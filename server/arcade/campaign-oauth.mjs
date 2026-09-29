import {createHash} from 'node:crypto';

const providerCodes=new Set(['invalid_request','invalid_client','invalid_grant','unauthorized_client','unsupported_grant_type','invalid_scope','access_denied','server_error','temporarily_unavailable','CreditsDepleted','ClientForbidden','Too Many Requests']);
function failure(stage,status,providerCode){return Object.assign(new Error('X sign-in failed during '+stage),{oauthStage:stage,providerStatus:status,providerCode});}
async function requestJson(fetchImpl,stage,url,options){
  let response;
  try{response=await fetchImpl(url,options);}catch{throw failure(stage,0,'network_error');}
  let body;try{body=await response.json();}catch{throw failure(stage,response.status||0,'invalid_response');}
  if(!response.ok){
    const code=body?.error||body?.title;
    throw failure(stage,response.status||0,providerCodes.has(code)?code:'provider_error');
  }
  return body;
}

export function xAuthorize({clientId,redirectUri,state,verifier}){
  const params=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,
    scope:'tweet.read users.read',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  return `https://x.com/i/oauth2/authorize?${params}`;
}
export async function xIdentity({clientId,clientSecret,redirectUri,code,verifier,fetchImpl=fetch}){
  const authorization='Basic '+Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
  const result=await requestJson(fetchImpl,'token','https://api.x.com/2/oauth2/token',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:verifier}),signal:AbortSignal.timeout(10000)});
  if(typeof result?.access_token!=='string'||!result.access_token)throw failure('token',200,'missing_token');
  try{
    const profile=await requestJson(fetchImpl,'profile','https://api.x.com/2/users/me',{headers:{Authorization:`Bearer ${result.access_token}`},signal:AbortSignal.timeout(10000)});
    const data=profile?.data;
    if(!/^\d{1,25}$/.test(data?.id||'')||!/^\w{1,15}$/.test(data?.username||'')||typeof data?.name!=='string')throw failure('profile',200,'invalid_profile');
    return {id:data.id,username:data.username,name:data.name.slice(0,80)};
  }finally{
    // No refresh token or X access token is stored. This service only needs identity.
    try{await fetchImpl('https://api.x.com/2/oauth2/revoke',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({token:result.access_token,token_type_hint:'access_token'}),signal:AbortSignal.timeout(3000)});}catch{}
  }
}
