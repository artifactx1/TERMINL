import {createHash} from 'node:crypto';

export function xAuthorize({clientId,redirectUri,state,verifier}){
  const params=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,
    scope:'tweet.read users.read',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  return `https://x.com/i/oauth2/authorize?${params}`;
}
export async function xIdentity({clientId,clientSecret,redirectUri,code,verifier,fetchImpl=fetch}){
  const authorization='Basic '+Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
  const response=await fetchImpl('https://api.x.com/2/oauth2/token',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:verifier}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('X did not complete sign-in. Your verified run is still saved in this browser.');
  const result=await response.json();
  if(typeof result.access_token!=='string')throw new Error('X did not return an identity token');
  try{
    const profile=await fetchImpl('https://api.x.com/2/users/me',{headers:{Authorization:`Bearer ${result.access_token}`},signal:AbortSignal.timeout(10000)});
    if(!profile.ok)throw new Error('X profile lookup failed. Try saving your win again.');
    const {data}=await profile.json();
    if(!/^\d{1,25}$/.test(data?.id||'')||!/^\w{1,15}$/.test(data?.username||'')||typeof data?.name!=='string')throw new Error('X returned an invalid profile');
    return {id:data.id,username:data.username,name:data.name.slice(0,80)};
  }finally{
    // No refresh token or X access token is stored. This service only needs identity.
    try{await fetchImpl('https://api.x.com/2/oauth2/revoke',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({token:result.access_token,token_type_hint:'access_token'}),signal:AbortSignal.timeout(3000)});}catch{}
  }
}
