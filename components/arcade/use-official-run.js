import {useEffect,useRef,useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {captureInput} from '../../lib/arcade/campaign-rules.mjs';

const PENDING_KEY='terminl:official-run',resumeKey=kind=>'terminl:official-run:'+kind;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transient=error=>!error.status||error.status===503;
function remember(key,value){try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);}catch{}}

/** One server-issued official run. Inputs are recorded tick by tick and each finished
 * race or fight is submitted in order; the server replays it and keeps the score. */
export function useOfficialRun(kind){
  const [campaign,setCampaign]=useState(null),[attempt,setAttempt]=useState(null),[progress,setProgress]=useState(null),[last,setLast]=useState(null);
  const [result,setResult]=useState(null),[points,setPoints]=useState(0),[held,setHeld]=useState(false),[status,setStatus]=useState('idle'),[error,setError]=useState('');
  const run=useRef(null),identity=useRef(null);
  useEffect(()=>{let alive=true;campaignRequest('/config').then(c=>{if(alive)setCampaign(c);}).catch(()=>{});return()=>{alive=false;};},[]);
  const begin=(next,segments=0)=>{
    run.current={...next,buffer:[],recording:true,queue:[],segments,sending:false};
    setAttempt(next);setResult(null);setLast(null);setPoints(next.points||0);setProgress(next.progress||null);setError('');setStatus('playing');
    if(kind==='rumble')remember(resumeKey(kind),next.id);
  };
  const start=async(extra={})=>{
    setError('');setStatus('starting');
    try{
      identity.current=(await campaignRequest('/session')).pass;setHeld(!!identity.current?.fcfs);
      const ref=new URLSearchParams(location.search).get('ref');
      const next=await campaignRequest('/runs',{kind,ref,...extra});begin(next);return next;
    }catch(e){setError(e.message);setStatus('idle');return null;}
  };
  /** Continue an unfinished circuit after a reload. Returns the server's progress. */
  const resume=async()=>{
    let id=null;try{id=localStorage.getItem(resumeKey(kind));}catch{}
    if(!id||!/^[a-f0-9]{32}$/.test(id))return null;
    try{
      identity.current=(await campaignRequest('/session')).pass;setHeld(!!identity.current?.fcfs);
      const saved=await campaignRequest('/runs/'+id);
      if(saved.kind!==kind||!saved.open){remember(resumeKey(kind),null);return null;}
      begin({id:saved.id,kind,challenge:saved.challenge,progress:saved.progress},saved.segments);return saved;
    }catch{remember(resumeKey(kind),null);return null;}
  };
  const flush=async()=>{
    const r=run.current;if(!r||r.sending)return;r.sending=true;
    try{
      while(r.queue.length&&run.current===r){
        const item=r.queue[0];let value,failures=0;
        for(;;){
          try{value=await campaignRequest('/submit',{runId:r.id,segment:item.segment,replay:item.replay});break;}
          catch(e){if(run.current!==r)return;if(!transient(e)||++failures>3){setError(e.message);setStatus('retry');return;}await wait(1500*failures);}
        }
        if(run.current!==r)return;
        r.queue.shift();setProgress(value.progress);setPoints(value.points);if(value.segment)setLast(value.segment);
        if(value.result){
          setResult(value.result);setStatus('verified');remember(resumeKey(kind),null);
          if(value.result.qualified)try{sessionStorage.setItem(PENDING_KEY,r.id);}catch{}
        }else if(!r.queue.length)setStatus('playing');
      }
    }finally{r.sending=false;}
  };
  const record=input=>{const r=run.current;if(r?.recording)captureInput(r.buffer,input);};
  /** Ends the current segment on the tick the game recorded its result. */
  const cut=({hold=false}={})=>{
    const r=run.current;if(!r?.recording)return;
    r.queue.push({segment:r.segments++,replay:r.buffer});r.buffer=[];r.recording=!hold;
    setStatus('verifying');setError('');void flush();
  };
  /** A fight was abandoned before its result: its inputs never reach the server. */
  const restartSegment=()=>{const r=run.current;if(r){r.buffer=[];r.recording=true;}};
  const retry=()=>{setError('');setStatus('verifying');void flush();};
  const save=async()=>{
    const r=run.current;if(!result?.qualified||!r)return;setStatus('saving');setError('');campaignEvent('save_access_click');
    try{
      if(identity.current){const saved=await campaignRequest('/claim',{runId:r.id,publicProfile:!!identity.current.publicProfile});location.assign('/arcade-pass?saved='+encodeURIComponent(saved.code));}
      else location.assign('/arcade-pass?run='+encodeURIComponent(r.id));
    }catch(e){setError(e.message);setStatus('verified');}
  };
  const cancel=()=>{run.current=null;setAttempt(null);setResult(null);setLast(null);setProgress(null);setPoints(0);setStatus('idle');setError('');};
  return {kind,campaign,open:!!campaign?.routes?.[kind],held,attempt,progress,last,result,points,status,error,
    segments:()=>run.current?.segments||0,start,resume,record,cut,restartSegment,retry,save,cancel};
}
