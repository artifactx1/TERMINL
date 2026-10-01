import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCampaignService} from '../server/arcade/campaign.mjs';
import {normalizeAddress} from '../server/arcade/campaign-address.mjs';
import {xAuthorize,xIdentity} from '../server/arcade/campaign-oauth.mjs';
import {xOAuth1Header,xOAuth1Start,xOAuth1Identity} from '../server/arcade/campaign-oauth1.mjs';
import {discordAuthorize,discordIdentity} from '../server/arcade/campaign-discord.mjs';
import {farcasterUsername,farcasterLabel} from '../server/arcade/campaign-farcaster.mjs';
import {addressWindow,canonicalReplay,captureInput,DEFAULT_CAMPAIGN,POINTS} from '../lib/arcade/campaign-rules.mjs';
import {campaignConfig} from '../server/arcade/campaign-config.mjs';
import {cupSnapshot,createChallengeRace,cupSegment,cupSegmentDone} from '../lib/arcade/bot-challenge.mjs';
import {rumbleSnapshot,rumbleSegment,circuitFight,CIRCUIT_MAX_ATTEMPTS} from '../lib/arcade/rumble-challenge.mjs';
import {stepRace,raceBotInput} from '../lib/arcade/race-sim.mjs';
import {stepFight,botInput,INPUT} from '../lib/arcade/rumble-sim.mjs';
import {circuitInput} from '../lib/arcade/rumble-circuit.mjs';
import {rivalInput} from '../lib/arcade/rumble-rival.mjs';

/** Drives a whole cup in the browser's way and cuts it where the client submits. */
function driveCup(challenge,lose=false){
  let s=createChallengeRace(challenge),segment=[],races=0;const segments=[];
  while(s.phase!=='finished'){
    const input=lose?0:raceBotInput(s,0,{...challenge.bot,pace:1.05,cornerPace:1.03,boostChance:1,seed:7});
    captureInput(segment,input);s=stepRace(s,[input,raceBotInput(s,1,challenge.bot)]);
    if(cupSegmentDone(s,races)){segments.push(segment);segment=[];races=s.raceResults.length;}
  }
  return {segments,state:s};
}
/** Crouching heavy pressure: the spam that cleared the old practice-bot circuit. */
const pressure=s=>{if(s.phase==='finishWindow')return botInput(s,0);const p=s.players[0],e=s.players[1];return Math.abs(p.x-e.x)>90?(p.x<e.x?INPUT.RIGHT:INPUT.LEFT):INPUT.DOWN|(s.tick%14<2?INPUT.HEAVY:0);};
/** A skilled player: the rival's own top-level play, varied per attempt. */
const skilled=attempt=>s=>rivalInput(s,0,5,7919*(attempt+1));
function driveFight(challenge,progress,strategy=skilled(progress.attempts)){
  let {input:rival,state}=circuitFight(challenge,progress);const replay=[];
  while(state.phase!=='finished'){const input=strategy(state);captureInput(replay,input);state=stepFight(state,[input,rival(state)]);}
  return {replay,ticks:state.tick,won:state.winner===0};
}
/** Stand-in verifier for identity and storage tests. Segment input 1 is a win.
 * Real replay verification is covered by its own tests below. */
async function quickVerify(challenge,progress,replay){
  const ticks=replay.reduce((n,[t])=>n+t,0),won=replay[0][1]===1;
  if(challenge.kind==='rumble'){
    const next={index:(progress?.index||0)+(won?1:0),attempts:(progress?.attempts||0)+1,fights:[]},done=next.index===6;
    return {state:next,ticks,points:(won?POINTS.fightWin:0)+(done?POINTS.circuitClear:0),segment:{index:progress?.index||0,won},
      result:done?{kind:'rumble',qualified:true,character:challenge.character,attempts:next.attempts,losses:next.attempts-6,fightTicks:6*ticks,opponents:[]}:null};
  }
  const raceResults=[...(progress?.raceResults||[]),{won}],wins=raceResults.filter(r=>r.won).length,done=raceResults.length===6;
  const state={raceResults,players:[{points:wins*10},{points:(raceResults.length-wins)*10}]};
  return {state,ticks,points:(won?POINTS.raceWin:0)+(done&&wins>=4?POINTS.cupWin:0),segment:{race:raceResults.length-1,won},
    result:done?{kind:'cup',qualified:wins>=4,winner:wins>=4?0:1,points:state.players.map(p=>p.points),races:[]}:null};
}
/** Distinct stand-in inputs, so the repeated-input check only fires when a test means it to. */
let replayVariant=0;
/** Plays a quick-verified cup through the service: six segments, in real time. */
async function playCup(api,client,clock,{ref,wins=6}={}){
  const start=await api(client,'/runs',{kind:'cup',ref});assert.equal(start.status,201,JSON.stringify(start));
  let last;
  for(let segment=0;segment<6;segment++){
    clock.time+=61000;last=await api(client,'/submit',{runId:start.data.id,segment,replay:[[3000+(++replayVariant),segment<wins?1:0]]});
    assert.equal(last.status,200,JSON.stringify(last));
  }
  assert.equal(last.data.result.qualified,wins>=4);return start.data;
}
async function playRumble(api,client,clock,{losses=0}={}){
  const start=await api(client,'/runs',{kind:'rumble',character:'mia'});assert.equal(start.status,201,JSON.stringify(start));
  let last;
  for(let segment=0;segment<6+losses;segment++){
    clock.time+=61000;last=await api(client,'/submit',{runId:start.data.id,segment,replay:[[3000+(++replayVariant),segment<losses?0:1]]});
    assert.equal(last.status,200,JSON.stringify(last));
  }
  assert.equal(last.data.result.qualified,true);return start.data;
}

test('official cup is verified race by race and matches one continuous replay',()=>{
  const challenge=cupSnapshot(DEFAULT_CAMPAIGN,42),win=driveCup(challenge);
  assert.equal(win.segments.length,6);
  let state=null,points=0,result=null;
  for(const [index,segment]of win.segments.entries()){
    const out=cupSegment(challenge,state&&structuredClone(state),segment);
    assert.equal(out.segment.race,index);state=out.state;points+=out.points;result=out.result;
    assert.equal(!!result,index===5,'only the last race settles the cup');
  }
  assert.equal(result.qualified,true);assert.equal(result.winner,win.state.winner);assert.deepEqual(result.points,win.state.players.map(p=>p.points));
  assert.equal(points,result.races.filter(r=>r.order[0]===0).length*POINTS.raceWin+POINTS.cupWin);
  const trailing=[...win.segments[0].map(frame=>[...frame]),[12,127]],first=cupSegment(challenge,null,win.segments[0]);
  assert.deepEqual(cupSegment(challenge,null,trailing).segment,first.segment,'post-finish frames do not change a verified race');
  assert.deepEqual(canonicalReplay(trailing,first.ticks),win.segments[0],'fingerprints discard post-finish frames');
  assert.throws(()=>cupSegment(challenge,state,win.segments[0]),/already complete/);
  assert.throws(()=>cupSegment(challenge,null,[[1,999999]]),/Invalid/);
  assert.throws(()=>cupSegment(challenge,null,[[8001,4]]),/too long/);
  assert.throws(()=>cupSegment(challenge,null,[[1,4]]),/Finish/);
  assert.throws(()=>cupSegment({...challenge,rulesVersion:999},null,win.segments[0]),/expired/);
  const lost=driveCup(cupSnapshot(DEFAULT_CAMPAIGN,42),true);state=null;
  for(const segment of lost.segments){const out=cupSegment(challenge,state,segment);state=out.state;result=out.result;assert.equal(out.points,0);}
  assert.equal(result.qualified,false);
});
test('official Rumble circuit advances only on verified wins, with a fresh bot seed per attempt',()=>{
  const challenge=rumbleSnapshot('max',7);let progress=null,points=0,result=null;
  assert.throws(()=>rumbleSnapshot('nobody',1),/Unknown fighter/);
  while(!result){
    const before=progress||{index:0,attempts:0,fights:[]},fight=driveFight(challenge,before),out=rumbleSegment(challenge,progress,fight.replay);
    assert.equal(out.segment.won,fight.won,'server replay agrees with the browser simulation');
    assert.equal(out.state.index,before.index+(fight.won?1:0));assert.equal(out.state.attempts,before.attempts+1);
    progress=out.state;points+=out.points;result=out.result;
    assert.ok(progress.attempts<CIRCUIT_MAX_ATTEMPTS);
  }
  assert.equal(result.qualified,true);assert.equal(result.opponents.length,6);assert.equal(result.losses,progress.attempts-6);
  assert.equal(points,6*POINTS.fightWin+POINTS.circuitClear);
  assert.notEqual(circuitFight(challenge,{index:0,attempts:0}).seed,circuitFight(challenge,{index:0,attempts:1}).seed);
  for(let index=0;index<6;index++){
    const spam=driveFight(challenge,{index,attempts:index,fights:[]},pressure);
    assert.equal(spam.won,false,`crouch-kick spam loses to official rival ${index+1}`);
  }
  const legacy={...challenge};delete legacy.bot;
  const old=driveFight(legacy,{index:0,attempts:0,fights:[]},pressure);
  assert.equal(rumbleSegment(legacy,null,old.replay).segment.won,old.won,'runs issued before the rival keep their original bot');
  const first=driveFight(challenge,{index:0,attempts:0,fights:[]});
  assert.throws(()=>rumbleSegment(challenge,{index:6,attempts:9,fights:[]},first.replay),/already complete/);
  assert.throws(()=>rumbleSegment(challenge,{index:2,attempts:CIRCUIT_MAX_ATTEMPTS,fights:[]},first.replay),/all its attempts/);
  assert.throws(()=>rumbleSegment(challenge,null,[[1,4096]]),/Invalid/);
  assert.throws(()=>rumbleSegment(challenge,null,[[30,0]]),/Finish/);
});
test('stored settings gain route defaults and reject a campaign with no route',()=>{
  const legacy={...DEFAULT_CAMPAIGN,targetSeconds:180};delete legacy.cupEnabled;delete legacy.rumbleEnabled;
  const migrated=campaignConfig(legacy);assert.equal(migrated.cupEnabled,true);assert.equal(migrated.rumbleEnabled,true);assert.equal('targetSeconds' in migrated,false);
  assert.throws(()=>campaignConfig({...DEFAULT_CAMPAIGN,active:true,cupEnabled:false,rumbleEnabled:false}),/Enable/);
  assert.equal(DEFAULT_CAMPAIGN.capacity,0,'FCFS spots are unlimited by default');assert.throws(()=>campaignConfig({...DEFAULT_CAMPAIGN,capacity:-1}),/Capacity/);
});
test('wallet checksum, zero address and non-address inputs',()=>{
  assert.equal(normalizeAddress('0x52908400098527886E0F7030069857D2E4169EE7'),'0x52908400098527886e0f7030069857d2e4169ee7');
  assert.equal(normalizeAddress('0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE'),'0x5aeda56215b167893e80b4fe645ba6d5bab767de');
  assert.throws(()=>normalizeAddress('0x5aEda56215b167893e80B4fE645BA6d5Bab767DE'),/checksum/);
  assert.throws(()=>normalizeAddress('0x'+'0'.repeat(40)),/valid/);
  assert.throws(()=>normalizeAddress('seed words should never go here'),/valid/);
});
test('blank address dates collect immediately while explicit boundaries schedule and freeze',()=>{
  assert.deepEqual(addressWindow(DEFAULT_CAMPAIGN,1000),{open:true,frozen:false,scheduled:false});
  assert.equal(addressWindow({...DEFAULT_CAMPAIGN,addressStartsAt:2000},1000).open,false);
  assert.equal(addressWindow({...DEFAULT_CAMPAIGN,addressStartsAt:500,addressEndsAt:2000},1000).open,true);
  assert.deepEqual(addressWindow({...DEFAULT_CAMPAIGN,addressEndsAt:500},1000),{open:false,frozen:true,scheduled:true});
});
test('X uses S256, read-only identity scopes and discards its token',async()=>{
  const url=new URL(xAuthorize({clientId:'client',redirectUri:'https://terminl.test/callback',state:'state',verifier:'verifier'}));
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('scope'),'tweet.read users.read');
  const calls=[];
  const identity=await xIdentity({clientId:'client',clientSecret:'secret',redirectUri:'https://terminl.test/callback',code:'code',verifier:'verifier',fetchImpl:async(url,options)=>{
    calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/token')?{access_token:'private'}:{data:{id:'123',username:'degen',name:'Degen'}}};
  }});
  assert.deepEqual(identity,{id:'123',username:'degen',name:'Degen'});
  assert.equal(calls.length,3);assert.ok(calls[2].url.endsWith('/revoke'));
  assert.equal(calls[0].options.body.get('code_verifier'),'verifier');
});
test('OAuth 1 signatures match the published OAuth example including URL parameters',()=>{
  const header=xOAuth1Header('http://photos.example.net/photos?file=vacation.jpg&size=original',{method:'GET',apiKey:'dpf43f3p2l4k3l03',apiSecret:'kd94hf93k423kf44',token:'nnch734d00sl2jdk',tokenSecret:'pfkkdhi9sl3r4s00',nonce:'kllo9940pd9333jh',timestamp:1191242096});
  assert.match(header,/oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D"/);
});
test('standard X sign-in requests read access and uses only the authenticated token response for identity',async()=>{
  const credentials={apiKey:'app',apiSecret:'secret'},calls=[];
  const pending=await xOAuth1Start({...credentials,redirectUri:'https://terminl.test/callback',fetchImpl:async(url,options)=>{
    calls.push(url);assert.equal(options.body.get('x_auth_access_type'),'read');assert.match(options.headers.Authorization,/oauth_callback="https%3A%2F%2Fterminl.test%2Fcallback"/);
    return {ok:true,text:async()=>new URLSearchParams({oauth_token:'request',oauth_token_secret:'request-secret',oauth_callback_confirmed:'true'}).toString()};
  }});
  assert.equal(new URL(pending.url).searchParams.get('oauth_token'),'request');
  assert.ok(!pending.url.includes('request-secret'));
  const identity=await xOAuth1Identity({...credentials,...pending,verifier:'verified',fetchImpl:async(url,options)=>{
    calls.push(url);
    if(url.endsWith('/access_token')){
      assert.equal(options.body.get('oauth_verifier'),'verified');assert.match(options.headers.Authorization,/oauth_token="request"/);
      return {ok:true,text:async()=>new URLSearchParams({oauth_token:'access',oauth_token_secret:'access-secret',user_id:'123',screen_name:'degen'}).toString()};
    }
    assert.ok(url.endsWith('/invalidate_token.json'));assert.match(options.headers.Authorization,/oauth_token="access"/);return {ok:true};
  }});
  assert.deepEqual(identity,{id:'123',username:'degen',name:'degen'});assert.equal(calls.length,3);assert.ok(calls.every(url=>!url.includes('/users/')));
  await assert.rejects(xOAuth1Start({...credentials,redirectUri:'https://terminl.test/callback',fetchImpl:async()=>({ok:true,text:async()=> 'oauth_token=request&oauth_token_secret=secret&oauth_callback_confirmed=false'})}),e=>e.providerCode==='invalid_request_token');
  let revoked=false;
  await assert.rejects(xOAuth1Identity({...credentials,...pending,verifier:'verified',fetchImpl:async url=>{
    if(url.endsWith('/invalidate_token.json')){revoked=true;return {ok:true};}
    return {ok:true,text:async()=> 'oauth_token=access&oauth_token_secret=secret&user_id=not-an-id&screen_name=degen'};
  }}),e=>e.providerCode==='invalid_identity');assert.equal(revoked,true);
});
test('Discord requests identity only, reads the authenticated profile and revokes its token',async()=>{
  const redirectUri='https://terminl.test/api/campaign/auth/callback';
  const authorize=new URL(discordAuthorize({clientId:'123456789012345678',redirectUri,state:'csrf'}));
  assert.equal(authorize.origin,'https://discord.com');assert.equal(authorize.searchParams.get('scope'),'identify');assert.equal(authorize.searchParams.get('state'),'csrf');assert.equal(authorize.searchParams.has('email'),false);
  const calls=[];
  const identity=await discordIdentity({clientId:'123456789012345678',clientSecret:'secret',redirectUri,code:'code',fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/oauth2/token'))return {ok:true,json:async()=>({access_token:'private-discord-token'})};
    if(url.endsWith('/users/@me'))return {ok:true,json:async()=>({id:'987654321098765432',username:'anon.degen',global_name:'Anon Degen'})};
    assert.ok(url.endsWith('/oauth2/token/revoke'));return {ok:true,json:async()=>({})};
  }});
  assert.deepEqual(identity,{id:'987654321098765432',username:'anon.degen',name:'Anon Degen'});assert.equal(calls.length,3);
  assert.equal(calls[0].options.body.get('grant_type'),'authorization_code');assert.equal(calls[2].options.body.get('token'),'private-discord-token');
  assert.ok(calls[0].options.headers.Authorization.startsWith('Basic '));assert.equal(calls[1].options.headers.Authorization,'Bearer private-discord-token');
});
test('OAuth 1 callback binds to its initiating session, saves a verified win and permits twelve complete sign-ins',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-oauth1-'));const clock={time:1800000000000};let issued=0,identified=0;
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',xAuthMode:'oauth1',xApiKey:'app',xApiSecret:'secret',now:()=>clock.time,verifyReplay:quickVerify,
    xOAuth1Start:async()=>({requestToken:'request-'+(++issued),tokenSecret:'secret-'+issued,url:'https://api.x.com/oauth/authorize?oauth_token=request-'+issued}),
    xOAuth1Identity:async({requestToken,tokenSecret,verifier})=>{identified++;assert.equal(tokenSecret,requestToken.replace('request-','secret-'));assert.equal(verifier,'approved');return {id:'123',username:'degen',name:'degen'};}});
  const server=http.createServer((req,res)=>void service.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/campaign`,owner={cookie:''},other={cookie:''};
  async function api(client,path,body,extra={}){
    const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json',Cookie:client.cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});
    const cookie=r.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null,location:r.headers.get('location')};
  }
  const callback=(request,more='')=>'/auth/callback?oauth_token='+request+'&oauth_verifier=approved'+more;
  try{
    assert.equal((await api(owner,'/admin/settings',{config:{...DEFAULT_CAMPAIGN,active:true}},{'X-Campaign-Admin':'admin'})).status,200);
    await api(owner,'/session');await api(other,'/session');
    const run=await playCup(api,owner,clock);
    assert.equal((await api(owner,'/auth/start',{runId:run.id})).status,200);
    assert.equal((await api(other,callback('request-1'))).status,403,'another session cannot consume this request token');
    assert.equal((await api(owner,callback('request-1','&state=forged'))).status,403);
    const oldCookie=owner.cookie,saved=await api(owner,callback('request-1','&user_id=999&screen_name=attacker'));
    assert.equal(saved.status,303);assert.match(saved.location,/saved=/);assert.notEqual(owner.cookie,oldCookie);
    const pass=(await api(owner,'/me')).data.pass;assert.equal(pass.username,'degen');assert.deepEqual(pass.spots.map(sp=>[sp.route,sp.status]),[['cup','qualified']]);
    assert.equal((await api(owner,callback('request-1'))).status,403,'callbacks are single use');
    assert.equal((await api({cookie:oldCookie},'/me')).status,401,'old session is rotated');
    for(let i=2;i<=12;i++){
      assert.equal((await api(owner,'/auth/start',{})).status,200,'callback must not consume start quota');
      assert.equal((await api(owner,callback('request-'+i))).status,303);
    }
    assert.equal(identified,12);assert.equal((await api(owner,'/auth/start',{})).status,429);
    clock.time+=3600001;
    await api(owner,'/auth/start',{});assert.match((await api(owner,'/auth/callback?denied=request-13')).location,/auth=cancelled/);
    assert.equal((await api(owner,callback('request-13'))).status,403);assert.equal(identified,12);
    await api(owner,'/auth/start',{});clock.time+=600001;assert.equal((await api(owner,callback('request-14'))).status,403,'expired request cannot authenticate');
    assert.equal(service.store.get('SELECT count(*) AS n FROM users').n,1);
  }finally{await new Promise(r=>server.close(r));service.close();await rm(dir,{recursive:true,force:true});}
});
test('Farcaster and Discord create namespaced identities without requiring X',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-social-auth-'));const clock={time:1800000000000};let fname='degen42';
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',now:()=>clock.time,verifyReplay:quickVerify,
    discordClientId:'123456789012345678',discordClientSecret:'secret',
    discordIdentity:async()=>({id:'987654321098765432',username:'discorddegen',name:'Discord Degen'}),
    farcasterIdentity:async({nonce,domain,uri,message,signature})=>{assert.match(nonce,/^[a-f0-9]{32}$/);assert.equal(domain,'terminl.test');assert.equal(uri,'https://terminl.test/arcade-pass');assert.equal(message,'signed message');assert.equal(signature,'0xsigned');return fname?{id:'42',username:fname,name:fname}:{id:'42',username:'fid42',name:'Farcaster #42'};}});
  const server=http.createServer((req,res)=>void service.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/campaign`,guest=()=>({cookie:'',network:Math.random().toString()});
  async function api(client,path,body,extra={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json',Cookie:client.cookie,'X-Campaign-Client':client.network,...extra},...(body?{body:JSON.stringify(body)}:{})});
    const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null,location:response.headers.get('location')};
  }
  try{
    const admin=guest();assert.equal((await api(admin,'/admin/settings',{config:{...DEFAULT_CAMPAIGN,active:true}},{'X-Campaign-Admin':'admin'})).status,200);
    const owner=guest(),attacker=guest();await api(owner,'/session');await api(attacker,'/session');
    const run=await playCup(api,owner,clock);
    const start=await api(owner,'/auth/start',{provider:'farcaster',runId:run.id,publicProfile:false});assert.equal(start.status,200);assert.match(start.data.nonce,/^[a-f0-9]{32}$/);
    assert.equal((await api(attacker,'/auth/complete',{provider:'farcaster',nonce:start.data.nonce,message:'signed message',signature:'0xsigned'})).status,403,'nonce is bound to its initiating session');
    const oldCookie=owner.cookie,complete=await api(owner,'/auth/complete',{provider:'farcaster',nonce:start.data.nonce,message:'signed message',signature:'0xsigned'});
    assert.equal(complete.status,200);assert.notEqual(owner.cookie,oldCookie);assert.ok(complete.data.saved);assert.equal(complete.data.pass.provider,'farcaster');assert.equal(complete.data.pass.spots[0].status,'qualified');
    assert.equal((await api(owner,'/auth/complete',{provider:'farcaster',nonce:start.data.nonce,message:'signed message',signature:'0xsigned'})).status,403,'nonce is single use');
    assert.equal(complete.data.pass.display,'@degen42','the registry name is the handle');
    fname=null;const again=await api(owner,'/auth/start',{provider:'farcaster'});
    assert.equal((await api(owner,'/auth/complete',{provider:'farcaster',nonce:again.data.nonce,message:'signed message',signature:'0xsigned'})).data.pass.display,'@degen42','a failed lookup keeps the known name');
    const discord=guest();await api(discord,'/session');const discordStart=await api(discord,'/auth/start',{provider:'discord'});assert.equal(discordStart.status,200);
    const state=new URL(discordStart.data.url).searchParams.get('state'),discordCallback=await api(discord,'/auth/callback?state='+state+'&code=approved');assert.equal(discordCallback.status,303);
    assert.equal((await api(discord,'/me')).data.pass.provider,'discord');
    assert.ok(service.store.get('SELECT id FROM users WHERE id=?','farcaster:42'));assert.ok(service.store.get('SELECT id FROM users WHERE id=?','discord:987654321098765432'));
  }finally{await new Promise(r=>server.close(r));service.close();await rm(dir,{recursive:true,force:true});}
});
test('X failures identify the provider stage without exposing response secrets and still revoke tokens',async()=>{
  const args={clientId:'client',clientSecret:'secret',redirectUri:'https://terminl.test/callback',code:'code',verifier:'verifier'};
  for(const status of [401,402,403,429]){
    const calls=[];
    await assert.rejects(xIdentity({...args,fetchImpl:async(url)=>{
      calls.push(url);
      if(url.endsWith('/token'))return {ok:true,status:200,json:async()=>({access_token:'private-access-token'})};
      if(url.endsWith('/revoke'))return {ok:true};
      return {ok:false,status,json:async()=>({title:status===402?'CreditsDepleted':'private-access-token',detail:'secret',access_token:'private-access-token'})};
    }}),e=>{
      assert.equal(e.oauthStage,'profile');assert.equal(e.providerStatus,status);
      assert.equal(e.providerCode,status===402?'CreditsDepleted':'provider_error');
      assert.doesNotMatch(JSON.stringify(e)+e.message,/private-access-token|secret/);return true;
    });
    assert.equal(calls.length,3);assert.ok(calls.at(-1).endsWith('/revoke'));
  }
  await assert.rejects(xIdentity({...args,fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:'invalid_client',error_description:'secret'})})}),e=>e.oauthStage==='token'&&e.providerStatus===401&&e.providerCode==='invalid_client');
  await assert.rejects(xIdentity({...args,fetchImpl:async()=>({ok:false,status:403,json:async()=>({errors:[{code:453,message:'Access level limits this endpoint; private-access-token'}]})})}),e=>e.providerErrorNumber===453&&e.providerReason==='app_access_level'&&!JSON.stringify(e).includes('private-access-token'));
  await assert.rejects(xIdentity({...args,fetchImpl:async()=>{throw Error('secret');}}),e=>e.oauthStage==='token'&&e.providerCode==='network_error'&&!e.message.includes('secret'));
});
test('WL spots per route, segment ordering, points leaderboard, referrals, capacity and address deadlines',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-campaign-'));const clock={time:1800000000000};
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',xClientId:'client',xClientSecret:'secret',now:()=>clock.time,verifyReplay:quickVerify,
    xIdentity:async({code})=>({id:code,username:'user'+code,name:'User '+code})});
  const server=http.createServer((req,res)=>void service.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/campaign`;
  const guest=()=>({cookie:'',network:Math.random().toString()});
  async function api(client,path,body,extra={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json',Cookie:client.cookie,'X-Campaign-Client':client.network,...extra},...(body?{body:JSON.stringify(body)}:{})});
    const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];
    const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null,location:response.headers.get('location')};
  }
  async function settings(config){const result=await api(guest(),'/admin/settings',{config},{'X-Campaign-Admin':'admin'});assert.equal(result.status,200,JSON.stringify(result));}
  async function save(client,runId,id,publicProfile=false){
    const auth=await api(client,'/auth/start',{runId,publicProfile});assert.equal(auth.status,200,JSON.stringify(auth));
    const state=new URL(auth.data.url).searchParams.get('state');
    const callback=await api(client,'/auth/callback?state='+state+'&code='+id);assert.equal(callback.status,303,JSON.stringify(callback));
    return (await api(client,'/me')).data.pass;
  }
  const routes=pass=>Object.fromEntries(pass.spots.map(sp=>[sp.route,sp.status]));
  try{
    await settings({...DEFAULT_CAMPAIGN,active:true,capacity:4});
    const a=guest(),b=guest();await api(a,'/session');await api(b,'/session');
    const config=(await api(a,'/config')).data;assert.deepEqual(config.routes,{cup:true,rumble:true});assert.equal(config.claimed,0);
    assert.equal((await api(a,'/admin')).status,404);
    assert.equal((await api(a,'/runs',{kind:'cup'},{Origin:'https://evil.test'})).status,403);
    assert.equal((await api(a,'/runs',{})).status,400,'a route is required');
    assert.equal((await api(a,'/runs',{kind:'rumble',character:'nobody'})).status,400);
    const start=(await api(a,'/runs',{kind:'cup'})).data;
    assert.equal((await api(b,'/runs/'+start.id)).status,404);
    assert.equal((await api(b,'/submit',{runId:start.id,segment:0,replay:[[3600,1]]})).status,404);
    assert.equal((await api(a,'/submit',{runId:start.id,segment:0,replay:[[3600,1]]})).status,422,'impossibly fast race rejected');
    clock.time+=61000;
    assert.equal((await api(a,'/submit',{runId:start.id,segment:1,replay:[[3600,1]]})).status,409,'segments arrive in order');
    assert.equal((await api(a,'/submit',{runId:start.id,segment:0,replay:[[3600,1]]})).status,200);
    const repeat=await api(a,'/submit',{runId:start.id,segment:0,replay:[[3600,0]]});
    assert.equal(repeat.status,200);assert.equal(repeat.data.duplicate,true);assert.equal(repeat.data.segments,1,'a repeated segment is not replayed');
    assert.equal((await api(a,'/auth/start',{runId:start.id})).status,403,'an unfinished cup cannot be saved');
    for(let segment=1;segment<6;segment++){clock.time+=61000;assert.equal((await api(a,'/submit',{runId:start.id,segment,replay:[[3600,1]]})).status,200);}
    assert.equal((await api(a,'/submit',{runId:start.id,segment:6,replay:[[3600,1]]})).status,409,'completed cups take no more races');
    const run=(await api(a,'/runs/'+start.id)).data;assert.equal(run.result.qualified,true);assert.deepEqual(run.progress,{races:6,points:[60,0]});
    assert.equal((await api(a,'/auth/callback?state=wrong&code=1')).status,403);
    const passA=await save(a,start.id,'101');assert.deepEqual(routes(passA),{cup:'qualified'});
    assert.equal(passA.points,6*POINTS.raceWin+POINTS.cupWin);assert.equal(passA.rank,1);assert.equal(passA.publicProfile,false);
    const code=passA.spots[0].code;
    assert.equal((await api(b,'/results/'+code)).data.player,'ANON','private identity never leaks');
    const loss=await playCup(api,a,clock,{wins:2});
    assert.equal((await api(a,'/claim',{runId:loss.id})).status,403,'a lost cup earns no spot');
    assert.equal((await api(a,'/me')).data.pass.points,6*POINTS.raceWin+POINTS.cupWin+2*POINTS.raceWin,'race wins in a lost cup still score');
    const rumble=await playRumble(api,a,clock,{losses:2}),second=await api(a,'/claim',{runId:rumble.id});
    assert.equal(second.status,200);assert.equal(second.data.status,'cleared');assert.deepEqual(routes(second.data.pass),{cup:'qualified',rumble:'cleared'},'one FCFS spot per account; another route is a clear');
    assert.deepEqual(second.data.pass.fcfs.route,'cup');
    const again=await playCup(api,a,clock);assert.equal((await api(a,'/claim',{runId:again.id})).data.already,true,'one spot per route');
    assert.equal((await api(a,'/config')).data.claimed,1);
    const runB=await playCup(api,b,clock,{ref:code}),passB=await save(b,runB.id,'202',true);
    assert.deepEqual(routes(passB),{cup:'qualified'});assert.equal((await api(a,'/me')).data.pass.referrals,1);
    await api(b,'/claim',{runId:runB.id,publicProfile:true});assert.equal((await api(a,'/me')).data.pass.referrals,1,'repeat claim cannot farm referrals');
    const c=guest();await api(c,'/session');const own=await playCup(api,c,clock,{ref:code});await save(c,own.id,'101');
    assert.equal((await api(a,'/me')).data.pass.referrals,1,'self referral rejected');
    assert.equal(service.store.get('SELECT count(*) AS n FROM users').n,2,'provider identity is unique');
    const board=(await api(guest(),'/leaderboard')).data.entries;
    assert.deepEqual(board.map(e=>[e.rank,e.player,e.spots]),[[1,'ANON',['cup','rumble']],[2,'@user202',['cup']]],'public names are opt-in');
    assert.ok(board[0].points>board[1].points);assert.equal(JSON.stringify(board).includes('101'),false,'leaderboard exposes no account ids');
    const address='0x52908400098527886E0F7030069857D2E4169EE7';
    assert.equal((await api(a,'/wallet',{address:'0x'+'1'.repeat(40),chainId:4663,confirmed:true})).status,200,'blank address window opens immediately');
    await settings({...DEFAULT_CAMPAIGN,active:true,capacity:4,addressStartsAt:Math.floor(clock.time)+60000,addressEndsAt:Math.floor(clock.time)+120000});
    assert.equal((await api(a,'/wallet',{address,chainId:4663,confirmed:true})).status,409,'future address window stays closed');
    await settings({...DEFAULT_CAMPAIGN,active:true,capacity:4,addressStartsAt:Math.floor(clock.time)-1000,addressEndsAt:Math.floor(clock.time)+60000});
    assert.equal((await api(a,'/wallet',{address,chainId:1,confirmed:true})).status,400);
    assert.equal((await api(a,'/wallet',{address,chainId:4663,confirmed:true})).status,200);
    assert.equal((await api(b,'/wallet',{address,chainId:4663,confirmed:true})).status,409,'one address per account');
    clock.time+=61000;assert.equal((await api(a,'/wallet',{address:'0x'+'1'.repeat(40),chainId:4663,confirmed:true})).status,409,'frozen addresses cannot change');
    assert.ok(service.store.get("SELECT count(*) AS n FROM audit WHERE action='wallet_saved'").n);
    assert.equal((await api(a,'/admin/addresses')).status,404,'address export is private');
    const exported=await api(guest(),'/admin/addresses',undefined,{'X-Campaign-Admin':'admin'});
    assert.equal(exported.data.frozen,true);assert.equal(exported.data.addresses.length,1);
    assert.deepEqual([exported.data.addresses[0].address,exported.data.addresses[0].route],[address.toLowerCase(),'cup']);
    await settings({...service.store.config(),capacity:2});
    const d=guest();await api(d,'/session');const overflow=await playCup(api,d,clock,{ref:code});
    assert.deepEqual(routes(await save(d,overflow.id,'303')),{cup:'waitlist'},'FCFS capacity cannot be oversubscribed');
    assert.equal((await api(a,'/me')).data.pass.referrals,1,'waitlisted accounts earn no referral credit');
    assert.equal((await api(d,'/results/'+overflow.code)).status,404);
    assert.equal((await api(guest(),'/admin/review',{userId:'303',status:'qualified',reason:'Over capacity test'},{'X-Campaign-Admin':'admin'})).status,409,'approval respects capacity');
    const bad=await api(b,'/auth/start',{runId:runB.id});const state=new URL(bad.data.url).searchParams.get('state');
    assert.equal((await api(a,'/auth/callback?state='+state+'&code=999')).status,403,'OAuth state bound to its session');
    await api(guest(),'/admin/review',{userId:'202',status:'banned',reason:'Automated test review'},{'X-Campaign-Admin':'admin'});
    assert.equal((await api(a,'/results/'+passB.spots[0].code)).status,404,'banned results are unpublished');
    assert.equal((await api(a,'/me')).data.pass.referrals,0,'invalid referrals are removed');
    assert.equal((await api(guest(),'/leaderboard')).data.entries.some(e=>e.player==='@user202'),false,'suspended accounts leave the leaderboard');
    const stale=await api(d,'/runs',{kind:'cup'});clock.time+=31*60000;
    assert.equal((await api(d,'/submit',{runId:stale.data.id,segment:0,replay:[[3600,1]]})).status,410,'idle runs expire');
    const blocked=await api(guest(),'/admin/review',{userId:'101',status:'banned',reason:'Export exclusion test'},{'X-Campaign-Admin':'admin'});
    assert.equal(blocked.status,200);
    assert.equal((await api(guest(),'/admin/addresses',undefined,{'X-Campaign-Admin':'admin'})).data.addresses.length,0,'suspended identities excluded from export');
    service.close();
    const restored=createCampaignService({dataDir:dir,serviceToken:'service',siteOrigin:'https://terminl.test'});
    assert.equal(restored.store.get('SELECT count(*) AS n FROM spots').n,4);
    assert.equal(restored.store.get('SELECT address FROM wallets WHERE user_id=?','101').address,address.toLowerCase());
    restored.close();
  }finally{await new Promise(r=>server.close(r));try{service.close();}catch{}await rm(dir,{recursive:true,force:true});}
});
test('Farcaster names come from the official registry for the proven FID only',async()=>{
  const registry=body=>async url=>{assert.equal(url,'https://fnames.farcaster.xyz/transfers/current?fid=8688');return {ok:true,json:async()=>body};};
  assert.equal(await farcasterUsername(8688,registry({transfer:{username:'generationart',to:8688}})),'generationart');
  assert.equal(await farcasterUsername(8688,registry({transfer:{username:'someoneelse',to:9}})),null,'a name owned by another FID is ignored');
  assert.equal(await farcasterUsername(8688,registry({transfer:{username:'<script>',to:8688}})),null);
  assert.equal(await farcasterUsername(8688,async()=>({ok:false})),null);
  assert.equal(await farcasterUsername(8688,async()=>{throw new Error('down');}),null,'registry outages fall back to the FID');
  assert.equal(farcasterLabel(8688,'generationart'),'@generationart');assert.equal(farcasterLabel(8688,'fid8688'),'FID #8688');
  const dir=await mkdtemp(join(tmpdir(),'terminl-fname-'));
  let service=createCampaignService({dataDir:dir,serviceToken:'service',siteOrigin:'https://terminl.test',farcasterUsername:async()=>null});
  service.store.run("INSERT INTO users(id,username,name,provider,public_profile,created_at,last_seen) VALUES('farcaster:8688','fid8688','Farcaster #8688','farcaster',1,1,1)");
  await service.backfill;service.close();
  service=createCampaignService({dataDir:dir,serviceToken:'service',siteOrigin:'https://terminl.test',farcasterUsername:async fid=>fid===8688?'generationart':null});
  try{
    await service.backfill;assert.equal(service.store.get("SELECT username FROM users WHERE id='farcaster:8688'").username,'generationart','saved accounts gain their name');
  }finally{service.close();await rm(dir,{recursive:true,force:true});}
});
test('existing single-race qualifications become honored sprint spots with points',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-migrate-'));
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'campaign.sqlite'));
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'x', public_profile INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
    CREATE TABLE runs (id TEXT PRIMARY KEY, anon_id TEXT NOT NULL, challenge TEXT NOT NULL, started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, completed_at INTEGER, result TEXT, replay_hash TEXT, flags TEXT NOT NULL DEFAULT '[]', code TEXT UNIQUE NOT NULL, ref_code TEXT, user_id TEXT REFERENCES users(id), invalidated INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE qualifications (user_id TEXT PRIMARY KEY REFERENCES users(id), run_id TEXT UNIQUE NOT NULL REFERENCES runs(id), status TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
    INSERT INTO users VALUES('farcaster:8688','fid8688','Farcaster #8688','farcaster',1,'active',1,1);
    INSERT INTO runs VALUES('${'a'.repeat(32)}','anon','{"version":1,"track":"night-market","vehicle":"comet"}',1,2,3,'{"qualified":true,"playerTicks":3350,"botTicks":4821,"winner":0}','h','[]','Yag0FRxedHtQxCPI',NULL,'farcaster:8688',0);
    INSERT INTO qualifications VALUES('farcaster:8688','${'a'.repeat(32)}','qualified',3);`);
  db.prepare('INSERT INTO settings(id,value) VALUES(1,?)').run(JSON.stringify({...DEFAULT_CAMPAIGN,active:true,targetSeconds:180}));db.close();
  const service=createCampaignService({dataDir:dir,serviceToken:'service',siteOrigin:'https://terminl.test',farcasterEnabled:true,farcasterUsername:async()=>null});
  try{
    assert.deepEqual(service.store.all('SELECT user_id,route,status FROM spots').map(row=>({...row})),[{user_id:'farcaster:8688',route:'sprint',status:'qualified'}]);
    assert.equal(service.store.get('SELECT points FROM runs').points,POINTS.legacySprint);
    const server=http.createServer((req,res)=>void service.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
    try{
      const get=path=>fetch(`http://127.0.0.1:${server.address().port}/campaign${path}`,{headers:{Authorization:'Bearer service'}}).then(r=>r.json());
      assert.equal((await get('/results/Yag0FRxedHtQxCPI')).kind,'sprint','legacy challenge pages keep working');
      assert.deepEqual((await get('/leaderboard')).entries,[{rank:1,player:'FID #8688',points:POINTS.legacySprint,spots:['sprint'],gtd:true}]);
      assert.equal((await get('/config')).config.cupEnabled,true);
      assert.equal((await get('/config')).config.capacity,0,'the old 2048 default no longer caps FCFS spots');
    }finally{await new Promise(r=>server.close(r));}
  }finally{service.close();await rm(dir,{recursive:true,force:true});}
});
test('the leaderboard top closes into GTD spots that holders can submit an address for',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-gtd-'));const clock={time:1800000000000};
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',xClientId:'client',xClientSecret:'secret',now:()=>clock.time,verifyReplay:quickVerify,
    xIdentity:async({code})=>({id:code,username:'user'+code,name:'User '+code})});
  const server=http.createServer((req,res)=>void service.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/campaign`,guest=()=>({cookie:'',network:Math.random().toString()});
  async function api(client,path,body,extra={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json',Cookie:client.cookie,'X-Campaign-Client':client.network,...extra},...(body?{body:JSON.stringify(body)}:{})});
    const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null};
  }
  const signIn=async(client,id)=>{const auth=await api(client,'/auth/start',{});await api(client,'/auth/callback?state='+new URL(auth.data.url).searchParams.get('state')+'&code='+id);return (await api(client,'/me')).data.pass;};
  const closesAt=clock.time+3600000,settings={...DEFAULT_CAMPAIGN,active:true,gtdSlots:2,gtdEndsAt:closesAt,gtdAddressEndsAt:closesAt+86400000};
  try{
    assert.equal((await api(guest(),'/admin/settings',{config:{...settings,gtdAddressEndsAt:closesAt-1}},{'X-Campaign-Admin':'admin'})).status,400,'GTD submissions close after the leaderboard');
    assert.equal((await api(guest(),'/admin/settings',{config:settings},{'X-Campaign-Admin':'admin'})).status,200);
    const players=[];
    for(const [id,wins] of [['1',6],['2',3],['3',2]]){const p=guest();await api(p,'/session');await playCup(api,p,clock,{wins});players.push({client:p,pass:await signIn(p,id)});}
    const [first,second,third]=players;
    assert.equal(first.pass.gtd.position,1);assert.equal(second.pass.gtd.position,2);assert.equal(third.pass.gtd.position,3);
    assert.deepEqual((await api(guest(),'/leaderboard')).data.entries.map(e=>e.gtd),[true,true,false],'the GTD range is marked before close');
    assert.equal((await api(second.client,'/wallet',{address:'0x'+'2'.repeat(40),chainId:4663,confirmed:true})).status,403,'no address before a spot is held');
    clock.time=closesAt+1000;
    await playCup(api,third.client,clock);
    const after=(await api(third.client,'/me')).data.pass;assert.equal(after.gtd.closed,true);assert.equal(after.gtd.held,null,'points after the close do not change the GTD list');
    assert.deepEqual(service.store.all('SELECT user_id,position FROM gtd ORDER BY position').map(row=>[row.user_id,row.position]),[['1',1],['2',2]]);
    const holder=(await api(second.client,'/me')).data.pass;assert.equal(holder.gtd.held,2);assert.equal(holder.fcfs,null,'a lost cup earns GTD standing without an FCFS spot');
    assert.equal((await api(second.client,'/wallet',{address:'0x'+'2'.repeat(40),chainId:4663,confirmed:true})).status,200,'GTD holders submit an address');
    const exported=(await api(guest(),'/admin/gtd',undefined,{'X-Campaign-Admin':'admin'})).data;
    assert.deepEqual(exported.holders.map(h=>[h.position,h.address]),[[1,null],[2,'0x'+'2'.repeat(40)]]);
    clock.time=closesAt+86400001;
    assert.equal((await api(second.client,'/wallet',{address:'0x'+'3'.repeat(40),chainId:4663,confirmed:true})).status,409,'GTD submissions close on schedule');
  }finally{await new Promise(r=>server.close(r));service.close();await rm(dir,{recursive:true,force:true});}
});
test('real replay verification runs through the service for both routes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-verify-'));const clock={time:1800000000000};
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',now:()=>clock.time});
  const server=http.createServer((req,res)=>void service.handle(req,res));
  // Simulating a whole cup between requests outlasts the default five-second keep-alive.
  server.keepAliveTimeout=60000;await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/campaign`,client={cookie:''};
  async function api(path,body,extra={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json',Cookie:client.cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});
    const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];return {status:response.status,data:await response.json()};
  }
  try{
    assert.equal((await api('/admin/settings',{config:{...DEFAULT_CAMPAIGN,active:true}},{'X-Campaign-Admin':'admin'})).status,200);
    await api('/session');
    const cup=(await api('/runs',{kind:'cup'})).data,driven=driveCup(cup.challenge);let last;
    for(const [segment,replay]of driven.segments.entries()){
      clock.time+=replay.reduce((n,[t])=>n+t,0)*1000/60;last=await api('/submit',{runId:cup.id,segment,replay});assert.equal(last.status,200,JSON.stringify(last));
    }
    assert.equal(last.data.result.qualified,true);assert.deepEqual(last.data.result.points,driven.state.players.map(p=>p.points));
    const rumble=(await api('/runs',{kind:'rumble',character:'max'})).data;let progress={index:0,attempts:0,fights:[]};
    while(progress.index<6){
      const fight=driveFight(rumble.challenge,progress);clock.time+=fight.ticks*1000/60;
      last=await api('/submit',{runId:rumble.id,segment:progress.attempts,replay:fight.replay});assert.equal(last.status,200,JSON.stringify(last));
      assert.equal(last.data.segment.won,fight.won);progress={index:last.data.progress.index,attempts:last.data.progress.attempts,fights:[]};
    }
    assert.equal(last.data.result.kind,'rumble');assert.equal(last.data.result.qualified,true);
  }finally{await new Promise(r=>server.close(r));service.close();await rm(dir,{recursive:true,force:true});}
});
