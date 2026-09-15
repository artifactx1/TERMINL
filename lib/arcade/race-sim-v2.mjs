/** WEN LAMBO v2. Fixed 60 Hz, input-only authority. Archived v1 replays remain exact. */
import {createRace as createLegacyRace,stepRace as stepLegacyRace} from './race-sim-v1.mjs';
export const RACE_RULES_VERSION=2;
export const RACE_INPUT=Object.freeze({LEFT:1,RIGHT:2,THROTTLE:4,BRAKE:8,DRIFT:16,BOOST:32,RESET:64});
export const VEHICLES=Object.freeze({
  comet:{id:'comet',name:'Comet GT',tag:'AGILE / FORGIVING',color:'#b8ee78',maxSpeed:5.6,acceleration:.078,steer:.044,grip:.18,driftGrip:.045},
  spectre:{id:'spectre',name:'Spectre RX',tag:'DRIFT / HIGH COMMITMENT',color:'#f6a46e',maxSpeed:6.2,acceleration:.061,steer:.038,grip:.15,driftGrip:.028},
});
export const TRACKS=Object.freeze({
  'redwood-rally':{"id":"redwood-rally","name":"Redwood Rush","theme":"forest","biome":"redwood","tag":"FLOWING / FOREST ESSES","subtitle":"Sun shafts, giant redwoods, and a rhythm section made for linking corners.","width":152,"laps":3,"points":[[370,1150],[290,710],[460,330],[910,260],[1240,480],[1570,290],[1950,430],[1990,880],[1740,1240],[1310,1400],[1030,1120],[650,1400]],"landmarks":[]},
  'alpine-pass':{"id":"alpine-pass","name":"Diamondback Pass","theme":"snow","biome":"alpine","tag":"TECHNICAL / MOUNTAIN HAIRPINS","subtitle":"Snow peaks above a blue lake. Brake early, hug the apex, launch out.","width":144,"laps":3,"points":[[400,1160],[280,750],[400,360],[790,250],[1060,520],[1340,260],[1770,280],[1990,620],[1900,1030],[1530,1280],[1200,1050],[910,1420],[520,1430]],"landmarks":[]},
  'neon-boulevard':{"id":"neon-boulevard","name":"Neon Afterhours","theme":"neon","biome":"neon","tag":"FAST / CITY GRAND PRIX","subtitle":"Electric midnight. Long neon straights broken by hard ninety-degree corners.","width":160,"laps":3,"points":[[360,1140],[340,540],[510,280],[1050,260],[1150,530],[1600,530],[1810,300],[2010,550],[1960,1100],[1730,1390],[1220,1390],[990,1110],[670,1380],[420,1390]],"landmarks":[]},
  'vineyard-run':{"id":"vineyard-run","name":"Golden Hour GP","theme":"hills","biome":"vineyard","tag":"SWEEPING / BOOST COUNTRY","subtitle":"Vineyard ribbons and golden hills. Save your boost for the sweeping back straight.","width":166,"laps":3,"points":[[380,1160],[270,770],[470,360],[930,250],[1370,350],[1800,300],[2050,660],[1890,1090],[1470,1390],[1110,1250],[750,1440],[430,1410]],"landmarks":[]},
  'night-market':{id:'night-market',name:'Pacific Coast Run',theme:'city',subtitle:'Ocean air, palm-lined sweepers, and one vicious coastal hairpin.',width:150,laps:3,points:[[400,1100],[400,600],[700,330],[1250,280],[1730,450],[1890,920],[1640,1160],[1290,930],[1050,1210],[680,1420],[350,1440],[190,1270]],landmarks:[{x:1060,y:570,label:'AFTER HOURS EXCHANGE',kind:'tower'},{x:790,y:1000,label:'DEAD MALL',kind:'mall'},{x:1550,y:680,label:'NO EXIT LIQUIDITY',kind:'tower'}]},
  'liquidation-docks':{id:'liquidation-docks',name:'Sunset Canyon',theme:'docks',subtitle:'Golden desert switchbacks. Roadside diners. Boost into the sunset.',width:136,laps:3,points:[[350,1150],[280,670],[470,340],[870,240],[1110,530],[950,790],[1290,870],[1530,430],[1890,460],[2040,850],[1830,1280],[1360,1400],[830,1210],[580,1450],[270,1440]],landmarks:[{x:590,y:680,label:'BAGS IN TRANSIT',kind:'containers'},{x:1460,y:1090,label:'LIQUIDATION TERMINAL',kind:'crane'},{x:1760,y:740,label:'NO REFUNDS',kind:'containers'}]},
});
export const CUP_TRACKS=Object.freeze(['night-market','liquidation-docks','redwood-rally','alpine-pass','neon-boulevard','vineyard-run']);
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),q=n=>Math.round(n*10000)/10000;
export const angleDelta=(a,b)=>((a-b+Math.PI)%TAU+TAU)%TAU-Math.PI;
const geometries=new Map();
export function trackGeometry(id){
  if(!Object.hasOwn(TRACKS,id))throw new Error('Unknown track');
  if(geometries.has(id))return geometries.get(id);
  const track=TRACKS[id],nodes=track.points,points=[],gates=[];let length=0;
  for(let i=0;i<nodes.length;i++){
    const a=nodes[(i+nodes.length-1)%nodes.length],b=nodes[i],c=nodes[(i+1)%nodes.length],d=nodes[(i+2)%nodes.length];
    for(let j=0;j<16;j++){
      const t=j/16,t2=t*t,t3=t2*t;
      const at=k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3);
      const p={x:at(0),y:at(1),s:0,sector:i};if(points.length)length+=Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y);p.s=length;points.push(p);
      if(!j)gates.push({...p,angle:Math.atan2(c[1]-a[1],c[0]-a[0]),index:i});
    }
  }
  length+=Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y);
  points.forEach((p,i)=>{const next=points[(i+1)%points.length];p.angle=Math.atan2(next.y-p.y,next.x-p.x);});
  const geometry={...track,points,gates,length};geometries.set(id,geometry);return geometry;
}
export function nearestRoad(geometry,x,y){
  let best={distance:Infinity};
  for(let i=0;i<geometry.points.length;i++){
    const a=geometry.points[i],b=geometry.points[(i+1)%geometry.points.length],dx=b.x-a.x,dy=b.y-a.y;
    const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1),px=a.x+dx*t,py=a.y+dy*t,distance=Math.hypot(x-px,y-py);
    if(distance<best.distance)best={distance,x:px,y:py,angle:a.angle,s:a.s+Math.hypot(dx,dy)*t,index:i,sector:a.sector};
  }
  return best;
}
export function roadAt(geometry,distance){
  const s=((distance%geometry.length)+geometry.length)%geometry.length;
  for(let i=geometry.points.length-1;i>=0;i--)if(geometry.points[i].s<=s){const a=geometry.points[i],b=geometry.points[(i+1)%geometry.points.length],span=(b.s||geometry.length)-a.s,t=(s-a.s)/span;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:a.angle};}
  return geometry.points[0];
}
function car(vehicle,slot,track){const g=trackGeometry(track).gates[0],side=slot?25:-25;return {vehicle,x:q(g.x-Math.cos(g.angle)*55-Math.sin(g.angle)*side),y:q(g.y-Math.sin(g.angle)*55+Math.cos(g.angle)*side),angle:g.angle,vx:0,vy:0,speed:0,steer:0,boost:35,boosting:false,drifting:false,driftCharge:0,previousInput:0,nextCheckpoint:0,passed:0,lap:0,finishedTick:null,place:null,sectorTimes:[],lastSectorTick:0,resetCooldown:0,ghost:90,offRoad:false,wrongWay:false,points:0,cupTime:0};}
export function createRace({vehicles=['comet','spectre'],track='night-market',cup=true,rulesVersion=RACE_RULES_VERSION}={}){
  if(rulesVersion===1)return createLegacyRace({vehicles,track,cup});
  if(rulesVersion!==RACE_RULES_VERSION)throw new Error('Unsupported racing rules');
  if(!Array.isArray(vehicles)||vehicles.length!==2||vehicles.some(v=>!Object.hasOwn(VEHICLES,v)))throw new Error('Unknown vehicle');
  if(!Object.hasOwn(TRACKS,track))throw new Error('Unknown track');
  const tracks=cup?[track,...CUP_TRACKS.filter(id=>id!==track)]:[track];
  return {version:RACE_RULES_VERSION,game:'wen-lambo',tick:0,phase:'countdown',phaseTick:0,track,tracks,trackIndex:0,players:vehicles.map((v,i)=>car(v,i,track)),raceTicks:0,firstFinish:null,winner:null,wins:[0,0],events:[],raceResults:[],bounds:null};
}
function event(s,type,player,text){s.events.push({id:`${s.tick}:${s.events.filter(e=>e.tick===s.tick).length}`,tick:s.tick,type,player,text});s.events=s.events.slice(-24);}
function recover(s,p,slot,g){
  const gate=g.gates[(p.nextCheckpoint+g.gates.length-1)%g.gates.length];
  // Before the start line the previous checkpoint is still start, not the last sector.
  const at=p.passed?gate:g.gates[0];let side=slot?26:-26;
  const other=s.players[1-slot];let x=at.x-Math.cos(at.angle)*45-Math.sin(at.angle)*side,y=at.y-Math.sin(at.angle)*45+Math.cos(at.angle)*side;
  if(Math.hypot(x-other.x,y-other.y)<45){side=-side;x=at.x-Math.cos(at.angle)*80-Math.sin(at.angle)*side;y=at.y-Math.sin(at.angle)*80+Math.cos(at.angle)*side;}
  p.x=q(x);p.y=q(y);p.angle=at.angle;p.vx=0;p.vy=0;p.speed=0;p.steer=0;p.yawRate=0;p.gear=1;p.offRoad=false;p.wrongWay=false;p.boosting=false;p.drifting=false;p.boost=Math.max(0,p.boost-15);p.driftCharge=0;p.resetCooldown=180;p.ghost=90;event(s,'reset',slot,'BACK TO YOUR LAST CHECKPOINT');
}
function drive(s,p,slot,mask,g){
  const edge=mask&~p.previousInput;p.previousInput=mask;p.resetCooldown=Math.max(0,p.resetCooldown-1);p.ghost=Math.max(0,p.ghost-1);
  if(p.finishedTick!==null){p.vx*=.95;p.vy*=.95;p.speed*=.95;return;}
  if((edge&RACE_INPUT.RESET)&&!p.resetCooldown){recover(s,p,slot,g);return;}
  const old={x:p.x,y:p.y},v=VEHICLES[p.vehicle],road=nearestRoad(g,p.x,p.y);
  p.offRoad=road.distance>g.width/2;const targetSteer=Number(!!(mask&2))-Number(!!(mask&1));
  // Digital buttons behave like a progressively turned steering wheel, including release.
  // Bounded wheel travel avoids both instant reversal and a long sticky return-to-center.
  const steeringStep=targetSteer===0?.075:.065;p.steer=q(p.steer+clamp(targetSteer-p.steer,-steeringStep,steeringStep));
  const speed=Math.hypot(p.vx,p.vy),signedSpeed=p.vx*Math.cos(p.angle)+p.vy*Math.sin(p.angle),direction=signedSpeed<0?-1:1;
  p.drifting=!!(mask&16)&&signedSpeed>2&&!p.offRoad&&!!targetSteer;
  // Low-speed manoeuvres get a tighter radius; fast driving retains stability.
  const targetYaw=p.steer*v.steer*direction*clamp(Math.abs(signedSpeed)/1.6,0,1)*(p.drifting?1.15:1)*Math.max(.5,1-speed/15);
  const oldYaw=Math.abs(signedSpeed)<.1?0:(p.yawRate||0);
  p.yawRate=q(oldYaw+(targetYaw-oldYaw)*.16);p.angle=q(p.angle+p.yawRate);
  let forward=p.vx*Math.cos(p.angle)+p.vy*Math.sin(p.angle);
  const braking=!!(mask&8),gas=!!(mask&4)&&!braking;
  if(gas)forward=forward<-.08?Math.min(0,forward+.22):Math.max(0,forward)+v.acceleration;
  if(braking)forward=forward>.08?Math.max(0,forward-.24):Math.min(0,forward)-.10;
  p.boosting=!!(mask&32)&&p.boost>.45&&(mask&4)!==0&&(mask&8)===0&&forward>=0&&!p.offRoad;
  if(p.boosting){forward+=.13;p.boost-=.45;}
  forward*=mask&12?.997:.987;forward=clamp(forward,-v.maxSpeed*.4,v.maxSpeed*(p.boosting?1.38:1));
  if(p.offRoad)forward=clamp(forward*.98,-1.5,2.0);
  const grip=braking||forward<0?Math.max(.28,v.grip):p.drifting?v.driftGrip:v.grip;
  p.vx=q(p.vx+(Math.cos(p.angle)*forward-p.vx)*grip);p.vy=q(p.vy+(Math.sin(p.angle)*forward-p.vy)*grip);
  const actual=Math.hypot(p.vx,p.vy),cap=p.offRoad?2.1:v.maxSpeed*(p.boosting?1.38:1);if(actual>cap){p.vx=q(p.vx/actual*cap);p.vy=q(p.vy/actual*cap);}
  if(p.drifting){p.driftCharge=Math.min(30,p.driftCharge+.10);}
  else if(p.driftCharge){if(p.driftCharge>3){p.boost=clamp(p.boost+p.driftCharge,0,100);event(s,'drift',slot,`DRIFT BANKED +${Math.floor(p.driftCharge)}`);}p.driftCharge=0;}
  p.x=q(p.x+p.vx);p.y=q(p.y+p.vy);p.speed=q(Math.hypot(p.vx,p.vy));p.gear=forward<-.1?-1:1;p.wheelRotation=q(((p.wheelRotation||0)+(p.gear*p.speed)/8)%TAU);p.boost=q(clamp(p.boost,0,100));
  const after=nearestRoad(g,p.x,p.y);
  if(after.distance>g.width/2+55){
    const nx=(p.x-after.x)/after.distance,ny=(p.y-after.y)/after.distance;
    p.x=q(after.x+nx*(g.width/2+55));p.y=q(after.y+ny*(g.width/2+55));
    // Remove only velocity INTO the barrier. Keep movement alongside/away from it.
    const impact=Math.max(0,p.vx*nx+p.vy*ny);
    p.vx=q(p.vx-impact*nx);p.vy=q(p.vy-impact*ny);p.speed=q(Math.hypot(p.vx,p.vy));p.driftCharge=0;
    if(impact>.3&&s.tick%20===0)event(s,'wall',slot,'BARRIER · SPEED LOST');
  }
  p.offRoad=after.distance>g.width/2;
  p.wrongWay=p.speed>1&&Math.abs(angleDelta(Math.atan2(p.vy,p.vx),after.angle))>Math.PI*.65;
  const gate=g.gates[p.nextCheckpoint],cos=Math.cos(gate.angle),sin=Math.sin(gate.angle),before=(old.x-gate.x)*cos+(old.y-gate.y)*sin,now=(p.x-gate.x)*cos+(p.y-gate.y)*sin;
  const lateral=Math.abs(-(p.x-gate.x)*sin+(p.y-gate.y)*cos);
  if(before<=0&&now>0&&lateral<g.width/2+18){
    p.passed++;p.nextCheckpoint=(p.nextCheckpoint+1)%g.gates.length;
    if(p.passed>1){p.sectorTimes.push(s.raceTicks-p.lastSectorTick);p.sectorTimes=p.sectorTimes.slice(-g.gates.length);p.boost=clamp(p.boost+2,0,100);}p.lastSectorTick=s.raceTicks;
    if(gate.index===0){p.lap=Math.floor((p.passed-1)/g.gates.length);if(p.lap>=g.laps){p.finishedTick=q(s.raceTicks-1+(-before)/(now-before));p.cupTime+=p.finishedTick;event(s,'finish',slot,'FINISH LINE');}else if(p.lap)event(s,'lap',slot,`LAP ${p.lap+1} / ${g.laps}`);}
  }
}
export function raceOrder(s){const g=trackGeometry(s.track);return s.players.map((p,i)=>({i,finish:p.finishedTick,passed:p.passed,distance:Math.hypot(p.x-g.gates[p.nextCheckpoint].x,p.y-g.gates[p.nextCheckpoint].y)})).sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.passed-a.passed||a.distance-b.distance).map(x=>x.i);}
function completeRound(s){
  const order=raceOrder(s),times=s.players.map(p=>p.finishedTick),points=s.players.map((p,i)=>p.finishedTick===null?0:times[0]===times[1]?8:order[0]===i?10:6);
  s.players.forEach((p,i)=>{p.points+=points[i];if(p.finishedTick===null)p.cupTime+=7200;});
  s.raceResults.push({track:s.track,times,points,order});s.wins=s.players.map(p=>p.points);s.phase='raceOver';s.phaseTick=0;event(s,'raceOver',order[0],'RACE COMPLETE');
}
export function stepRace(source,inputs=[0,0]){
  if(source.version===1)return stepLegacyRace(source,inputs);
  const s=structuredClone(source);s.tick++;s.phaseTick++;
  if(s.phase==='finished')return s;
  if(s.phase==='countdown'){if(s.phaseTick>=180){s.phase='racing';s.phaseTick=0;event(s,'go',0,'GO · MAKE BAD DECISIONS');}return s;}
  if(s.phase==='raceOver'){
    if(s.phaseTick>=480){
      if(s.trackIndex+1>=s.tracks.length){s.phase='finished';s.phaseTick=0;const [a,b]=s.players;s.winner=a.points!==b.points?(a.points>b.points?0:1):a.cupTime===b.cupTime?null:a.cupTime<b.cupTime?0:1;event(s,'cup',s.winner,'CUP COMPLETE');}
      else{s.trackIndex++;s.track=s.tracks[s.trackIndex];s.players=s.players.map((p,i)=>({...car(p.vehicle,i,s.track),points:p.points,cupTime:p.cupTime}));s.phase='countdown';s.phaseTick=0;s.raceTicks=0;s.firstFinish=null;event(s,'track',0,TRACKS[s.track].name);}
    }return s;
  }
  s.raceTicks++;const geometry=trackGeometry(s.track);
  s.players.forEach((p,i)=>drive(s,p,i,Number.isInteger(inputs[i])&&inputs[i]>=0&&inputs[i]<=127?inputs[i]:0,geometry));
  const [a,b]=s.players,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<30&&!a.ghost&&!b.ghost&&a.finishedTick===null&&b.finishedTick===null){const nx=d?dx/d:1,ny=d?dy/d:0,overlap=(30-d)/2;a.x=q(a.x-nx*overlap);a.y=q(a.y-ny*overlap);b.x=q(b.x+nx*overlap);b.y=q(b.y+ny*overlap);const impulse=((a.vx-b.vx)*nx+(a.vy-b.vy)*ny)*.55;if(impulse>0){a.vx=q(a.vx-nx*impulse);a.vy=q(a.vy-ny*impulse);b.vx=q(b.vx+nx*impulse);b.vy=q(b.vy+ny*impulse);}a.driftCharge=0;b.driftCharge=0;}
  if(s.firstFinish===null&&s.players.some(p=>p.finishedTick!==null))s.firstFinish=s.raceTicks;
  raceOrder(s).forEach((slot,i)=>{s.players[slot].place=i+1;});
  if(s.players.every(p=>p.finishedTick!==null)||s.raceTicks>=7200||(s.firstFinish!==null&&s.raceTicks-s.firstFinish>=1800))completeRound(s);
  return s;
}
export function raceBotInput(s,slot){
  if(s.phase!=='racing')return 0;const p=s.players[slot];if(p.finishedTick!==null)return 0;
  const g=trackGeometry(s.track),road=nearestRoad(g,p.x,p.y),gate=g.gates[p.nextCheckpoint];
  let target=roadAt(g,road.s+45+p.speed*8);
  // Aim through the next mandatory gate if it is near; no teleport or lap writes.
  if(Math.hypot(p.x-gate.x,p.y-gate.y)<140)target={x:gate.x+Math.cos(gate.angle)*18,y:gate.y+Math.sin(gate.angle)*18};
  const difference=angleDelta(Math.atan2(target.y-p.y,target.x-p.x),p.angle)-(p.yawRate||0)*12;
  let mask=4|(difference<-.045?1:difference>.045?2:0);if(Math.abs(difference)>.55&&p.speed>2.7)mask=8|(difference<0?1:2);if(Math.abs(difference)<.10&&Math.abs(p.steer)<.15&&p.boost>20)mask|=32;
  if(p.offRoad&&p.speed<.3&&s.tick%240===0)mask|=64;return mask;
}
export function raceHash(s){const text=JSON.stringify(s);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
export const RACE_RULES={id:'wen-lambo',create:createRace,step:stepRace,hash:raceHash,maxInput:127};
