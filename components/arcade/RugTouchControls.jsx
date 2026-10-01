import {useEffect,useRef,useState} from 'react';
import s from '../../styles/RugExe.module.css';

/** Phone controls: left thumb moves (double-tap to dash), right thumb aims. Touch play
 * auto-fires when the crosshair is on an enemy, so aiming and shooting take one thumb. */
export default function RugTouchControls({game,canUse}){
  const movePointer=useRef(null),lookPointer=useRef(null),last=useRef(null),lastTap=useRef(0),[knob,setKnob]=useState({x:0,y:0});
  useEffect(()=>{
    const input=game.runtime.current?.input,coarse=matchMedia('(pointer: coarse)').matches;
    input?.touchMode(coarse);return()=>input?.touchMode(false);
  },[game.runtime]);
  const input=()=>game.runtime.current?.input;
  const move=e=>{if(movePointer.current!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect();let x=(e.clientX-r.x-r.width/2)/(r.width*.34),y=(e.clientY-r.y-r.height/2)/(r.height*.34);const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}setKnob({x,y});input()?.stick({x:Math.abs(x)<.1?0:x,y:Math.abs(y)<.1?0:y});};
  const release=e=>{if(movePointer.current!==e.pointerId)return;movePointer.current=null;setKnob({x:0,y:0});input()?.stick(null);};
  const stickDown=e=>{
    if(movePointer.current!==null)return;input()?.touchMode(true);movePointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);game.runtime.current?.audio.unlock();
    // A second tap within 300ms dashes in the stick's direction.
    const now=performance.now();if(now-lastTap.current<300){input()?.touch('dash',true,'stick-dash');setTimeout(()=>input()?.touch('dash',false,'stick-dash'),60);lastTap.current=0;}else lastTap.current=now;
    move(e);
  };
  const aimStart=(e,fire)=>{if(lookPointer.current!==null)return;input()?.touchMode(true);lookPointer.current=e.pointerId;last.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);game.runtime.current?.audio.unlock();if(fire)game.touch('fire',e);};
  const aimMove=e=>{if(lookPointer.current!==e.pointerId)return;input()?.look((e.clientX-last.current.x)*2.2,(e.clientY-last.current.y)*2.2);last.current={x:e.clientX,y:e.clientY};};
  const aimEnd=e=>{if(lookPointer.current!==e.pointerId)return;lookPointer.current=null;last.current=null;input()?.touch('fire',false,e.pointerId);};
  const button=(action,label,className='')=> <button className={className} onPointerDown={e=>game.touch(action,e)} onPointerUp={e=>game.touch(action,e)} onPointerCancel={e=>game.touch(action,e)} onLostPointerCapture={e=>game.touch(action,e)}>{label}</button>;
  return <div className={s.touchLayer}>
    <div className={s.aimArea} role='application' aria-label='Look area. Drag to aim. Shots fire automatically when the crosshair is on an enemy.' onPointerDown={e=>aimStart(e,false)} onPointerMove={aimMove} onPointerUp={aimEnd} onPointerCancel={aimEnd} onLostPointerCapture={aimEnd}/>
    <div className={s.moveWrap}><div className={s.stick} role='application' aria-label='Movement thumbstick. Double-tap to dash.' onPointerDown={stickDown} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><i style={{transform:`translate(${knob.x*38}px,${knob.y*38}px)`}}/></div><small>MOVE · DOUBLE-TAP TO DASH</small></div>
    <div className={s.actionCluster}>
      {canUse&&button('interact','USE',s.use)}
      <div>{button('jump','JUMP')}{button('crouch','SLIDE')}</div>
      <button className={s.fire} aria-label='Fire and aim. Hold to shoot, drag to aim.' onPointerDown={e=>aimStart(e,true)} onPointerMove={aimMove} onPointerUp={aimEnd} onPointerCancel={aimEnd} onLostPointerCapture={aimEnd}>FIRE<span>AUTO ON TARGET</span></button>
    </div>
  </div>;
}
