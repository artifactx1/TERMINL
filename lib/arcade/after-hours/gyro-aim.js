import {useEffect,useRef,useState} from 'react';

const GYRO_KEY='terminl:rug-gyro',SPEED_KEY='terminl:rug-gyro-speed';
/** Sensitivity 1–10. View turn per phone turn = 0.6 × level for slow, precise movement,
 * up to double that for fast flicks, so a quick turn swings the view onto a target. */
export const GYRO_SPEEDS=Object.freeze({min:1,max:10,initial:5});
const gain=(level,rate)=>.6*level*(1+Math.min(1,rate/200));
/** Radians of view per look unit in the sim (RUG_TUNING.mouseSensitivity). */
const LOOK_RAD=.0022;
/** Turns the phone's rotation into look input: physically turning the phone turns the view.
 * Rotation rates are in degrees per second around the device axes; which axis is
 * "turn" and which is "tilt" depends on how the phone is held. */
function gyroLook(event,angle,dt){
  const r=event.rotationRate;if(!r)return null;
  // beta: rotation around the device's short axis; gamma: around its long axis.
  // Sub-degree rates are sensor noise; ignoring them stops the view drifting.
  const still=v=>Math.abs(v)<1?0:v,rad=Math.PI/180*dt/LOOK_RAD,aroundX=still(r.beta||0),aroundY=still(r.gamma||0);
  if(angle===90)return {x:-aroundX*rad,y:aroundY*rad};
  if(angle===270||angle===-90)return {x:aroundX*rad,y:-aroundY*rad};
  return {x:-aroundY*rad,y:-aroundX*rad};
}
/** Optional gyro aim for Rug.exe. Off by default; the choice is remembered on this device. */
export function useGyro(game){
  const [gyro,setGyro]=useState(false),[gyroError,setGyroError]=useState(''),[speed,setSpeedState]=useState(GYRO_SPEEDS.initial);
  useEffect(()=>{try{setGyro(localStorage.getItem(GYRO_KEY)==='on');const saved=Number(localStorage.getItem(SPEED_KEY));if(saved>=GYRO_SPEEDS.min&&saved<=GYRO_SPEEDS.max)setSpeedState(saved);}catch{}},[]);
  // Phone movement on the pause screen must not jolt the view on resume.
  const playing=useRef(false);playing.current=game.mode==='playing';
  const setSpeed=value=>{setSpeedState(value);try{localStorage.setItem(SPEED_KEY,String(value));}catch{}};
  useEffect(()=>{
    if(!gyro)return;let last=0;
    const motion=e=>{const now=performance.now(),dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!dt||!playing.current)return;
      const look=gyroLook(e,screen.orientation?.angle??window.orientation??0,dt);if(!look)return;
      const rate=Math.hypot(e.rotationRate.alpha||0,e.rotationRate.beta||0,e.rotationRate.gamma||0),g=gain(speed,rate);
      // Vertical is a little calmer than horizontal so tilting doesn't overshoot.
      game.runtime.current?.input.look(look.x*g,look.y*g*.8);};
    window.addEventListener('devicemotion',motion);return()=>window.removeEventListener('devicemotion',motion);
  },[gyro,game,speed]);
  const toggle=async()=>{
    setGyroError('');const next=!gyro;
    // iOS asks for motion permission, and only from a tap.
    if(next&&typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
      try{if(await DeviceMotionEvent.requestPermission()!=='granted'){setGyroError('Motion access was declined. Reload the page and allow motion access to use gyro aim.');return;}}
      catch{setGyroError('Gyro aim needs motion access.');return;}
    }
    setGyro(next);try{localStorage.setItem(GYRO_KEY,next?'on':'off');}catch{}
  };
  return {gyro,gyroError,toggle,speed,setSpeed};
}
