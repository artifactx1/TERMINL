import {clamp,inside,nearestRail,floorAt,distance,random,moveSolid} from './math.mjs';
import {makeMall,MALL_CHALLENGES,ZONES} from './mall-world.mjs';
import {trick,bank,bail,emptyCombo,comboValue} from './mall-score.mjs';
export {comboValue};
export const MALL_TUNING={duration:150*60,speed:21,acceleration:28,turn:2.7,jump:11,gravity:23,railSnap:2};
export function createMall({character='max',seed=1,practice=false,board='classic'}={}){const world=makeMall();const s={kind:'mall',version:1,seed:seed>>>0,tick:0,phase:'playing',practice,character,board,world,player:{...world.spawn,speed:0,vy:0,grounded:true,rail:null,bail:0,spin:0},combo:emptyCombo(),score:0,damage:0,meter:0,boost:0,alert:0,heat:0,guards:[],event:null,events:[],completed:{},visited:['atrium'],tapes:[],ghost:[],stats:{longestCombo:0,maxMultiplier:1,biggestBail:0,bestCombo:0,rekt:0},callout:{text:'AFTER HOURS',detail:'Find your line. Own the mall.',until:240},previous:{},bag:false,bagZones:[],challengeIds:[],challengeTimes:{}};const pool=[...MALL_CHALLENGES];for(let i=0;i<3;i++)s.challengeIds.push(pool.splice(Math.floor(random(s)*pool.length),1)[0].id);return s;}
export function stepMall(s,input={}){
 if(s.phase!=='playing')return s;s.tick++;s.events=[];const p=s.player,t=MALL_TUNING,dt=1/60,edge=k=>input[k]&&!s.previous[k];
 if(p.bail>0){p.bail--;if(!p.bail){p.y=floorAt(s.world,p.x,p.z);p.vy=0;p.grounded=true;}s.previous={...input};if(!s.practice&&s.tick>=t.duration){s.phase='finished';}return s;}
 if(edge('bail'))bail(s);
 p.railCooldown=Math.max(0,(p.railCooldown||0)-1);
 p.yaw+=(input.steer??(Number(!!input.right)-Number(!!input.left)))*t.turn*dt*(p.grounded?1:s.character==='pigeon'?1.4:1.1);
 if(edge('turn')){p.yaw+=Math.PI;trick(s,'REVERT',70);}
 const cap=s.character==='pigeon'?t.speed*.94:t.speed;
 p.speed=clamp(p.speed+(input.back?-38:input.forward?t.acceleration:-3)*dt,0,cap);
 if(s.boost>0)s.boost--;
 if(edge('special')&&s.meter>=100){s.events.push({type:'special'});s.meter=0;trick(s,{barry:'DIAMOND LINE',paul:'COLD WALLET',max:'100X LEVERAGE',pigeon:'SANDWICH ATTACK'}[s.character],1000);if(s.character==='paul')bank(s);else if(s.character==='max')s.boost=360;else if(s.character==='barry'){p.spin+=Math.PI*2;p.vy=12;p.grounded=false;}else{p.vy=13;p.grounded=false;for(const o of s.world.props)if(!o.broken&&!o.unbreakable&&distance(p,o)<10)destroy(s,o);}}
 const airborneAction=edge('action')&&!p.grounded&&!p.rail;
 if((edge('jump')||edge('action'))&&(p.grounded||p.rail)){p.vy=t.jump+(p.rail?2:0);p.grounded=false;p.rail=null;p.railCooldown=18;trick(s,'OLLIE',60);s.events.push({type:'jump'});}
 if(!p.grounded){p.spin+=(input.steer??(Number(!!input.right)-Number(!!input.left)))*.09;if(edge('flip')||airborneAction)trick(s,input.left?'HEELFLIP':input.right?'IMPOSSIBLE':'KICKFLIP',180);if(edge('grab'))trick(s,input.left?'MELON':input.right?'MUTE':'INDY',220);}
 if(p.rail&&input.grind){const r=s.world.rails.find(r=>r.id===p.rail),q=nearestRail(p,r);p.y=r.y;p.vy=0;p.grounded=false;p.x=q.x;p.z=q.z;const a=Math.atan2(r.bx-r.x,-(r.bz-r.z)),alignment=Math.cos(p.yaw-a);p.yaw=alignment>=0?a:a+Math.PI;p.speed=Math.max(10,p.speed);if(s.tick%30===0)trick(s,input.left?'NOSESLIDE':input.right?'TAILSLIDE':'50-50',110);if(q.t<=.005||q.t>=.995){p.rail=null;p.vy=3;}}
 else if(p.rail)p.rail=null;
 const oldX=p.x,oldZ=p.z,dx=Math.sin(p.yaw)*p.speed*dt,dz=-Math.cos(p.yaw)*p.speed*dt;moveSolid(p,dx,dz,s.world.solids,.45);if(Math.abs(p.x-oldX-dx)+Math.abs(p.z-oldZ-dz)>.08){if(input.wallride&&!p.grounded){p.vy=Math.max(0,p.vy);if(s.tick%30===0)trick(s,'WALLRIDE',200);}else if(Math.abs(p.speed)>12)bail(s,'WALL CHECK');}
 if(!p.rail){p.vy-=t.gravity*dt;p.y+=p.vy*dt;const floor=floorAt(s.world,p.x,p.z);if(p.y<=floor){if(!p.grounded&&p.vy<-20)bail(s,'HEAVY LANDING');else if(!p.grounded&&Math.abs(p.spin)>2.5)trick(s,`${Math.max(180,Math.round(Math.abs(p.spin)/Math.PI)*180)} SPIN`,250);p.y=floor;p.vy=0;p.grounded=true;p.spin=0;}else p.grounded=false;
 if(input.grind&&s.tick>15&&!p.railCooldown&&p.vy<=0){for(const r of s.world.rails){const q=nearestRail(p,r);if(q.distance<t.railSnap+(s.character==='barry'?.4:0)&&Math.abs(p.y-r.y)<2&&q.t>.02&&q.t<.98&&Math.abs(p.speed)>3){p.rail=r.id;p.y=r.y;trick(s,'BOARDSLIDE',200);break;}}}}
 if(input.manual&&p.grounded&&Math.abs(p.speed)>2){if(s.tick%60===0)trick(s,'MANUAL',85);s.combo.grace=70;}
 if(input.wallride&&!p.grounded&&(Math.abs(p.x)>81||Math.abs(p.z)>81)){p.vy=Math.max(p.vy,0);if(s.tick%40===0)trick(s,'WALLRIDE',190);}
 if(Math.abs(p.x)>84||Math.abs(p.z)>84){p.x=clamp(p.x,-84,84);p.z=clamp(p.z,-84,84);if(Math.abs(p.speed)>10&&!input.wallride)bail(s,'WALL CHECK');else p.speed*=.8;}
 for(const o of s.world.props)if(!o.broken&&!o.unbreakable&&inside(p,o,.7)&&p.y<o.y+o.h+.6&&p.y+1>o.y&&Math.abs(p.speed)>5)destroy(s,o);
 if(Math.abs(p.x)<5&&Math.abs(p.z)<5){if(p.y>1.5&&!s.fountainAir){trick(s,'EXIT LIQUIDITY',1200);s.completed.gap=true;s.fountainAir=true;}else if(p.grounded&&s.tick%120===0)p.speed*=.6;}else s.fountainAir=false;
 const zone=ZONES.find(z=>inside(p,{...z,w:56,d:56}));s.zone=zone?.name||'EMPLOYEE PASSAGE';if(zone&&!s.visited.includes(zone.id)){s.visited.push(zone.id);if(s.combo.count)trick(s,'ZONE TRANSFER',300);}
 if(zone?.id==='roof'&&p.y>=8){if(!s.completed.roof){s.completed.roof=true;trick(s,'NEW ATH',1500);}}
 if(zone?.id==='service')s.completed.service=true;
 if(p.x<-74&&p.z>74)s.completed.grass=true;
 if(!s.bag&&distance(p,{x:-14,z:12})<3){s.bag=true;s.callout={text:'BAGHOLDER',detail:'Take the bag through three zones.',until:s.tick+150};}
 if(s.bag&&zone&&!s.bagZones.includes(zone.id))s.bagZones.push(zone.id);if(s.bagZones.length>=3)s.completed.bag=true;
 for(const tape of s.world.tapes)if(!s.tapes.includes(tape.id)&&distance(p,tape)<2.6&&Math.abs(p.y+1-tape.y)<3){s.tapes.push(tape.id);trick(s,'LOST VHS',700);s.events.push({type:'secret'});s.callout={text:'VHS FOUND',detail:`${s.tapes.length}/9 · ${s.tapes.length===9?'THE POOL HAS A FALSE WALL.':'A recording from after closing.'}`,until:s.tick+180};}
 if(s.damage>=12000)s.completed.damage=true;if(s.combo.count&&(s.tick-s.combo.started)>=1800)s.completed.hold=true;
 if(s.combo.count){s.combo.grace--;s.stats.longestCombo=Math.max(s.stats.longestCombo,(s.tick-s.combo.started)/60);if(s.combo.grace<=0&&p.grounded&&!input.manual)bank(s);}
 if(edge('bank'))s.bankPending=true;
 if(s.bankPending&&p.grounded){bank(s);s.bankPending=false;}
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
 s.previous={...input};return s;
}
function destroy(s,o){o.broken=true;s.damage+=o.value;s.heat+=.65;trick(s,o.kind==='carpet'?'RUG PULL':`SMASH ${o.kind.toUpperCase()}`,100+o.value/4);s.events.push({type:'smash',x:o.x,z:o.z});if(o.kind==='carpet'){s.rugs=(s.rugs||0)+1;if(s.rugs>=5)s.completed.rug=true;for(const prop of s.world.props)if(!prop.broken&&prop!==o&&!prop.unbreakable&&distance(o,prop)<6){prop.broken=true;s.damage+=prop.value;}}
 if(o.kind==='restaurant sign'){s.combo.signs.push(o.id);if(s.combo.signs.length>=3)s.completed.food=true;}}
