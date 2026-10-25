import {campaignFetch} from '../../../lib/server/campaign';
import {loadSnapshot,applicationDigest} from '../../../lib/server/wallet-intelligence-store.mjs';

export const maxDuration=30;
export const config={api:{responseLimit:'4mb'}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','X-Campaign-Admin');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const admin=req.headers['x-campaign-admin'];
  if(typeof admin!=='string'||!admin||admin.length>512)return res.status(404).json({error:'Not found'});
  let live;
  try{
    const upstream=await campaignFetch('/admin/wl',{admin,client:'wallet-intelligence'});
    if(upstream.status===429)return res.status(429).json({error:'Too many admin requests. Wait a minute and retry.'});
    if(upstream.status===401||upstream.status===403||upstream.status===404)return res.status(404).json({error:'Not found'});
    if(!upstream.ok)throw new Error('Admin verification unavailable');
    live=await upstream.json();
  }catch{return res.status(503).json({error:'Admin verification is temporarily unavailable.'});}
  try{
    const snapshot=await loadSnapshot();
    const liveCheck={checkedAt:new Date().toISOString(),applicationCount:live.applications.length,
      applicationsChanged:applicationDigest(live.applications)!==snapshot.applicationDigest,
      masterChanged:live.masterDigest!==snapshot.masterDigest,
      entriesChanged:JSON.stringify(live.entries)!==snapshot.entriesFingerprint,
      exclusionsChanged:JSON.stringify(live.excludedCounts)!==snapshot.exclusionsFingerprint};
    return res.status(200).json({...snapshot,liveCheck});
  }catch{return res.status(503).json({error:'The wallet analysis snapshot is unavailable. Please retry after the next completed scan.'});}
}
