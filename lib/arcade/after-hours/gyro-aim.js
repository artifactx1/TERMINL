import {useEffect,useState} from 'react';

const GYRO_KEY='terminl:rug-gyro';
/** Radians of view per look unit in the sim (RUG_TUNING.mouseSensitivity). */
const LOOK_RAD=.0022;
/** Turns the phone's rotation into look input: physically turning the phone turns the view.
 * Rotation rates are in degrees per second around the device axes; which axis is
 * "turn" and which is "tilt" depends on how the phone is held. */
function gyroLook(event,angle,dt){
  const r=event.rotationRate;if(!r)return null;
  // beta: rotation around the device's short axis; gamma: around its long axis.
  const rad=Math.PI/180*dt/LOOK_RAD,aroundX=r.beta||0,aroundY=r.gamma||0;
  if(angle===90)return {x:-aroundX*rad,y:aroundY*rad};
  if(angle===270||angle===-90)return {x:aroundX*rad,y:-aroundY*rad};
  return {x:-aroundY*rad,y:-aroundX*rad};
}
/** Optional gyro aim for Rug.exe. Off by default; the choice is remembered on this device. */
export function useGyro(game){
  const [gyro,setGyro]=useState(false),[gyroError,setGyroError]=useState('');
  useEffect(()=>{try{setGyro(localStorage.getItem(GYRO_KEY)==='on');}catch{}},[]);
  useEffect(()=>{
    if(!gyro)return;let last=0;
    const motion=e=>{const now=performance.now(),dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!dt)return;
      const look=gyroLook(e,screen.orientation?.angle??window.orientation??0,dt);
      if(look)game.runtime.current?.input.look(look.x*1.4,look.y*1.4);};
    window.addEventListener('devicemotion',motion);return()=>window.removeEventListener('devicemotion',motion);
  },[gyro,game]);
  const toggle=async()=>{
    setGyroError('');const next=!gyro;
    // iOS asks for motion permission, and only from a tap.
    if(next&&typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
      try{if(await DeviceMotionEvent.requestPermission()!=='granted'){setGyroError('Motion access was declined. Reload the page and allow motion access to use gyro aim.');return;}}
      catch{setGyroError('Gyro aim needs motion access.');return;}
    }
    setGyro(next);try{localStorage.setItem(GYRO_KEY,next?'on':'off');}catch{}
  };
  return {gyro,gyroError,toggle};
}
