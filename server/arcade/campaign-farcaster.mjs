import {createAppClient,viemConnector} from '@farcaster/auth-client';

const failure=code=>Object.assign(new Error('Farcaster sign-in failed'),{oauthStage:'signature',providerStatus:0,providerCode:code});
const clients=new Map();
const clientFor=rpcUrl=>{
  const key=rpcUrl||'public';
  if(!clients.has(key))clients.set(key,createAppClient({relay:'https://relay.farcaster.xyz',ethereum:viemConnector(rpcUrl?{rpcUrl}:{})}));
  return clients.get(key);
};

export async function farcasterIdentity({nonce,domain,uri,message,signature,rpcUrl}){
  if(typeof nonce!=='string'||!/^[A-Za-z0-9]{8,128}$/.test(nonce)||typeof message!=='string'||message.length<20||message.length>4096||typeof signature!=='string'||!/^0x[a-fA-F0-9]{130}$/.test(signature))throw failure('invalid_request');
  let result;try{
    result=await clientFor(rpcUrl).verifySignInMessage({nonce,domain,message,signature,acceptAuthAddress:true});
  }catch{throw failure('verification_unavailable');}
  if(result?.isError||result?.success!==true||result.data?.uri!==uri||!Number.isSafeInteger(result.fid)||result.fid<1)throw failure('invalid_signature');
  return {id:String(result.fid),username:'fid'+result.fid,name:'Farcaster #'+result.fid};
}
