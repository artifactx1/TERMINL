import {createFight,stepFight,CHARACTERS,RUMBLE_RULES_VERSION} from './rumble-sim.mjs';
import {CIRCUIT_LENGTH,circuitOpponent,circuitStage,circuitInput} from './rumble-circuit.mjs';
import {CHALLENGE_VERSION,POINTS,checkReplay,mixSeed} from './campaign-rules.mjs';

/** Five rounds plus intro, intermissions and a finisher fit well inside this bound. */
export const FIGHT_SEGMENT_TICKS=30000;
export const FIGHT_MAX_INPUT=2047;
/** A circuit can be retried fight by fight, but not indefinitely. */
export const CIRCUIT_MAX_ATTEMPTS=60;
export function rumbleSnapshot(character,seed){
  if(!Object.hasOwn(CHARACTERS,character))throw new Error('Unknown fighter');
  return {version:CHALLENGE_VERSION,kind:'rumble',rulesVersion:RUMBLE_RULES_VERSION,character,seed:seed>>>0,fights:CIRCUIT_LENGTH};
}
export const rumbleStart=()=>({index:0,attempts:0,fights:[]});
/** The next official fight. Each attempt gets its own bot timing seed. */
export function circuitFight(challenge,progress){
  if(challenge.version!==CHALLENGE_VERSION||challenge.kind!=='rumble'||challenge.rulesVersion!==RUMBLE_RULES_VERSION)throw new Error('This challenge version has expired. Start a new run.');
  const circuit={version:1,character:challenge.character,index:progress.index,complete:false};
  return {circuit,seed:mixSeed(challenge.seed,progress.attempts),
    state:createFight({characters:[challenge.character,circuitOpponent(circuit)],stage:circuitStage(circuit),rulesVersion:challenge.rulesVersion})};
}
export function rumbleSegment(challenge,previous,replay){
  checkReplay(replay,FIGHT_SEGMENT_TICKS,FIGHT_MAX_INPUT);
  const progress=previous||rumbleStart();
  if(progress.index>=CIRCUIT_LENGTH)throw new Error('This circuit is already complete');
  if(progress.attempts>=CIRCUIT_MAX_ATTEMPTS)throw new Error('This circuit has used all its attempts. Start a new circuit.');
  let {circuit,seed,state}=circuitFight(challenge,progress),ticks=0;
  replay:for(const [duration,input]of replay)for(let i=0;i<duration;i++){
    if(state.phase==='finished')break replay;
    state=stepFight(state,[input,circuitInput(state,circuit,seed)]);ticks++;
  }
  if(state.phase!=='finished')throw new Error('Finish the fight before submitting');
  const won=state.winner===0,opponent=circuitOpponent(circuit);
  const next={index:progress.index+(won?1:0),attempts:progress.attempts+1,fights:[...progress.fights,{index:progress.index,opponent,won,ticks,wins:state.wins}]};
  let points=won?POINTS.fightWin:0,result=null;
  if(next.index===CIRCUIT_LENGTH){
    points+=POINTS.circuitClear;
    const wins=next.fights.filter(f=>f.won);
    result={kind:'rumble',qualified:true,character:challenge.character,attempts:next.attempts,losses:next.attempts-wins.length,
      fightTicks:wins.reduce((total,f)=>total+f.ticks,0),opponents:wins.map(f=>f.opponent)};
  }
  return {state:next,ticks,points,segment:{index:progress.index,opponent,won,wins:state.wins},result};
}
export const rumbleProgress=progress=>({index:progress?.index||0,attempts:progress?.attempts||0});
