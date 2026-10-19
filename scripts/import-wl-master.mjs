import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {normalizeAddress} from '../server/arcade/campaign-address.mjs';

const file=process.argv[2];
const apply=process.argv.includes('--apply');
const merge=process.argv.includes('--merge');
if(!file){
  console.error('Usage: node scripts/import-wl-master.mjs <private-manifest.json> [--merge] [--apply]');
  process.exit(2);
}

const bytes=readFileSync(file);
const digest=createHash('sha256').update(bytes).digest('hex');
const body=JSON.parse(bytes);
if(!Array.isArray(body.entries)||!body.entries.length)throw new Error('The manifest has no entries.');
const keys=new Set(),counts={gtd:0,fcfs:0};
for(const [index,row] of body.entries.entries()){
  if(!['gtd','fcfs'].includes(row?.kind))throw new Error(`Invalid tier at row ${index+1}.`);
  let address;try{address=normalizeAddress(row.address);}catch{throw new Error(`Invalid wallet at row ${index+1}.`);}
  const key=address+':'+row.kind;
  if(keys.has(key))throw new Error(`Duplicate tier entry at row ${index+1}.`);
  keys.add(key);counts[row.kind]++;
}
if(!counts.gtd||!counts.fcfs)throw new Error('Both GTD and FCFS tiers are required for a master snapshot.');
const snapshotDigest=createHash('sha256').update([...keys].map(key=>{
  const separator=key.lastIndexOf(':');return key.slice(0,separator)+','+key.slice(separator+1);
}).sort().join('\n')).digest('hex');
console.log(JSON.stringify({validated:true,counts,sha256:digest,snapshotDigest,mode:apply?'apply':'dry-run',operation:merge?'merge':'replace'}));
if(!apply)process.exit(0);

const expected=process.env.WL_IMPORT_EXPECTED_SHA256;
if(!expected||expected!==digest)throw new Error('Set WL_IMPORT_EXPECTED_SHA256 to the reviewed dry-run hash.');
const base=process.env.WL_IMPORT_URL?.replace(/\/$/,'');
const origin=process.env.WL_IMPORT_ORIGIN;
const credentialsPath=process.env.WL_IMPORT_CREDENTIALS;
if(!base||!origin||!credentialsPath)throw new Error('Set WL_IMPORT_URL, WL_IMPORT_ORIGIN and WL_IMPORT_CREDENTIALS.');
const secrets=JSON.parse(readFileSync(credentialsPath,'utf8'));
if(!secrets.CAMPAIGN_SERVICE_TOKEN||!secrets.CAMPAIGN_ADMIN_TOKEN)throw new Error('The credentials file lacks campaign tokens.');
const headers={Authorization:`Bearer ${secrets.CAMPAIGN_SERVICE_TOKEN}`,
  'X-Campaign-Admin':secrets.CAMPAIGN_ADMIN_TOKEN,'X-Campaign-Client':'terminl-master-import',Origin:origin,
  'Content-Type':'application/json'};
const endpoint=base+'/campaign/admin/wl';
const before=await fetch(endpoint,{headers});
if(!before.ok)throw new Error(`WL admin endpoint unavailable (${before.status}); deploy the backend before importing.`);
const beforeState=await before.json();
const response=await fetch(endpoint+(merge?'/merge':'/import'),{method:'POST',headers,body:bytes});
const result=await response.json().catch(()=>({}));
if(!response.ok)throw new Error(`Master import failed (${response.status}): ${result.error||'unknown error'}`);
const actual=Object.fromEntries((result.counts||[]).map(row=>[row.kind,row.count]));
if(!merge&&(actual.gtd!==counts.gtd||actual.fcfs!==counts.fcfs))throw new Error('Import response counts differ from the reviewed manifest.');
if(!merge&&result.digest!==snapshotDigest)throw new Error('Import response digest differs from the reviewed addresses.');
if(merge){
  const prior=Object.fromEntries((beforeState.masterCounts||[]).map(row=>[row.kind,row.count]));
  const delta=(actual.gtd||0)+(actual.fcfs||0)-(prior.gtd||0)-(prior.fcfs||0);
  if(delta!==result.added||delta<0||delta>counts.gtd+counts.fcfs)throw new Error('Merge response delta differs from the reviewed manifest.');
}
const after=await fetch(endpoint,{headers});
if(!after.ok)throw new Error(`Import succeeded but readback failed (${after.status}).`);
const readback=await after.json();
const stored=Object.fromEntries((readback.masterCounts||[]).map(row=>[row.kind,row.count]));
if(stored.gtd!==actual.gtd||stored.fcfs!==actual.fcfs)throw new Error('Import succeeded but stored counts differ from the response.');
if(readback.masterDigest!==result.digest)throw new Error('Import succeeded but stored addresses differ from the response.');
console.log(JSON.stringify({imported:true,verified:true,operation:merge?'merge':'replace',added:result.added,counts:actual,sha256:digest,masterDigest:result.digest}));
