import {createRace,stepRace,raceBotInput,RACE_RULES_VERSION,VEHICLES,TRACKS} from './race-sim.mjs';
import {RACE_MAX_INPUT} from './race-input.mjs';

export const CHALLENGE_VERSION=1;
export const MAX_CHALLENGE_TICKS=60*300;
export const DEFAULT_CAMPAIGN=Object.freeze({
  active:false,name:'Beat the Bots',startsAt:0,endsAt:0,
  track:'night-market',vehicle:'comet',botVehicle:'spectre',botPace:.82,
  targetSeconds:180,capacity:2048,addressStartsAt:0,addressEndsAt:0,
  chainId:4663,announcementUrl:'',
});
export const BARRY=Object.freeze({
  id:'barrybot',name:'BARRYBOT',portrait:'diamond-hands-pepe',
  taunt:'My bags are slow. I’m not.',
  beaten:'Barry would like a recount.',
  won:'Barry has already posted the screenshot.',
});
export function campaignConfig(input){
  const c={...DEFAULT_CAMPAIGN,...input};
  if(typeof c.active!=='boolean'||typeof c.name!=='string'||!c.name.trim()||c.name.length>60)throw new Error('Invalid campaign name or state');
  if(!Object.hasOwn(TRACKS,c.track)||!Object.hasOwn(VEHICLES,c.vehicle)||!Object.hasOwn(VEHICLES,c.botVehicle))throw new Error('Unknown track or vehicle');
  if(!Number.isFinite(c.botPace)||c.botPace<.55||c.botPace>1.1)throw new Error('Bot pace must be between 0.55 and 1.1');
  if(!Number.isInteger(c.targetSeconds)||c.targetSeconds<30||c.targetSeconds>300)throw new Error('Target must be 30–300 seconds');
  if(!Number.isInteger(c.capacity)||c.capacity<1||c.capacity>100000)throw new Error('Capacity must be 1–100,000');
  for(const key of ['startsAt','endsAt','addressStartsAt','addressEndsAt'])if(!Number.isSafeInteger(c[key])||c[key]<0)throw new Error('Invalid campaign date');
  if(c.endsAt&&c.endsAt<=c.startsAt||c.addressEndsAt&&c.addressEndsAt<=c.addressStartsAt)throw new Error('Window must end after it starts');
  if(c.chainId!==4663)throw new Error('This campaign accepts Robinhood Chain mainnet addresses');
  if(c.announcementUrl){let url;try{url=new URL(c.announcementUrl);}catch{throw new Error('Invalid announcement URL');}if(url.protocol!=='https:'||!['x.com','www.x.com','terminl.net','www.terminl.net'].includes(url.hostname))throw new Error('Use a TERMINL or X announcement URL');}
  return Object.fromEntries(Object.keys(DEFAULT_CAMPAIGN).map(k=>[k,c[k]]));
}
export function campaignOpen(config,now=Date.now()){
  return config.active&&now>=config.startsAt&&(!config.endsAt||now<config.endsAt);
}
export function challengeSnapshot(config,seed){
  return {version:CHALLENGE_VERSION,rulesVersion:RACE_RULES_VERSION,track:config.track,vehicle:config.vehicle,
    botVehicle:config.botVehicle,targetSeconds:config.targetSeconds,
    bot:{id:BARRY.id,name:BARRY.name,seed:seed>>>0,vehicle:config.botVehicle,pace:config.botPace,cornerPace:.93,boostChance:.3,line:8,mistakeRate:.16,reactionTicks:24}};
}
export function createChallengeRace(challenge){
  if(challenge.version!==CHALLENGE_VERSION||challenge.rulesVersion!==RACE_RULES_VERSION)throw new Error('This challenge version has expired. Start a new run.');
  return createRace({track:challenge.track,vehicles:[challenge.vehicle,challenge.botVehicle],cup:false});
}
export function captureInput(replay,input){
  const last=replay.at(-1);if(last&&last[1]===input)last[0]++;else replay.push([1,input]);
}
export function replayChallenge(challenge,replay){
  if(!Array.isArray(replay)||!replay.length||replay.length>MAX_CHALLENGE_TICKS)throw new Error('Invalid replay');
  let ticks=0;
  for(const frame of replay){
    if(!Array.isArray(frame)||frame.length!==2||!Number.isInteger(frame[0])||frame[0]<1||!Number.isInteger(frame[1])||frame[1]<0||frame[1]>RACE_MAX_INPUT)throw new Error('Invalid replay input');
    ticks+=frame[0];if(ticks>MAX_CHALLENGE_TICKS)throw new Error('Replay too long');
  }
  let state=createChallengeRace(challenge),processed=0;
  for(const [duration,input]of replay)for(let i=0;i<duration;i++){
    if(state.phase==='finished')throw new Error('Replay contains inputs after the result');
    state=stepRace(state,[input,raceBotInput(state,1,challenge.bot)]);processed++;
  }
  if(state.phase!=='finished')throw new Error('Finish the race before submitting');
  const times=state.raceResults[0]?.times;
  const playerTicks=times?.[0]??null,botTicks=times?.[1]??null;
  const qualified=state.winner===0&&playerTicks!==null&&playerTicks<=challenge.targetSeconds*60;
  return {ticks:processed,playerTicks,botTicks,qualified,winner:state.winner,vehicle:challenge.vehicle,track:challenge.track};
}
export function raceTime(ticks){if(ticks===null||ticks===undefined)return 'DNF';const ms=Math.round(ticks*1000/60);return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
