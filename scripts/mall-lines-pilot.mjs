import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {angleDelta} from '../lib/arcade/after-hours/math.mjs';
export function drive(s,points){const inputs=[];for(const [x,z]of points){let ticks=0;while(Math.hypot(s.player.x-x,s.player.z-z)>5&&ticks++<1800){const p=s.player,a=angleDelta(Math.atan2(x-p.x,-(z-p.z)),p.yaw),brake=Math.abs(a)>1.1&&p.speed>8,input={forward:!brake,back:brake,left:a<-.035,right:a>.035};stepMall(s,input);inputs.push(input);}if(ticks>=1800)throw Error(`Stalled near ${x},${z}`);}for(let i=0;i<180&&!s.player.grounded;i++){stepMall(s);inputs.push({});}return inputs;}
export function planLines(){
 const cases=[['fountain',[[0,-35]]],['ath',[[0,-178]]],['street',[[-75,134],[-42,134],[44,134]]],['canal',[[110,100],[107,129],[180,129]]],['snake',[[-140,-95],[-140,-175]]]];
 const plans=[];
 for(const [id,points]of cases){const state=createMall({practice:true,seed:123});stepMall(state);stepMall(state);const inputs=drive(state,points);plans.push({id,inputs,gaps:state.gaps||[],x:state.player.x,z:state.player.z});}
 for(const id of ['concourse','outer']){const state=createMall({practice:true,seed:123});stepMall(state);stepMall(state);const route=state.world.routes.find(r=>r.id===id),inputs=drive(state,route.gates.map(g=>[g.x,g.z]));plans.push({id,inputs,completed:state.routesCompleted,x:state.player.x,z:state.player.z});}
 return plans;
}
if(process.argv.includes('--plan'))for(const p of planLines())console.log(p.id,p.inputs.length,p.gaps||p.completed);
