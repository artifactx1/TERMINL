import {VEHICLES,raceBotNoise as rivalNoise} from './race-sim.mjs';

export const RIVAL_STYLES=Object.freeze([
  {id:'smooth',name:'SMOOTH OPERATOR',description:'Clean lines, patient exits',pace:.94,cornerPace:1,boostChance:.55,line:5,mistakeRate:.12},
  {id:'cautious',name:'SUNDAY DRIVER',description:'Early brakes, steady pace',pace:.88,cornerPace:.93,boostChance:.3,line:8,mistakeRate:.16},
  {id:'charger',name:'BOOST CHASER',description:'Fast straights, occasional hesitation',pace:1,cornerPace:.98,boostChance:.95,line:10,mistakeRate:.3},
  {id:'wildcard',name:'WILD CARD',description:'Varied lines, uneven rhythm',pace:.96,cornerPace:.96,boostChance:.7,line:15,mistakeRate:.45},
]);
/** Randomness is chosen once outside the simulation; each profile is reproducible. */
export function createPracticeRival({seed,playerVehicle='comet',previous=null,teaching=false}={}){
  if(!Number.isInteger(seed)){
    const bytes=new Uint32Array(1);
    if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
    else bytes[0]=Math.floor(Math.random()*4294967296);
    seed=bytes[0];
  }
  seed>>>=0;
  const styles=RIVAL_STYLES.filter(p=>teaching?p.id==='cautious':p.id!==previous?.id);
  const style=styles[Math.floor(rivalNoise(seed,0)*styles.length)];
  const vehicles=Object.keys(VEHICLES).filter(id=>id!==playerVehicle&&id!==previous?.vehicle);
  return {...style,seed,vehicle:vehicles[Math.floor(rivalNoise(seed,1)*vehicles.length)],
    pace:style.pace*(.97+rivalNoise(seed,2)*.04),reactionTicks:10+Math.floor(rivalNoise(seed,3)*32)};
}
