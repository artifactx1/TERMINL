import {createHmac,timingSafeEqual} from 'node:crypto';

const NAME='terminl_preview';
const MAX_AGE=2*60*60;
function secret(){
  const value=process.env.CAMPAIGN_SERVICE_TOKEN;
  if(!value||value.length<24)throw new Error('Campaign service token is not configured');
  return value;
}
function signature(payload){return createHmac('sha256',secret()).update(`collection-preview:${payload}`).digest('base64url');}
export function sessionCookie(secure=true){
  const payload=Buffer.from(JSON.stringify({exp:Date.now()+MAX_AGE*1000})).toString('base64url');
  return `${NAME}=${payload}.${signature(payload)}; Path=/api/admin/collection; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure?'; Secure':''}`;
}
export function clearSessionCookie(secure=true){return `${NAME}=; Path=/api/admin/collection; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`;}
export function validSession(cookieHeader){
  try{
    const value=String(cookieHeader||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${NAME}=`))?.slice(NAME.length+1)||'';
    const [payload,mac,...rest]=value.split('.');
    if(rest.length||!payload||!mac||payload.length>100||mac.length>100)return false;
    const actual=Buffer.from(mac),expected=Buffer.from(signature(payload));
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
    const {exp}=JSON.parse(Buffer.from(payload,'base64url').toString());
    return Number.isFinite(exp)&&exp>Date.now()&&exp<=Date.now()+MAX_AGE*1000;
  }catch{return false;}
}
