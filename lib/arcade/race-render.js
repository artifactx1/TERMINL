/** Original pixel circuit art. Rendering reads authority; it never changes race state. */
import { TRACKS, VEHICLES, trackGeometry, roadAt, angleDelta } from './race-sim.mjs';
import {drawPerspectiveRace} from './race-perspective.js';

const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tracks=new Map(), sprites=new Map(), cameras=new WeakMap();
const WORLD={width:2336,height:1728,pixel:2};
const COLORS=['#b8ee78','#f6a46e'];
function surface(w,h){if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function poly(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
function text(c,value,x,y,size=12,color='#e8e4ca',align='center'){c.font=`bold ${size}px ui-monospace,monospace`;c.textAlign=align;c.fillStyle=color;c.fillText(value,x,y);}
function stroke(c,points,color,width,close=false){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));if(close)c.closePath();c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.strokeStyle=color;c.stroke();}
function hash(n){let x=Math.imul(n+71,374761393);x=(x^(x>>>13));return ((Math.imul(x,1274126177)^(x>>>16))>>>0)/4294967296;}

function carSprite(id,steer){
  const key=`${id}:${steer}`;if(sprites.has(key))return sprites.get(key);
  const s=surface(66,42);if(!s)return null;const c=s.getContext('2d');c.translate(33,21);const exotic=id==='spectre',paint=VEHICLES[id]?.color||(exotic?'#e38e61':'#a2ce62'),light=exotic?'#ffd3a0':'#e5ffc1',dark=exotic?'#8f493c':'#4f7846';
  // Four distinct wheels. Front axle actively articulates instead of rotating the body art.
  for(const ax of [-18,18])for(const side of [-1,1]){c.save();c.translate(ax,side*13);if(ax>0)c.rotate(steer*.26);rect(c,-6,-3,12,6,'#050c10');rect(c,-3,-2,7,4,'#29393b');rect(c,-1,-2,2,4,'#738586');c.restore();}
  poly(c,exotic?[[-28,-9],[-21,-13],[13,-12],[27,-8],[30,-4],[30,4],[27,8],[13,12],[-21,13],[-28,9]]:[[-27,-9],[-21,-12],[17,-12],[27,-7],[29,0],[27,7],[17,12],[-21,12],[-27,9]],'#080e12');
  poly(c,[[-25,-8],[-20,-11],[15,-10],[25,-6],[27,0],[25,6],[15,10],[-20,11],[-25,8]],paint);
  rect(c,-23,-8,7,16,dark);rect(c,-20,-10,31,2,light);rect(c,-20,8,31,2,dark);
  poly(c,[[-13,-8],[1,-8],[11,-5],[11,5],[1,8],[-13,8],[-16,4],[-16,-4]],'#17292f');
  poly(c,[[1,-7],[9,-4],[9,4],[1,7]],'#72afb5');poly(c,[[-11,-6],[-2,-6],[-2,6],[-11,6]],dark);
  rect(c,-9,-5,5,10,paint);rect(c,-13,-4,2,8,'#528388');rect(c,0,-8,2,16,'#101c22');
  poly(c,[[12,-7],[21,-5],[24,-2],[12,-3]],light);poly(c,[[12,3],[24,2],[21,5],[12,7]],dark);
  rect(c,25,-6,2,4,'#d2ffff');rect(c,25,2,2,4,'#d2ffff');rect(c,-26,-8,2,5,'#fc6763');rect(c,-26,3,2,5,'#fc6763');
  for(const side of [-1,1]){rect(c,-2,side*12-1,5,2,dark);rect(c,-23,side*5-1,2,2,'#02080c');}
  if(exotic){rect(c,-24,-15,3,30,'#080c12');rect(c,-24,-14,1,28,'#f0b096');rect(c,12,-2,12,4,'#5c3134');rect(c,16,-1,8,2,'#ffce9a');}
  else{rect(c,-22,-10,3,20,'#293b2e');rect(c,12,-1,13,2,'#d8efac');rect(c,-8,-4,3,8,'#c7e996');}
  sprites.set(key,s);return s;
}

/** Garage and live race use the same original car body, wheel and exhaust rig. */
export function drawVehicle(ctx,vehicle,{x=0,y=0,angle=0,scale=1,speed=0,steer=0,boosting=false,drifting=false,tick=0}={}){
  const id=typeof vehicle==='string'?vehicle:vehicle?.id||vehicle?.vehicle||'comet';
  const sprite=carSprite(Object.hasOwn(VEHICLES,id)?id:'comet',Math.sign(steer));if(!sprite)return;
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
  rect(ctx,-26,-10,56,25,'#00000055');
  if(boosting){const pulse=4+Math.floor(tick/3)%4;for(const side of [-1,1]){poly(ctx,[[-26,side*5-3],[-36-pulse*2,side*5],[-26,side*5+3]],'#49cfeb');rect(ctx,-30-pulse,side*5-1,7+pulse,2,'#e4fff0');}}
  else if(speed>2&&tick%11<3){rect(ctx,-29,-6,3,2,'#f4b675');rect(ctx,-29,4,3,2,'#f4b675');}
  ctx.drawImage(sprite,-33,-21);
  if(drifting){rect(ctx,-19,-16,2,2,'#ffe28c');rect(ctx,-20,14,2,2,'#ffe28c');}
  ctx.restore();
}

function building(c,x,y,w,h,index,theme){
  const docks=theme==='docks',edge=docks?'#263d43':'#222735';rect(c,x+11,y+14,w,h,'#030a1090');rect(c,x-5,y-5,w+10,h+10,edge);rect(c,x,y,w,h,docks?'#35474b':'#303343');rect(c,x+5,y+6,w-10,h-12,docks?'#263a41':'#232635');
  const accent=docks?'#a7925b':index%2?'#b77a86':'#55a79c';rect(c,x,y,w,3,accent);rect(c,x,y,3,h,accent);
  for(let xx=12;xx<w-15;xx+=19)for(let yy=15;yy<h-10;yy+=22){rect(c,x+xx,y+yy,9,5,hash(index*47+xx*7+yy)>.45?accent:'#151d28');}
  rect(c,x+w*.3,y+h*.3,w*.3,h*.25,'#141f2a');rect(c,x+w*.3,y+h*.3,w*.3,3,'#4a515b');
  for(let i=0;i<3;i++){rect(c,x+w*.3+6+i*8,y+h*.3+7,4,h*.25-14,'#4e5a63');}
}
function container(c,x,y,w,h,index){const colors=['#995a4f','#4e7275','#73724c','#796276'];const color=colors[index%colors.length];rect(c,x+6,y+8,w,h,'#060e1580');rect(c,x,y,w,h,'#192a30');rect(c,x+3,y+3,w-6,h-6,color);for(let i=8;i<w-7;i+=10){rect(c,x+i,y+5,2,h-10,'#ffffff19');rect(c,x+i+2,y+5,2,h-10,'#00000025');}rect(c,x+w-8,y+5,2,h-10,'#d9c497');}
function cachedTrack(id){
  if(tracks.has(id))return tracks.get(id);const canvas=surface(WORLD.width/2,WORLD.height/2);if(!canvas)return null;const c=canvas.getContext('2d');c.scale(.5,.5);const g=trackGeometry(id),docks=g.theme==='docks';
  rect(c,0,0,WORLD.width,WORLD.height,docks?'#102a34':'#151d26');
  for(let y=0;y<WORLD.height;y+=32)for(let x=0;x<WORLD.width;x+=32){const n=hash(x*17+y*31);if(n>.7)rect(c,x,y,docks?18:4,2,docks?'#2b4e5655':'#62645526');}
  if(docks){poly(c,[[80,120],[2100,80],[2200,1500],[1600,1660],[180,1600]],'#3b4244');for(let x=160;x<2180;x+=32)rect(c,x,1550,12,70,'#25333b');rect(c,2060,50,60,1250,'#778070');for(let y=80;y<1250;y+=42)rect(c,2080,y,20,5,'#d2b375');}
  // Scenery uses an occupancy mask: props cannot lie on the drivable course.
  const mask=surface(WORLD.width/8,WORLD.height/8),m=mask.getContext('2d');m.scale(1/8,1/8);stroke(m,g.points,'#fff',g.width+145,true);const pixels=m.getImageData(0,0,mask.width,mask.height).data;
  const clear=(x,y,w,h)=>{for(let yy=y-15;yy<y+h+15;yy+=12)for(let xx=x-15;xx<x+w+15;xx+=12){const mx=Math.floor(xx/8),my=Math.floor(yy/8);if(mx<0||my<0||mx>=mask.width||my>=mask.height||pixels[(my*mask.width+mx)*4+3]>0)return false;}return true;};
  for(let y=110;y<1500;y+=155)for(let x=110;x<2110;x+=165){const n=Math.floor(hash(x*31+y)*100),w=docks?115:110+n%30,h=docks?54:80+n%35;if(clear(x,y,w,h)){if(docks){container(c,x,y,w,h,n);if(clear(x,y+64,w,h))container(c,x,y+64,w,h,n+1);}else building(c,x,y,w,h,n,g.theme);}}
  for(const mark of g.landmarks){
    if(mark.kind==='crane'){rect(c,mark.x-35,mark.y-20,70,70,'#222e34');rect(c,mark.x-12,mark.y-100,24,160,'#bc9157');rect(c,mark.x-90,mark.y-94,240,16,'#d9ac67');for(let n=0;n<8;n++)poly(c,[[mark.x-90+n*30,mark.y-94],[mark.x-76+n*30,mark.y-78],[mark.x-63+n*30,mark.y-94]],'#6d573f');rect(c,mark.x+138,mark.y-78,2,70,'#b1b6a1');rect(c,mark.x+127,mark.y-9,22,8,'#d0a065');}
    else if(mark.kind==='containers'){container(c,mark.x-70,mark.y-50,140,44,2);container(c,mark.x-70,mark.y+4,140,44,0);}
    else building(c,mark.x-80,mark.y-58,160,116,2,g.theme);
    rect(c,mark.x-100,mark.y+66,200,24,'#111b25');text(c,mark.label,mark.x,mark.y+82,10,docks?'#edc384':'#acdcc2');
  }
  stroke(c,g.points,docks?'#141e23':'#0b141c',g.width+115,true);stroke(c,g.points,docks?'#5b6661':'#495155',g.width+104,true);
  // Continuous barriers at the exact outer collision margin; segmented safety paint.
  for(let s=0;s<g.length;s+=29){const p=roadAt(g,s),n={x:-Math.sin(p.angle),y:Math.cos(p.angle)};for(const side of [-1,1]){c.save();c.translate(p.x+n.x*(g.width/2+55)*side,p.y+n.y*(g.width/2+55)*side);c.rotate(p.angle);rect(c,-12,-3,24,6,Math.floor(s/29)%2?'#3c4348':docks?'#ba9b5e':'#8ca59d');c.restore();}}
  stroke(c,g.points,'#202b32',g.width+25,true);stroke(c,g.points,'#88928a',g.width+9,true);stroke(c,g.points,docks?'#303c40':'#303541',g.width,true);
  for(let s=0;s<g.length;s+=22){const p=roadAt(g,s),normal={x:-Math.sin(p.angle),y:Math.cos(p.angle)};for(const side of [-1,1]){c.save();c.translate(p.x+normal.x*(g.width/2+1)*side,p.y+normal.y*(g.width/2+1)*side);c.rotate(p.angle);rect(c,-10,-4,20,8,Math.floor(s/22)%2?'#b9bfaa':docks?'#c89759':'#ac6a73');c.restore();}}
  for(let s=100;s<g.length;s+=73){const p=roadAt(g,s);c.save();c.translate(p.x,p.y);c.rotate(p.angle);rect(c,-13,-1,26,2,'#8c91826a');c.restore();}
  // Direction chevrons repeat sparingly and always point with the real route.
  for(let s=230;s<g.length;s+=380){const p=roadAt(g,s);c.save();c.translate(p.x,p.y);c.rotate(p.angle);poly(c,[[-11,-12],[0,-12],[12,0],[0,12],[-11,12],[1,0]],'#b4bca537');c.restore();}
  const gate=g.gates[0];c.save();c.translate(gate.x,gate.y);c.rotate(gate.angle);for(let i=0;i<2;i++)for(let j=0;j<Math.floor(g.width/12);j++)rect(c,-i*12,-g.width/2+j*12,12,12,(i+j)%2?'#d6dac5':'#141e25');rect(c,18,-g.width/2-34,20,20,'#e0bc75');rect(c,18,g.width/2+14,20,20,'#e0bc75');c.restore();
  const entry={canvas,geometry:g};if(tracks.size>=2)tracks.delete(tracks.keys().next().value);tracks.set(id,entry);return entry;
}

function followCamera(ctx,state,slot,reduced,overview){
  const p=state.players[slot]||state.players[0];let camera=cameras.get(ctx);
  const target={x:p.x+Math.cos(p.angle)*(80+p.speed*10),y:p.y+Math.sin(p.angle)*(80+p.speed*10),angle:p.angle};
  if(!camera||camera.track!==state.track||state.tick<camera.tick||Math.hypot(camera.x-target.x,camera.y-target.y)>650){camera={...target,track:state.track,tick:state.tick,marks:[],last:[],overview};cameras.set(ctx,camera);}
  const dt=clamp(state.tick-camera.tick,0,6),blend=reduced?1:1-Math.pow(.83,dt);
  if(dt){camera.x+=(target.x-camera.x)*blend;camera.y+=(target.y-camera.y)*blend;camera.angle+=angleDelta(target.angle,camera.angle)*(reduced?1:1-Math.pow(.88,dt));
    for(let i=0;i<state.players.length;i++){const car=state.players[i],last=camera.last[i];if(last&&car.drifting&&Math.hypot(car.x-last.x,car.y-last.y)<50){camera.marks.push({x:car.x,y:car.y,angle:car.angle,tick:state.tick});}camera.last[i]={x:car.x,y:car.y};}
    camera.marks=camera.marks.filter(m=>state.tick-m.tick<220).slice(-140);camera.tick=state.tick;
  }return camera;
}
function minimap(c,state,slot,width,height){
  const cssWidth=Number(c.canvas?.clientWidth)||width,unit=width/cssWidth;
  const w=Math.min(180,cssWidth*.37)*unit,h=Math.min(w*.92,height*.74),x=width-w-10*unit,y=Math.min(height-h-10*unit,height*.23);
  const g=trackGeometry(state.track),pad=12*unit,top=24*unit,bottom=20*unit;
  const xs=g.points.map(p=>p.x),ys=g.points.map(p=>p.y),minX=Math.min(...xs)-70,minY=Math.min(...ys)-70;
  const spanX=Math.max(...xs)+70-minX,spanY=Math.max(...ys)+70-minY;
  const scale=Math.min((w-pad*2)/spanX,Math.max(8*unit,h-top-bottom)/spanY);
  const at=p=>({x:x+w/2+(p.x-minX-spanX/2)*scale,y:y+top+(h-top-bottom)/2+(p.y-minY-spanY/2)*scale});
  c.save();rect(c,x,y,w,h,'#061018ed');rect(c,x,y,w,2*unit,'#b8ee78');
  text(c,'LIVE CIRCUIT',x+pad,y+15*unit,10*unit,'#e4edd2','left');
  stroke(c,g.points.map(at),'#667c7e',4*unit,true);
  const next=at(g.gates[state.players[slot]?.nextCheckpoint||0]);rect(c,next.x-3*unit,next.y-3*unit,6*unit,6*unit,'#fff4ab');
  const start=at(g.gates[0]);text(c,'S',start.x,start.y-7*unit,9*unit);
  for(const i of [1-slot,slot]){
    const p=state.players[i],pos=at(p);c.save();c.translate(pos.x,pos.y);c.rotate(p.angle+Math.PI/2);
    poly(c,[[0,-8*unit],[6*unit,6*unit],[0,3*unit],[-6*unit,6*unit]],'#071018');
    poly(c,[[0,-6*unit],[4*unit,4*unit],[0,2*unit],[-4*unit,4*unit]],i===slot?'#b8ee78':'#ff80bd');c.restore();
  }
  text(c,'▲ YOU',x+pad,y+h-7*unit,9*unit,'#b8ee78','left');
  text(c,'▲ RIVAL',x+w-pad,y+h-7*unit,9*unit,'#ff80bd','right');c.restore();
}

export function drawRace(ctx,state,{width=1000,height=600,slot=0,reducedMotion=false,quality='high',overview=false,debug=false,showMap=true}={}){
  if(!overview){drawPerspectiveRace(ctx,state,{width,height,slot,reducedMotion,quality});if(showMap)minimap(ctx,state,slot,width,height);return;}
  if(!state?.players?.length||!TRACKS[state.track])return;const track=cachedTrack(state.track);if(!track)return;slot=slot===1?1:0;
  const camera=followCamera(ctx,state,slot,reducedMotion,overview),car=state.players[slot],g=track.geometry;
  const zoom=overview?Math.min(width/WORLD.width,height/WORLD.height)*.93:clamp(Math.min(width/760,height/540),.6,1.6)*(reducedMotion?1:1-car.speed*.007);
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();rect(ctx,0,0,width,height,g.theme==='docks'?'#102a34':'#151d26');ctx.imageSmoothingEnabled=false;
  ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);if(!overview)ctx.rotate(-camera.angle-Math.PI/2);ctx.translate(overview?-WORLD.width/2:-camera.x,overview?-WORLD.height/2:-camera.y);
  ctx.drawImage(track.canvas,0,0,WORLD.width,WORLD.height);
  for(const mark of camera.marks){ctx.save();ctx.translate(mark.x,mark.y);ctx.rotate(mark.angle);const opacity=clamp(1-(state.tick-mark.tick)/220,0,.65);ctx.globalAlpha=opacity;rect(ctx,-20,-14,7,3,'#090e16');rect(ctx,-20,11,7,3,'#090e16');ctx.restore();}
  const gate=g.gates[car.nextCheckpoint];ctx.save();ctx.translate(gate.x,gate.y);ctx.rotate(gate.angle);ctx.globalAlpha=.16;rect(ctx,-3,-g.width/2,6,g.width,'#c8f298');ctx.globalAlpha=1;
  for(const side of [-1,1]){rect(ctx,-8,side*(g.width/2+15)-8,16,16,'#b8ee78');rect(ctx,-4,side*(g.width/2+15)-4,8,8,'#153633');}ctx.restore();
  for(let i=0;i<state.players.length;i++){
    const p=state.players[i];
    if(quality!=='low'&&!reducedMotion&&p.drifting){for(let n=1;n<7;n++){const age=(state.tick+n*7)%42,s=3+age*.14;const x=p.x-Math.cos(p.angle)*(24+age*.9)-Math.sin(p.angle)*((n%2?1:-1)*14);const y=p.y-Math.sin(p.angle)*(24+age*.9)+Math.cos(p.angle)*((n%2?1:-1)*14);rect(ctx,x,y,s,s,`rgba(186,197,185,${.28*(1-age/42)})`);}}
    ctx.save();if(p.ghost>0)ctx.globalAlpha=.55+(Math.floor(state.tick/6)%2)*.25;drawVehicle(ctx,p.vehicle,{...p,tick:state.tick,scale:.86});ctx.restore();
    if(debug){ctx.strokeStyle=COLORS[i];ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,15,0,TAU);ctx.stroke();}
    ctx.save();ctx.translate(p.x,p.y);if(!overview)ctx.rotate(camera.angle+Math.PI/2);rect(ctx,-15,-38,30,12,'#07121cdc');text(ctx,i===slot?'YOU':`P${i+1}`,0,-29,8,COLORS[i]);ctx.restore();
  }
  ctx.restore();
  // Screen-space directions remain readable even while the course rotates.
  if(!overview){
    minimap(ctx,state,slot,width,height);
    const ahead=roadAt(g,gate.s+100),direction=angleDelta(Math.atan2(ahead.y-car.y,ahead.x-car.x),car.angle);
    ctx.save();ctx.translate(43,48);rect(ctx,-26,-31,52,66,'#061018c9');ctx.rotate(direction);poly(ctx,[[0,-20],[12,-3],[5,-3],[5,14],[-5,14],[-5,-3],[-12,-3]],'#bedc9c');ctx.restore();text(ctx,'NEXT',43,77,8,'#b9c9ad');
    if(car.wrongWay||car.offRoad){rect(ctx,width/2-115,18,230,28,'#1b101ae8');text(ctx,car.wrongWay?'WRONG WAY — FOLLOW THE ARROW':'OFF ROAD — LOSING SPEED',width/2,36,10,'#ffbf88');}
    const recent=[...(state.events||[])].reverse().find(e=>(e.player===slot||e.type==='go')&&state.tick-e.tick<90&&['drift','lap','go','reset'].includes(e.type));
    if(recent){rect(ctx,width/2-135,height-55,270,25,'#07121cdb');text(ctx,recent.text,width/2,height-38,11,'#d3eca7');}
  }
}

export const RACE_ART_MANIFEST=Object.freeze({version:1,vehicles:Object.keys(VEHICLES),tracks:Object.keys(TRACKS),source:'original-code-native',nativeCarPixels:[66,42],trackPixels:[1168,864],maxTrackCacheBytes:8073216,liveEffects:['steering','boost-exhaust','drift-smoke','tire-marks','ghost-recovery','checkpoint','minimap']});
