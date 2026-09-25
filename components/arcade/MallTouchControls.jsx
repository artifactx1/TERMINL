import {useRef,useState} from 'react';
import s from '../../styles/MallRat.module.css';
const TRICKS=[['flip','KICKFLIP'],['varial','VARIAL'],['tre','TRE FLIP'],['shuvit','SHUVIT'],['frontflip','FRONTFLIP'],['backflip','BACKFLIP'],['grab','GRAB'],['heelflip','HEELFLIP']];
export default function MallTouchControls({game}){
 const pointer=useRef(null),[stick,setStick]=useState({x:0,y:0}),[selected,setSelected]=useState(TRICKS[0]),[picker,setPicker]=useState(false);
 const move=e=>{
  if(pointer.current!==e.pointerId)return;
  const r=e.currentTarget.getBoundingClientRect(),radius=r.width*.34;
  let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  setStick({x,y});game.runtime.current?.input.stick({x:Math.abs(x)<.12?0:x,y});
 };
 const release=e=>{if(pointer.current!==e.pointerId)return;pointer.current=null;setStick({x:0,y:0});game.runtime.current?.input.stick(null);};
 const action=(name,label,detail,className)=> <button className={className} aria-label={label} onPointerDown={e=>{setPicker(false);game.touch(name,e);}} onPointerUp={e=>game.touch(name,e)} onPointerCancel={e=>game.touch(name,e)} onLostPointerCapture={e=>game.touch(name,e)}><b>{label}</b><small>{detail}</small></button>;
 const p=game.view?.player,air=p&&!p.grounded&&!p.rail;
 return <div className={s.touchControls} aria-label='Touch skate controls'>
  <div className={s.stickWrap}><div className={s.stick} role='application' aria-label='Steering thumbstick. Hold to roll, drag left or right to steer, pull down to brake.' onPointerDown={e=>{if(pointer.current!==null)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);game.runtime.current?.audio.unlock();move(e);}} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
   <span className={s.stickCross}/><i style={{transform:`translate(${stick.x*40}px,${stick.y*40}px)`}}/><span className={s.brakeLabel}>{stick.y>=.45?'BRAKING':'BRAKE ↓'}</span>
  </div><small>HOLD TO ROLL · DRAG TO STEER</small></div>
  <div className={s.actions}>
   {picker&&<div className={s.trickPicker} role='group' aria-label='Choose your trick'>{TRICKS.map(trick=><button key={trick[0]} aria-pressed={selected[0]===trick[0]} onClick={()=>{setSelected(trick);setPicker(false);}}>{trick[1]}</button>)}</div>}
   <button className={s.chooseTrick} aria-expanded={picker} onClick={()=>setPicker(!picker)}>CHOOSE TRICK {picker?'▴':'▾'}</button>
   {action('spin','360','IN THE AIR',s.spin)}
   {action('link','GRIND','HOLD / MANUAL',s.link)}
   {action(selected[0],selected[1],p?.airMove?'CATCHING…':air?'TAP NOW':'AFTER JUMP',s.trick)}
   {action('jump','JUMP','HOLD FOR HEIGHT',s.ollie)}
   <small>LAND + RELEASE TO BANK YOUR SCORE</small>
  </div>
 </div>;
}
