import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCampaignService} from '../server/arcade/campaign.mjs';
import {normalizeAddress} from '../server/arcade/campaign-address.mjs';
import {xAuthorize,xIdentity} from '../server/arcade/campaign-oauth.mjs';
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
