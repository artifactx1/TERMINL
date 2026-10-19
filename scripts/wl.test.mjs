import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openCampaignStore} from '../server/arcade/campaign-store.mjs';
import {createWlService} from '../server/arcade/wl.mjs';
import {createCampaignService} from '../server/arcade/campaign.mjs';

const WALLET='0x1111111111111111111111111111111111111111';
const SECOND='0x2222222222222222222222222222222222222222';

test('applications stay pending until review; rolling entries and Arcade Pass spots appear in the checker',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'terminl-wl-'));
  const store=openCampaignStore(directory),wl=createWlService(store,()=>1800000000000);
  try{
    assert.deepEqual(wl.check(WALLET).lists,[]);
    assert.throws(()=>wl.submit({address:WALLET,email:'invalid',requestedKind:'gtd',emailConsent:true,socialConfirmed:true}),/email/);
    assert.throws(()=>wl.submit({address:WALLET,email:'test@example.com',requestedKind:'gtd',emailConsent:true}),/Open the X links/);
    assert.deepEqual(wl.submit({address:WALLET,email:'Test@Example.com',requestedKind:'both',emailConsent:true,socialConfirmed:true,note:'Arcade fan'}),{received:true});
    assert.deepEqual(wl.check(WALLET).lists,[],'an application does not grant a spot');
    assert.deepEqual(wl.submit({address:WALLET,email:'other@example.com',requestedKind:'gtd',emailConsent:true,socialConfirmed:true}),{received:true},'repeat submissions do not reveal the saved email');
    const application=wl.admin().applications[0];
    assert.equal(application.email,'test@example.com');
    assert.deepEqual(wl.contacts().contacts,[]);
    wl.review({id:application.id,status:'approved',awardedKind:'both',reason:'Selected for launch'});
    assert.deepEqual(wl.check(WALLET).lists.map(row=>row.kind),['fcfs','gtd']);
    assert.equal(wl.contacts().contacts[0].email,'test@example.com');
    wl.review({id:application.id,status:'rejected',reason:'Approval reversed'});
    assert.deepEqual(wl.check(WALLET).lists,[],'reversal removes application entries');
    wl.setEntry({address:WALLET,kind:'gtd',action:'add',reason:'Partner allocation'});
    assert.deepEqual(wl.check(WALLET).lists,[{kind:'gtd',source:'manual'}]);
    wl.setEntry({address:WALLET,kind:'gtd',action:'remove',reason:'Partner removed'});
    assert.deepEqual(wl.check(WALLET).lists,[]);
    wl.setEntry({address:WALLET,kind:'fcfs',action:'add',reason:'Partner allocation'});
    assert.deepEqual(wl.contacts().contacts,[],'a manual award does not revive a rejected application contact');
    const firstImport=wl.importMaster({entries:[{address:WALLET,kind:'gtd'},{address:SECOND,kind:'fcfs'},{address:WALLET,kind:'gtd'}],reason:'Master workbook sync'});
    assert.equal(firstImport.deduplicated,2);
    assert.equal(wl.admin().masterDigest,firstImport.digest,'private readback identifies the exact imported snapshot');
    const merged=wl.mergeMaster({entries:[{address:SECOND,kind:'gtd'},{address:SECOND,kind:'fcfs'},{address:SECOND,kind:'gtd'}],reason:'New partner winners'});
    assert.equal(merged.added,1,'merge only inserts new tier pairs');
    assert.equal(merged.deduplicated,2);
    assert.deepEqual(wl.check(SECOND).lists.map(row=>row.kind),['fcfs','gtd']);
    assert.throws(()=>wl.mergeMaster({entries:[{address:'invalid',kind:'gtd'}],reason:'Bad partner row'}),/row 1/);
    assert.equal(wl.admin().masterDigest,merged.digest,'invalid merge preserves existing master rows');
    assert.deepEqual(wl.check(WALLET).lists.map(row=>row.kind),['fcfs'],'an earlier admin exclusion overrides the imported entry');
    wl.setEntry({address:WALLET,kind:'gtd',action:'add',reason:'Reinstate master address'});
    assert.deepEqual(wl.check(WALLET).lists.map(row=>row.kind),['fcfs','gtd']);
    assert.throws(()=>wl.importMaster({entries:[{address:'invalid',kind:'gtd'}],reason:'Bad workbook row'}),/row 1/);
    assert.equal(wl.admin().masterCounts.reduce((total,row)=>total+row.count,0),3,'invalid imports preserve the prior master snapshot');
    wl.setEntry({address:WALLET,kind:'gtd',action:'remove',reason:'Corrected master exception'});
    assert.deepEqual(wl.check(WALLET).lists.map(row=>row.kind),['fcfs'],'admin exclusions override a master entry');
    wl.importMaster({entries:[{address:WALLET,kind:'gtd'}],reason:'New master workbook'});
    assert.deepEqual(wl.check(SECOND).lists,[],'reimport replaces old master entries');
    assert.deepEqual(wl.check(WALLET).lists.map(row=>row.kind),['fcfs'],'exclusions survive reimport');
    wl.setEntry({address:WALLET,kind:'gtd',action:'add',reason:'Exception resolved'});
    assert.deepEqual(wl.check(WALLET).lists.map(row=>row.kind),['fcfs','gtd']);

    store.run("INSERT INTO users(id,username,name,created_at,last_seen) VALUES('player','player','Player',?,?)",1800000000000,1800000000000);
    store.run("INSERT INTO runs(id,anon_id,challenge,started_at,expires_at,code,kind,user_id) VALUES('run','anon','{}',?,?,'abcdefghABCDEFGH','cup','player')",1800000000000,1800000100000);
    store.run("INSERT INTO spots(user_id,route,run_id,status,created_at) VALUES('player','cup','run','qualified',?)",1800000000000);
    store.run("INSERT INTO wallets(user_id,address,chain_id,updated_at) VALUES('player',?,4663,?)",SECOND,1800000000000);
    assert.deepEqual(wl.check(SECOND).lists,[{kind:'fcfs',source:'arcade'}]);
    store.run("INSERT INTO gtd(user_id,position,points,created_at) VALUES('player',1,50,?)",1800000000000);
    store.run('INSERT INTO gtd_close(id,ends_at,closed_at) VALUES(1,?,?)',1800000000000,1800000000000);
    assert.deepEqual(wl.check(SECOND).lists.map(row=>row.kind),['fcfs','gtd']);
  }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('public WL routes stay pending until review and tied leaderboard scores get distinct ranks',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'terminl-wl-routes-'));
  const service=createCampaignService({dataDir:directory,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test'});
  const server=http.createServer((request,response)=>void service.handle(request,response));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/campaign`;
  const call=async(path,body,admin=false)=>{
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json','X-Campaign-Client':'route-test',...(admin?{'X-Campaign-Admin':'admin'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  };
  try{
    const post='https://x.com/TERMINLnet/status/123456789';
    assert.equal((await call('/admin/settings',{config:{wlPostUrl:post}},true)).status,200);
    assert.equal((await call('/config')).data.config.wlPostUrl,post,'the application receives the current admin-selected post');
    assert.equal((await call('/admin/settings',{config:{wlPostUrl:'https://x.com/TERMINLnet/status/987654321'}},true)).status,200);
    assert.equal((await call('/config')).data.config.wlPostUrl,'https://x.com/TERMINLnet/status/987654321','the post can change without a site build');
    assert.equal((await call('/wl/check/'+WALLET)).data.eligible,false);
    assert.equal((await call('/wl/apply',{address:WALLET,email:'winner@example.com',requestedKind:'fcfs',emailConsent:true})).status,400);
    assert.equal((await call('/wl/apply',{address:WALLET,email:'winner@example.com',requestedKind:'fcfs',emailConsent:true,socialConfirmed:true})).status,200);
    assert.equal((await call('/wl/check/'+WALLET)).data.eligible,false);
    assert.equal((await call('/admin/wl')).status,404);
    const application=(await call('/admin/wl',null,true)).data.applications[0];
    assert.equal(application.status,'pending');
    assert.equal((await call('/admin/wl/review',{id:application.id,status:'approved',awardedKind:'fcfs',reason:'Selected for launch'},true)).status,200);
    assert.deepEqual((await call('/wl/check/'+WALLET)).data.lists,[{kind:'fcfs',source:'application'}]);
    assert.equal((await call('/admin/wl/import',{entries:[{address:SECOND,kind:'gtd'}],reason:'Master workbook sync'},true)).status,200);
    assert.deepEqual((await call('/wl/check/'+SECOND)).data.lists,[{kind:'gtd',source:'master'}]);
    assert.equal((await call('/admin/wl/merge',{entries:[{address:WALLET,kind:'gtd'}],reason:'New partner winners'},true)).status,200);
    assert.deepEqual((await call('/wl/check/'+SECOND)).data.lists,[{kind:'gtd',source:'master'}],'merge retains prior master entries');

    for(const [id,last] of [['first',100],['second',200]]){
      service.store.run('INSERT INTO users(id,username,name,created_at,last_seen) VALUES(?,?,?,?,?)',id,id,id,1,1);
      service.store.run(`INSERT INTO runs(id,anon_id,challenge,started_at,expires_at,code,kind,user_id,points,last_segment_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`,id,id,'{}',1,1000,id.padEnd(16,'x'),'cup',id,50,last);
    }
    const board=(await call('/leaderboard')).data.entries;
    assert.deepEqual(board.slice(0,2).map(row=>row.rank),[1,2]);
    assert.deepEqual(board.slice(0,2).map(row=>row.points),[50,50]);
  }finally{await new Promise(resolve=>server.close(resolve));service.close();await rm(directory,{recursive:true,force:true});}
});

test('wallet checks count distinct browsers and searched wallets only in private admin metrics',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'terminl-wl-tracking-'));
  const service=createCampaignService({dataDir:directory,serviceToken:'service',adminToken:'admin',siteOrigin:'https://terminl.test',now:()=>1800000000000});
  const server=http.createServer((request,response)=>void service.handle(request,response));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/campaign`;
  const call=async(path,{body,cookie,admin=false}={})=>{
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer service',Origin:'https://terminl.test','Content-Type':'application/json','X-Campaign-Client':'checker-test',...(cookie?{Cookie:cookie}:{}),...(admin?{'X-Campaign-Admin':'admin'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0],data:await response.json()};
  };
  try{
    assert.equal((await call('/admin/wl/import',{admin:true,body:{entries:[{address:WALLET,kind:'gtd'}],reason:'Checker tracking fixture'}})).status,200);
    const first=await call('/wl/check/'+WALLET+'?source=mint');
    assert.equal(first.data.eligible,true);
    assert.ok(first.cookie?.startsWith('btb_session='));
    assert.equal((await call('/wl/check/'+WALLET+'?source=wl',{cookie:first.cookie})).status,200);
    assert.equal((await call('/wl/check-event',{cookie:first.cookie,body:{address:SECOND,source:'mint',outcome:'not_listed'}})).status,200);
    assert.equal((await call('/wl/check-event',{cookie:first.cookie,body:{address:SECOND,source:'mint',outcome:'failed'}})).status,200);
    assert.equal((await call('/wl/check/'+WALLET+'?source=connected',{cookie:first.cookie})).status,200);
    assert.equal((await call('/wl/check-event',{cookie:first.cookie,body:{address:SECOND,source:'connected',outcome:'listed'}})).status,200);
    assert.equal((await call('/admin')).status,404,'checker metrics stay private');
    const metrics=(await call('/admin',{admin:true})).data.wlChecker;
    assert.deepEqual(metrics.summary,{attempts:4,completed:3,browsers:1,wallets:2,listed:2,notListed:1,failed:1});
    assert.equal(metrics.daily[0].completed,3);
    assert.deepEqual(metrics.sources.map(row=>[row.source,row.mode,row.completed].join(':')).sort(),['connected:published:1','connected:rolling:1','mint:published:1','mint:rolling:1','wl:rolling:1']);
    const details=service.store.all("SELECT detail FROM events WHERE name='wl_check'").map(row=>row.detail).join(' ');
    assert.ok(!details.includes(WALLET)&&!details.includes(SECOND),'events never store searched wallet addresses');
  }finally{await new Promise(resolve=>server.close(resolve));service.close();await rm(directory,{recursive:true,force:true});}
});
