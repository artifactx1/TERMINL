/** Upload an encrypted, admin-only browsing copy of the locked JPEG release.
 *
 * Run with GCS_SERVICE_ACCOUNT_JSON and COLLECTION_PREVIEW_KEY in the
 * environment. The bucket may be public: only authenticated API routes ever
 * decrypt these objects. The catalog is uploaded last so partial runs stay
 * unavailable. Re-running the same release/key resumes missing objects.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {Storage} from '@google-cloud/storage';
import {previewKey,seal} from '../lib/server/collection-preview.mjs';

const root=path.resolve(process.cwd(),process.env.TERMINL_COLLECTION_DIR||'../ELEMENT/nft-projects/tickerbots/v2/output/collection-2048-terminl');
const release=path.join(root,'arweave-release');
const sum=data=>createHash('sha256').update(data).digest('hex');
const key=previewKey();
const releaseHash=sum(await fs.readFile(path.join(release,'SHA256SUMS-images-jpg-q82.txt')));
const prefix=`terminl/admin-preview/${releaseHash.slice(0,12)}-${sum(key).slice(0,8)}`;
const raw=process.env.GCS_SERVICE_ACCOUNT_JSON;
const credentials=raw?JSON.parse(raw.trim().startsWith('{')?raw:Buffer.from(raw,'base64').toString('utf8')):undefined;
const storage=new Storage(credentials?{projectId:process.env.GCS_PROJECT_ID||credentials.project_id,credentials}:{projectId:process.env.GCS_PROJECT_ID});
const bucket=storage.bucket(process.env.COLLECTION_PREVIEW_BUCKET||process.env.GCS_BUCKET_NAME||'curent-marketplace');
const source=JSON.parse(await fs.readFile(path.join(root,'bulk-upload.json'),'utf8'));
if(source.length!==2048)throw new Error('Expected the locked 2048-piece collection');
const catalog={version:1,supply:source.length,releaseHash,items:source.map((row,id)=>({id,name:row.name,description:row.description,attributes:row.attributes,...(row.screen_artist?{screen_artist:row.screen_artist}:{}),...(row.screen_source?{screen_source:row.screen_source}:{})}))};
const dry=process.argv.includes('--dry-run');
console.log(JSON.stringify({bucket:bucket.name,prefix,files:4097,dryRun:dry}));
if(!dry){
  const [objects]=await bucket.getFiles({prefix:`${prefix}/`});
  const existing=new Set(objects.map(file=>file.name));
  const tasks=[];
  for(let id=0;id<source.length;id++)for(const kind of ['thumb','image'])tasks.push({id,kind});
  let cursor=0,completed=0,uploaded=0;
  async function worker(){
    while(cursor<tasks.length){
      const {id,kind}=tasks[cursor++];
      const name=`${prefix}/${kind}/${String(id).padStart(4,'0')}.enc`;
      if(!existing.has(name)){
        const file=path.join(release,'images-jpeg-q82',`${String(id).padStart(4,'0')}.jpg`);
        const data=kind==='image'?await fs.readFile(file):await sharp(file).resize(480,480,{kernel:'nearest'}).webp({quality:78,effort:4}).toBuffer();
        await bucket.file(name).save(seal(data,name,key),{resumable:false,metadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'}});
        uploaded++;
      }
      completed++;
      if(completed%100===0||completed===tasks.length)console.log(`${completed}/${tasks.length} processed; ${uploaded} uploaded`);
    }
  }
  await Promise.all(Array.from({length:8},worker));
  const catalogName=`${prefix}/catalog.enc`;
  if(!existing.has(catalogName))await bucket.file(catalogName).save(seal(Buffer.from(JSON.stringify(catalog)),catalogName,key),{resumable:false,metadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'}});
  console.log(JSON.stringify({ready:true,prefix,uploaded}));
}
