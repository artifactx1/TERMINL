import {createAppClient,viemConnector} from '@farcaster/auth-client';

const failure=code=>Object.assign(new Error('Farcaster sign-in failed'),{oauthStage:'signature',providerStatus:0,providerCode:code});
const clients=new Map();
const clientFor=rpcUrl=>{
  const key=rpcUrl||'public';
  if(!clients.has(key))clients.set(key,createAppClient({relay:'https://relay.farcaster.xyz',ethereum:viemConnector(rpcUrl?{rpcUrl}:{})}));
  return clients.get(key);
};

const FNAME=/^[a-z0-9][a-z0-9-]{0,15}$/;
/** The username currently registered to an FID in Farcaster's official fname registry.
 * Looked up server-side after the signature proves the FID, so a browser cannot
 * claim someone else's name. Null when the FID has no fname or the registry is down. */
export async function farcasterUsername(fid,fetchImpl=fetch){
  try{
    const response=await fetchImpl('https://fnames.farcaster.xyz/transfers/current?fid='+fid,{signal:AbortSignal.timeout(4000)});
    if(!response.ok)return null;
    const transfer=(await response.json())?.transfer;
    return transfer?.to===fid&&typeof transfer.username==='string'&&FNAME.test(transfer.username)?transfer.username:null;
  }catch{return null;}
}
/** Display label: the fname as a handle, or the FID when no name is known. */
export const farcasterLabel=(fid,username)=>username&&username!=='fid'+fid?'@'+username:'FID #'+fid;
export async function farcasterIdentity({nonce,domain,uri,message,signature,rpcUrl,fetchImpl}){
  if(typeof nonce!=='string'||!/^[A-Za-z0-9]{8,128}$/.test(nonce)||typeof message!=='string'||message.length<20||message.length>4096||typeof signature!=='string'||!/^0x[a-fA-F0-9]{130}$/.test(signature))throw failure('invalid_request');
  let result;try{
    result=await clientFor(rpcUrl).verifySignInMessage({nonce,domain,message,signature,acceptAuthAddress:true});
  }catch{throw failure('verification_unavailable');}
  if(result?.isError||result?.success!==true||result.data?.uri!==uri||!Number.isSafeInteger(result.fid)||result.fid<1)throw failure('invalid_signature');
  const username=await farcasterUsername(result.fid,fetchImpl);
  return {id:String(result.fid),username:username||'fid'+result.fid,name:username||'Farcaster #'+result.fid};
}
