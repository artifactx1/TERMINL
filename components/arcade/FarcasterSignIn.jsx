import {useMemo,useState} from 'react';
import {AuthKitProvider,SignInButton} from '@farcaster/auth-kit';
import {campaignRequest} from '../../lib/arcade/campaign-client';
import s from '../../styles/Campaign.module.css';

export default function FarcasterSignIn({runId,publicProfile,onError}){
  const [finishing,setFinishing]=useState(false);
  const config=useMemo(()=>({domain:window.location.host,siweUri:window.location.origin+'/arcade-pass',relay:'https://relay.farcaster.xyz'}),[]);
  const nonce=async()=>{
    const auth=await campaignRequest('/auth/start',{provider:'farcaster',...(runId?{runId}:{}),publicProfile});
    return auth.nonce;
  };
  const complete=async result=>{
    setFinishing(true);onError('');
    try{
      const auth=await campaignRequest('/auth/complete',{provider:'farcaster',nonce:result.nonce,message:result.message,signature:result.signature});
      location.assign('/arcade-pass'+(auth.saved?'?saved='+encodeURIComponent(auth.saved):auth.runId?'?run='+encodeURIComponent(auth.runId):''));
    }catch(error){onError(error.message);setFinishing(false);}
  };
  if(finishing)return <button className={s.secondary} disabled>VERIFYING FARCASTER…</button>;
  return <div className={s.farcaster}><AuthKitProvider config={config}><SignInButton nonce={nonce} hideSignOut onSuccess={complete} onError={error=>onError(error?.message||'Farcaster sign-in did not finish. Try again.')}/></AuthKitProvider></div>;
}
