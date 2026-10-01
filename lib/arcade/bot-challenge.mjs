import {createRace,stepRace,raceBotInput,RACE_RULES_VERSION,CUP_TRACKS} from './race-sim.mjs';
import {RACE_MAX_INPUT} from './race-input.mjs';
import {BARRY,CHALLENGE_VERSION,POINTS,checkReplay} from './campaign-rules.mjs';

/** One race plus the standings and countdown that precede it. Races end at 7200 ticks. */
export const CUP_SEGMENT_TICKS=8000;
export function cupSnapshot(config,seed){
  return {version:CHALLENGE_VERSION,kind:'cup',rulesVersion:RACE_RULES_VERSION,track:config.track,vehicle:config.vehicle,botVehicle:config.botVehicle,races:CUP_TRACKS.length,
    bot:{id:BARRY.id,name:BARRY.name,seed:seed>>>0,vehicle:config.botVehicle,pace:config.botPace,cornerPace:.93,boostChance:.3,line:8,mistakeRate:.16,reactionTicks:24}};
}
export function createChallengeRace(challenge){
  if(challenge.version!==CHALLENGE_VERSION||challenge.kind!=='cup'||challenge.rulesVersion!==RACE_RULES_VERSION)throw new Error('This challenge version has expired. Start a new run.');
  return createRace({track:challenge.track,vehicles:[challenge.vehicle,challenge.botVehicle],cup:true});
}
/** A cup segment ends on the tick a race result is recorded. The server keeps the
 * state between segments, so each submission replays one race, not the whole cup. */
export const cupSegmentDone=(state,racesBefore)=>state.raceResults.length>racesBefore;
export function cupSegment(challenge,previous,replay){
  checkReplay(replay,CUP_SEGMENT_TICKS,RACE_MAX_INPUT);
  let state=previous||createChallengeRace(challenge),ticks=0;
  const racesBefore=state.raceResults.length;
  if(state.phase==='finished')throw new Error('This cup is already complete');
  replay:for(const [duration,input]of replay)for(let i=0;i<duration;i++){
    if(cupSegmentDone(state,racesBefore))break replay;
    state=stepRace(state,[input,raceBotInput(state,1,challenge.bot)]);ticks++;
  }
  if(!cupSegmentDone(state,racesBefore))throw new Error('Finish the race before submitting');
  // Final standings ignore input; settle the cup instead of waiting for another submission.
  if(state.raceResults.length===state.tracks.length)while(state.phase!=='finished')state=stepRace(state,[0,0]);
  const race=state.raceResults.at(-1),won=race.order[0]===0&&race.times[0]!==null&&race.times[0]!==race.times[1];
  let points=won?POINTS.raceWin:0,result=null;
  if(state.phase==='finished'){
    const qualified=state.winner===0;if(qualified)points+=POINTS.cupWin;
    result={kind:'cup',qualified,winner:state.winner,points:state.players.map(p=>p.points),cupTicks:state.players.map(p=>p.cupTime),
      races:state.raceResults.map(r=>({track:r.track,times:r.times,order:r.order})),vehicle:challenge.vehicle,track:challenge.track};
  }
  return {state,ticks,points,segment:{race:state.raceResults.length-1,track:race.track,times:race.times,won},result};
}
export const cupProgress=state=>state?{races:state.raceResults.length,points:state.players.map(p=>p.points)}:{races:0,points:[0,0]};
