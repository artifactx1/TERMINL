import {useRef,useState} from 'react';
import s from '../../styles/MallRat.module.css';

export default function MallTouchControls({game}){
 const pointer=useRef(null),[stick,setStick]=useState({x:0,y:0});
 const move=e=>{
  if(pointer.current!==e.pointerId)return;
  const r=e.currentTarget.getBoundingClientRect(),radius=r.width*.34;
  let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  setStick({x,y});game.runtime.current?.input.stick({x:Math.abs(x)<.12?0:x,y});
 };
 const release=e=>{if(pointer.current!==e.pointerId)return;pointer.current=null;setStick({x:0,y:0});game.runtime.current?.input.stick(null);};
 const action=(name,label,className)=> <button className={className} aria-label={label} onPointerDown={e=>game.touch(name,e)} onPointerUp={e=>game.touch(name,e)} onPointerCancel={e=>game.touch(name,e)} onLostPointerCapture={e=>game.touch(name,e)}>{label}</button>;
 const p=game.view?.player;
 return <div className={s.touchControls} aria-label='Touch skate controls'>
  <div className={s.stickWrap}><div className={s.stick} role='application' aria-label='Steering thumbstick. Hold to push, slide left or right to steer, pull down to brake.' onPointerDown={e=>{if(pointer.current!==null)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);game.runtime.current?.audio.unlock();move(e);}} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
   <span className={s.stickCross}/><i style={{transform:`translate(${stick.x*40}px,${stick.y*40}px)`}}/><span className={s.brakeLabel}>BRAKE ↓</span>
  </div><small>HOLD TO ROLL · SLIDE TO STEER</small></div>
  <div className={s.actions}>
   {action('bank','BANK',s.bank)}
   {action('special',game.view?.meter>=100?'SPECIAL ↗':'SPECIAL',s.special)}
   {action('grab','GRAB',s.grab)}
   {action('action',p&&!p.grounded&&!p.rail?'FLIP':'OLLIE',s.ollie)}
   <small>AUTO GRIND + MANUAL</small>
  </div>
 </div>;
}
