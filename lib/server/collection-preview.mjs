import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const PREVIEW_PREFIX=process.env.COLLECTION_PREVIEW_PREFIX||'terminl/admin-preview/v1';
const DEFAULT_ROOT=path.resolve(process.cwd(),'../ELEMENT/nft-projects/tickerbots/v2/output/collection-2048-terminl');
let catalogCache;

export function previewKey(){
  const raw=process.env.COLLECTION_PREVIEW_KEY||'';
  if(!/^[a-f0-9]{64}$/i.test(raw))throw new Error('Collection preview key is not configured');
  return Buffer.from(raw,'hex');
}

export function seal(data,objectName,key=previewKey()){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(objectName));
  const payload=Buffer.concat([cipher.update(data),cipher.final()]);
  return Buffer.concat([Buffer.from('TPV1'),iv,cipher.getAuthTag(),payload]);
}

export function unseal(data,objectName,key=previewKey()){
  if(data.length<32||data.subarray(0,4).toString()!=='TPV1')throw new Error('Invalid preview asset');
  const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(4,16));
  decipher.setAAD(Buffer.from(objectName));
  decipher.setAuthTag(data.subarray(16,32));
  return Buffer.concat([decipher.update(data.subarray(32)),decipher.final()]);
}

export function previewObject(kind,id){
  if(kind==='catalog')return `${PREVIEW_PREFIX}/catalog.enc`;
  if(!['thumb','image'].includes(kind)||!Number.isInteger(id)||id<0||id>9999)throw new Error('Invalid preview asset');
  return `${PREVIEW_PREFIX}/${kind}/${String(id).padStart(4,'0')}.enc`;
}

function localRoot(){
  return path.resolve(process.cwd(),process.env.TERMINL_COLLECTION_DIR||DEFAULT_ROOT);
}

async function hasLocalCollection(){
  try{await fs.access(path.join(localRoot(),'bulk-upload.json'));return true;}catch{return false;}
}

async function remoteObject(name){
  const bucket=process.env.COLLECTION_PREVIEW_BUCKET||'curent-marketplace';
  const url=`https://storage.googleapis.com/${bucket}/${name}`;
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Private preview object unavailable');
  return Buffer.from(await response.arrayBuffer());
}

export async function loadCatalog(){
  if(catalogCache&&Date.now()-catalogCache.at<300000)return catalogCache.data;
  let rows;
  if(await hasLocalCollection()){
    const source=JSON.parse(await fs.readFile(path.join(localRoot(),'bulk-upload.json'),'utf8'));
    rows=source.map((row,id)=>({id,name:row.name,description:row.description,attributes:row.attributes,...(row.screen_artist?{screen_artist:row.screen_artist}:{}),...(row.screen_source?{screen_source:row.screen_source}:{})}));
  }else{
    const name=previewObject('catalog');
    const encrypted=await remoteObject(name);
    rows=JSON.parse(unseal(encrypted,name).toString('utf8')).items;
  }
  if(!Array.isArray(rows)||rows.length!==2048||rows.some((row,id)=>row.id!==id))throw new Error('Invalid collection preview catalog');
  catalogCache={data:rows,at:Date.now()};
  return rows;
}

export async function loadImage(id,size){
  if(!Number.isInteger(id)||id<0||id>=2048||!['thumb','full'].includes(size))throw new Error('Invalid image request');
  if(await hasLocalCollection()){
    const source=path.join(localRoot(),'arweave-release/images-jpeg-q82',`${String(id).padStart(4,'0')}.jpg`);
    if(size==='full')return {data:await fs.readFile(source),type:'image/jpeg'};
    return {data:await sharp(source).resize(480,480,{kernel:'nearest'}).webp({quality:78,effort:4}).toBuffer(),type:'image/webp'};
  }
  const kind=size==='full'?'image':'thumb',name=previewObject(kind,id);
  const encrypted=await remoteObject(name);
  return {data:unseal(encrypted,name),type:size==='full'?'image/jpeg':'image/webp'};
}

export function facetsFor(rows){
  const facets={};
  for(const row of rows)for(const trait of row.attributes||[]){
    if(!facets[trait.trait_type])facets[trait.trait_type]={};
    facets[trait.trait_type][trait.value]=(facets[trait.trait_type][trait.value]||0)+1;
  }
  return Object.fromEntries(Object.entries(facets).map(([type,values])=>[type,Object.entries(values).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))]));
}

export function queryCatalog(rows,{q='',trait='',value='',sort='asc',offset=0,limit=48}={}){
  const needle=String(q).trim().toLowerCase().slice(0,80);
  const matches=rows.filter(row=>{
    if(needle&&!`${row.id} ${String(row.id).padStart(4,'0')} ${row.name} ${row.attributes.map(a=>a.value).join(' ')}`.toLowerCase().includes(needle))return false;
    return !trait||!value||row.attributes.some(a=>a.trait_type===trait&&a.value===value);
  });
  if(sort==='desc')matches.reverse();
  const start=Math.max(0,Math.min(Number(offset)||0,matches.length));
  const size=Math.max(1,Math.min(Number(limit)||48,72));
  return {total:matches.length,items:matches.slice(start,start+size),ids:matches.map(row=>row.id),next:start+size<matches.length?start+size:null};
}

export function sha256(buffer){return createHash('sha256').update(buffer).digest('hex');}
