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
import {createChallengeRace,captureInput,replayChallenge,challengeSnapshot,DEFAULT_CAMPAIGN} from '../lib/arcade/bot-challenge.mjs';
import {stepRace,raceBotInput} from '../lib/arcade/race-sim.mjs';

function drive(challenge,lose=false){
  let s=createChallengeRace(challenge);const replay=[];
  while(s.phase!=='finished'&&s.tick<18000){
    const input=lose?0:raceBotInput(s,0,{...challenge.bot,pace:1.05,cornerPace:1.03,boostChance:1,seed:7});
    captureInput(replay,input);s=stepRace(s,[input,raceBotInput(s,1,challenge.bot)]);
  }
  assert.equal(s.phase,'finished');return {replay,ticks:s.tick};
}
test('official race is replayed, not scored by a browser claim',()=>{
  const challenge=challengeSnapshot(DEFAULT_CAMPAIGN,42),win=drive(challenge),loss=drive(challenge,true);
  assert.equal(replayChallenge(challenge,win.replay).qualified,true);
  assert.equal(replayChallenge(challenge,loss.replay).qualified,false);
  assert.throws(()=>replayChallenge(challenge,[[1,999999]]),/Invalid/);
  assert.throws(()=>replayChallenge(challenge,[[18001,4]]),/too long/);
  assert.throws(()=>replayChallenge(challenge,[[1,4]]),/Finish/);
  assert.throws(()=>replayChallenge({...challenge,rulesVersion:999},win.replay),/expired/);
});
test('wallet checksum, zero address and non-address inputs',()=>{
  assert.equal(normalizeAddress('0x52908400098527886E0F7030069857D2E4169EE7'),'0x52908400098527886e0f7030069857d2e4169ee7');
  assert.equal(normalizeAddress('0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE'),'0x5aeda56215b167893e80b4fe645ba6d5bab767de');
  assert.throws(()=>normalizeAddress('0x5aEda56215b167893e80B4fE645BA6d5Bab767DE'),/checksum/);
  assert.throws(()=>normalizeAddress('0x'+'0'.repeat(40)),/valid/);
  assert.throws(()=>normalizeAddress('seed words should never go here'),/valid/);
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
  const dir=await mkdtemp(join(tmpdir(),'terminl-oauth1-'));let time=1800000000000,issued=0,identified=0;
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',xAuthMode:'oauth1',xApiKey:'app',xApiSecret:'secret',now:()=>time,
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
    const run=(await api(owner,'/runs',{})).data,driveResult=drive(run.challenge);time+=driveResult.ticks*1000/60+3000;
    assert.equal((await api(owner,'/submit',{runId:run.id,replay:driveResult.replay})).data.result.qualified,true);
    assert.equal((await api(owner,'/auth/start',{runId:run.id})).status,200);
    assert.equal((await api(other,callback('request-1'))).status,403,'another session cannot consume this request token');
    assert.equal((await api(owner,callback('request-1','&state=forged'))).status,403);
    const oldCookie=owner.cookie,saved=await api(owner,callback('request-1','&user_id=999&screen_name=attacker'));
    assert.equal(saved.status,303);assert.match(saved.location,/saved=/);assert.notEqual(owner.cookie,oldCookie);
    const pass=(await api(owner,'/me')).data.pass;assert.equal(pass.username,'degen');assert.equal(pass.qualification.status,'qualified');
    assert.equal((await api(owner,callback('request-1'))).status,403,'callbacks are single use');
    assert.equal((await api({cookie:oldCookie},'/me')).status,401,'old session is rotated');
    for(let i=2;i<=12;i++){
      assert.equal((await api(owner,'/auth/start',{})).status,200,'callback must not consume start quota');
      assert.equal((await api(owner,callback('request-'+i))).status,303);
    }
    assert.equal(identified,12);assert.equal((await api(owner,'/auth/start',{})).status,429);
    time+=3600001;
    await api(owner,'/auth/start',{});assert.match((await api(owner,'/auth/callback?denied=request-13')).location,/auth=cancelled/);
    assert.equal((await api(owner,callback('request-13'))).status,403);assert.equal(identified,12);
    await api(owner,'/auth/start',{});time+=600001;assert.equal((await api(owner,callback('request-14'))).status,403,'expired request cannot authenticate');
    assert.equal(service.store.get('SELECT count(*) AS n FROM users').n,1);
  }finally{await new Promise(r=>server.close(r));service.close();await rm(dir,{recursive:true,force:true});}
});
test('Farcaster and Discord create namespaced identities without requiring X',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-social-auth-'));let time=1800000000000;
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',now:()=>time,
    discordClientId:'123456789012345678',discordClientSecret:'secret',
    discordIdentity:async()=>({id:'987654321098765432',username:'discorddegen',name:'Discord Degen'}),
    farcasterIdentity:async({nonce,domain,uri,message,signature})=>{assert.match(nonce,/^[a-f0-9]{32}$/);assert.equal(domain,'terminl.test');assert.equal(uri,'https://terminl.test/arcade-pass');assert.equal(message,'signed message');assert.equal(signature,'0xsigned');return {id:'42',username:'fid42',name:'Farcaster #42'};}});
  const server=http.createServer((req,res)=>void service.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/campaign`,guest=()=>({cookie:'',network:Math.random().toString()});
  async function api(client,path,body,extra={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json',Cookie:client.cookie,'X-Campaign-Client':client.network,...extra},...(body?{body:JSON.stringify(body)}:{})});
    const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null,location:response.headers.get('location')};
  }
  try{
    const admin=guest();assert.equal((await api(admin,'/admin/settings',{config:{...DEFAULT_CAMPAIGN,active:true}},{'X-Campaign-Admin':'admin'})).status,200);
    const owner=guest(),attacker=guest();await api(owner,'/session');await api(attacker,'/session');
    const run=(await api(owner,'/runs',{})).data,driven=drive(run.challenge);time+=driven.ticks*1000/60+3000;
    assert.equal((await api(owner,'/submit',{runId:run.id,replay:driven.replay})).data.result.qualified,true);
    const start=await api(owner,'/auth/start',{provider:'farcaster',runId:run.id,publicProfile:false});assert.equal(start.status,200);assert.match(start.data.nonce,/^[a-f0-9]{32}$/);
    assert.equal((await api(attacker,'/auth/complete',{provider:'farcaster',nonce:start.data.nonce,message:'signed message',signature:'0xsigned'})).status,403,'nonce is bound to its initiating session');
    const oldCookie=owner.cookie,complete=await api(owner,'/auth/complete',{provider:'farcaster',nonce:start.data.nonce,message:'signed message',signature:'0xsigned'});
    assert.equal(complete.status,200);assert.notEqual(owner.cookie,oldCookie);assert.ok(complete.data.saved);assert.equal(complete.data.pass.provider,'farcaster');assert.equal(complete.data.pass.qualification.status,'qualified');
    assert.equal((await api(owner,'/auth/complete',{provider:'farcaster',nonce:start.data.nonce,message:'signed message',signature:'0xsigned'})).status,403,'nonce is single use');
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
test('persistent access, replay ownership, X uniqueness, qualified referrals and address deadlines',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'terminl-campaign-'));let time=1800000000000;
  const service=createCampaignService({dataDir:dir,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',xClientId:'client',xClientSecret:'secret',now:()=>time,
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
  async function win(client,ref){
    const start=await api(client,'/runs',{ref});assert.equal(start.status,201,JSON.stringify(start));
    const driven=drive(start.data.challenge);time+=driven.ticks*1000/60+3000;
    const submit=await api(client,'/submit',{runId:start.data.id,replay:driven.replay,score:99999999});
    assert.equal(submit.status,200,JSON.stringify(submit));assert.equal(submit.data.result.qualified,true);return start.data;
  }
  async function save(client,runId,id,publicProfile=false){
    const auth=await api(client,'/auth/start',{runId,publicProfile});assert.equal(auth.status,200);
    const state=new URL(auth.data.url).searchParams.get('state');
    const callback=await api(client,'/auth/callback?state='+state+'&code='+id);assert.equal(callback.status,303,JSON.stringify(callback));
    return (await api(client,'/me')).data.pass;
  }
  try{
    await settings({...DEFAULT_CAMPAIGN,active:true,capacity:3});
    const a=guest(),b=guest();await api(a,'/session');await api(b,'/session');
    assert.equal((await api(a,'/admin')).status,404);
    assert.equal((await api(a,'/runs',{}, {Origin:'https://evil.test'})).status,403);
    const start=await api(a,'/runs',{}),driven=drive(start.data.challenge);
    assert.equal((await api(b,'/runs/'+start.data.id)).status,404);
    assert.equal((await api(b,'/submit',{runId:start.data.id,replay:driven.replay})).status,404);
    assert.equal((await api(a,'/submit',{runId:start.data.id,replay:driven.replay})).status,422,'impossibly fast run rejected');
    time+=driven.ticks*1000/60+3000;
    assert.equal((await api(a,'/submit',{runId:start.data.id,replay:driven.replay})).status,200);
    assert.equal((await api(a,'/submit',{runId:start.data.id,replay:[]})).status,200,'submission idempotent');
    assert.equal((await api(a,'/auth/callback?state=wrong&code=1')).status,403);
    const passA=await save(a,start.data.id,'101');assert.equal(passA.qualification.status,'qualified');
    assert.equal(passA.publicProfile,false);
    const code=passA.runs[0].code;
    assert.equal((await api(b,'/results/'+code)).data.player,'ANON','private X identity never leaks');
    const runB=await win(b,code),passB=await save(b,runB.id,'202',true);
    assert.equal(passB.qualification.status,'qualified');assert.equal((await api(a,'/me')).data.pass.referrals,1);
    await api(b,'/claim',{runId:runB.id,publicProfile:true});assert.equal((await api(a,'/me')).data.pass.referrals,1,'repeat claim cannot farm referrals');
    const c=guest();await api(c,'/session');const own=await win(c,code);await save(c,own.id,'101');
    assert.equal((await api(a,'/me')).data.pass.referrals,1,'self referral rejected');
    assert.equal(service.store.get('SELECT count(*) AS n FROM qualifications').n,2,'X identity is unique');
    const address='0x52908400098527886E0F7030069857D2E4169EE7';
    assert.equal((await api(a,'/wallet',{address,chainId:4663,confirmed:true})).status,409,'closed address window');
    await settings({...DEFAULT_CAMPAIGN,active:true,capacity:3,addressStartsAt:Math.floor(time)-1000,addressEndsAt:Math.floor(time)+60000});
    assert.equal((await api(a,'/wallet',{address,chainId:1,confirmed:true})).status,400);
    assert.equal((await api(a,'/wallet',{address,chainId:4663,confirmed:true})).status,200);
    assert.equal((await api(b,'/wallet',{address,chainId:4663,confirmed:true})).status,409,'one address per X account');
    time+=61000;assert.equal((await api(a,'/wallet',{address:'0x'+'1'.repeat(40),chainId:4663,confirmed:true})).status,409,'frozen addresses cannot change');
    const board=(await api(a,'/leaderboard')).data.entries;assert.equal(board.length,2);assert.equal(new Set(board.map(e=>e.code)).size,2);
    assert.ok(service.store.get("SELECT count(*) AS n FROM audit WHERE action='wallet_saved'").n);
    assert.equal((await api(a,'/admin/addresses')).status,404,'address export is private');
    const exported=await api(guest(),'/admin/addresses',undefined,{'X-Campaign-Admin':'admin'});
    assert.equal(exported.data.frozen,true);assert.equal(exported.data.addresses.length,1);
    assert.equal(exported.data.addresses[0].address,address.toLowerCase());
    await settings({...service.store.config(),capacity:2});
    const d=guest();await api(d,'/session');const overflow=await win(d,code);
    assert.equal((await save(d,overflow.id,'303')).qualification.status,'waitlist','capacity cannot be oversubscribed');
    assert.equal((await api(a,'/me')).data.pass.referrals,1,'waitlisted accounts earn no referral credit');
    assert.equal((await api(d,'/results/'+overflow.code)).status,404);
    const bad=await api(b,'/auth/start',{runId:runB.id});const state=new URL(bad.data.url).searchParams.get('state');
    assert.equal((await api(a,'/auth/callback?state='+state+'&code=999')).status,403,'OAuth state bound to its session');
    await api(guest(),'/admin/review',{userId:'202',status:'banned',reason:'Automated test review'},{'X-Campaign-Admin':'admin'});
    assert.equal((await api(a,'/results/'+passB.runs[0].code)).status,404,'banned results are unpublished');
    assert.equal((await api(a,'/me')).data.pass.referrals,0,'invalid referrals are removed');
    const stale=await api(d,'/runs',{});time+=21*60000;
    assert.equal((await api(d,'/submit',{runId:stale.data.id,replay:driven.replay})).status,410);
    const blocked=await api(guest(),'/admin/review',{userId:'101',status:'banned',reason:'Export exclusion test'},{'X-Campaign-Admin':'admin'});
    assert.equal(blocked.status,200);
    assert.equal((await api(guest(),'/admin/addresses',undefined,{'X-Campaign-Admin':'admin'})).data.addresses.length,0,'suspended identities excluded from export');
    service.close();
    const restored=createCampaignService({dataDir:dir,serviceToken:'service',siteOrigin:'https://terminl.test'});
    assert.equal(restored.store.get('SELECT count(*) AS n FROM qualifications').n,3);
    assert.equal(restored.store.get('SELECT address FROM wallets WHERE user_id=?','101').address,address.toLowerCase());
    restored.close();
  }finally{await new Promise(r=>server.close(r));try{service.close();}catch{}await rm(dir,{recursive:true,force:true});}
});
