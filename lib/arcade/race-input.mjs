/** Rules v4: seven action bits plus an optional signed steering axis.
 * Axis byte 0 means digital keys; 1..255 maps to -1..1 (128 is centered).
 * One bounded integer travels through the existing input/replay protocol.
 */
export const RACE_MAX_INPUT=32767;
export const RACE_KEYS=Object.freeze({ArrowLeft:1,a:1,ArrowRight:2,d:2,ArrowUp:4,w:4,ArrowDown:8,s:8,' ':16,Shift:32,r:64});
const clamp=n=>Math.max(-1,Math.min(1,n));
export function raceKeyboardInput(held){
  let buttons=0,steering=0;
  for(const key of held){const bit=RACE_KEYS[key]||RACE_KEYS[key.toLowerCase()]||0;buttons|=bit;if(bit&3)steering=bit;}
  return (buttons&~3)|steering;
}
export function encodeRaceInput(buttons,axis){
  const actions=(Number.isInteger(buttons)?buttons:0)&127;
  if(!Number.isFinite(axis))return actions;
  return (actions&~3)|((Math.round(clamp(axis)*127)+128)<<7);
}
export function decodeRaceSteering(input){
  const axis=input>>7;
  return axis?(axis-128)/127:Number(!!(input&2))-Number(!!(input&1));
}
/** Digital keys win while held; otherwise use the active thumb/controller axis. */
export function composeRaceInput({keyboard=0,touch=0,pad=0,touchAxis=0,padAxis=0,touchActive=false}={}){
  let buttons=keyboard|touch|pad;
  if(buttons&8)buttons&=~(4|32);
  if((keyboard|pad)&3)return (buttons&~3)|((keyboard|pad)&3);
  return encodeRaceInput(buttons,touchActive?touchAxis:padAxis);
}
