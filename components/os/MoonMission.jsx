import { useEffect, useRef, useState } from "react";
import { newMoon, stepMoon, moonWorld, MOON_TICK_MS, MOON_END_TICK, LEFT, RIGHT, JUMP } from "../../lib/moon-mission.mjs";
import { drawMoon } from "../../lib/moon-draw";
import s from "../../styles/OS.module.css";

export default function MoonMission({run,active,onComplete,leave,sound,machine}) {
  const world=moonWorld(run.level);
  const canvas=useRef(null),scene=useRef(null),game=useRef(newMoon(run.seed,world.level)),moves=useRef([]),art=useRef(null);
  const ghost=useRef(run.rivalRecord?newMoon(run.seed,run.rivalRecord.level):null),ghostIndex=useRef(0);
  const [phase,setPhase]=useState("ready"),[view,setView]=useState(game.current);
  const phaseRef=useRef(phase);phaseRef.current=phase;
  const callbacks=useRef({onComplete,sound});callbacks.current={onComplete,sound};
  const dimensions=useRef({width:960,scale:1}),completed=useRef(false),audio=useRef(null);
  const input=value=>{
    if(phaseRef.current!=="running")return;
    const state=game.current;
    if(state.input===value)return;
    game.current={...state,input:value};
    const action={tick:state.tick,input:value};
    if(moves.current.at(-1)?.tick===state.tick)moves.current[moves.current.length-1]=action;else moves.current.push(action);
  };
  const inputRef=useRef(input);inputRef.current=input;
  const bit=(value,down)=>inputRef.current(down?game.current.input|value:game.current.input&~value);
  const bitRef=useRef(bit);bitRef.current=bit;
  const pause=()=>{inputRef.current(0);setPhase("paused");};
  const paint=(state)=>{
    const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    ctx.setTransform(dimensions.current.scale,0,0,dimensions.current.scale,0,0);
    drawMoon(ctx,state,dimensions.current.width,{art:art.current,ghost:ghost.current});
  };
  const paintRef=useRef(paint);paintRef.current=paint;

  useEffect(()=>{
    const image=new window.Image();image.src=`/art/${machine.slug}.webp`;art.current=image;
    const sceneElement=scene.current,canvasElement=canvas.current;
    if(!sceneElement||!canvasElement)return;
    let disposed=false;
    const resize=()=>{
      // A queued observer notification can outlive React's ref cleanup.
      if(disposed||!sceneElement.isConnected||!canvasElement.isConnected)return;
      const r=sceneElement.getBoundingClientRect();if(!r.width||!r.height)return;
      const dpr=Math.min(2,window.devicePixelRatio||1);
      canvasElement.width=Math.round(r.width*dpr);canvasElement.height=Math.round(r.height*dpr);
      dimensions.current={width:r.width/r.height*540,scale:canvasElement.height/540};
      paintRef.current(game.current);
    };
    const observer=new ResizeObserver(resize);observer.observe(sceneElement);resize();
    return ()=>{disposed=true;observer.disconnect();audio.current?.close().catch(()=>{});audio.current=null;};
  },[machine.slug]);
  useEffect(()=>{
    if(!active&&phase==="running"){inputRef.current(0);setPhase("paused");}
  },[active,phase]);
  useEffect(()=>{
    const map={ArrowLeft:LEFT,a:LEFT,A:LEFT,ArrowRight:RIGHT,d:RIGHT,D:RIGHT," ":JUMP,ArrowUp:JUMP,w:JUMP,W:JUMP};
    const key=e=>{
      if(e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
      if(phaseRef.current!=="running")return;
      if(map[e.key]){e.preventDefault();bitRef.current(map[e.key],e.type==="keydown");}
      if(e.type==="keydown"&&["p","P","Escape"].includes(e.key)){e.preventDefault();inputRef.current(0);setPhase("paused");}
    };
    const blur=()=>{if(phaseRef.current==="running"){inputRef.current(0);setPhase("paused");}};
    const hidden=()=>{if(document.hidden)blur();};
    window.addEventListener("keydown",key);window.addEventListener("keyup",key);window.addEventListener("blur",blur);document.addEventListener("visibilitychange",hidden);
    return ()=>{window.removeEventListener("keydown",key);window.removeEventListener("keyup",key);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",hidden);};
  },[]);
  useEffect(()=>{
    if(phase==="paused")return;
    let frame,last=performance.now(),accumulator=0,preview=0;
    const tick=now=>{
      const elapsed=Math.min(100,now-last);last=now;
      if(phase==="ready"||phase==="complete"){
        preview+=elapsed/MOON_TICK_MS;paintRef.current({...game.current,tick:game.current.tick+preview});frame=requestAnimationFrame(tick);return;
      }
      accumulator+=elapsed;
      while(accumulator>=MOON_TICK_MS&&!game.current.ended){
        game.current=stepMoon(game.current);accumulator-=MOON_TICK_MS;
        if(ghost.current&&!ghost.current.ended&&ghost.current.tick<run.rivalRecord.endTick){
          const action=run.rivalRecord.moves[ghostIndex.current];if(action?.tick===ghost.current.tick){ghost.current.input=action.input;ghostIndex.current++;}
          ghost.current=stepMoon(ghost.current);
        }
        if(callbacks.current.sound&&game.current.pulse?.tick===game.current.tick){
          try{const Context=window.AudioContext||window.webkitAudioContext;const ctx=audio.current||(audio.current=new Context());ctx.resume().catch(()=>{});const o=ctx.createOscillator(),g=ctx.createGain();o.type="square";o.frequency.value=game.current.pulse.kind==="hit"?85:game.current.pulse.kind==="jump"?360:780;g.gain.setValueAtTime(.02,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.12);}catch{/* Audio is optional. */}
        }
      }
      paintRef.current(game.current);
      canvas.current.dataset.tick=String(game.current.tick);
      canvas.current.dataset.x=String(Math.round(game.current.x));
      if(game.current.tick%6===0||game.current.ended)setView(game.current);
      if(game.current.ended){setPhase("complete");return;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
  },[phase,run.rivalRecord]);
  useEffect(()=>{
    if(phase!=="complete")return;
    const timer=setTimeout(()=>{
      if(completed.current)return;completed.current=true;
      callbacks.current.onComplete({seed:run.seed,level:game.current.level,moves:moves.current.filter(m=>m.tick<game.current.tick),endTick:game.current.tick},"MOON");
    },1800);
    return ()=>clearTimeout(timer);
  },[phase,run.seed]);

  const control=(value)=>({
    onPointerDown:e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);bit(value,true);},
    onPointerUp:()=>bit(value,false),onPointerCancel:()=>bit(value,false),onLostPointerCapture:()=>bit(value,false),
  });
  return <section className={s.moonGame} aria-label="Moon Mission platform game">
    <header className={s.moonHeader}><button onClick={leave}>← ARCADE</button><div>MOON MISSION <span>WORLD {String(world.level+1).padStart(2,"0")} / {world.name.toUpperCase()}</span></div><button disabled={phase==="ready"||phase==="complete"} onClick={()=>phase==="paused"?setPhase("running"):pause()}>{phase==="paused"?"▶ RESUME":"Ⅱ PAUSE"}</button></header>
    <div className={s.moonScene} ref={scene}>
      <canvas ref={canvas} data-level={world.level} data-phase={phase} data-tick={view.tick} data-x={Math.round(view.x)} data-input={view.input} tabIndex={0} aria-label="Side-scrolling platform game. Arrow keys to run. Space to jump, press again in the air to double jump. Reach the rocket." onPointerDown={e=>{if(e.pointerType!=="mouse"){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);bit(JUMP,true);}}} onPointerUp={()=>bit(JUMP,false)} onPointerCancel={()=>bit(JUMP,false)} onLostPointerCapture={()=>bit(JUMP,false)} />
      <div className={s.moonHud}><div><span>YOUR BAG</span><b>✦ {view.score.toLocaleString("en-US")}</b></div><div><span>LIVES</span><b className={s.moonHearts}>{"♥".repeat(view.hp)}<i>{"♡".repeat(3-view.hp)}</i></b></div><div><span>TIME</span><b>{Math.ceil((MOON_END_TICK-view.tick)/60)}</b></div></div>
      <div className={s.moonProgress}><span style={{width:`${Math.min(100,view.furthest/world.finish*100)}%`}} /></div>
      {phase==="ready"&&<div className={s.moonIntro}><div className={s.moonIntroPanel}><span className={s.moonEyebrow}>WORLD {String(world.level+1).padStart(2,"0")} / {world.tag}</span><h2>MOON<br /><em>MISSION</em></h2><p><strong>{world.name}</strong><br />{world.brief}</p><div className={s.moonHowto}><span>← → <b>RUN</b></span><span>SPACE <b>JUMP</b></span><span>AGAIN <b>DOUBLE JUMP</b></span></div><p className={s.moonInstruction}>Collect coins. Stomp red candles from above.<br />Jump the pools. Reach the rocket.</p><button onClick={()=>setPhase("running")}>LAUNCH WORLD {String(world.level+1).padStart(2,"0")} →</button><small>{run.rivalName?`RACING ${run.rivalName.toUpperCase()}'S GHOST` : "90 SECONDS · 3 LIVES · NO ACTUAL MOON MONEY"}</small></div></div>}
      {phase==="paused"&&<div className={s.moonPause}><span>PAUSED</span><h3>Even degens need a breather.</h3><p>Your checkpoint and coins are safe.</p><button onClick={()=>setPhase("running")}>BACK TO THE MISSION →</button></div>}
      {phase==="complete"&&<div className={s.moonComplete}><span>{view.won?"✦ MISSION COMPLETE ✦":view.dead?"SYSTEM CRASH":"TIME'S UP"}</span><h3>{view.won?"WE MADE IT.":"ONE MORE TRY?"}</h3><p>{view.score.toLocaleString("en-US")} POINTS · {view.coins} COINS · {view.stomps} STOMPS</p></div>}
      {phase==="running"&&view.tick<360&&<div className={s.moonHint}>MOVE → &nbsp; SPACE TO JUMP &nbsp; · &nbsp; PRESS AGAIN TO DOUBLE JUMP</div>}
    </div>
    <footer className={s.moonControls}><div><button aria-label="Run left" disabled={phase!=="running"} {...control(LEFT)}>◀</button><button aria-label="Run right" disabled={phase!=="running"} {...control(RIGHT)}>▶</button></div><p><b>STOMP THE CANDLES. SAVE THE TERMINAL.</b><span>Checkpoints save your place. Purple bridges collapse. Blue diamonds give a shield.</span></p><button className={s.moonJump} aria-label="Jump" disabled={phase!=="running"} {...control(JUMP)}>↑ <span>JUMP</span></button></footer>
  </section>;
}
