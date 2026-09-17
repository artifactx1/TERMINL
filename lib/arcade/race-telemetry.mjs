import {angleDelta} from './race-sim.mjs';

export {raceProgress} from './race-sim.mjs';
import {raceProgress} from './race-sim.mjs';

export function rivalTelemetry(state,slot=0){
  const me=state.players[slot],rival=state.players[1-slot];
  const gap=raceProgress(state,1-slot)-raceProgress(state,slot);
  const bearing=angleDelta(Math.atan2(rival.y-me.y,rival.x-me.x),me.angle);
  const direction=Math.abs(bearing)>Math.PI*.75?'BEHIND CAR':Math.abs(bearing)<Math.PI*.25?'IN FRONT':bearing<0?'LEFT OF CAR':'RIGHT OF CAR';
  // Match the existing arcade speed display: 1 sim-unit/tick = 42 km/h.
  const meters=Math.round(Math.abs(gap)*42/216);
  const label=rival.finishedTick!==null?'RIVAL FINISHED':me.finishedTick!==null?'YOU FINISHED':meters<2?'NECK AND NECK':`RIVAL ${meters}m ${gap>0?'AHEAD':'BEHIND'}`;
  return {gap,meters,bearing,direction,label};
}

/** Cup standing for one seat, read from authoritative state. Race place and cup
 * place are different numbers; the HUD shows both so a driver leading the race
 * can see when the cup is still lost on points. A race swings at most ten points
 * (10 v 0), which is what "clinched" and "out of reach" mean here. */
export function cupStanding(state,slot=0){
  if(!state?.players?.length)return null;
  const me=state.players[slot],rival=state.players[1-slot],mine=me.points||0,theirs=rival.points||0;
  const scored=state.phase==='raceOver'||state.phase==='finished'?state.trackIndex+1:state.trackIndex;
  const remaining=Math.max(0,state.tracks.length-scored),lead=mine-theirs;
  const place=lead>0?1:lead<0?2:state.phase==='finished'&&state.winner!==null?(state.winner===slot?1:2):1;
  const tied=lead===0;
  let status;
  if(state.phase==='finished')status=state.winner===null?'CUP DRAWN':state.winner===slot?'CUP WON':'CUP LOST ON POINTS';
  else if(lead>10*remaining)status='CUP CLINCHED';
  else if(-lead>10*remaining)status='CUP OUT OF REACH · RACE FOR PRIDE';
  else if(tied)status=remaining?'CUP TIED':'CUP TIED · TIME DECIDES';
  else if(lead>0)status=`CUP LEAD +${lead}`;
  else status=-lead<=4?'WIN THE NEXT RACE TO TAKE THE CUP LEAD':`CUP TRAILING BY ${-lead} · NEED ${Math.ceil(-lead/4)} MORE WINS`;
  return {mine,theirs,lead,place,tied,remaining,status,label:place===1&&!tied?'1st':tied?'TIED':'2nd'};
}
