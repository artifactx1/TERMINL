import {clamp,inside,floorAt,moveSolid,distance} from './math.mjs';
import {makeRugWorld,RUG_LEVELS,spawnEnemy} from './rug-world.mjs';
import {WEAPONS,fireWeapon,stepEnemies,hurtPlayer,discover,openSecret} from './rug-combat.mjs';
export {WEAPONS};
export const RUG_TUNING={speed:13,acceleration:65,jump:9,gravity:24,dashSpeed:31,dashTicks:11,dashCooldown:65,mouseSensitivity:.0022};
export function createRug({level=0,allTapes=false}={}){level=clamp(Math.floor(level),0,7);const world=makeRugWorld(level,allTapes);return {kind:'rug',version:1,level,world,phase:'playing',tick:0,seed:level+1,player:{...world.spawn,vx:0,vz:0,vy:0,grounded:true,hp:100,armor:50,invuln:0,fireCooldown:0,dash:0,dashCooldown:0,crouch:false},enemies:world.enemies,initialEnemies:world.enemies.length,nextEnemy:1000,projectiles:[],hazards:[],weapon:0,unlocked:[0,1,2,6],ammo:{shells:24,gwei:180,crates:2,ultimate:1},score:0,kills:0,shots:0,hits:0,damageTaken:0,chain:0,lastKill:-999,leverage:1,maxLeverage:1,secrets:[],exitOpen:false,events:[],previous:{},shotFlash:0,hitFlash:0,escape:0,callout:{text:RUG_LEVELS[level].name,detail:RUG_LEVELS[level].objective,until:300}};}
export function stepRug(s,input={}){
 if(s.phase!=='playing')return s;s.tick++;s.events=[];const p=s.player,t=RUG_TUNING,dt=1/60,edge=k=>input[k]&&!s.previous[k];
 if(s.level===2)for(const f of s.world.floors)if(f.id?.startsWith('bid-')){f.renderOffset=s.world.switches.every(a=>a.used)?0:Math.sin((s.tick+Number(f.id.slice(4))*70)/110)*2;f.y=2.4+f.renderOffset;}
 p.yaw-=(Number(input.lookX)||0)*t.mouseSensitivity;p.pitch=clamp(p.pitch-(Number(input.lookY)||0)*t.mouseSensitivity,-1.25,1.25);
 // Arrow look buttons remain available without pointer lock, including touch.
 if(input.lookLeft)p.yaw+=.045;if(input.lookRight)p.yaw-=.045;
 if(typeof input.weapon==='number'&&s.unlocked.includes(input.weapon))s.weapon=input.weapon;
 else if(input.weapon?.delta){const index=s.unlocked.indexOf(s.weapon);s.weapon=s.unlocked[(index+input.weapon.delta+s.unlocked.length)%s.unlocked.length];}
 p.crouch=!!input.crouch;p.invuln=Math.max(0,p.invuln-1);p.fireCooldown=Math.max(0,p.fireCooldown-1);p.dashCooldown=Math.max(0,p.dashCooldown-1);s.shotFlash=Math.max(0,s.shotFlash-1);s.hitFlash=Math.max(0,s.hitFlash-1);
 const forward=input.moveY??(Number(!!input.forward)-Number(!!input.back)),side=input.moveX??(Number(!!input.right)-Number(!!input.left)),len=Math.max(1,Math.hypot(forward,side));let dx=(-Math.sin(p.yaw)*forward+Math.cos(p.yaw)*side)/len,dz=(-Math.cos(p.yaw)*forward-Math.sin(p.yaw)*side)/len;
 if(edge('dash')&&p.dashCooldown===0){p.dash=t.dashTicks;p.dashCooldown=t.dashCooldown;if(!forward&&!side){dx=-Math.sin(p.yaw);dz=-Math.cos(p.yaw);}p.vx=dx*t.dashSpeed;p.vz=dz*t.dashSpeed;}
 if(p.dash>0)p.dash--;else{const slide=p.crouch&&Math.hypot(p.vx,p.vz)>7&&p.grounded,ice=s.level===5;const blend=slide?.035:ice?.045:p.grounded?.18:.075;p.vx+=(dx*t.speed-p.vx)*blend;p.vz+=(dz*t.speed-p.vz)*blend;if(slide){p.vx*=1.002;p.vz*=1.002;}}
 if(edge('jump')&&p.grounded){p.vy=t.jump+(p.crouch?1:0);p.grounded=false;s.events.push({type:'jump'});}
 if(s.level===1&&!s.world.switches.every(a=>a.used)&&Math.abs(p.x)<9&&p.z<0&&p.z>-52){p.vx*=.975;p.vz*=.975;}
 if(s.level===3&&Math.abs(p.x)>18&&Math.abs(p.x)<26)p.vz-=.24*(s.world.switches[0].used?-1:1);
 moveSolid(p,p.vx*dt,p.vz*dt,s.world.solids,.45);p.vy-=t.gravity*dt;p.y+=p.vy*dt;let floor=floorAt(s.world,p.x,p.z,s.tick);if(s.escape&&p.z<s.collapseZ)floor=-100;if(p.y<-9){p.hp=0;s.phase='dead';}if(p.y<=floor){p.y=floor;p.vy=0;p.grounded=true;}else p.grounded=false;
 if(input.fire)fireWeapon(s);
 for(const item of s.world.pickups)if(!item.taken&&distance(p,item)<1.8&&Math.abs(p.y-item.y)<3){if(item.type==='health'&&p.hp<100){p.hp=Math.min(100,p.hp+item.amount);item.taken=true;}else if(item.type==='armor'&&p.armor<100){p.armor=Math.min(100,p.armor+item.amount);item.taken=true;}else if(item.type==='weapon'){if(!s.unlocked.includes(item.weapon))s.unlocked.push(item.weapon);s.weapon=item.weapon;item.taken=true;s.events.push({type:'secret'});s.callout={text:WEAPONS[item.weapon].name,detail:WEAPONS[item.weapon].role,until:s.tick+100};}else if(Object.hasOwn(s.ammo,item.type)){s.ammo[item.type]=Math.min(item.type==='gwei'?500:99,s.ammo[item.type]+item.amount);item.taken=true;}}
 if(edge('interact')){for(const item of s.world.switches)if(!item.used&&distance(p,item)<3){item.used=true;s.score+=1000;s.events.push({type:'secret'});s.callout={text:'SYSTEM UPDATED',detail:`${s.world.switches.filter(a=>a.used).length}/2 controls active`,until:s.tick+100};if(s.level===0){for(let i=0;i<5;i++)s.enemies.push(spawnEnemy('bot',item.x+(i%2?3:-3),item.z+4+i,s.nextEnemy++));}if(s.level===5)for(const e of s.enemies)e.cooldown=Math.min(30,e.cooldown);}
  for(const secret of s.world.secrets)if(secret.method==='interact'&&distance(p,secret)<2.5){if(secret.panelId)openSecret(s,secret);else discover(s,secret);}
 }
 for(const secret of s.world.secrets)if(secret.method==='jump'&&distance(p,secret)<3&&p.y>1.7)openSecret(s,secret);
 for(const secret of s.world.secrets)if(secret.open&&distance(p,{x:secret.roomX,z:secret.roomZ})<3)discover(s,secret);
 if(s.level===1&&s.world.switches.every(a=>a.used))s.world.solids.find(b=>b.id==='drain-gate').broken=true;
 s.nearControl=s.world.switches.find(a=>!a.used&&distance(p,a)<5)?.label||s.world.secrets.find(a=>a.method==='interact'&&!s.secrets.includes(a.id)&&distance(p,a)<4)?.id||null;
 if(s.tick-s.lastKill>240){s.chain=0;s.leverage=1;}
 if(s.level===4&&p.z<-22&&!s.bridgeEvent){s.bridgeEvent=s.tick;s.callout={text:'BRIDGE PAUSED',detail:'The bridge stopped. The enemies did not.',until:s.tick+180};}
 if(s.level===4&&s.bridgeEvent&&s.tick-s.bridgeEvent<180){p.vx*=.96;p.vz*=.96;}
 if(s.level===2&&!s.world.switches.every(a=>a.used)&&s.tick%240<80&&Math.abs(p.x)<10&&p.z<-12&&p.grounded&&p.y<.5)hurtPlayer(s,5);
 if(s.level===4&&p.z<17&&p.z>-79&&Math.abs(p.x)<10&&((17-p.z)%15)>12&&p.grounded){hurtPlayer(s,16);p.vy=8;p.grounded=false;}
 if(s.level===6&&s.tick===600){s.callout={text:'NOTHING IS REAL',detail:'The scenery was a sell wall.',until:s.tick+180};for(const wall of s.world.solids)if(wall.id.startsWith('left-pier'))wall.broken=true;}
 if(!s.escape&&(s.level!==6||s.tick>450))stepEnemies(s);
 s.exitOpen=s.world.switches.every(a=>a.used)&&s.kills>=Math.ceil(s.initialEnemies*.6);
 if(s.exitOpen&&distance(p,s.world.exit)<3&&(edge('interact')||s.level===7)){
  if(s.level===7&&!s.escape){s.escape=1;s.escapeStarted=s.tick;s.callout={text:'REMOVE LIQUIDITY',detail:'THE RUG · Get back to the entry portal. Keep moving!',until:s.tick+180};s.world.exit={...s.world.spawn};s.projectiles=[];s.hazards=[];p.yaw=Math.PI;}
  else if(s.level!==7)complete(s);
 }
 if(s.escape){s.escape++;s.collapseZ=-91+s.escape/60*7;if(p.z<s.collapseZ&&p.grounded)hurtPlayer(s,12);if(distance(p,s.world.spawn)<4)complete(s);if(s.escape>1500&&s.phase==='playing'){p.hp=0;s.phase='dead';}}
 s.enemies=s.enemies.filter(e=>e.hp>0);
 if(s.phase==='playing'&&p.hp<=0)s.phase='dead';s.previous={...input};return s;
}
function complete(s){s.phase='complete';s.score+=Math.round(s.player.hp*20)+s.secrets.length*1000+Math.max(0,18000-s.tick);const ratio=s.kills/Math.max(1,s.initialEnemies);s.grade=s.tick<12000&&ratio>.9&&s.secrets.length>=2?'S':ratio>.75&&s.player.hp>40?'A':ratio>.6?'B':'C';s.events.push({type:'secret'});}
