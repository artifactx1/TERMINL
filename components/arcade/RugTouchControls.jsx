import {useRef,useState} from 'react';
import s from '../../styles/RugExe.module.css';
export default function RugTouchControls({game}){
 const movePointer=useRef(null),lookPointer=useRef(null),last=useRef(null),[knob,setKnob]=useState({x:0,y:0});
 const move=e=>{if(movePointer.current!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect();let x=(e.clientX-r.x-r.width/2)/(r.width*.34),y=(e.clientY-r.y-r.height/2)/(r.height*.34);const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}setKnob({x,y});game.runtime.current?.input.stick({x:Math.abs(x)<.1?0:x,y:Math.abs(y)<.1?0:y});};
 const release=e=>{if(movePointer.current!==e.pointerId)return;movePointer.current=null;setKnob({x:0,y:0});game.runtime.current?.input.stick(null);};
 const aimStart=(e,fire)=>{if(lookPointer.current!==null)return;lookPointer.current=e.pointerId;last.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);game.runtime.current?.audio.unlock();if(fire)game.touch('fire',e);};
 const aimMove=e=>{if(lookPointer.current!==e.pointerId)return;game.runtime.current?.input.look((e.clientX-last.current.x)*2.2,(e.clientY-last.current.y)*2.2);last.current={x:e.clientX,y:e.clientY};};
 const aimEnd=e=>{if(lookPointer.current!==e.pointerId)return;lookPointer.current=null;last.current=null;game.runtime.current?.input.touch('fire',false,e.pointerId);};
 const button=(action,label)=> <button onPointerDown={e=>game.touch(action,e)} onPointerUp={e=>game.touch(action,e)} onPointerCancel={e=>game.touch(action,e)} onLostPointerCapture={e=>game.touch(action,e)}>{label}</button>;
 return <div className={s.touchLayer}>
  <div className={s.aimArea} role='application' aria-label='Look area. Drag to aim without firing.' onPointerDown={e=>aimStart(e,false)} onPointerMove={aimMove} onPointerUp={aimEnd} onPointerCancel={aimEnd} onLostPointerCapture={aimEnd}/>
  <div className={s.moveWrap}><div className={s.stick} role='application' aria-label='Movement thumbstick' onPointerDown={e=>{if(movePointer.current!==null)return;movePointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);game.runtime.current?.audio.unlock();move(e);}} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><i style={{transform:`translate(${knob.x*38}px,${knob.y*38}px)`}}/></div><small>MOVE / STRAFE</small></div>
  <div className={s.actionCluster}><div>{button('jump','JUMP')}{button('dash','DASH')}{button('interact','USE')}{button('crouch','SLIDE')}</div><button className={s.fire} aria-label='Fire and aim. Hold to shoot, drag to aim.' onPointerDown={e=>aimStart(e,true)} onPointerMove={aimMove} onPointerUp={aimEnd} onPointerCancel={aimEnd} onLostPointerCapture={aimEnd}>FIRE<span>HOLD + DRAG</span></button></div>
 </div>;
}
