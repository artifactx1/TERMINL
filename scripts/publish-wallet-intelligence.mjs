import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Storage} from '@google-cloud/storage';
import {sealSnapshot,openSnapshot,SNAPSHOT_BUCKET,SNAPSHOT_OBJECT} from '../lib/server/wallet-intelligence-store.mjs';

const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/publish-wallet-intelligence.mjs <completed-snapshot.json> [--dry-run]');
const snapshot=JSON.parse(await fs.readFile(input,'utf8'));
const sealed=sealSnapshot(snapshot);
if(openSnapshot(sealed).wallets.length!==snapshot.wallets.length)throw new Error('Snapshot round-trip failed');
const digest=createHash('sha256').update(sealed).digest('hex');
if(process.argv.includes('--dry-run'))console.log(JSON.stringify({dryRun:true,wallets:snapshot.wallets.length,encryptedBytes:sealed.length}));
else{
  const raw=process.env.GCS_SERVICE_ACCOUNT_JSON;
  if(!raw)throw new Error('GCS service account is not configured');
  const credentials=JSON.parse(raw.trim().startsWith('{')?raw:Buffer.from(raw,'base64').toString());
  const storage=new Storage({projectId:credentials.project_id,credentials}),bucket=storage.bucket(SNAPSHOT_BUCKET);
  const options={resumable:false,metadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'}};
  const archive=`terminl/admin-wallet-intelligence/history/${snapshot.createdAt.replace(/[:.]/g,'-')}-${digest.slice(0,12)}.enc`;
  await bucket.file(archive).save(sealed,options);
  // Object replacement is atomic; the dashboard only sees completed snapshots.
  await bucket.file(SNAPSHOT_OBJECT).save(sealed,options);
  console.log(JSON.stringify({published:true,wallets:snapshot.wallets.length,encryptedBytes:sealed.length,sha256:digest,archive}));
}
