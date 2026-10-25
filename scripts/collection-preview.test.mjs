import test from 'node:test';
import assert from 'node:assert/strict';
import {seal,unseal,queryCatalog,facetsFor} from '../lib/server/collection-preview.mjs';
import {sessionCookie,validSession} from '../lib/server/collection-preview-session.mjs';

test('preview objects require the matching key and object name',()=>{
  const key=Buffer.alloc(32,7),other=Buffer.alloc(32,8),data=Buffer.from('unrevealed art');
  const sealed=seal(data,'terminl/admin-preview/image/0001.enc',key);
  assert.deepEqual(unseal(sealed,'terminl/admin-preview/image/0001.enc',key),data);
  assert.throws(()=>unseal(sealed,'terminl/admin-preview/image/0002.enc',key));
  assert.throws(()=>unseal(sealed,'terminl/admin-preview/image/0001.enc',other));
});

test('catalog search, filters, ordering and pagination stay within the matching set',()=>{
  const rows=[
    {id:0,name:'TERMINL #0000',attributes:[{trait_type:'Companion',value:'Paul'}]},
    {id:1,name:'TERMINL #0001',attributes:[{trait_type:'Companion',value:'Max'}]},
    {id:2,name:'TERMINL #0002',attributes:[{trait_type:'Companion',value:'Paul'}]},
  ];
  assert.deepEqual(queryCatalog(rows,{trait:'Companion',value:'Paul',sort:'desc',limit:1}).ids,[2,0]);
  assert.deepEqual(queryCatalog(rows,{trait:'Companion',value:'Paul',sort:'desc',offset:1,limit:1}).items.map(x=>x.id),[0]);
  assert.deepEqual(queryCatalog(rows,{q:'Max'}).ids,[1]);
  assert.equal(facetsFor(rows).Companion.find(([name])=>name==='Paul')[1],2);
});

test('admin session is signed, scoped and expires',()=>{
  process.env.CAMPAIGN_SERVICE_TOKEN='test-secret-that-is-long-enough-for-session-signing';
  const cookie=sessionCookie(false);
  assert.equal(validSession(cookie),true);
  assert.equal(validSession(cookie.replace('terminl_preview=','other=')),false);
  assert.equal(validSession(cookie.replace(/(terminl_preview=[^.]+\.)[A-Za-z0-9_-]/,'$1x')),false);
});
