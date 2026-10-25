import {campaignFetch} from '../../../../lib/server/campaign';
import {loadCatalog,loadImage,facetsFor,queryCatalog} from '../../../../lib/server/collection-preview.mjs';
import {sessionCookie,clearSessionCookie,validSession} from '../../../../lib/server/collection-preview-session.mjs';

export const config={api:{bodyParser:{sizeLimit:'2kb'}}};
export const maxDuration=30;
const notFound=res=>res.status(404).json({error:'Not found'});
const secure=req=>process.env.NODE_ENV==='production'||req.headers['x-forwarded-proto']==='https';
const sameOrigin=req=>{
  try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}
};

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Cookie');
  const parts=Array.isArray(req.query.path)?req.query.path:[];
  const route=parts.join('/');
  if(route==='session'){
    if(req.method==='GET')return res.status(200).json({authenticated:validSession(req.headers.cookie)});
    if(req.method==='DELETE'){
      if(!sameOrigin(req))return notFound(res);
      res.setHeader('Set-Cookie',clearSessionCookie(secure(req)));
      return res.status(200).json({authenticated:false});
    }
    if(req.method!=='POST'||!sameOrigin(req))return notFound(res);
    const admin=String(req.headers['x-campaign-admin']||'');
    if(!admin||admin.length>512)return notFound(res);
    try{
      const upstream=await campaignFetch('/admin',{admin,client:'collection-preview'});
      if(!upstream.ok)return notFound(res);
      res.setHeader('Set-Cookie',sessionCookie(secure(req)));
      return res.status(200).json({authenticated:true});
    }catch(error){console.error('Collection preview admin sign-in failed',error);return res.status(503).json({error:'Admin sign-in is unavailable'});}
  }
  if(req.method!=='GET'||!validSession(req.headers.cookie))return notFound(res);
  try{
    if(route==='catalog'){
      const rows=await loadCatalog();
      const result=queryCatalog(rows,{q:req.query.q,trait:req.query.trait,value:req.query.value,sort:req.query.sort,offset:req.query.offset,limit:req.query.limit});
      return res.status(200).json({...result,supply:rows.length,facets:Number(req.query.offset)>0?undefined:facetsFor(rows)});
    }
    if(parts[0]==='item'&&parts.length===2&&/^\d{4}$/.test(parts[1])){
      const id=Number(parts[1]),rows=await loadCatalog();
      return rows[id]?res.status(200).json(rows[id]):notFound(res);
    }
    if(parts[0]==='image'&&parts.length===2&&/^\d{4}$/.test(parts[1])){
      const id=Number(parts[1]),size=req.query.size==='full'?'full':'thumb';
      const {data,type}=await loadImage(id,size);
      res.setHeader('Content-Type',type);
      res.setHeader('Content-Length',data.length);
      res.status(200).end(data);
      return;
    }
    return notFound(res);
  }catch(error){console.error('Collection preview failed',error);return res.status(503).json({error:'Private collection preview is unavailable'});}
}
