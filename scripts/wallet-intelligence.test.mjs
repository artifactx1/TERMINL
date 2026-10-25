import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEth,scenarioInputs,hydrateWallet,fundingFor,analyzeWallets,allocationRisk,inPool,csvFor,balanceMatrix} from '../lib/wallet-intelligence.mjs';
import {validateSnapshot,sealSnapshot,openSnapshot,applicationDigest} from '../lib/server/wallet-intelligence-store.mjs';

const address=id=>'0x'+id.toString(16).padStart(40,'0');
const row=(id,{eth='0',rh='0',ew='0',rw='0',gtd=false,fcfs=false,et='eoa',rt='eoa',app}={})=>({address:address(id),gtd,fcfs,sources:[],eth:[String(parseEth(eth)),String(parseEth(ew)),'0','0',et,0,0],rh:[String(parseEth(rh)),String(parseEth(rw)),'0',rt,0,0],...(app?{app:[id.toString(16).padStart(32,'0'),'pending','both',null,'outside_burst',1700000000000]}:{})});
const wallet=(id,options)=>hydrateWallet(row(id,options));
const scenario=scenarioInputs({});
const sample=()=>({version:1,createdAt:'2026-10-25T19:00:00Z',chains:{ethereum:{endBlockHash:'0x123'},robinhood:{endBlockHash:'0x456'}},sourceNames:[],wallets:[row(1,{gtd:true})]});

test('integer wei comparisons include the fee reserve at the exact boundary',()=>{
  const good=wallet(1,{rh:'0.0101'}),short={...good,robinhood:{...good.robinhood,native:good.robinhood.native-1n}};
  assert.equal(fundingFor(good,scenario).ready,1);assert.equal(fundingFor(short,scenario).ready,0);
  assert.equal(parseEth('0.000000000000000001'),1n);
});
test('bridge pools include ready wallets once and deduct the Ethereum reserve',()=>{
  const rows=[wallet(1,{rh:'0.0101',eth:'1'}),wallet(2,{eth:'0.0111'}),wallet(3,{eth:'0.011099999999999999'})];
  const result=analyzeWallets(rows,scenario);assert.equal(result.ready,1);assert.equal(result.bridge,2);assert.equal(result.routes.bridge,1);assert.equal(result.routes.underfunded,1);
});
test('WETH requires gas and still pays the Robinhood reserve after bridging',()=>{
  assert.equal(fundingFor(wallet(1,{rw:'10'}),scenario).converted,0);
  assert.equal(fundingFor(wallet(2,{ew:'10'}),scenario).converted,0);
  assert.equal(fundingFor(wallet(3,{eth:'0.001',ew:'0.01'}),scenario).converted,0);
  assert.equal(fundingFor(wallet(4,{eth:'0.001',ew:'0.0101'}),scenario).converted,1);
  assert.equal(fundingFor(wallet(5,{rh:'0.0001',rw:'0.01'}),scenario).route,'convert');
});
test('contract balances are excluded only on the relevant route',()=>{
  assert.equal(fundingFor(wallet(1,{eth:'100',et:'contract'}),scenario).bridge,0);
  assert.equal(fundingFor(wallet(2,{eth:'100',rh:'0.0101',et:'contract'}),scenario).ready,1);
  assert.equal(fundingFor(wallet(3,{rh:'100',rt:'contract'}),scenario).route,'contract');
  assert.equal(fundingFor(wallet(4,{rh:'0.0101',rt:'delegated_eoa'}),scenario).ready,1);
});
test('wallet caps are not additive across tiers and affordable partial quantities count',()=>{
  const input=scenarioInputs({gtdCap:2,otherCap:5});
  assert.equal(fundingFor(wallet(1,{gtd:true,fcfs:true,rh:'100'}),input).ready,2);
  assert.equal(fundingFor(wallet(2,{fcfs:true,rh:'0.0251'}),input).ready,2);
  assert.equal(fundingFor(wallet(3,{fcfs:true,rh:'100'}),input).ready,5);
});
test('pending applicants do not become allocations and unfunded GTD still counts as a promise',()=>{
  const rows=[wallet(1,{gtd:true,fcfs:true}),wallet(2,{gtd:true}),wallet(3,{app:true,rh:'1'})];
  assert.equal(rows.filter(w=>inPool(w,'eligible')).length,2);assert.equal(rows.filter(w=>inPool(w,'pending-new')).length,1);
  assert.deepEqual(allocationRisk(rows,scenarioInputs({supply:1})),{gtd:2,eligible:2,gtdCommitment:2,excess:1,maximumFcfsAfterGtd:0,ratio:2});
});
test('invalid inputs fail explicitly rather than rendering plausible zero counts',()=>{
  for(const input of [{price:'0'},{price:'NaN'},{price:'1e-3'},{supply:0},{reserved:2048},{gtdCap:1.5},{participation:101},{rhReserve:'-1'}])assert.throws(()=>scenarioInputs(input));
});
test('matrix partitions wallets and CSV retains exact small balances safely',()=>{
  const rows=[wallet(1,{rh:'0.000000000000000001'}),wallet(2,{rh:'0.1',eth:'1'})];
  rows[0].sources=['=DANGEROUS()'];assert.equal(balanceMatrix(rows).cells.flat().reduce((a,b)=>a+b,0),2);
  const csv=csvFor(rows,scenario);assert.match(csv,/0\.000000000000000001/);assert.match(csv,/'=DANGEROUS\(\)/);
});
test('snapshot rejects duplicate addresses and malformed account amounts',()=>{
  const duplicate=sample();duplicate.wallets.push(duplicate.wallets[0]);assert.throws(()=>validateSnapshot(duplicate));
  const malformed=sample();malformed.wallets[0].eth[0]='-1';assert.throws(()=>validateSnapshot(malformed));
});
test('snapshot encryption authenticates both contents and the service key',()=>{
  const secret='test-only-service-secret-abcdefghijklmnopqrstuvwxyz',value=sample(),encrypted=sealSnapshot(value,secret);
  assert.deepEqual(openSnapshot(encrypted,secret),value);
  assert.equal(encrypted.includes(Buffer.from(value.wallets[0].address)),false);
  assert.throws(()=>openSnapshot(encrypted,'wrong-service-secret-abcdefghijklmnopqrstuvwxyz'));
  encrypted[encrypted.length-1]^=1;assert.throws(()=>openSnapshot(encrypted,secret));
});
test('application consistency ignores order and changes when review status changes',()=>{
  const a={id:'a',address:address(1),status:'pending',awarded_kind:null,created_at:1},b={...a,id:'b',address:address(2)};
  assert.equal(applicationDigest([a,b]),applicationDigest([b,a]));assert.notEqual(applicationDigest([a]),applicationDigest([{...a,status:'approved',awarded_kind:'gtd'}]));
});
