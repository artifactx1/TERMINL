import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';

export const SNAPSHOT_OBJECT='terminl/admin-wallet-intelligence/latest.enc';
export const SNAPSHOT_BUCKET='curent-marketplace';
const MAGIC=Buffer.from('TWI1');
function key(secret=process.env.CAMPAIGN_SERVICE_TOKEN){
  if(typeof secret!=='string'||secret.length<24)throw new Error('Campaign service is not configured');
  return createHmac('sha256',secret).update('terminl:wallet-intelligence:encryption:v1').digest();
}
export function validateSnapshot(value){
  if(value?.version!==1||!Array.isArray(value.wallets)||value.wallets.length<1||value.wallets.length>50000||!Array.isArray(value.sourceNames)||!value.chains?.ethereum?.endBlockHash||!value.chains?.robinhood?.endBlockHash||!Number.isFinite(Date.parse(value.createdAt)))throw new Error('Invalid wallet snapshot');
  const addresses=new Set();
  for(const row of value.wallets){
    if(!/^0x[0-9a-f]{40}$/.test(row.address)||addresses.has(row.address)||typeof row.gtd!=='boolean'||typeof row.fcfs!=='boolean'||row.eth?.length!==7||row.rh?.length!==6)throw new Error('Invalid wallet row');
    addresses.add(row.address);
    for(const n of [...row.eth.slice(0,4),...row.rh.slice(0,3)])if(typeof n!=='string'||!/^\d{1,78}$/.test(n))throw new Error('Invalid balance');
    for(const t of [row.eth[4],row.rh[3]])if(!['eoa','delegated_eoa','contract'].includes(t))throw new Error('Invalid account type');
    for(const n of [...row.eth.slice(5),...row.rh.slice(4)])if(n!==null&&(!Number.isSafeInteger(n)||n<0))throw new Error('Invalid nonce');
    if(row.app&&(!Array.isArray(row.app)||row.app.length!==6||!['pending','approved','rejected'].includes(row.app[1])))throw new Error('Invalid application');
  }
  // Keep the authenticated JSON response below the platform response-size limit.
  if(Buffer.byteLength(JSON.stringify(value))>4_000_000)throw new Error('Snapshot exceeds the response budget');
  return value;
}
export function sealSnapshot(snapshot,secret){
  validateSnapshot(snapshot);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);
  cipher.setAAD(Buffer.from(SNAPSHOT_OBJECT));
  const payload=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),payload]);
}
export function openSnapshot(data,secret){
  if(data.length<33||!data.subarray(0,4).equals(MAGIC))throw new Error('Invalid encrypted snapshot');
  const cipher=createDecipheriv('aes-256-gcm',key(secret),data.subarray(4,16));
  cipher.setAAD(Buffer.from(SNAPSHOT_OBJECT));cipher.setAuthTag(data.subarray(16,32));
  const clear=Buffer.concat([cipher.update(data.subarray(32)),cipher.final()]);
  return validateSnapshot(JSON.parse(gunzipSync(clear,{maxOutputLength:4_000_000}).toString('utf8')));
}
export async function loadSnapshot(){
  const response=await fetch(`https://storage.googleapis.com/${SNAPSHOT_BUCKET}/${SNAPSHOT_OBJECT}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Wallet snapshot unavailable');
  return openSnapshot(Buffer.from(await response.arrayBuffer()));
}
export function applicationDigest(rows){
  const payload=rows.map(a=>[a.id,a.address,a.status,a.awarded_kind||'',a.created_at].join('|')).sort().join('\n');
  return createHmac('sha256','terminl-wallet-snapshot-consistency-v1').update(payload).digest('hex');
}
