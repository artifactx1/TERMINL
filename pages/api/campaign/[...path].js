import {campaignConfigured,campaignFetch,campaignOrigin} from '../../../lib/server/campaign';
import {checkBotId} from 'botid/server';

const paths=/^\/(?:config|session|me|leaderboard|runs|runs\/[a-f0-9]{32}|results\/[A-Za-z0-9_-]{16}|prepare-result|submit|subscribe|auth\/(?:start|complete|callback)|claim|profile|wallet|events|logout|wl\/(?:apply|check-event|check\/0x[0-9a-fA-F]{40})|admin(?:\/(?:settings|review|addresses|gtd|subscribers|wl(?:\/(?:contacts|review|entry|import|merge))?))?)$/;
export const maxDuration=30;
export const config={api:{bodyParser:{sizeLimit:'2mb'}}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const path='/'+(Array.isArray(req.query.path)?req.query.path:[]).join('/');
  if(!paths.test(path))return res.status(404).json({error:'Not found'});
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).end();}
  if(req.method==='POST'&&(req.headers.origin!==campaignOrigin()||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')))return res.status(403).json({error:'Request origin rejected'});
  if(req.method==='POST'&&['/wl/apply','/subscribe'].includes(path)){
    try{
      const verification=await checkBotId({advancedOptions:{headers:req.headers,checkLevel:'basic'}});
      if(verification.isBot)return res.status(403).json({error:'Submission could not be verified. Please retry.'});
    }catch(error){
      console.error('Campaign BotID verification failed',error);
      return res.status(503).json({error:'Submission verification is temporarily unavailable. Please retry shortly.'});
    }
  }
  if(!campaignConfigured()){
    if(path==='/config')return res.status(200).json({open:false,routes:{cup:false,rumble:false},authReady:false,providers:{x:false,discord:false,farcaster:false},configured:false});
    return res.status(503).json({error:'Official challenges are not open yet. The free arcade is still playable.'});
  }
  const query=new URLSearchParams();
  for(const key of path==='/auth/callback'?['code','state','error','oauth_token','oauth_verifier','denied']:path.startsWith('/wl/check/')?['source']:[]){if(typeof req.query[key]==='string')query.set(key,req.query[key]);}
  // Forward only the campaign cookie; never wallet sessions or unrelated credentials.
  const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>/^btb_session=[A-Za-z0-9_-]+$/.test(v));
  try{
    const upstream=await campaignFetch(path+(query.size?'?'+query:''),{method:req.method,body:req.method==='POST'?req.body:undefined,cookie,
      origin:req.headers.origin,admin:req.headers['x-campaign-admin'],
      geo:process.env.VERCEL?{country:req.headers['x-vercel-ip-country'],region:req.headers['x-vercel-ip-country-region']}:undefined,
      client:process.env.VERCEL?req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown':req.socket.remoteAddress||'local'});
    const setCookie=upstream.headers.get('set-cookie');if(setCookie)res.setHeader('Set-Cookie',setCookie);
    const location=upstream.headers.get('location');
    if(location){const target=new URL(location);if(target.origin!==campaignOrigin())throw new Error('Unexpected redirect');res.setHeader('Location',target.href);res.status(upstream.status).end();return;}
    const data=await upstream.json();return res.status(upstream.status).json(data);
  }catch{return res.status(503).json({error:'The challenge service is temporarily unavailable. Keep this page open and retry.'});}
}
