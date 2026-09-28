import {angleDelta} from './math.mjs';
export const MAX_GHOST_FRAMES=2000;

/** Long last lines retain the entire replay by gradually reducing sample density. */
export function recordMallGhost(s,force=false){
 if(s.practice)return;
 const last=s.ghost.at(-1),stride=s.ghostStride||6;
 if(last?.[0]===s.tick||(!force&&s.tick-(last?.[0]||0)<stride))return;
 if(s.ghost.length>=MAX_GHOST_FRAMES){s.ghost=s.ghost.filter((_,i)=>i%2===0);s.ghostStride=stride*2;}
 const p=s.player;s.ghost.push([s.tick,Math.round(p.x*100)/100,Math.round(p.y*100)/100,Math.round(p.z*100)/100,p.yaw]);
}
export function validMallGhost(frames){
 return Array.isArray(frames)&&frames.length<=MAX_GHOST_FRAMES&&frames.every((f,i)=>Array.isArray(f)&&f.length===5&&f.every(Number.isFinite)&&f[0]>=0&&(!i||f[0]>frames[i-1][0]));
}
/** Timestamps also support older saves that skipped sampling during bails. */
export function sampleMallGhost(frames,tick){
 if(!frames?.length||tick>frames.at(-1)[0])return null;
 let low=0,high=frames.length-1;
 while(low<high){const mid=Math.floor((low+high)/2);if(frames[mid][0]<tick)low=mid+1;else high=mid;}
 const b=frames[low],a=frames[Math.max(0,low-1)],span=b[0]-a[0],t=span?Math.max(0,(tick-a[0])/span):0;
 return {x:a[1]+(b[1]-a[1])*t,y:a[2]+(b[2]-a[2])*t,z:a[3]+(b[3]-a[3])*t,yaw:a[4]+angleDelta(b[4],a[4])*t,speed:span?Math.hypot(b[1]-a[1],b[3]-a[3])*60/span:0};
}
