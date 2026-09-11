/** Behind-the-car perspective of the SAME authoritative world and checkpoint geometry.
 * Generated plates/sprites are presentation only; no positions, inputs or scores are changed.
 */
import {trackGeometry,nearestRoad,roadAt,angleDelta} from './race-sim.mjs';
import {drawRaceWheels} from './race-wheels.js';
const cache={},cameras=new WeakMap(),props=new Map();
const files={coast:'/arcade/california-coast-v1.png',desert:'/arcade/california-desert-v1.png',cars:'/arcade/california-pepe-bodies-v1.png',scenery:'/arcade/california-scenery-v1.png'};
let loading;
export function preloadRaceArt(){
  if(loading)return loading;if(typeof window==='undefined')return Promise.resolve();
  loading=Promise.all(Object.entries(files).map(([key,src])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{cache[key]=im;resolve();};im.onerror=()=>resolve();im.src=src;})));return loading;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const playerCarFrame=(width,height)=>({x:width/2,y:height*.87,width:clamp(43*Math.min(width*.92,height*1.04)/65,75,width*.5)});
function poly(c,points,color){if(points.length<3)return;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();}
function label(c,value,x,y,size,color='#fff'){c.font=`900 italic ${size}px system-ui,sans-serif`;c.textAlign='center';c.lineWidth=4;c.strokeStyle='#172328';c.strokeText(value,x,y);c.fillStyle=color;c.fillText(value,x,y);}
function spriteCell(image,row,column){return {image,x:column*image.width/3,y:row*image.height/2,w:image.width/3,h:image.height/2};}
const SCENERY_FRAMES=[[24,0,410,540],[438,136,570,404],[1014,65,522,475],[12,540,420,484],[437,540,543,484],[982,540,554,484]];
function drawCell(c,cell,x,y,w,h){c.drawImage(cell.image,cell.x,cell.y,cell.w,cell.h,x,y,w,h);}
export function drawRearCar(c,id,{x,y,width=260,steer=0,boosting=false,braking=false,tick=0,ghost=false,rotation=0,view=0}={}){
  preloadRaceArt();const h=width*.72;c.save();c.globalAlpha=ghost?.72:1;
  c.fillStyle='#10202966';c.beginPath();c.ellipse(x,y-h*.015,width*.43,h*.055,0,0,Math.PI*2);c.fill();
  if(boosting){for(const side of [-1,1]){const length=width*(.16+(tick%5)*.012);poly(c,[{x:x+side*width*.16-width*.055,y:y-h*.13},{x:x+side*width*.16+width*.055,y:y-h*.13},{x:x+side*width*.16,y:y+length}], '#36dfff');poly(c,[{x:x+side*width*.16-width*.026,y:y-h*.12},{x:x+side*width*.16+width*.026,y:y-h*.12},{x:x+side*width*.16,y:y+length*.65}],'#eeffff');}}
  // Continuous chassis lean with a stable bottom-center; wheels are a separate articulated layer.
  c.translate(x,y);c.transform(1,clamp(steer,-1,1)*.025,clamp(view,-.5,.5)*.12,1,0,0);c.translate(-x,-y);
  drawRaceWheels(c,{x,y,width,height:h,steer,rotation,view});
  if(cache.cars){const cell={image:cache.cars,x:0,y:id==='spectre'?550:80,w:485,h:id==='spectre'?380:360};drawCell(c,cell,x-width/2,y-h*.84,width,h*.86);}
  else{poly(c,[{x:x-width*.43,y},{x:x-width*.49,y:y-h*.35},{x:x-width*.30,y:y-h*.85},{x:x+width*.30,y:y-h*.85},{x:x+width*.49,y:y-h*.35},{x:x+width*.43,y}],id==='spectre'?'#fa9c64':'#bbed74');c.fillStyle='#193c50';c.fillRect(x-width*.27,y-h*.75,width*.54,h*.25);c.fillStyle='#172225';c.fillRect(x-width*.4,y-h*.2,width*.8,h*.15);}
  if(braking){c.fillStyle='#ff443777';c.fillRect(x-width*.32,y-h*.23,width*.2,h*.05);c.fillRect(x+width*.12,y-h*.23,width*.2,h*.05);}c.restore();
}
function roadside(g){if(props.has(g.id))return props.get(g.id);const list=[];for(let s=70,index=0;s<g.length;s+=105,index++){const p=roadAt(g,s);for(const side of [-1,1]){const gap=g.width/2+65+(index%3)*25;const x=p.x-Math.sin(p.angle)*side*gap,y=p.y+Math.cos(p.angle)*side*gap;if(nearestRoad(g,x,y).distance<g.width/2+45)continue;const kind=g.id==='night-market'?[0,3,0,4,0,2][(index+(side+1))%6]:[1,0,1,5,1,3][(index+(side+1))%6];list.push({x,y,kind,width:kind===0?72:kind===3?110:140,height:kind===0?230:kind===3?210:kind===1?95:135});}}props.set(g.id,list);return list;}

export function drawPerspectiveRace(ctx,state,{width,height,slot=0,reducedMotion=false,quality='high'}={}){
  if(!width||!height)return;preloadRaceArt();const p=state.players[slot],g=trackGeometry(state.track),desert=state.track==='liquidation-docks';
  const now=performance.now();let camera=cameras.get(ctx);if(!camera||camera.track!==state.track||state.tick<camera.tick||Math.hypot(camera.x-p.x,camera.y-p.y)>300){camera={x:p.x,y:p.y,angle:p.angle,tick:state.tick,track:state.track,time:now};cameras.set(ctx,camera);}
  // Render-clock interpolation continues between network/fixed-step ticks: no 20 Hz camera snapping.
  const dt=clamp((now-camera.time)/1000,0,.05),blend=1-Math.exp(-7*dt);camera.angle+=angleDelta(p.angle,camera.angle)*blend;camera.x+=(p.x-camera.x)*(1-Math.exp(-24*dt));camera.y+=(p.y-camera.y)*(1-Math.exp(-24*dt));camera.tick=state.tick;camera.time=now;
  const heading=camera.angle,cos=Math.cos(heading),sin=Math.sin(heading),back=65,camX=camera.x-cos*back,camY=camera.y-sin*back;
  const focal=Math.min(width*.92,height*1.04)*(p.boosting&&!reducedMotion?.94:1),horizon=height*.40,camHeight=30,far=1300;
  const view=(x,y,h=0)=>{const dx=x-camX,dy=y-camY;return {x:-dx*sin+dy*cos,z:dx*cos+dy*sin,h};};
  const project=v=>({x:width/2+v.x*focal/v.z,y:horizon+(camHeight-v.h)*focal/v.z,z:v.z});
  const polygon=(world,color)=>{let input=world.map(a=>view(a.x,a.y,a.h||0)),clipped=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],inside=a.z>=8;if(inside)clipped.push(a);if(inside!==(b.z>=8)){const t=(8-a.z)/(b.z-a.z);clipped.push({x:a.x+(b.x-a.x)*t,z:8,h:a.h+(b.h-a.h)*t});}}poly(ctx,clipped.map(project),color);};
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  const sky=ctx.createLinearGradient(0,0,0,height*.55);sky.addColorStop(0,desert?'#69bac9':'#238bb9');sky.addColorStop(1,desert?'#ffd7a4':'#d4f1e1');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  const plate=cache[desert?'desert':'coast'];if(plate){const bh=height*.65,bw=Math.max(width*1.3,bh*plate.width/plate.height),offset=Math.sin(heading)*width*.12;ctx.drawImage(plate,(width-bw)/2+offset,0,bw,bh);}
  // Horizon terrain is below the far-road plane, leaving the generated mountains visible.
  const ground=ctx.createLinearGradient(0,horizon,0,height);ground.addColorStop(0,desert?'#d8b987':'#53bfc6');ground.addColorStop(1,desert?'#ba8e61':'#258aac');ctx.fillStyle=ground;ctx.fillRect(0,horizon+camHeight*focal/far,width,height);
  if(!desert){ctx.fillStyle='#e2fff326';for(let i=0;i<18;i++){const y=horizon+40+i*i*1.6+(state.tick*.08)%5;ctx.fillRect(0,y,width,1);}}
  const road=[];for(let i=0;i<g.points.length;i++){const a=g.points[i],b=g.points[(i+1)%g.points.length],av=view(a.x,a.y),bv=view(b.x,b.y);if(Math.max(av.z,bv.z)<8||Math.min(av.z,bv.z)>far)continue;road.push({a,b,z:(av.z+bv.z)/2,index:i});}road.sort((a,b)=>b.z-a.z);
  const edge=(p,side,w)=>({x:p.x-Math.sin(p.angle)*side*w,y:p.y+Math.cos(p.angle)*side*w});
  const strip=(a,b,lo,hi,color)=>polygon([edge(a,lo,1),edge(b,lo,1),edge(b,hi,1),edge(a,hi,1)],color);
  for(const {a,b,index,z}of road){const half=g.width/2;if(!desert){strip(a,b,-half-220,half+220,'#d5c493');strip(a,b,-half-180,half+180,'#91a86f');}strip(a,b,-half-16,half+16,desert?'#a77955':'#d8c99c');strip(a,b,-half-5,half+5,index%2?'#e7e8d6':'#d27555');strip(a,b,-half,half,index%2?'#59666b':'#566368');strip(a,b,-half+3,-half+4.5,'#eee4c9');strip(a,b,half-4.5,half-3,'#eee4c9');if(index%4<2){strip(a,b,-half/3-1,-half/3+1,'#eee3bc');strip(a,b,half/3-1,half/3+1,'#eee3bc');}if(z>far*.6)strip(a,b,-half,half,`rgba(${desert?'215,181,139':'185,211,184'},${(z-far*.6)/(far*.4)*.5})`);}
  // Real mandatory checkpoint posts: the road gate, not a decorative finish trigger.
  const gate=g.gates[p.nextCheckpoint],left=edge(gate,-1,g.width/2+8),right=edge(gate,1,g.width/2+8);
  for(const at of [left,right]){const b=view(at.x,at.y),top=view(at.x,at.y,75);if(b.z>15&&b.z<far){const a=project(b),t=project(top);ctx.strokeStyle='#eaf6b8';ctx.lineWidth=Math.max(2,5*focal/b.z);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(t.x,t.y);ctx.stroke();}}
  const gv=view(gate.x,gate.y,80);if(gv.z>50&&gv.z<900){const at=project(gv);label(ctx,p.nextCheckpoint===0?'FINISH / START':'CHECKPOINT',at.x,at.y,clamp(20*focal/gv.z,9,24),'#edffb2');}
  const objects=roadside(g).map(o=>({...o,v:view(o.x,o.y)})).filter(o=>o.v.z>15&&o.v.z<far);
  state.players.forEach((car,i)=>{if(i!==slot){const v=view(car.x,car.y);if(v.z>15&&v.z<far)objects.push({car,i,v});}});objects.sort((a,b)=>b.v.z-a.v.z);
  for(const o of objects){const at=project(o.v),scale=focal/o.v.z;if(o.car){drawRearCar(ctx,o.car.vehicle,{x:at.x,y:at.y,width:40*scale,steer:o.car.steer,rotation:o.car.wheelRotation||0,view:angleDelta(o.car.angle,heading),boosting:o.car.boosting,tick:state.tick,ghost:o.car.ghost>0});label(ctx,'RIVAL',at.x,at.y-32*scale,clamp(12*scale,9,18),'#ffd78a');}else if(cache.scenery){const w=o.width*scale,h=o.height*scale;if(at.x+w/2<0||at.x-w/2>width)continue;const [x,y,fw,fh]=SCENERY_FRAMES[o.kind];drawCell(ctx,{image:cache.scenery,x,y,w:fw,h:fh},at.x-w/2,at.y-h,w,h);}}
  // The player body is screen-anchored. Camera catch-up must never change its height/scale.
  const feet=playerCarFrame(width,height),carWidth=feet.width,yaw=angleDelta(p.angle,camera.angle);
  if(p.drifting&&!reducedMotion&&quality!=='low'){for(let i=0;i<8;i++){const age=(state.tick+i*7)%45;ctx.fillStyle=`rgba(242,233,207,${.23*(1-age/45)})`;ctx.beginPath();ctx.arc(feet.x+(i%2?1:-1)*(carWidth*.3+age),feet.y+age*.3,8+age*.45,0,Math.PI*2);ctx.fill();}}
  drawRearCar(ctx,p.vehicle,{x:feet.x,y:feet.y,width:carWidth,steer:p.steer,view:yaw,rotation:p.wheelRotation||0,boosting:p.boosting,braking:!!(p.previousInput&8),tick:state.tick,ghost:p.ghost>0});
  if(p.boosting&&!reducedMotion){ctx.strokeStyle='#defaff75';ctx.lineWidth=2;for(let i=0;i<12;i++){const side=i%2?1:-1,x=width/2+side*width*(.36+(i%3)*.055),y=height*(.35+(i%5)*.13);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*30,y+70);ctx.stroke();}}
  const recent=[...state.events].reverse().find(e=>e.player===slot&&state.tick-e.tick<80&&['drift','lap','reset'].includes(e.type));if(recent)label(ctx,recent.text,width/2,height*.18,Math.min(24,width*.045),'#f2ffab');
  // Turn preview uses course geometry ahead of the car, not a scripted animation.
  const near=nearestRoad(g,p.x,p.y),ahead=roadAt(g,near.s+180),turn=angleDelta(ahead.angle,near.angle);
  label(ctx,Math.abs(turn)<.25?'↑':turn<0?'↰':'↱',width*.91,height*.17,Math.min(65,width*.09),'#f6f5d1');
  ctx.restore();
}
