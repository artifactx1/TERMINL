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
