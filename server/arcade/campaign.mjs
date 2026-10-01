import {randomBytes} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {openCampaignStore} from './campaign-store.mjs';
import {token,hash,equal,fingerprint,cookieValue,sessionCookie,readJson,verifyReplay} from './campaign-security.mjs';
import {xAuthorize,xIdentity} from './campaign-oauth.mjs';
import {xOAuth1Start,xOAuth1Identity} from './campaign-oauth1.mjs';
import {discordAuthorize,discordIdentity} from './campaign-discord.mjs';
import {farcasterIdentity} from './campaign-farcaster.mjs';
import {normalizeAddress} from './campaign-address.mjs';
import {campaignConfig} from './campaign-config.mjs';
import {BARRY,OPEN_ROUTES,addressWindow,canonicalReplay,campaignOpen,poolFull,routeOpen} from '../../lib/arcade/campaign-rules.mjs';
import {CUP_SEGMENT_TICKS,cupSnapshot,cupProgress} from '../../lib/arcade/bot-challenge.mjs';
import {FIGHT_SEGMENT_TICKS,rumbleSnapshot,rumbleProgress} from '../../lib/arcade/rumble-challenge.mjs';
import {CHARACTERS} from '../../lib/arcade/rumble-sim.mjs';

const DAY=86400000,MINUTE=60000;
/** Official runs stay open while segments keep arriving, within an overall limit. */
const RUN_IDLE=30*MINUTE,RUN_LIMIT=3*60*MINUTE;
const SEGMENT_TICKS={cup:CUP_SEGMENT_TICKS,rumble:FIGHT_SEGMENT_TICKS};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const parse=value=>value?JSON.parse(value):null;
const validCode=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16}$/.test(value);

export function createCampaignService(options){
  const store=openCampaignStore(options.dataDir),now=options.now||Date.now;
  const serviceToken=options.serviceToken,adminToken=options.adminToken;
  const origin=new URL(options.siteOrigin||'https://terminl.net').origin;
  const secure=origin.startsWith('https:'),redirectUri=origin+'/api/campaign/auth/callback';
  const clientId=options.xClientId,clientSecret=options.xClientSecret;
  const oauth1=options.xAuthMode==='oauth1',apiKey=options.xApiKey,apiSecret=options.xApiSecret;
  const xReady=oauth1?!!(apiKey&&apiSecret):!!(clientId&&clientSecret);
  const discordClientId=options.discordClientId,discordClientSecret=options.discordClientSecret;
  const discordReady=!!(discordClientId&&discordClientSecret),farcasterReady=options.farcasterEnabled!==false;
  const authReady=xReady||discordReady||farcasterReady;
  const providers={x:xReady,discord:discordReady,farcaster:farcasterReady};
  const startOAuth1=options.xOAuth1Start||xOAuth1Start,identifyOAuth1=options.xOAuth1Identity||xOAuth1Identity;
  const identifyDiscord=options.discordIdentity||discordIdentity,identifyFarcaster=options.farcasterIdentity||farcasterIdentity;
  const verify=options.verifyReplay||verifyReplay;
  const identify=options.xIdentity||xIdentity;
  const config=()=>campaignConfig(store.config());
  const json=(response,status,value,headers={})=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});response.end(JSON.stringify(value));};
  const redirect=(response,path,cookie)=>{response.writeHead(303,{Location:origin+path,'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})});response.end();};
  function session(request,response,create=false){
    const raw=cookieValue(request,'btb_session');
    let s=raw&&store.get('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',hash(raw),now());
    if(!s&&create){const value=token();s={token_hash:hash(value),anon_id:token(),user_id:null,ref_code:null,created_at:now(),expires_at:now()+30*DAY};
      store.run('INSERT INTO sessions(token_hash,anon_id,created_at,expires_at) VALUES(?,?,?,?)',s.token_hash,s.anon_id,s.created_at,s.expires_at);
      response.setHeader('Set-Cookie',sessionCookie(value,secure));}
    return s||null;
  }
  const user=s=>s?.user_id?store.get('SELECT * FROM users WHERE id=?',s.user_id):null;
  const accountId=(provider,id)=>provider==='x'?String(id):provider+':'+id;
  const publicIdentity=row=>(row.provider||'x')==='farcaster'?'FID #'+row.username.replace(/^fid/,''):'@'+row.username;
  const rate=(key,limit,windowMs)=>{if(!store.rate(key,limit,windowMs,now()))fail('Too many attempts. Please try again shortly.',429);};
  const progressSummary=row=>{const progress=row.progress?deserialize(row.progress):null;return row.kind==='cup'?cupProgress(progress):row.kind==='rumble'?rumbleProgress(progress):null;};
  const qualifiedSpots=()=>store.get("SELECT count(*) AS n FROM spots WHERE status='qualified'").n;
  function publicRun(code){
    const row=store.get(`SELECT r.*,u.provider,u.username,u.public_profile,u.status AS user_status,sp.status AS spot_status
      FROM runs r JOIN users u ON u.id=r.user_id JOIN spots sp ON sp.run_id=r.id WHERE r.code=?`,code);
    if(!row||row.invalidated||row.user_status!=='active'||row.spot_status!=='qualified')return null;
    return {code:row.code,kind:row.kind,player:row.public_profile?publicIdentity(row):'ANON',result:parse(row.result),challenge:parse(row.challenge),createdAt:row.completed_at,qualified:true};
  }
  function pointsFor(userId){
    return store.get(`SELECT coalesce(sum(r.points),0) AS n FROM runs r WHERE r.user_id=? AND r.invalidated=0 AND r.flags='[]'`,userId).n;
  }
  function pass(s){
    const u=user(s);if(!u)return null;
    const wallet=store.get('SELECT * FROM wallets WHERE user_id=?',u.id);
    const spots=store.all('SELECT sp.route,sp.status,sp.created_at,r.code FROM spots sp JOIN runs r ON r.id=sp.run_id WHERE sp.user_id=? ORDER BY sp.created_at',u.id);
    const runs=store.all(`SELECT id,kind,code,result,points,segments,progress,started_at,completed_at,expires_at,invalidated FROM runs
      WHERE user_id=? AND kind<>'sprint' AND (completed_at IS NOT NULL OR segments>0) ORDER BY coalesce(completed_at,last_segment_at) DESC LIMIT 20`,u.id);
    const points=pointsFor(u.id);
    const rank=points?store.get(`SELECT count(*)+1 AS n FROM (SELECT r.user_id FROM runs r JOIN users u ON u.id=r.user_id
      WHERE r.invalidated=0 AND r.flags='[]' AND u.status='active' GROUP BY r.user_id HAVING sum(r.points)>?)`,points).n:null;
    return {provider:u.provider||'x',username:u.username,name:u.name,publicProfile:!!u.public_profile,status:u.status,points,rank,
      spots:spots.map(sp=>({route:sp.route,status:sp.status,at:sp.created_at,code:sp.code})),
      runs:runs.map(r=>({id:r.id,kind:r.kind,code:r.code,result:parse(r.result),points:r.points,progress:progressSummary(r),at:r.completed_at||r.started_at,
        open:!r.completed_at&&r.expires_at>now(),invalidated:!!r.invalidated})),
      referrals:store.get('SELECT count(*) AS n FROM referrals WHERE referrer_id=?',u.id).n,
      wallet:wallet?{address:wallet.address,chainId:wallet.chain_id,updatedAt:wallet.updated_at}:null};
  }
  function claim(s,runId,publicProfile){
    if(typeof runId!=='string'||!/^[a-f0-9]{32}$/.test(runId))fail('Invalid run');
    return store.transaction(()=>{
      const u=user(s),r=store.get('SELECT * FROM runs WHERE id=?',runId);
      if(!u||u.status==='banned')fail('This account cannot save WL spots.',403);
      if(!r||r.anon_id!==s.anon_id||!parse(r.result)?.qualified||r.invalidated)fail('A verified, completed challenge is required.',403);
      if(r.user_id&&r.user_id!==u.id)fail('This run is already saved to another account.',409);
      store.run('UPDATE users SET public_profile=? WHERE id=?',publicProfile?1:0,u.id);
      store.run('UPDATE runs SET user_id=? WHERE id=?',u.id,r.id);
      const existing=store.get('SELECT sp.status,r.code FROM spots sp JOIN runs r ON r.id=sp.run_id WHERE sp.user_id=? AND sp.route=?',u.id,r.kind);
      if(existing)return {status:existing.status,code:existing.code,route:r.kind,already:true};
      const firstSpot=!store.get('SELECT 1 FROM spots WHERE user_id=?',u.id);
      const reused=store.get('SELECT count(DISTINCT user_id) AS n FROM runs WHERE anon_id=? AND user_id IS NOT NULL AND user_id<>?',s.anon_id,u.id).n;
      const status=u.status==='review'||parse(r.flags).length||reused>=2?'review':poolFull(config(),qualifiedSpots())?'waitlist':'qualified';
      store.run('INSERT INTO spots(user_id,route,run_id,status,created_at) VALUES(?,?,?,?,?)',u.id,r.kind,r.id,status,now());
      store.event('qualification_saved',{anonId:s.anon_id,userId:u.id,runId:r.id,detail:{status,route:r.kind}},now());
      const parent=firstSpot&&r.ref_code&&store.get(`SELECT r.user_id FROM runs r JOIN spots sp ON sp.run_id=r.id JOIN users u ON u.id=r.user_id WHERE r.code=? AND r.invalidated=0 AND sp.status='qualified' AND u.status='active'`,r.ref_code);
      if(status==='qualified'&&parent?.user_id&&parent.user_id!==u.id&&u.created_at>=r.started_at){
        store.run('INSERT OR IGNORE INTO referrals(referred_id,referrer_id,run_id,created_at) VALUES(?,?,?,?)',u.id,parent.user_id,r.id,now());
        store.event('referred_player_qualified',{anonId:s.anon_id,userId:u.id,runId:r.id},now());
      }
      return {status,code:r.code,route:r.kind,already:false};
    });
  }
  function signedInSession(s,provider,identity){
    const id=accountId(provider,identity.id),fresh=token();
    store.transaction(()=>{
      store.run(`INSERT INTO users(id,username,name,provider,created_at,last_seen) VALUES(?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET username=excluded.username,name=excluded.name,provider=excluded.provider,last_seen=excluded.last_seen`,id,identity.username,identity.name,provider,now(),now());
      store.run('INSERT INTO sessions(token_hash,anon_id,user_id,ref_code,created_at,expires_at) VALUES(?,?,?,?,?,?)',hash(fresh),s.anon_id,id,s.ref_code,now(),now()+30*DAY);
      store.run('DELETE FROM sessions WHERE token_hash=?',s.token_hash);
      // Official runs played before signing in count toward this account's points.
      store.run('UPDATE runs SET user_id=? WHERE anon_id=? AND user_id IS NULL',id,s.anon_id);
    });
    return {fresh,session:{...s,user_id:id,token_hash:hash(fresh)},userId:id};
  }
  async function handle(request,response){
    const url=new URL(request.url,'http://arcade.internal'),path=url.pathname.replace(/^\/campaign/,'');
    if(!url.pathname.startsWith('/campaign/'))return false;
    try{
      if(!serviceToken||!equal(request.headers.authorization,`Bearer ${serviceToken}`))fail('Not found',404);
      const network=fingerprint(serviceToken,request.headers['x-campaign-client']||'unknown');
      rate('network:'+network,240,60000);
      if(!['GET','POST'].includes(request.method))fail('Method not allowed',405);
      if(request.method==='POST'&&request.headers.origin!==origin)fail('Origin rejected',403);
      if(path.startsWith('/admin')){
        rate('admin:'+network,20,60000);
        if(!adminToken||!equal(request.headers['x-campaign-admin'],adminToken))fail('Not found',404);
        if(path==='/admin/addresses'&&request.method==='GET'){
          const addresses=store.all(`SELECT w.address,w.chain_id,w.updated_at,count(*) AS spots,group_concat(sp.route,' ') AS routes FROM wallets w
            JOIN spots sp ON sp.user_id=w.user_id JOIN users u ON u.id=w.user_id JOIN runs r ON r.id=sp.run_id
            WHERE sp.status='qualified' AND u.status='active' AND r.invalidated=0 GROUP BY w.user_id ORDER BY w.address`);
          const c=config(),frozen=!!c.addressEndsAt&&now()>=c.addressEndsAt;
          store.audit('admin','address_export',{count:addresses.length,frozen},now());
          return json(response,200,{exportedAt:now(),frozen,addresses});
        }
        if(path==='/admin'&&request.method==='GET'){
          const funnel=store.all('SELECT name,count(*) AS total,count(DISTINCT anon_id) AS players FROM events WHERE at>=? GROUP BY name',now()-30*DAY);
          return json(response,200,{config:config(),authReady,providers,funnel,spots:store.all('SELECT route,status,count(*) AS n FROM spots GROUP BY route,status'),
            users:store.all(`SELECT u.id,u.provider,u.username,u.status,group_concat(sp.route||':'||sp.status,' ') AS spots,
              (SELECT coalesce(sum(points),0) FROM runs WHERE user_id=u.id AND invalidated=0 AND flags='[]') AS points,w.address
              FROM users u LEFT JOIN spots sp ON sp.user_id=u.id LEFT JOIN wallets w ON w.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`),
            audit:store.all('SELECT * FROM audit ORDER BY id DESC LIMIT 60')});
        }
        const body=await readJson(request,16000);
        if(path==='/admin/settings'&&request.method==='POST'){
          const next=campaignConfig(body.config);if(next.active&&!authReady)fail('Configure at least one sign-in provider before opening WL challenges.',409);
          store.transaction(()=>{const previous=config();store.run('UPDATE settings SET value=? WHERE id=1',JSON.stringify(next));store.audit('admin','settings',{previous,next},now());});
          return json(response,200,{config:next});
        }
        if(path==='/admin/review'&&request.method==='POST'){
          if(!['qualified','review','banned'].includes(body.status)||typeof body.userId!=='string'||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>300)fail('Choose a status and give an audit reason.');
          store.transaction(()=>{
            // A review decision applies to every WL spot the account holds.
            const spots=store.all('SELECT * FROM spots WHERE user_id=?',body.userId);if(!spots.length)fail('No WL spots found for that user',404);
            const approving=spots.filter(sp=>sp.status!=='qualified').length;
            if(body.status==='qualified'&&approving&&poolFull(config(),qualifiedSpots()+approving-1))fail('The WL pool is full.',409);
            store.run('UPDATE spots SET status=? WHERE user_id=?',body.status,body.userId);
            store.run('UPDATE users SET status=? WHERE id=?',body.status==='banned'?'banned':'active',body.userId);
            if(body.status!=='qualified')store.run('DELETE FROM referrals WHERE referred_id=? OR referrer_id=?',body.userId,body.userId);
            store.audit('admin','spot_review',{userId:body.userId,status:body.status,reason:body.reason,routes:spots.map(sp=>sp.route)},now());
          });return json(response,200,{ok:true});
        }
        fail('Not found',404);
      }
      if(path==='/config'&&request.method==='GET'){
        const c=config(),open=campaignOpen(c,now())&&authReady;
        return json(response,200,{config:c,open,routes:Object.fromEntries(OPEN_ROUTES.map(route=>[route,open&&routeOpen(c,route,now())])),authReady,providers,bot:BARRY,serverTime:now(),claimed:qualifiedSpots(),capacity:c.capacity});
      }
      if(path.startsWith('/results/')&&request.method==='GET'){
        const code=path.slice(9);if(!validCode(code))fail('Challenge not found',404);
        const r=publicRun(code);if(!r)fail('Challenge not found',404);return json(response,200,r);
      }
      if(path==='/leaderboard'&&request.method==='GET'){
        const rows=store.all(`SELECT u.id,u.provider,u.username,u.public_profile,sum(r.points) AS points,max(r.last_segment_at) AS last
          FROM runs r JOIN users u ON u.id=r.user_id WHERE r.invalidated=0 AND r.flags='[]' AND u.status='active' AND r.points>0
          GROUP BY u.id ORDER BY points DESC,last ASC LIMIT 50`);
        const spots=rows.length?store.all(`SELECT user_id,route FROM spots WHERE status='qualified' AND user_id IN (${rows.map(()=>'?').join(',')})`,...rows.map(row=>row.id)):[];
        // Ties share a rank; earlier scoring breaks display order only.
        let rank=0;
        const entries=rows.map((row,index)=>{if(!index||row.points<rows[index-1].points)rank=index+1;
          return {rank,player:row.public_profile?publicIdentity(row):'ANON',points:row.points,spots:spots.filter(sp=>sp.user_id===row.id).map(sp=>sp.route).sort()};});
        return json(response,200,{entries});
      }
      let s=session(request,response,path==='/session');
      if(!s)fail('Start a fresh challenge to continue.',401);
      if(path==='/session'&&request.method==='GET')return json(response,200,{pass:pass(s)});
      if(path==='/me'&&request.method==='GET')return json(response,200,{pass:pass(s)});
      if(path==='/auth/callback'&&request.method==='GET'){
        rate('oauth-callback:'+s.anon_id,24,3600000);
        const state=url.searchParams.get('state'),requestToken=url.searchParams.get('oauth_token')||url.searchParams.get('denied');
        if(state&&requestToken)fail('Invalid sign-in callback.',403);
        const lookup=requestToken?'oauth1:'+requestToken:state;
        const record=lookup&&lookup.length<=512&&store.get('SELECT * FROM oauth_states WHERE state_hash=?',hash(lookup));
        if(!record||record.session_hash!==s.token_hash||record.expires_at<now())fail('Sign-in expired. Return to your run and try again.',403);
        const provider=record.provider||'x';
        if(requestToken&&provider!=='x')fail('Invalid sign-in callback.',403);
        store.run('DELETE FROM oauth_states WHERE state_hash=?',record.state_hash);
        const returnQuery=`&provider=${encodeURIComponent(provider)}${record.run_id?'&run='+encodeURIComponent(record.run_id):''}`;
        if(url.searchParams.has('error')||url.searchParams.has('denied'))return redirect(response,`/arcade-pass?auth=cancelled${returnQuery}`);
        const code=url.searchParams.get(requestToken?'oauth_verifier':'code');if(!code||code.length>2048)fail('The identity provider did not return an authorization code');
        let identity;try{
          if(provider==='discord')identity=await identifyDiscord({clientId:discordClientId,clientSecret:discordClientSecret,redirectUri,code});
          else identity=requestToken
            ?await identifyOAuth1({apiKey,apiSecret,requestToken,tokenSecret:record.verifier,verifier:code})
            :await identify({clientId,clientSecret,redirectUri,code,verifier:record.verifier});
        }
        catch(error){
          const detail={stage:error.oauthStage||'identity',status:error.providerStatus||0,code:error.providerCode||'internal',reason:error.providerReason||'unspecified',...(Number.isSafeInteger(error.providerErrorNumber)?{providerErrorNumber:error.providerErrorNumber}:{})};
          console.error(JSON.stringify({event:provider+'_oauth_fail',...detail}));
          store.event(provider+'_oauth_fail',{anonId:s.anon_id,detail},now());return redirect(response,`/arcade-pass?auth=failed${returnQuery}`);
        }
        const login=signedInSession(s,provider,identity);s=login.session;
        let saved=null;try{if(record.run_id)saved=claim(s,record.run_id,!!record.public_profile);}catch(error){store.event('claim_failed',{anonId:s.anon_id,userId:login.userId,runId:record.run_id},now());}
        store.event(provider+'_oauth_success',{anonId:s.anon_id,userId:login.userId},now());
        return redirect(response,`/arcade-pass${saved?'?saved='+encodeURIComponent(saved.code):record.run_id?'?run='+encodeURIComponent(record.run_id):''}`,sessionCookie(login.fresh,secure));
      }
      if(path.startsWith('/runs/')&&request.method==='GET'){
        const row=store.get('SELECT * FROM runs WHERE id=?',path.slice(6));if(!row||row.anon_id!==s.anon_id&&(!s.user_id||row.user_id!==s.user_id))fail('Run not found',404);
        const spot=row.user_id&&store.get('SELECT status FROM spots WHERE run_id=?',row.id);
        return json(response,200,{id:row.id,kind:row.kind,result:parse(row.result),challenge:parse(row.challenge),progress:progressSummary(row),segments:row.segments,
          open:!row.completed_at&&row.expires_at>now(),code:spot?row.code:null,saved:!!spot});
      }
      if(request.method!=='POST')fail('Not found',404);
      const body=await readJson(request);
      if(path==='/runs'){
        rate('start:'+s.anon_id,12,600000);rate('start-net:'+network,45,600000);
        const kind=body.kind;if(!OPEN_ROUTES.includes(kind))fail('Choose the Barry Cup or the Rekt Rumble Circuit.');
        if(kind==='rumble'&&!Object.hasOwn(CHARACTERS,body.character))fail('Choose a fighter.');
        if(!routeOpen(config(),kind,now())||!authReady)fail('This official challenge is not open. The free arcade is still playable.',409);
        if(user(s)?.status==='banned')fail('This account cannot enter official challenges.',403);
        let ref=s.ref_code;
        if(!ref&&validCode(body.ref)&&publicRun(body.ref)){ref=body.ref;store.run('UPDATE sessions SET ref_code=? WHERE token_hash=?',ref,s.token_hash);}
        const id=randomBytes(16).toString('hex'),code=randomBytes(12).toString('base64url'),seed=randomBytes(4).readUInt32BE();
        const challenge=kind==='cup'?cupSnapshot(config(),seed):rumbleSnapshot(body.character,seed);
        const started=now(),expires=started+RUN_IDLE;
        store.run('INSERT INTO runs(id,anon_id,user_id,kind,challenge,started_at,last_segment_at,expires_at,code,ref_code) VALUES(?,?,?,?,?,?,?,?,?,?)',id,s.anon_id,s.user_id,kind,JSON.stringify(challenge),started,started,expires,code,ref);
        store.event('challenge_start',{anonId:s.anon_id,userId:s.user_id,runId:id,detail:{route:kind}},now());
        if(ref)store.event('referred_player_started',{anonId:s.anon_id,runId:id},now());
        return json(response,201,{id,kind,challenge,expiresAt:expires,startedAt:started});
      }
      if(path==='/submit'){
        rate('submit:'+s.anon_id,40,600000);
        const row=store.get('SELECT * FROM runs WHERE id=?',typeof body.runId==='string'?body.runId:'');
        if(!row||row.anon_id!==s.anon_id||row.kind==='sprint')fail('Run not found',404);
        const accepted=r=>({id:r.id,kind:r.kind,segments:r.segments,points:r.points,progress:progressSummary(r),result:parse(r.result),verified:true});
        // Segments arrive in order. A repeat of an accepted segment is answered, not replayed.
        if(!Number.isInteger(body.segment)||body.segment<0)fail('Invalid segment',422);
        if(body.segment<row.segments)return json(response,200,{...accepted(row),duplicate:true});
        if(row.completed_at)fail('This run is already complete.',409);
        if(body.segment>row.segments)fail('Submit the earlier result first.',409);
        if(row.expires_at<now())fail('This attempt expired. Start another run.',410);
        if(!Array.isArray(body.replay)||body.replay.length>SEGMENT_TICKS[row.kind])fail('Invalid replay',422);
        const challenge=parse(row.challenge),out=await verify(challenge,row.progress?deserialize(row.progress):null,body.replay);
        if(now()-row.last_segment_at<out.ticks*1000/60-2000)fail('The run finished faster than real time allows.',422);
        // Winning inputs shared between browsers are flagged; idle losses are naturally identical.
        const replayHash=hash(JSON.stringify([row.kind,canonicalReplay(body.replay,out.ticks)]));
        const duplicate=out.segment.won&&store.get('SELECT 1 FROM replay_hashes WHERE hash=? AND anon_id<>? LIMIT 1',replayHash,s.anon_id);
        const saved=store.transaction(()=>{
          const current=store.get('SELECT * FROM runs WHERE id=?',row.id);
          if(current.segments!==row.segments)return current;
          const flags=parse(current.flags);if(duplicate&&!flags.includes('repeated_inputs'))flags.push('repeated_inputs');
          const at=now(),done=!!out.result;
          store.run(`UPDATE runs SET progress=?,segments=segments+1,points=points+?,last_segment_at=?,expires_at=?,flags=?,
            completed_at=?,result=?,replay_hash=? WHERE id=?`,serialize(out.state),out.points,at,Math.min(at+RUN_IDLE,current.started_at+RUN_LIMIT),JSON.stringify(flags),
            done?at:null,done?JSON.stringify(out.result):null,replayHash,row.id);
          if(out.segment.won)store.run('INSERT OR IGNORE INTO replay_hashes(hash,anon_id,run_id) VALUES(?,?,?)',replayHash,s.anon_id,row.id);
          store.event(row.kind==='cup'?'cup_race_complete':'rumble_fight_complete',{anonId:s.anon_id,userId:current.user_id,runId:row.id,detail:{won:out.segment.won}},at);
          if(done)store.event(out.result.qualified?'qualification_earned':'challenge_fail',{anonId:s.anon_id,userId:current.user_id,runId:row.id,detail:{route:row.kind}},at);
          return store.get('SELECT * FROM runs WHERE id=?',row.id);
        });
        return json(response,200,{...accepted(saved),segment:saved.segments===row.segments+1?out.segment:null});
      }
      if(path==='/auth/start'){
        const provider=body.provider===undefined?'x':body.provider;
        if(!['x','discord','farcaster'].includes(provider))fail('Unknown sign-in provider');
        rate((provider==='farcaster'?'farcaster-start:':'oauth-start:')+s.anon_id,provider==='farcaster'?30:12,3600000);
        if(!providers[provider])fail(provider[0].toUpperCase()+provider.slice(1)+' sign-in is not available yet.',503);
        if(body.runId!==undefined&&(typeof body.runId!=='string'||!/^[a-f0-9]{32}$/.test(body.runId)))fail('Invalid run');
        if(body.runId){const r=store.get('SELECT * FROM runs WHERE id=?',body.runId);if(!r||r.anon_id!==s.anon_id||!parse(r.result)?.qualified)fail('Complete a verified challenge before saving a WL spot.',403);}
        if(provider==='farcaster'){
          const nonce=randomBytes(16).toString('hex');
          store.run('INSERT INTO oauth_states(state_hash,session_hash,run_id,verifier,provider,public_profile,expires_at) VALUES(?,?,?,?,?,?,?)',hash(nonce),s.token_hash,body.runId||null,'',provider,body.publicProfile===true?1:0,now()+10*60000);
          store.event('farcaster_auth_start',{anonId:s.anon_id,runId:body.runId||null},now());
          return json(response,200,{provider,nonce,expiresAt:now()+10*60000});
        }
        let state=token(),verifier=token(),authorizeUrl;
        if(provider==='discord')authorizeUrl=discordAuthorize({clientId:discordClientId,redirectUri,state});
        else if(oauth1){
          try{const pending=await startOAuth1({apiKey,apiSecret,redirectUri});state='oauth1:'+pending.requestToken;verifier=pending.tokenSecret;authorizeUrl=pending.url;}
          catch(error){console.error(JSON.stringify({event:'x_oauth_fail',stage:error.oauthStage||'request_token',status:error.providerStatus||0,code:error.providerCode||'internal'}));fail('X sign-in is temporarily unavailable. Your run is still saved.',503);}
        }else authorizeUrl=xAuthorize({clientId,redirectUri,state,verifier});
        store.run('INSERT INTO oauth_states(state_hash,session_hash,run_id,verifier,provider,public_profile,expires_at) VALUES(?,?,?,?,?,?,?)',hash(state),s.token_hash,body.runId||null,verifier,provider,body.publicProfile===true?1:0,now()+10*60000);
        store.event(provider+'_oauth_start',{anonId:s.anon_id,runId:body.runId||null},now());
        return json(response,200,{provider,url:authorizeUrl});
      }
      if(path==='/auth/complete'){
        rate('farcaster-complete:'+s.anon_id,12,3600000);
        if(body.provider!=='farcaster'||typeof body.nonce!=='string'||body.nonce.length>128)fail('Invalid Farcaster sign-in');
        const record=store.get('SELECT * FROM oauth_states WHERE state_hash=?',hash(body.nonce));
        if(!record||record.provider!=='farcaster'||record.session_hash!==s.token_hash||record.expires_at<now())fail('Sign-in expired. Return to your run and try again.',403);
        store.run('DELETE FROM oauth_states WHERE state_hash=?',record.state_hash);
        let identity;try{identity=await identifyFarcaster({nonce:body.nonce,domain:new URL(origin).host,uri:origin+'/arcade-pass',message:body.message,signature:body.signature,rpcUrl:options.farcasterRpcUrl});}
        catch(error){
          const detail={stage:error.oauthStage||'signature',status:error.providerStatus||0,code:error.providerCode||'invalid_signature'};
          console.error(JSON.stringify({event:'farcaster_auth_fail',...detail}));store.event('farcaster_auth_fail',{anonId:s.anon_id,detail},now());
          fail('Farcaster sign-in could not be verified. Your run is still saved.',403);
        }
        const login=signedInSession(s,'farcaster',identity);s=login.session;
        let saved=null;try{if(record.run_id)saved=claim(s,record.run_id,!!record.public_profile);}catch{store.event('claim_failed',{anonId:s.anon_id,userId:login.userId,runId:record.run_id},now());}
        store.event('farcaster_auth_success',{anonId:s.anon_id,userId:login.userId},now());
        return json(response,200,{saved:saved?.code||null,runId:record.run_id||null,pass:pass(s)},{'Set-Cookie':sessionCookie(login.fresh,secure)});
      }
      if(path==='/claim'){
        rate('claim:'+s.anon_id,12,600000);const result=claim(s,body.runId,body.publicProfile===true);return json(response,200,{...result,pass:pass(s)});
      }
      if(path==='/profile'){
        const u=user(s);if(!u)fail('Sign in to update your profile.',401);
        store.run('UPDATE users SET public_profile=? WHERE id=?',body.publicProfile===true?1:0,u.id);return json(response,200,{pass:pass(s)});
      }
      if(path==='/wallet'){
        const u=user(s),spot=u&&store.get("SELECT 1 FROM spots WHERE user_id=? AND status='qualified'",u.id),c=config();
        if(!u||u.status!=='active'||!spot)fail('Save a WL spot before adding a mint address.',403);
        rate('address:'+u.id,8,3600000);
        if(!addressWindow(c,now()).open)fail('Address submission is closed.',409);
        if(body.chainId!==c.chainId||body.confirmed!==true)fail('Confirm this address is for Robinhood Chain mainnet.');
        const address=normalizeAddress(body.address);
        store.transaction(()=>{
          const used=store.get('SELECT user_id FROM wallets WHERE address=?',address);if(used&&used.user_id!==u.id)fail('This address is already registered.',409);
          const previous=store.get('SELECT address FROM wallets WHERE user_id=?',u.id);
          store.run('INSERT INTO wallets(user_id,address,chain_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET address=excluded.address,updated_at=excluded.updated_at',u.id,address,c.chainId,now());
          store.audit(u.id,'wallet_saved',{previous:previous?.address||null,address},now());
          store.event(previous?'wallet_updated':'wallet_submitted',{anonId:s.anon_id,userId:u.id},now());
        });return json(response,200,{pass:pass(s)});
      }
      if(path==='/events'){
        rate('events:'+s.anon_id,45,60000);
        if(!['arcade_view','challenge_view','save_access_click','share_click','challenge_link_opened','leaderboard_view','wallet_submission_view'].includes(body.name))fail('Unknown event');
        store.event(body.name,{anonId:s.anon_id,userId:s.user_id,detail:validCode(body.code)?{code:body.code}:{},once:`${body.name}:${s.anon_id}:${Math.floor(now()/DAY)}:${validCode(body.code)?body.code:''}`},now());
        return json(response,200,{ok:true});
      }
      if(path==='/logout'){store.run('DELETE FROM sessions WHERE token_hash=?',s.token_hash);response.setHeader('Set-Cookie',sessionCookie('',secure,0));return json(response,200,{ok:true});}
      fail('Not found',404);
    }catch(error){
      if(!error.status)console.error(JSON.stringify({event:'campaign_request_failed',path,code:error.code||'internal'}));
      if(!response.headersSent)json(response,error.status||500,{error:error.status?error.message:'The campaign is temporarily unavailable. Your saved wins are safe.'});
      return true;
    }
    return true;
  }
  return {handle,store,close:()=>store.close(),configured:!!serviceToken&&authReady};
}
