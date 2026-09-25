import {createRug,stepRug} from '../lib/arcade/after-hours/rug-sim.mjs';
import {distance,lineBlocked,angleDelta} from '../lib/arcade/after-hours/math.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const plans={};
for(let level=0;level<8;level++){
 const s=createRug({level}),moves=[];let targetIndex=0,lastPath=-100,path=[],prior='';
 const waypoints=[{x:-23,z:17},{x:-23,z:-5},{x:-27,z:-18},{x:0,z:-20},{x:0,z:-42},{x:24,z:-43},{x:27,z:-56},{x:0,z:-66},{x:0,z:-85}];
 function route(goal){const step=2,key=(x,z)=>`${x},${z}`,start={x:Math.round(s.player.x/step),z:Math.round(s.player.z/step)},end={x:Math.round(goal.x/step),z:Math.round(goal.z/step)},q=[start],seen=new Map([[key(start.x,start.z),null]]);let found;
  for(let i=0;i<q.length&&i<6000;i++){const a=q[i];if(Math.abs(a.x-end.x)+Math.abs(a.z-end.z)===0){found=a;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:a.x+dx,z:a.z+dz},k=key(n.x,n.z);if(seen.has(k)||Math.abs(n.x)>17||n.z<-45||n.z>17)continue;if(s.world.solids.some(b=>!b.broken&&Math.abs(n.x*step-b.x)<b.w/2+.8&&Math.abs(n.z*step-b.z)<b.d/2+.8))continue;seen.set(k,a);q.push(n);}}
  const result=[];while(found){result.unshift({x:found.x*step,z:found.z*step});found=seen.get(key(found.x,found.z));}return result;
 }
 for(let tick=0;tick<24000&&s.phase==='playing';tick++){
  const p=s.player;
  if(targetIndex<waypoints.length-1&&distance(p,waypoints[targetIndex])<(targetIndex===2||targetIndex===6?3:5)){if(targetIndex!==2&&targetIndex!==6||s.world.switches[targetIndex===2?0:1].used)targetIndex++;}
  let goal=s.escape?s.world.spawn:waypoints[targetIndex];
  if(!s.escape&&p.hp<70){const health=s.world.pickups.filter(a=>!a.taken&&a.type==='health'&&!s.world.solids.some(b=>!b.broken&&Math.abs(a.x-b.x)<b.w/2+.8&&Math.abs(a.z-b.z)<b.d/2+.8)).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(health)goal=health;}
  const enemies=s.enemies.filter(e=>e.hp>0&&!lineBlocked({...p,y:p.y+1.6},{...e,y:e.y+1.2},s.world.solids)).sort((a,b)=>distance(a,p)-distance(b,p));
  const enemy=enemies[0];
  if(targetIndex===8&&!s.exitOpen){const alive=s.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(a,p)-distance(b,p));goal=alive[0]||goal;}
  if(level>=4&&enemy&&!s.escape&&p.hp>=70&&distance(p,enemy)<24&&s.kills<Math.ceil(s.initialEnemies*.6)){goal={x:Math.max(-30,Math.min(30,enemy.x+10*Math.sin(tick/120))),z:Math.max(-85,Math.min(29,enemy.z+10))};}
  if(tick-lastPath>=30){path=route(goal);lastPath=tick;}
  while(path.length>1&&distance(p,path[0])<1.8)path.shift();
  const dest=path.length>1?path[0]:goal,desired=Math.atan2(-(dest.x-p.x),-(dest.z-p.z));
  const aim=enemy&&!s.escape?Math.atan2(-(enemy.x-p.x),-(enemy.z-p.z)):desired,pitch=enemy&&!s.escape?Math.atan2(enemy.y+1.1-(p.y+1.65),distance(p,enemy)):0;
  const relative=angleDelta(desired,aim);const input={lookX:-angleDelta(aim,p.yaw)/.0022,lookY:-(pitch-p.pitch)/.0022,forward:Math.cos(relative)>.38,back:Math.cos(relative)<-.38,left:Math.sin(relative)>.38,right:Math.sin(relative)<-.38,fire:!!enemy&&!s.escape,interact:tick%2===0,jump:p.grounded&&!s.previous.jump,dash:s.escape&&tick%70===0,weapon:enemy&&distance(p,enemy)<9&&s.ammo.gwei>=2?2:enemy&&distance(p,enemy)<3.6?6:enemy&&distance(p,enemy)<18&&s.ammo.shells>0?1:0};
  const json=JSON.stringify(input);if(json!==prior){moves.push({tick:s.tick,input});prior=json;}
  stepRug(s,input);
 }
 console.log(level,s.phase,'tick',s.tick,'hp',s.player.hp,'kills',s.kills,'switch',s.world.switches.map(a=>a.used),'pos',s.player.x.toFixed(1),s.player.z.toFixed(1));
 assert.equal(s.phase,'complete',`Campaign level ${level} must have a playable route`);plans[level]={moves,ticks:s.tick};
}
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);if(output)fs.writeFileSync(output,JSON.stringify(plans));
