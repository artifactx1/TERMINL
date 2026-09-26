import {useEffect,useRef,useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {captureInput,MAX_CHALLENGE_TICKS} from '../../lib/arcade/bot-challenge.mjs';

export function useBotChallenge(){
  const [campaign,setCampaign]=useState(null),[attempt,setAttempt]=useState(null),[result,setResult]=useState(null),[status,setStatus]=useState('idle'),[error,setError]=useState('');
  const run=useRef(null),identity=useRef(null);
  useEffect(()=>{let alive=true;campaignRequest('/config').then(c=>{if(alive)setCampaign(c);}).catch(()=>{});return()=>{alive=false;};},[]);
  const start=async()=>{
    setError('');setStatus('starting');
    try{
      identity.current=(await campaignRequest('/session')).pass;
      const ref=new URLSearchParams(location.search).get('ref');
      const next=await campaignRequest('/runs',{ref});
      run.current={...next,replay:[],frames:0,submitted:false};setAttempt(next);setResult(null);setStatus('racing');
      try{sessionStorage.setItem('terminl:official-run',next.id);}catch{}
      return next;
    }catch(e){setError(e.message);setStatus('idle');return null;}
  };
  const record=input=>{const r=run.current;if(!r||r.finished)return;if(r.frames>=MAX_CHALLENGE_TICKS)return;captureInput(r.replay,input);r.frames++;};
  const submit=async()=>{
    const r=run.current;if(!r||r.submitted)return;r.submitted=true;setStatus('verifying');setError('');
    try{const value=await campaignRequest('/submit',{runId:r.id,replay:r.replay});if(run.current?.id!==r.id)return;setResult(value.result);setStatus('verified');}
    catch(e){if(run.current?.id!==r.id)return;r.submitted=false;setError(e.message);setStatus('retry');}
  };
  const finish=state=>{if(run.current&&!run.current.finished&&state.phase==='finished'){run.current.finished=true;void submit();}};
  const save=async publicProfile=>{
    if(!result?.qualified||!attempt)return;setStatus('saving');setError('');campaignEvent('save_access_click');
    try{
      if(identity.current){const saved=await campaignRequest('/claim',{runId:attempt.id,publicProfile});location.assign('/arcade-pass?saved='+encodeURIComponent(saved.code));}
      else {const auth=await campaignRequest('/auth/start',{runId:attempt.id,publicProfile});location.assign(auth.url);}
    }catch(e){setError(e.message);setStatus('verified');}
  };
  const cancel=()=>{run.current=null;setAttempt(null);setResult(null);setStatus('idle');setError('');};
  return {campaign,attempt,result,status,error,start,record,finish,submit,save,cancel};
}
