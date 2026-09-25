import {useEffect,useRef,useState} from 'react';
import {RugScene} from './rug-scene';
import {MallScene} from './mall-scene';
import {AfterHoursAudio} from './audio';
import {attachInput} from './input';
import {readProgress,recordRun} from './progress.mjs';
export function useGame({kind,create,step,options}){
 const audioRef=useRef(null);if(!audioRef.current)audioRef.current=new AfterHoursAudio();
 const canvas=useRef(null),runtime=useRef(null),optionsRef=useRef(options);optionsRef.current=options;
 const [run,setRun]=useState(0),[view,setView]=useState(null),[mode,setMode]=useState('menu'),[error,setError]=useState(''),[progress,setProgress]=useState(null),[notice,setNotice]=useState(''),[debug,setDebug]=useState(false),[muted,setMuted]=useState(false),[quality,setQuality]=useState('high');
 const progressRef=useRef(null),modeRef=useRef(mode),settings=useRef({debug,muted,quality});modeRef.current=mode;settings.current={debug,muted,quality};
 useEffect(()=>()=>audioRef.current?.dispose(),[]);
 useEffect(()=>{const saved=readProgress(localStorage);progressRef.current=saved;setProgress(saved);},[]);
 useEffect(()=>{
  if(!canvas.current)return;const element=canvas.current;let raf,disposed=false,last=performance.now(),acc=0,lastUI=0,lastPaint=0,savedDiscoveries='',recorded=false,scene,input;
  const state=create(optionsRef.current),audio=audioRef.current;audio.setVolume(settings.current.muted?0:.12);
  const pause=(force=false)=>{if(modeRef.current==='menu'||['finished','complete','dead'].includes(state.phase))return;const next=force||modeRef.current==='playing'?'paused':'playing';modeRef.current=next;setMode(next);input?.clear();audio.pause(next!=='playing');};
  try{scene=new (kind==='mall'?MallScene:RugScene)(canvas.current,state,{quality:settings.current.quality,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});}catch(e){console.error('After-hours renderer:',e);setError('This game needs WebGL 2. Enable hardware acceleration and reload to play.');return;}
  input=attachInput(canvas.current,{kind,pause,restart:()=>{modeRef.current='playing';setMode('playing');setRun(n=>n+1);},debug:()=>setDebug(v=>!v)});
  runtime.current={state,scene,input,audio};setView({...state});setError('');
  const resize=new ResizeObserver(()=>scene.resize());resize.observe(canvas.current);
  const frame=now=>{if(disposed)return;const elapsed=Math.min(.1,(now-last)/1000);last=now;const running=modeRef.current==='playing';audio.pause(!running);audio.setVolume(settings.current.muted?0:.12);if(running){acc+=elapsed;const controls=acc>=1/60?input.read():{};let ticks=0;while(acc>=1/60&&ticks<6){step(state,controls);if(ticks===0){controls.lookX=controls.lookY=0;controls.weapon=null;}audio.update(state);acc-=1/60;ticks++;if(state.phase!=='playing')break;}}else acc=0;
   if(state.phase!=='playing'&&!recorded){recorded=true;setView({...state,player:{...state.player},combo:state.combo?{...state.combo}:undefined});input.clear();if(document.pointerLockElement===canvas.current)document.exitPointerLock();modeRef.current='result';setMode('result');const result=recordRun(progressRef.current||readProgress(localStorage),state,localStorage);progressRef.current=result.progress;setProgress(result.progress);if(!result.saved)setNotice('Storage is unavailable. Your result is kept for this visit.');}
   if(running||!lastPaint||now-lastPaint>250){scene.draw(state,{debug:settings.current.debug,ghost:optionsRef.current.ghost?progressRef.current?.mall.ghost:null});lastPaint=now;}const discoveries=state.kind==='mall'?`${state.tapes.length}:${state.gaps?.length||0}:${state.routesCompleted?.length||0}`:'';if(state.kind==='mall'&&state.phase==='playing'&&discoveries!==savedDiscoveries){savedDiscoveries=discoveries;const result=recordRun(progressRef.current||readProgress(localStorage),state,localStorage);progressRef.current=result.progress;setProgress(result.progress);if(!result.saved)setNotice('Storage is unavailable. Tapes are kept for this visit.');}const c=canvas.current;c.dataset.game=kind;c.dataset.tick=state.tick;c.dataset.phase=state.phase;c.dataset.x=state.player.x.toFixed(2);c.dataset.z=state.player.z.toFixed(2);c.dataset.y=state.player.y.toFixed(2);c.dataset.score=state.score;c.dataset.combo=state.combo?.count||0;c.dataset.portfolio=state.player.hp??'';c.dataset.kills=state.kills||0;c.dataset.mode=modeRef.current;c.dataset.shots=state.shots||0;c.dataset.drawCalls=scene.renderer.info.render.calls;c.dataset.yaw=state.player.yaw.toFixed(3);c.dataset.trick=state.player.airMove?.id||'';c.dataset.manual=String(!!state.player.manual);c.dataset.rail=state.player.rail||'';c.dataset.zone=state.zone||'';c.dataset.speed=(state.player.speed??Math.hypot(state.player.vx,state.player.vz)).toFixed(2);
   if(now-lastUI>80){setView({...state,player:{...state.player},combo:state.combo?{...state.combo}:undefined});lastUI=now;}raf=requestAnimationFrame(frame);
  };raf=requestAnimationFrame(frame);
  return()=>{disposed=true;cancelAnimationFrame(raf);resize.disconnect();input.dispose();audio.pause(true);scene.dispose();if(document.pointerLockElement===element)document.exitPointerLock();runtime.current=null;};
 },[run,kind,create,step]);
 function start(){runtime.current?.audio.unlock();modeRef.current='playing';setMode('playing');runtime.current?.input.clear();setRun(n=>n+1);}
 function resume(){runtime.current?.audio.unlock();runtime.current?.input.clear();modeRef.current='playing';setMode('playing');}
 function menu(){runtime.current?.input.clear();modeRef.current='menu';setMode('menu');if(document.pointerLockElement)document.exitPointerLock();}
 function touch(action,event){const down=event.type==='pointerdown';if(down){event.currentTarget.setPointerCapture?.(event.pointerId);runtime.current?.audio.unlock();}runtime.current?.input.touch(action,down,event.pointerId);}
 return {canvas,view,mode,error,progress,notice,debug,muted,setMuted,quality,setQuality,start,resume,menu,touch,runtime,pause:()=>{runtime.current?.input.clear();modeRef.current='paused';setMode('paused');}};
}
