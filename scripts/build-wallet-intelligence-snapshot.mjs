import fs from 'node:fs/promises';
import path from 'node:path';
import {applicationDigest,validateSnapshot} from '../lib/server/wallet-intelligence-store.mjs';
import {hydrateWallet,scenarioInputs,analyzeWallets,inPool,allocationRisk} from '../lib/wallet-intelligence.mjs';

const [directory,metadataFile,sourceFile]=process.argv.slice(2);
if(!directory||!metadataFile)throw new Error('Usage: node scripts/build-wallet-intelligence-snapshot.mjs <scan-directory> <live-metadata.json> [prior-wallet-report.json]');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const metadata=await read(metadataFile),ethereum=await read(path.join(directory,'ethereum-results.json')),robinhood=await read(path.join(directory,'robinhood-results.json')),tokens=await read(path.join(directory,'robinhood-token-balances.json'));
const e=new Map(ethereum.map(row=>[row.address,row])),r=new Map(robinhood.map(row=>[row.address,row])),applications=new Map(metadata.applications.map(row=>[row.address,row])),checks=new Map(metadata.engagement.map(row=>[row.address,row]));
const sourceRows=sourceFile?await read(sourceFile):[];
const priorSources=new Map(sourceRows.map(row=>[row.Wallet,row.Sources.split('; ').filter(value=>value!=='Source not recovered')]));
if(e.size!==ethereum.length||r.size!==robinhood.length||e.size!==metadata.wallets.length||r.size!==metadata.wallets.length||Object.keys(tokens).length!==metadata.wallets.length||applications.size!==metadata.applications.length)throw new Error('Snapshot coverage or uniqueness mismatch');
const names=new Set();
const enriched=metadata.wallets.map(row=>{
  if(!e.has(row.address)||!r.has(row.address)||!tokens[row.address])throw new Error('Missing scanned wallet');
  const sources=new Set(priorSources.get(row.address)||[]);
  if(applications.has(row.address))sources.add('WL application');
  if(!sources.size)for(const list of row.lists)sources.add(`Live ${list.kind.toUpperCase()}: ${list.source}`);
  for(const source of sources)names.add(source);
  return {...row,sources:[...sources].sort()};
});
const sourceNames=[...names].sort(),indices=new Map(sourceNames.map((name,index)=>[name,index]));
const wallets=enriched.map(row=>{
  const eth=e.get(row.address),rh=r.get(row.address),t=tokens[row.address],app=applications.get(row.address),check=checks.get(row.address);
  if(rh.native_wei!==t.native_wei)throw new Error('Independent Robinhood native balance mismatch');
  return {address:row.address,gtd:row.lists.some(x=>x.kind==='gtd'),fcfs:row.lists.some(x=>x.kind==='fcfs'),sources:row.sources.map(source=>indices.get(source)),
    ...(app?{app:[app.id,app.status,app.requested_kind,app.awarded_kind,app.review_group,app.created_at]}:{}),...(check?{check:[check.checks,check.lastAt]}:{}),
    eth:[eth.native_wei,eth.weth_raw,eth.usdc_raw,eth.usdt_raw,eth.account_type,eth.outgoing_transactions_lifetime,eth.outgoing_transactions_30d],
    rh:[rh.native_wei,t.weth_raw,t.usdg_raw,rh.account_type,rh.outgoing_transactions_lifetime,rh.outgoing_transactions_30d]};
});
const value=validateSnapshot({version:1,createdAt:new Date().toISOString(),allowlistAt:metadata.at,plannedSupply:2048,
  chains:{ethereum:await read(path.join(directory,'ethereum-anchor.json')),robinhood:await read(path.join(directory,'robinhood-anchor.json'))},
  masterDigest:metadata.masterDigest,applicationDigest:applicationDigest(metadata.applications),entriesFingerprint:JSON.stringify(metadata.entries),exclusionsFingerprint:JSON.stringify(metadata.excludedCounts),
  sourceNames,engagementTracking:metadata.engagementTracking,wallets});
await fs.writeFile(path.join(directory,'dashboard-snapshot.json'),JSON.stringify(value)+'\n');
const hydrated=wallets.map(row=>hydrateWallet(row,sourceNames)),scenario=scenarioInputs({});
const summary={snapshot:value.createdAt,wallets:wallets.length,bytes:Buffer.byteLength(JSON.stringify(value)),risk:allocationRisk(hydrated,scenario),pools:Object.fromEntries(['eligible','gtd','applications','pending-new','all'].map(pool=>[pool,analyzeWallets(hydrated.filter(w=>inPool(w,pool)),scenario)]))};
await fs.writeFile(path.join(directory,'dashboard-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
