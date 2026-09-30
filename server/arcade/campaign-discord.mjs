const failure=(stage,status,code)=>Object.assign(new Error('Discord sign-in failed during '+stage),{oauthStage:stage,providerStatus:status,providerCode:code});
const snowflake=value=>typeof value==='string'&&/^\d{16,22}$/.test(value);

async function requestJson(fetchImpl,stage,url,options){
  let response;try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(10000)});}catch{throw failure(stage,0,'network_error');}
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw failure(stage,response.status,typeof data?.error==='string'?data.error:'provider_error');
  return data;
}

export function discordAuthorize({clientId,redirectUri,state}){
  return 'https://discord.com/oauth2/authorize?'+new URLSearchParams({response_type:'code',client_id:clientId,scope:'identify',state,redirect_uri:redirectUri});
}

export async function discordIdentity({clientId,clientSecret,redirectUri,code,fetchImpl=fetch}){
  const authorization='Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64');
  const token=await requestJson(fetchImpl,'token','https://discord.com/api/oauth2/token',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri})});
  if(typeof token.access_token!=='string'||token.access_token.length<8)throw failure('token',200,'invalid_token');
  try{
    const profile=await requestJson(fetchImpl,'profile','https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+token.access_token}});
    if(!snowflake(profile.id)||typeof profile.username!=='string'||!profile.username.trim()||profile.username.length>80)throw failure('profile',200,'invalid_identity');
    const username=profile.username.trim(),name=typeof profile.global_name==='string'&&profile.global_name.trim()?profile.global_name.trim().slice(0,100):username;
    return {id:profile.id,username,name};
  }finally{
    try{await fetchImpl('https://discord.com/api/oauth2/token/revoke',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token.access_token,token_type_hint:'access_token'}),signal:AbortSignal.timeout(10000)});}catch{}
  }
}
