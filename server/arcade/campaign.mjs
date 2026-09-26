import {randomBytes} from 'node:crypto';
import {openCampaignStore} from './campaign-store.mjs';
import {token,hash,equal,fingerprint,cookieValue,sessionCookie,readJson,verifyReplay} from './campaign-security.mjs';
import {xAuthorize,xIdentity} from './campaign-oauth.mjs';
import {normalizeAddress} from './campaign-address.mjs';
import {BARRY,campaignConfig,campaignOpen,challengeSnapshot} from '../../lib/arcade/bot-challenge.mjs';

const DAY=86400000;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const parse=value=>value?JSON.parse(value):null;
const validCode=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16}$/.test(value);

export function createCampaignService(options){
  const store=openCampaignStore(options.dataDir),now=options.now||Date.now;
  const serviceToken=options.serviceToken,adminToken=options.adminToken;
  const origin=new URL(options.siteOrigin||'https://terminl.net').origin;
  const secure=origin.startsWith('https:'),redirectUri=origin+'/api/campaign/auth/callback';
  const clientId=options.xClientId,clientSecret=options.xClientSecret;
  const oauthReady=!!(clientId&&clientSecret);
  const verify=options.verifyReplay||verifyReplay;
  const identify=options.xIdentity||xIdentity;
  const config=()=>store.config();
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
  const rate=(key,limit,windowMs)=>{if(!store.rate(key,limit,windowMs,now()))fail('Too many attempts. Please try again shortly.',429);};
  function publicRun(code){
    const row=store.get(`SELECT r.*,u.username,u.public_profile,u.status AS user_status,q.status AS access_status
      FROM runs r JOIN users u ON u.id=r.user_id JOIN qualifications q ON q.user_id=u.id WHERE r.code=?`,code);
    if(!row||row.invalidated||row.user_status!=='active'||row.access_status!=='qualified')return null;
    return {code:row.code,player:row.public_profile?'@'+row.username:'ANON',result:parse(row.result),challenge:parse(row.challenge),createdAt:row.completed_at,qualified:true};
  }
  function pass(s){
    const u=user(s);if(!u)return null;
    const q=store.get('SELECT * FROM qualifications WHERE user_id=?',u.id),wallet=store.get('SELECT * FROM wallets WHERE user_id=?',u.id);
    const runs=store.all('SELECT id,code,result,completed_at,challenge,invalidated FROM runs WHERE user_id=? AND result IS NOT NULL ORDER BY completed_at DESC LIMIT 20',u.id);
    return {username:u.username,name:u.name,publicProfile:!!u.public_profile,status:u.status,qualification:q?{status:q.status,at:q.created_at}:null,
      runs:runs.map(r=>({id:r.id,code:r.code,result:parse(r.result),challenge:parse(r.challenge),at:r.completed_at,invalidated:!!r.invalidated})),
      referrals:store.get('SELECT count(*) AS n FROM referrals WHERE referrer_id=?',u.id).n,
      wallet:wallet?{address:wallet.address,chainId:wallet.chain_id,updatedAt:wallet.updated_at}:null};
  }
  function claim(s,runId,publicProfile){
    if(typeof runId!=='string'||!/^[a-f0-9]{32}$/.test(runId))fail('Invalid run');
    return store.transaction(()=>{
      const u=user(s),r=store.get('SELECT * FROM runs WHERE id=?',runId);
      if(!u||u.status==='banned')fail('This account cannot save access.',403);
      if(!r||r.anon_id!==s.anon_id||!parse(r.result)?.qualified||r.invalidated)fail('A verified winning run is required.',403);
      if(r.user_id&&r.user_id!==u.id)fail('This run is already saved to another account.',409);
      store.run('UPDATE users SET public_profile=? WHERE id=?',publicProfile?1:0,u.id);
      store.run('UPDATE runs SET user_id=? WHERE id=?',u.id,r.id);
      let q=store.get('SELECT * FROM qualifications WHERE user_id=?',u.id);
      if(!q){
        const capacity=store.get("SELECT count(*) AS n FROM qualifications WHERE status='qualified'").n;
        const reused=store.get('SELECT count(DISTINCT user_id) AS n FROM runs WHERE anon_id=? AND user_id IS NOT NULL AND user_id<>?',s.anon_id,u.id).n;
        const status=u.status==='review'||parse(r.flags).length||reused>=2?'review':capacity>=config().capacity?'waitlist':'qualified';
        store.run('INSERT INTO qualifications(user_id,run_id,status,created_at) VALUES(?,?,?,?)',u.id,r.id,status,now());
        q={status};
        store.event('qualification_saved',{anonId:s.anon_id,userId:u.id,runId:r.id,detail:{status}},now());
        const parent=r.ref_code&&store.get(`SELECT r.user_id FROM runs r JOIN qualifications q ON q.user_id=r.user_id JOIN users u ON u.id=r.user_id WHERE r.code=? AND r.invalidated=0 AND q.status='qualified' AND u.status='active'`,r.ref_code);
        if(status==='qualified'&&parent?.user_id!==u.id&&parent?.user_id&&u.created_at>=r.started_at){
          store.run('INSERT OR IGNORE INTO referrals(referred_id,referrer_id,run_id,created_at) VALUES(?,?,?,?)',u.id,parent.user_id,r.id,now());
          store.event('referred_player_qualified',{anonId:s.anon_id,userId:u.id,runId:r.id},now());
        }
      }
      return {status:q.status,code:r.code};
    });
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
          const addresses=store.all(`SELECT w.address,w.chain_id,w.updated_at FROM wallets w
            JOIN qualifications q ON q.user_id=w.user_id JOIN users u ON u.id=w.user_id
            JOIN runs r ON r.id=q.run_id
            WHERE q.status='qualified' AND u.status='active' AND r.invalidated=0 ORDER BY w.address`);
          const c=config(),frozen=!!c.addressEndsAt&&now()>=c.addressEndsAt;
          store.audit('admin','address_export',{count:addresses.length,frozen},now());
          return json(response,200,{exportedAt:now(),frozen,addresses});
        }
        if(path==='/admin'&&request.method==='GET'){
          const funnel=store.all('SELECT name,count(*) AS total,count(DISTINCT anon_id) AS players FROM events WHERE at>=? GROUP BY name',now()-30*DAY);
          return json(response,200,{config:config(),oauthReady,funnel,
            users:store.all(`SELECT u.id,u.username,u.status,q.status AS qualification_status,q.created_at,w.address FROM users u LEFT JOIN qualifications q ON q.user_id=u.id LEFT JOIN wallets w ON w.user_id=u.id ORDER BY u.created_at DESC LIMIT 100`),
            audit:store.all('SELECT * FROM audit ORDER BY id DESC LIMIT 60')});
        }
        const body=await readJson(request,16000);
        if(path==='/admin/settings'&&request.method==='POST'){
          const next=campaignConfig(body.config);if(next.active&&!oauthReady)fail('Configure the X OAuth app before opening qualification.',409);
          store.transaction(()=>{const previous=config();store.run('UPDATE settings SET value=? WHERE id=1',JSON.stringify(next));store.audit('admin','settings',{previous,next},now());});
          return json(response,200,{config:next});
        }
        if(path==='/admin/review'&&request.method==='POST'){
          if(!['qualified','review','banned'].includes(body.status)||typeof body.userId!=='string'||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>300)fail('Choose a status and give an audit reason.');
          store.transaction(()=>{
            const q=store.get('SELECT * FROM qualifications WHERE user_id=?',body.userId);if(!q)fail('Qualification not found',404);
            if(body.status==='qualified'&&q.status!=='qualified'&&store.get("SELECT count(*) AS n FROM qualifications WHERE status='qualified'").n>=config().capacity)fail('The access pool is full.',409);
            store.run('UPDATE qualifications SET status=? WHERE user_id=?',body.status,body.userId);
            store.run('UPDATE users SET status=? WHERE id=?',body.status==='banned'?'banned':'active',body.userId);
            if(body.status!=='qualified')store.run('DELETE FROM referrals WHERE referred_id=? OR referrer_id=?',body.userId,body.userId);
            store.audit('admin','qualification_review',{userId:body.userId,status:body.status,reason:body.reason},now());
          });return json(response,200,{ok:true});
        }
        fail('Not found',404);
      }
      if(path==='/config'&&request.method==='GET'){
        const c=config();return json(response,200,{config:c,open:campaignOpen(c,now())&&oauthReady,oauthReady,bot:BARRY,serverTime:now(),qualified:store.get("SELECT count(*) AS n FROM qualifications WHERE status='qualified'").n});
      }
      if(path.startsWith('/results/')&&request.method==='GET'){
        const code=path.slice(9);if(!validCode(code))fail('Challenge not found',404);
        const r=publicRun(code);if(!r)fail('Challenge not found',404);return json(response,200,r);
      }
      if(path==='/leaderboard'&&request.method==='GET'){
        const since=url.searchParams.get('period')==='day'?Math.floor(now()/DAY)*DAY:0;
        const rows=store.all(`SELECT * FROM (SELECT r.code,r.result,r.completed_at,u.username,u.public_profile,
          row_number() OVER(PARTITION BY r.user_id ORDER BY json_extract(r.result,'$.playerTicks') ASC) AS personal_rank
          FROM runs r JOIN users u ON u.id=r.user_id JOIN qualifications q ON q.user_id=u.id
          WHERE r.invalidated=0 AND q.status='qualified' AND u.status='active' AND r.completed_at>=? AND json_extract(r.result,'$.qualified')=1
          AND json_extract(r.challenge,'$.track')=? AND json_extract(r.challenge,'$.vehicle')=? AND json_extract(r.challenge,'$.version')=1
          ) WHERE personal_rank=1 ORDER BY json_extract(result,'$.playerTicks') ASC LIMIT 20`,since,config().track,config().vehicle);
        const entries=rows.map((row,index)=>({rank:index+1,code:row.code,player:row.public_profile?'@'+row.username:'ANON',result:parse(row.result)}));
        return json(response,200,{entries,period:since?'day':'all',track:config().track,vehicle:config().vehicle});
      }
      let s=session(request,response,path==='/session');
      if(!s)fail('Start a fresh challenge to continue.',401);
      if(path==='/session'&&request.method==='GET')return json(response,200,{pass:pass(s)});
      if(path==='/me'&&request.method==='GET')return json(response,200,{pass:pass(s)});
      if(path==='/auth/callback'&&request.method==='GET'){
        rate('oauth:'+s.anon_id,12,3600000);
        const state=url.searchParams.get('state'),record=state&&store.get('SELECT * FROM oauth_states WHERE state_hash=?',hash(state));
        if(!record||record.session_hash!==s.token_hash||record.expires_at<now())fail('Sign-in expired. Return to your run and try again.',403);
        store.run('DELETE FROM oauth_states WHERE state_hash=?',record.state_hash);
        if(url.searchParams.has('error'))return redirect(response,`/arcade-pass?auth=cancelled${record.run_id?'&run='+encodeURIComponent(record.run_id):''}`);
        const code=url.searchParams.get('code');if(!code||code.length>2048)fail('X did not return an authorization code');
        let identity;try{identity=await identify({clientId,clientSecret,redirectUri,code,verifier:record.verifier});}
        catch(error){store.event('x_oauth_fail',{anonId:s.anon_id},now());return redirect(response,`/arcade-pass?auth=failed${record.run_id?'&run='+encodeURIComponent(record.run_id):''}`);}
        const fresh=token();
        store.transaction(()=>{
          store.run(`INSERT INTO users(id,username,name,created_at,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,name=excluded.name,last_seen=excluded.last_seen`,identity.id,identity.username,identity.name,now(),now());
          store.run('INSERT INTO sessions(token_hash,anon_id,user_id,ref_code,created_at,expires_at) VALUES(?,?,?,?,?,?)',hash(fresh),s.anon_id,identity.id,s.ref_code,now(),now()+30*DAY);
          store.run('DELETE FROM sessions WHERE token_hash=?',s.token_hash);
        });
        s={...s,user_id:identity.id,token_hash:hash(fresh)};
        let saved=null;try{if(record.run_id)saved=claim(s,record.run_id,!!record.public_profile);}catch(error){store.event('claim_failed',{anonId:s.anon_id,userId:identity.id,runId:record.run_id},now());}
        store.event('x_oauth_success',{anonId:s.anon_id,userId:identity.id},now());
        return redirect(response,`/arcade-pass${saved?'?saved='+encodeURIComponent(saved.code):record.run_id?'?run='+encodeURIComponent(record.run_id):''}`,sessionCookie(fresh,secure));
      }
      if(path.startsWith('/runs/')&&request.method==='GET'){
        const row=store.get('SELECT * FROM runs WHERE id=?',path.slice(6));if(!row||row.anon_id!==s.anon_id&&(!s.user_id||row.user_id!==s.user_id))fail('Run not found',404);
        return json(response,200,{id:row.id,result:parse(row.result),challenge:parse(row.challenge),code:row.user_id?row.code:null,saved:!!row.user_id});
      }
      if(request.method!=='POST')fail('Not found',404);
      const body=await readJson(request);
      if(path==='/runs'){
        rate('start:'+s.anon_id,12,600000);rate('start-net:'+network,45,600000);
        if(!campaignOpen(config(),now())||!oauthReady)fail('Official challenges are not open. The free arcade is still playable.',409);
        if(user(s)?.status==='banned')fail('This account cannot enter official challenges.',403);
        let ref=s.ref_code;
        if(!ref&&validCode(body.ref)&&publicRun(body.ref)){ref=body.ref;store.run('UPDATE sessions SET ref_code=? WHERE token_hash=?',ref,s.token_hash);}
        const id=randomBytes(16).toString('hex'),code=randomBytes(12).toString('base64url');
        const challenge=challengeSnapshot(config(),randomBytes(4).readUInt32BE());
        const started=now(),expires=started+20*60000;
        store.run('INSERT INTO runs(id,anon_id,challenge,started_at,expires_at,code,ref_code) VALUES(?,?,?,?,?,?,?)',id,s.anon_id,JSON.stringify(challenge),started,expires,code,ref);
        store.event('challenge_start',{anonId:s.anon_id,userId:s.user_id,runId:id},now());
        if(ref)store.event('referred_player_started',{anonId:s.anon_id,runId:id},now());
        return json(response,201,{id,challenge,expiresAt:expires,startedAt:started});
      }
      if(path==='/submit'){
        rate('submit:'+s.anon_id,15,600000);
        const row=store.get('SELECT * FROM runs WHERE id=?',typeof body.runId==='string'?body.runId:'');
        if(!row||row.anon_id!==s.anon_id)fail('Run not found',404);
        if(row.completed_at)return json(response,200,{id:row.id,result:parse(row.result),verified:true});
        if(row.expires_at<now())fail('This attempt expired. Start another run.',410);
        if(!Array.isArray(body.replay)||body.replay.length>18000)fail('Invalid replay',422);
        const result=await verify(parse(row.challenge),body.replay);
        if(now()-row.started_at<result.ticks*1000/60-2000)fail('The run finished faster than real time allows.',422);
        const replayHash=hash(JSON.stringify(body.replay));
        const duplicate=store.get('SELECT id FROM runs WHERE replay_hash=? AND anon_id<>? LIMIT 1',replayHash,s.anon_id);
        store.transaction(()=>{
          if(store.get('SELECT completed_at FROM runs WHERE id=?',row.id).completed_at)return;
          store.run('UPDATE runs SET completed_at=?,result=?,replay_hash=?,flags=? WHERE id=?',now(),JSON.stringify(result),replayHash,JSON.stringify(duplicate?['repeated_inputs']:[]),row.id);
          store.event(result.qualified?'qualification_earned':'challenge_fail',{anonId:s.anon_id,userId:s.user_id,runId:row.id},now());
          store.event('challenge_complete',{anonId:s.anon_id,runId:row.id},now());
        });return json(response,200,{id:row.id,result,verified:true});
      }
      if(path==='/auth/start'){
        rate('oauth:'+s.anon_id,12,3600000);if(!oauthReady)fail('X sign-in is not available yet.',503);
        if(body.runId!==undefined&&(typeof body.runId!=='string'||!/^[a-f0-9]{32}$/.test(body.runId)))fail('Invalid run');
        if(body.runId){const r=store.get('SELECT * FROM runs WHERE id=?',body.runId);if(!r||r.anon_id!==s.anon_id||!parse(r.result)?.qualified)fail('Win a verified challenge before saving access.',403);}
        const state=token(),verifier=token();
        store.run('INSERT INTO oauth_states(state_hash,session_hash,run_id,verifier,public_profile,expires_at) VALUES(?,?,?,?,?,?)',hash(state),s.token_hash,body.runId||null,verifier,body.publicProfile===true?1:0,now()+10*60000);
        store.event('x_oauth_start',{anonId:s.anon_id,runId:body.runId||null},now());
        return json(response,200,{url:xAuthorize({clientId,redirectUri,state,verifier})});
      }
      if(path==='/claim'){
        rate('claim:'+s.anon_id,12,600000);const result=claim(s,body.runId,body.publicProfile===true);return json(response,200,{...result,pass:pass(s)});
      }
      if(path==='/profile'){
        const u=user(s);if(!u)fail('Sign in with X to update your profile.',401);
        store.run('UPDATE users SET public_profile=? WHERE id=?',body.publicProfile===true?1:0,u.id);return json(response,200,{pass:pass(s)});
      }
      if(path==='/wallet'){
        const u=user(s),q=u&&store.get('SELECT status FROM qualifications WHERE user_id=?',u.id),c=config();
        if(!u||u.status!=='active'||q?.status!=='qualified')fail('A saved qualification is required.',403);
        rate('address:'+u.id,8,3600000);
        if(!c.addressStartsAt||!c.addressEndsAt||now()<c.addressStartsAt||now()>=c.addressEndsAt)fail('Address submission is closed.',409);
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
  return {handle,store,close:()=>store.close(),configured:!!serviceToken&&oauthReady};
}
