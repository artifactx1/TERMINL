import {inside,floorAt,distance,random} from './math.mjs';
import {makeMall,MALL_CHALLENGES} from './mall-world.mjs';
import {trick,bank,bail,emptyCombo,comboValue} from './mall-score.mjs';
export {comboValue};
import {skate,MALL_TUNING} from './mall-skating.mjs';
export {MALL_TUNING};
export function createMall({character='max',seed=1,practice=false,board='classic'}={}){const world=makeMall();const s={kind:'mall',version:1,seed:seed>>>0,tick:0,phase:'playing',practice,character,board,world,player:{...world.spawn,speed:0,vy:0,grounded:true,rail:null,bail:0,spin:0,visualSpin:0,steer:0,pushPhase:0,balance:0},combo:emptyCombo(),score:0,damage:0,meter:0,boost:0,alert:0,heat:0,guards:[],event:null,events:[],completed:{},visited:['atrium'],tapes:[],ghost:[],stats:{longestCombo:0,maxMultiplier:1,biggestBail:0,bestCombo:0,rekt:0},callout:{text:'AFTER HOURS',detail:'Find your line. Own the mall.',until:240},previous:{},bag:false,bagZones:[],challengeIds:[],challengeTimes:{}};const pool=[...MALL_CHALLENGES];for(let i=0;i<3;i++)s.challengeIds.push(pool.splice(Math.floor(random(s)*pool.length),1)[0].id);return s;}
export function stepMall(s,input={}){
 if(s.phase!=='playing')return s;s.tick++;s.events=[];const p=s.player,t=MALL_TUNING,dt=1/60,edge=k=>input[k]&&(!s.previous[k]||(input.pressIds?.[k]!==undefined&&input.pressIds[k]!==s.previous.pressIds?.[k]));
 if(p.bail>0){p.bail--;if(!p.bail){p.y=floorAt(s.world,p.x,p.z);p.vy=0;p.grounded=true;}s.previous={...input};if(!s.practice&&s.tick>=t.duration){s.phase='finished';}return s;}
 if(edge('bail')){bail(s);s.previous={...input};return s;}
 skate(s,input,edge);
 for(const o of s.world.props)if(!o.broken&&!o.unbreakable&&inside(p,o,.7)&&p.y<o.y+o.h+.6&&p.y+1>o.y&&Math.abs(p.speed)>5)destroy(s,o);
 const zone=s.world.zones.find(z=>inside(p,z));s.zone=zone?.name||'EMPLOYEE PASSAGE';if(zone&&!s.visited.includes(zone.id)){s.visited.push(zone.id);if(s.combo.count)trick(s,'ZONE TRANSFER',300);}
 if(zone?.id==='roof'&&p.y>=8){if(!s.completed.roof){s.completed.roof=true;trick(s,'NEW ATH',1500);}}
 if(zone?.id==='service')s.completed.service=true;
 if(p.x<-74&&p.z>74)s.completed.grass=true;
 if(!s.bag&&distance(p,{x:-14,z:12})<3){s.bag=true;s.callout={text:'BAGHOLDER',detail:'Take the bag through three zones.',until:s.tick+150};}
 if(s.bag&&zone&&!s.bagZones.includes(zone.id))s.bagZones.push(zone.id);if(s.bagZones.length>=3)s.completed.bag=true;
 for(const tape of s.world.tapes)if(!s.tapes.includes(tape.id)&&distance(p,tape)<2.6&&Math.abs(p.y+1-tape.y)<3){s.tapes.push(tape.id);trick(s,'LOST VHS',700);s.events.push({type:'secret'});s.callout={text:'VHS FOUND',detail:`${s.tapes.length}/9 · ${s.tapes.length===9?'THE POOL HAS A FALSE WALL.':'A recording from after closing.'}`,until:s.tick+180};}
 if(s.damage>=12000)s.completed.damage=true;if(s.combo.count&&(s.tick-s.combo.started)>=1800)s.completed.hold=true;
 if(s.combo.count){s.combo.grace--;s.stats.longestCombo=Math.max(s.stats.longestCombo,(s.tick-s.combo.started)/60);if(s.combo.grace<=0&&p.grounded&&!p.manual&&!p.rail)bank(s);}
 if(edge('bank'))s.bankPending=true;
 if(s.bankPending&&p.grounded){bank(s);p.manual=false;p.linkBlocked=true;s.bankPending=false;}
 if(p.bail)s.bankPending=false;
 s.heat=Math.max(0,s.heat-.004);s.alert=Math.min(5,Math.floor(s.heat/5));
 const count=s.alert===0?1:Math.min(6,s.alert+1);while(s.guards.length<count)s.guards.push({x:p.x+12,z:p.z+16,y:p.y,cart:s.guards.length>=3});
 for(const [i,g]of s.guards.entries()){if(s.alert>0){const a=Math.atan2(p.x-g.x,p.z-g.z),speed=g.cart?12:6;g.x+=Math.sin(a)*speed*dt;g.z+=Math.cos(a)*speed*dt;g.y=floorAt(s.world,g.x,g.z);if(distance(p,g)<1.5&&p.y<g.y+1.3&&!p.bail)bail(s,'SECURITY CHECK');else if(distance(p,g)<2&&p.y>g.y+1.5&&s.tick%60===0)trick(s,'SECURITY TRANSFER',500);}if(g.cart){let rail=s.world.rails.find(r=>r.id===`cart-${i}`);if(!rail){rail={id:`cart-${i}`};s.world.rails.push(rail);}Object.assign(rail,{x:g.x,z:g.z-2,bx:g.x,bz:g.z+2,y:g.y+1.5});}if(s.alert>=4&&i===0&&Math.abs(p.z-28)<.6&&Math.abs(p.x)<18&&p.y<1.4)bail(s,'GATE CLOSED · JUMP IT');}
 if(s.tick%1800===0){const types=['FLASH CRASH','BULL RUN','RUG','POWER OUTAGE','MALL WALKERS','GAS WAR'];s.event={type:types[Math.floor(random(s)*types.length)],until:s.tick+600};s.callout={text:s.event.type,detail:'Keep moving. Find another line.',until:s.tick+180};}
 if(s.event&&s.tick>=s.event.until){if(s.combo.count)trick(s,s.event.type==='FLASH CRASH'?'MARKET REBOUND':'EVENT SURVIVED',800);s.event=null;}
 if(s.event?.type==='RUG'&&inside(p,{x:0,z:-40,w:22,d:8})&&p.grounded)bail(s,'FLOOR REMOVED');
 if(s.event?.type==='GAS WAR'&&p.x>40&&!s.event.won){s.event.won=true;trick(s,'GAS WAR WON',1200);s.meter=100;}
 if(['BULL RUN','MALL WALKERS'].includes(s.event?.type)){const z=(s.tick%600)/600*150-75;if(Math.abs(p.z-z)<2&&Math.abs(p.x)<(s.event.type==='BULL RUN'?2:14)&&p.y<1.2)bail(s,'MAKE WAY');}
 for(const id of s.challengeIds)if(s.completed[id]&&!s.challengeTimes[id]){s.challengeTimes[id]=s.tick;s.score+=2500;s.callout={text:'CHALLENGE COMPLETE',detail:MALL_CHALLENGES.find(c=>c.id===id).name+' +2,500',until:s.tick+140};s.events.push({type:'secret'});}
 if(!s.practice&&s.tick%6===0)s.ghost.push([s.tick,Math.round(p.x*100)/100,Math.round(p.y*100)/100,Math.round(p.z*100)/100,p.yaw]);
 if(!s.practice&&s.tick>=t.duration){if(p.grounded)bank(s);else bail(s,'AFTER HOURS ENDED');s.phase='finished';}
 stepRoutes(s);s.previous={...input};return s;
}
function destroy(s,o){o.broken=true;s.damage+=o.value;s.heat+=.65;trick(s,o.kind==='carpet'?'RUG PULL':`SMASH ${o.kind.toUpperCase()}`,100+o.value/4);s.events.push({type:'smash',x:o.x,z:o.z});if(o.kind==='carpet'){s.rugs=(s.rugs||0)+1;if(s.rugs>=5)s.completed.rug=true;for(const prop of s.world.props)if(!prop.broken&&prop!==o&&!prop.unbreakable&&distance(o,prop)<6){prop.broken=true;s.damage+=prop.value;}}
 if(o.kind==='restaurant sign'){s.combo.signs.push(o.id);if(s.combo.signs.length>=3)s.completed.food=true;}}

function stepRoutes(s){
 s.routeProgress??={};s.routesCompleted??=[];
 for(const route of s.world.routes||[]){
  const progress=s.routeProgress[route.id]??={index:0,started:0,cooldown:0};
  if(progress.cooldown>s.tick)continue;
  const gate=route.gates[progress.index];
  if(distance(s.player,gate)<7){
   if(!progress.index)progress.started=s.tick;progress.index++;
   if(progress.index===route.gates.length){const seconds=(s.tick-progress.started)/60;s.routesCompleted.push({id:route.id,seconds});s.routesCompleted=s.routesCompleted.slice(-20);s.score+=route.points;s.callout={text:route.name,detail:`${seconds.toFixed(1)}s · +${route.points.toLocaleString('en-US')}`,until:s.tick+150};progress.index=0;progress.cooldown=s.tick+180;s.events.push({type:'secret'});}
   else{s.trickHint={text:`${route.name} ${progress.index}/${route.gates.length}`,until:s.tick+100};}
  }
 }
}
