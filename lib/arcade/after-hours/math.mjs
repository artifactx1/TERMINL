export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const inside=(p,b,pad=0)=>Math.abs(p.x-b.x)<b.w/2+pad&&Math.abs(p.z-b.z)<b.d/2+pad;
export function nearestRail(p,r){const dx=r.bx-r.x,dz=r.bz-r.z,len=dx*dx+dz*dz,t=clamp(((p.x-r.x)*dx+(p.z-r.z)*dz)/len,0,1);return {x:r.x+dx*t,z:r.z+dz*t,t,distance:Math.hypot(p.x-r.x-dx*t,p.z-r.z-dz*t)};}
export function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function floorAt(world,x,z,tick=0){let height=world.base??0;for(const f of world.floors){if(inside({x,z},f)){const h=f.rise?f.y+clamp((z-(f.z-f.d/2))/f.d,0,1)*f.rise:f.y;if(f.override)height=h;else height=Math.max(height,h);}}return height;}
export function moveSolid(p,dx,dz,solids,radius=.5){const blocked=(x,z)=>solids.some(b=>!b.broken&&p.y<(b.y||0)+b.h-.15&&p.y+1.3>(b.y||0)&&inside({x,z},b,radius));if(!blocked(p.x+dx,p.z))p.x+=dx;else p.vx=0;if(!blocked(p.x,p.z+dz))p.z+=dz;else p.vz=0;}
export function lineBlocked(a,b,solids){const len=distance(a,b),steps=Math.ceil(len/.5);for(let i=1;i<steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=(a.y??1)+( (b.y??1)-(a.y??1))*t;if(solids.some(o=>!o.broken&&y>(o.y||0)&&y<(o.y||0)+o.h&&inside({x,z},o)))return true;}return false;}
