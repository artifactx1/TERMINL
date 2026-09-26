import {createHmac} from 'node:crypto';

export const campaignOrigin=()=>new URL(process.env.CAMPAIGN_SITE_ORIGIN||'https://terminl.net').origin;
export function campaignConfigured(){return !!(process.env.CAMPAIGN_API_URL&&process.env.CAMPAIGN_SERVICE_TOKEN);}
export async function campaignFetch(path,{method='GET',body,cookie,origin,admin,client='server'}={}){
  if(!campaignConfigured())throw new Error('Campaign not configured');
  const base=process.env.CAMPAIGN_API_URL.replace(/\/$/,'');
  const secret=process.env.CAMPAIGN_SERVICE_TOKEN;
  return fetch(base+'/campaign'+path,{method,redirect:'manual',headers:{
    Authorization:`Bearer ${secret}`,'Content-Type':'application/json',
    'X-Campaign-Client':createHmac('sha256',secret).update(String(client)).digest('hex'),
    ...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{}),...(admin?{'X-Campaign-Admin':admin}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(path.startsWith('/auth/callback')?28000:20000)});
}
export async function publicChallenge(code){
  if(!/^[A-Za-z0-9_-]{16}$/.test(code||'')||!campaignConfigured())return null;
  const response=await campaignFetch('/results/'+code);if(response.status===404)return null;
  if(!response.ok)throw new Error('Challenge lookup unavailable');return response.json();
}
