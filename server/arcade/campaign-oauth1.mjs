import {createHmac,randomBytes} from 'node:crypto';

const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const validToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(value);
const failure=(stage,status,code)=>Object.assign(new Error('X sign-in failed during '+stage),{oauthStage:stage,providerStatus:status,providerCode:code});

export function xOAuth1Header(url,{apiKey,apiSecret,token,tokenSecret='',body=new URLSearchParams(),oauth={},method='POST',nonce=randomBytes(16).toString('hex'),timestamp=Math.floor(Date.now()/1000)}){
  const target=new URL(url);
  const params={oauth_consumer_key:apiKey,oauth_nonce:nonce,oauth_signature_method:'HMAC-SHA1',oauth_timestamp:String(timestamp),oauth_version:'1.0',...(token?{oauth_token:token}:{}),...oauth};
  const pairs=[...Object.entries(params),...target.searchParams,...body].map(([k,v])=>[encode(k),encode(v)]);
  pairs.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0);
  const normalized=pairs.map(pair=>pair.join('=')).join('&');
  const base=[method.toUpperCase(),target.origin+target.pathname,normalized].map(encode).join('&');
  params.oauth_signature=createHmac('sha1',encode(apiSecret)+'&'+encode(tokenSecret)).update(base).digest('base64');
  return 'OAuth '+Object.entries(params).map(([k,v])=>encode(k)+'="'+encode(v)+'"').join(', ');
}

async function exchange(stage,url,options,fetchImpl){
  let response;
  try{response=await fetchImpl(url,{method:'POST',headers:{Authorization:xOAuth1Header(url,options),'Content-Type':'application/x-www-form-urlencoded'},body:options.body,signal:AbortSignal.timeout(10000)});}catch{throw failure(stage,0,'network_error');}
  if(!response.ok)throw failure(stage,response.status,'provider_error');
  let data;try{data=new URLSearchParams(await response.text());}catch{throw failure(stage,response.status,'invalid_response');}
  return data;
}

export async function xOAuth1Start({apiKey,apiSecret,redirectUri,fetchImpl=fetch}){
  const data=await exchange('request_token','https://api.x.com/oauth/request_token',{apiKey,apiSecret,oauth:{oauth_callback:redirectUri},body:new URLSearchParams({x_auth_access_type:'read'})},fetchImpl);
  const requestToken=data.get('oauth_token'),tokenSecret=data.get('oauth_token_secret');
  if(data.get('oauth_callback_confirmed')!=='true'||!validToken(requestToken)||!validToken(tokenSecret))throw failure('request_token',200,'invalid_request_token');
  return {requestToken,tokenSecret,url:'https://api.x.com/oauth/authorize?'+new URLSearchParams({oauth_token:requestToken})};
}

export async function xOAuth1Identity({apiKey,apiSecret,requestToken,tokenSecret,verifier,fetchImpl=fetch}){
  if(!validToken(requestToken)||!validToken(tokenSecret)||!validToken(verifier))throw failure('access_token',0,'invalid_callback');
  const data=await exchange('access_token','https://api.x.com/oauth/access_token',{apiKey,apiSecret,token:requestToken,tokenSecret,body:new URLSearchParams({oauth_verifier:verifier})},fetchImpl);
  const accessToken=data.get('oauth_token'),accessSecret=data.get('oauth_token_secret');
  try{
    // Identity comes only from X's authenticated server response, never callback/query fields.
    const id=data.get('user_id'),username=data.get('screen_name');
    if(!validToken(accessToken)||!validToken(accessSecret)||!/^\d{1,25}$/.test(id||'')||!/^\w{1,15}$/.test(username||''))throw failure('access_token',200,'invalid_identity');
    return {id,username,name:username};
  }finally{
    // The account ID is all we need. Do not retain user API access credentials.
    if(validToken(accessToken)&&validToken(accessSecret)){
      const url='https://api.x.com/1.1/oauth/invalidate_token.json';
      try{await fetchImpl(url,{method:'POST',headers:{Authorization:xOAuth1Header(url,{apiKey,apiSecret,token:accessToken,tokenSecret:accessSecret})},signal:AbortSignal.timeout(3000)});}catch{}
    }
  }
}
