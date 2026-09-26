import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {Worker} from 'node:worker_threads';

export const token=()=>randomBytes(32).toString('base64url');
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const fingerprint=(secret,value)=>createHmac('sha256',secret).update(String(value)).digest('hex');
export function cookieValue(request,name){
  const item=(request.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
  return item?item.slice(name.length+1):null;
}
export function sessionCookie(value,secure=true,maxAge=30*86400){return `btb_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export function readJson(request,maxBytes=400000){return new Promise((resolve,reject)=>{
  if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||'')){reject(Object.assign(new Error('Expected JSON'),{status:415}));return;}
  let size=0,done=false;const chunks=[];
  request.on('data',part=>{if(done)return;size+=part.length;if(size>maxBytes){done=true;reject(Object.assign(new Error('Request too large'),{status:413}));return;}chunks.push(part);});
  request.on('end',()=>{if(done)return;try{const body=JSON.parse(Buffer.concat(chunks).toString());if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();resolve(body);}catch{reject(Object.assign(new Error('Invalid JSON'),{status:400}));}});
  request.on('error',reject);
});}
let verifying=0;
export function verifyReplay(challenge,replay){
  if(verifying>=2)return Promise.reject(Object.assign(new Error('Verification is busy. Your run is kept; try again.'),{status:503}));
  verifying++;
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./campaign-replay.mjs',import.meta.url),{workerData:{challenge,replay},resourceLimits:{maxOldGenerationSizeMb:96}});
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);verifying--;void worker.terminate();if(error)reject(error);else resolve(result);};
    const timer=setTimeout(()=>finish(Object.assign(new Error('Replay verification timed out'),{status:422})),12000);
    worker.on('message',m=>finish(m.error?Object.assign(new Error(m.error),{status:422}):null,m.result));
    worker.on('error',e=>finish(e));
    worker.on('exit',code=>{if(!settled)finish(new Error(`Verification worker stopped (${code})`));});
  });
}
