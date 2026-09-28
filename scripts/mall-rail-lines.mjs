import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {angleDelta} from '../lib/arcade/after-hours/math.mjs';
import {drive} from './mall-lines-pilot.mjs';

/** Reproducible line from spawn, using only ordinary movement/trick inputs. */
export function planRailLine({releaseFrames=0}={}){
 const state=createMall({practice:true,seed:123});stepMall(state);stepMall(state);
 const inputs=drive(state,[[100,70],[140,70],[140,60]]),catches=[];let hops=0,lastRail=null;
 const advance=input=>{stepMall(state,input);inputs.push(input);const p=state.player;if(p.rail&&p.rail!==lastRail)catches.push({frame:inputs.length,rail:p.rail,chain:p.railChain});lastRail=p.rail;};
 for(let i=0;i<500&&(state.stats.railTransfers||0)<2;i++){
  const p=state.player,a=angleDelta(Math.atan2(140-p.x,10),p.yaw);
  if(p.rail&&hops<2){
   for(let j=0;j<releaseFrames;j++)advance({forward:true});
   advance({forward:true,grind:releaseFrames===0,jump:true,left:hops===1,right:hops===0});hops++;
  }else if(hops&&!p.rail)advance({forward:true,grind:true});
  else advance({forward:true,grind:true,left:a<-.035,right:a>.035});
 }
 if(state.stats.railTransfers!==2)throw Error(`Rail transfer line did not complete (${releaseFrames} release frames)`);
 return {inputs,catches,state};
}
if(process.argv.includes('--rail-plan'))for(const releaseFrames of [0,3,7]){const p=planRailLine({releaseFrames});console.log(JSON.stringify({releaseFrames,catches:p.catches,score:p.state.combo.base,stats:p.state.stats}));}
