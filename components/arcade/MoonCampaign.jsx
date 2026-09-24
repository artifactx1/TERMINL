import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {CAMPAIGN_KEY,CAMPAIGN_WORLDS,campaignWorld,newCampaignLevel,stepCampaign,readCampaign,clearCampaignLevel,LEFT,RIGHT,JUMP} from '../../lib/moon-campaign.mjs';
import {drawCampaign} from '../../lib/moon-campaign-draw.js';
import {watchPointerRelease} from '../../lib/arcade/pointer-release.mjs';
import s from '../../styles/MoonCampaign.module.css';

export default function MoonCampaign(){
  const [save,setSave]=useState(()=>readCampaign(null)),[ready,setReady]=useState(false),[run,setRun]=useState(null),[storageError,setStorageError]=useState(false);
  const saved=useRef(save);saved.current=save;
  useEffect(()=>{try{const next=readCampaign(localStorage.getItem(CAMPAIGN_KEY));saved.current=next;setSave(next);}catch{setStorageError(true);}setReady(true);},[]);
  const persist=next=>{saved.current=next;setSave(next);try{localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(next));}catch{setStorageError(true);}};
  const start=(level,checkpoint=-1)=>{if(!ready||level>saved.current.unlocked)return;persist({...saved.current,current:level,checkpoint});setRun({level,checkpoint,id:crypto.randomUUID()});};
  if(run)return <Mission key={run.id} run={run} onLeave={()=>setRun(null)} onRetry={checkpoint=>start(run.level,checkpoint)} onNext={()=>start(run.level+1)}
    onCheckpoint={checkpoint=>persist({...saved.current,current:run.level,checkpoint})} onFinish={state=>{if(state.won)persist(clearCampaignLevel(saved.current,state));}} storageError={storageError}/>;
  const allClear=save.completed.length===10;
  return <main className={s.menu}>
    <header className={s.header}><Link href='/os'><b>TERMINL</b><span>ARCADE</span></Link><span>SOLO CAMPAIGN / 10 LEVELS</span></header>
    <section className={s.hero}><div><span className={s.eyebrow}>ONE SMALL STEP. TEN VERY BIG PROBLEMS.</span><h1>MOON<br/><em>MISSION</em></h1><p>Take your terminal from the city to the moon. Clear spike beds, dodge saws and cannon fire, and beat the Warden waiting at the end.</p>
      <button className={s.primary} disabled={!ready} onClick={()=>start(save.current,save.checkpoint)}>{allClear?'PLAY AGAIN':save.completed.length||save.checkpoint>=0?'CONTINUE CAMPAIGN':'START CAMPAIGN'} →</button><small>{save.completed.length} / 10 LEVELS CLEARED · CHECKPOINTS SAVE AUTOMATICALLY</small></div><MoonPreview level={save.current}/></section>
    {storageError&&<p className={s.notice} role='status'>Browser storage is unavailable. Your progress will last for this visit.</p>}
    <section className={s.route} aria-label='Campaign levels'><div className={s.sectionTitle}><h2>THE ROAD TO THE MOON</h2><span>RUN · DOUBLE JUMP · STOMP</span></div><div className={s.levels}>{CAMPAIGN_WORLDS.map(world=>{
      const cleared=save.completed.includes(world.level),locked=world.level>save.unlocked;
      return <button key={world.level} disabled={!ready||locked} aria-label={`Level ${world.level+1}: ${world.name}${locked?', locked':cleared?', cleared':''}`} onClick={()=>start(world.level,world.level===save.current?save.checkpoint:-1)} style={{'--world':world.accent}}>
        <span className={s.number}>{String(world.level+1).padStart(2,'0')}</span><div><small>{cleared?'CLEARED ✓':locked?'LOCKED':world.level===9?'FINAL BOSS':'READY TO PLAY'}</small><h3>{world.name}</h3><p>{world.mechanic}</p></div><span className={s.levelArrow}>{locked?'○':'↗'}</span>
      </button>;
    })}</div></section>
    <footer className={s.footer}><p>Arrows or A/D to run. Space, W or ↑ to jump; release and press again for a double jump. Touch controls and controllers supported.</p><span>Progress saves on this browser. Replay any cleared level.</span></footer>
  </main>;
}

function MoonPreview({level}){
  const canvas=useRef(null);
  useEffect(()=>{const ctx=canvas.current.getContext('2d');drawCampaign(ctx,newCampaignLevel(level),960);},[level]);
  return <canvas className={s.preview} ref={canvas} width={960} height={540} aria-label={`${campaignWorld(level).name} preview`}/>;
}

function Mission({run,onLeave,onRetry,onNext,onCheckpoint,onFinish,storageError}){
  const world=campaignWorld(run.level),game=useRef(newCampaignLevel(run.level,run.checkpoint)),canvas=useRef(null),scene=useRef(null),dimensions=useRef({width:960,scale:1});
  const [phase,setPhase]=useState('ready'),[view,setView]=useState(game.current),[sound,setSound]=useState(true);
  const phaseRef=useRef(phase),callbacks=useRef({onCheckpoint,onFinish}),soundRef=useRef(sound),audio=useRef(null),finished=useRef(false),lastCheckpoint=useRef(game.current.checkpointIndex);
  phaseRef.current=phase;callbacks.current={onCheckpoint,onFinish};soundRef.current=sound;
  const keys=useRef(new Set()),pointers=useRef(new Map()),captures=useRef(new Map());
  const clear=()=>{keys.current.clear();pointers.current.clear();game.current={...game.current,input:0};for(const[id,el]of captures.current){if(el.hasPointerCapture?.(id))el.releasePointerCapture(id);}captures.current.clear();};
  const release=e=>{pointers.current.delete(e.pointerId);captures.current.delete(e.pointerId);};
  const pause=()=>{clear();setPhase('paused');};
  const paint=()=>{const c=canvas.current?.getContext('2d');if(c){c.setTransform(dimensions.current.scale,0,0,dimensions.current.scale,0,0);drawCampaign(c,game.current,dimensions.current.width);}};
  const paintRef=useRef(paint);paintRef.current=paint;
  useEffect(()=>{
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    const element=scene.current,el=canvas.current;let disposed=false;
    const resize=()=>{if(disposed||!element.isConnected)return;const r=element.getBoundingClientRect();if(!r.width||!r.height)return;el.width=Math.round(r.width*Math.min(2,devicePixelRatio||1));el.height=Math.round(r.height*Math.min(2,devicePixelRatio||1));dimensions.current={width:r.width/r.height*540,scale:el.height/540};paintRef.current();};
    const observer=new ResizeObserver(resize);observer.observe(element);resize();
    const map={ArrowLeft:LEFT,KeyA:LEFT,ArrowRight:RIGHT,KeyD:RIGHT,Space:JUMP,ArrowUp:JUMP,KeyW:JUMP};
    const key=e=>{if(e.type==='keyup'){keys.current.delete(e.code);return;}if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.code==='Escape'&&phaseRef.current==='running'){clear();setPhase('paused');return;}if(!map[e.code]||phaseRef.current!=='running')return;e.preventDefault();keys.current.add(e.code);};
    const blur=()=>{clear();if(phaseRef.current==='running')setPhase('paused');};const hidden=()=>{if(document.hidden)blur();};
    window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
    const unwatch=watchPointerRelease({release,clear,hasPointers:()=>pointers.current.size>0});
    window.addEventListener('resize',clear);window.addEventListener('gamepaddisconnected',blur);
    return()=>{disposed=true;unwatch();clear();observer.disconnect();document.body.style.overflow=old;window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);window.removeEventListener('resize',clear);window.removeEventListener('gamepaddisconnected',blur);document.removeEventListener('visibilitychange',hidden);audio.current?.close().catch(()=>{});};
  },[]);
  useEffect(()=>{
    if(phase!=='running'){paintRef.current();return;}
    let raf,last=performance.now(),accumulator=0;
    const tick=now=>{
      accumulator+=Math.min(100,now-last);last=now;
      while(accumulator>=1000/60&&!game.current.ended){
        const keyMask=[...keys.current].reduce((n,key)=>n|(['ArrowLeft','KeyA'].includes(key)?LEFT:['ArrowRight','KeyD'].includes(key)?RIGHT:JUMP),0);
        const touchMask=[...pointers.current.values()].reduce((a,b)=>a|b,0),pad=navigator.getGamepads?.()?.find?.(p=>p?.connected);
        const padMask=pad?((pad.axes[0]<-.25||pad.buttons[14]?.pressed?LEFT:0)|(pad.axes[0]>.25||pad.buttons[15]?.pressed?RIGHT:0)|(pad.buttons[0]?.pressed?JUMP:0)):0;
        game.current=stepCampaign({...game.current,input:keyMask|touchMask|padMask});accumulator-=1000/60;
        const current=game.current;
        if(current.checkpointIndex!==lastCheckpoint.current){lastCheckpoint.current=current.checkpointIndex;callbacks.current.onCheckpoint(current.checkpointIndex);}
        if(soundRef.current&&current.pulse?.tick===current.tick){try{const Context=window.AudioContext||window.webkitAudioContext,ctx=audio.current||(audio.current=new Context());ctx.resume().catch(()=>{});const o=ctx.createOscillator(),g=ctx.createGain();o.type='square';o.frequency.value=current.pulse.kind==='hit'?95:current.pulse.kind==='stomp'?420:760;g.gain.setValueAtTime(.018,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);}catch{}}
      }
      paintRef.current();
      const current=game.current,el=canvas.current;
      if(el){el.dataset.tick=String(current.tick);el.dataset.x=String(current.x);el.dataset.input=String(current.input);el.dataset.checkpoint=String(current.checkpointIndex);el.dataset.bossHp=String(current.boss?.hp??0);}
      if(current.tick%6===0||current.ended)setView(current);
      if(current.ended){clear();setPhase('complete');if(!finished.current){finished.current=true;callbacks.current.onFinish(current);}return;}
      raf=requestAnimationFrame(tick);
    };raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[phase]);
  const control=mask=>({'data-moon-control':mask,onContextMenu:e=>e.preventDefault(),onPointerDown:e=>{e.preventDefault();if(phase!=='running'||e.pointerType==='mouse'&&e.button!==0)return;try{e.currentTarget.setPointerCapture(e.pointerId);captures.current.set(e.pointerId,e.currentTarget);}catch{}pointers.current.set(e.pointerId,mask);},onPointerMove:e=>{if(!pointers.current.has(e.pointerId))return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-moon-control]');pointers.current.set(e.pointerId,target&&!target.disabled?Number(target.dataset.moonControl):0);},onPointerUp:release,onPointerCancel:release,onLostPointerCapture:release});
  const final=world.level===9&&view.won;
  return <section className={s.game} aria-label='Moon Mission campaign'>
    <header className={s.gameHeader}><button onClick={onLeave}>← LEVELS</button><div>MOON MISSION <span>{String(world.level+1).padStart(2,'0')} / 10 · {world.name}</span></div><div><button aria-label={sound?'Mute sound':'Enable sound'} onClick={()=>setSound(!sound)}>{sound?'SOUND ON':'SOUND OFF'}</button><button disabled={phase==='ready'||phase==='complete'} onClick={()=>phase==='paused'?setPhase('running'):pause()}>{phase==='paused'?'RESUME':'PAUSE'}</button></div></header>
    <div className={s.scene} ref={scene}><canvas ref={canvas} data-level={world.level} data-phase={phase} data-tick={view.tick} data-x={view.x} data-input={view.input} aria-label='Run with arrows. Space to jump and double jump. Stomp enemies and reach the rocket.'/>
      <div className={s.hud}><div><small>SCORE</small><b>{view.score.toLocaleString()}</b></div><div><small>HEALTH</small><b className={s.hearts}>{'♥'.repeat(view.hp)}<i>{'♡'.repeat(3-view.hp)}</i></b></div><div><small>TIME LEFT</small><b>{Math.floor(Math.ceil((world.timeLimit-view.tick)/60)/60)}:{String(Math.ceil((world.timeLimit-view.tick)/60)%60).padStart(2,'0')}</b></div></div>
      <div className={s.progress}><span style={{width:`${Math.min(100,view.furthest/world.finish*100)}%`}}/></div>
      {view.boss?.active&&view.boss.hp>0&&<div className={s.bossHud} role='status'><b>THE LIQUIDATION WARDEN · {view.boss.hp} / 6</b><span>{view.boss.phase==='exposed'?'BLUE ARMOR: JUMP ON ITS HEAD':view.boss.phase==='warning'?'WATCH THE CHARGE':'JUMP OVER THE SHOCKWAVES'}</span></div>}
      {storageError&&<div className={s.saveWarning}>Progress saves for this visit only.</div>}
      {phase==='ready'&&<div className={s.overlay}><div><span className={s.eyebrow}>LEVEL {world.level+1} OF 10</span><h2>{world.name}</h2><p>{world.mechanic}</p><p>{world.tip}</p><p>Arrows / A D to run · Space to jump<br/>Release and jump again for a double jump.</p><button className={s.primary} onClick={()=>setPhase('running')}>{run.checkpoint>=0?'RESUME CHECKPOINT':'START LEVEL'} →</button><small>{Math.floor(world.timeLimit/3600)} MINUTES · 3 HEALTH · CHECKPOINTS</small></div></div>}
      {phase==='paused'&&<div className={s.overlay}><div><span className={s.eyebrow}>PAUSED</span><h2>Catch your breath.</h2><p>Your checkpoint is saved.</p><button className={s.primary} onClick={()=>setPhase('running')}>BACK TO THE MISSION →</button><button className={s.secondary} onClick={onLeave}>LEVEL SELECT</button></div></div>}
      {phase==='complete'&&<div className={s.overlay}><div><span className={s.eyebrow}>{final?'ALL TEN LEVELS CLEARED':view.won?'LEVEL COMPLETE':view.dead?'OUT OF HEALTH':'TIME’S UP'}</span><h2>{final?'THE MOON IS YOURS.':view.won?'Onward. Upward.':'One more try.'}</h2><p>{final?'The Warden is down. Your terminal made it home.':view.won?`${view.coins} coins · ${view.stomps} stomps · ${view.score.toLocaleString()} points`:'Your latest checkpoint is ready.'}</p>
        {view.won&&!final?<button className={s.primary} onClick={onNext}>NEXT LEVEL →</button>:!view.won?<button className={s.primary} onClick={()=>onRetry(game.current.checkpointIndex)}>RETRY CHECKPOINT →</button>:<button className={s.primary} onClick={onLeave}>VIEW CAMPAIGN →</button>}<button className={s.secondary} onClick={onLeave}>LEVEL SELECT</button></div></div>}
    </div>
    <footer className={s.controls}><div><button aria-label='Run left' disabled={phase!=='running'} {...control(LEFT)}>◀</button><button aria-label='Run right' disabled={phase!=='running'} {...control(RIGHT)}>▶</button></div><p>{world.mechanic}<span>Double jump to climb. Stomp from above.</span></p><button aria-label='Jump' disabled={phase!=='running'} className={s.jump} {...control(JUMP)}>↑ JUMP</button></footer>
  </section>;
}
