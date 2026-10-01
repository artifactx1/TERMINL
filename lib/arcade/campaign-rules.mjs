/** Campaign rules shared by the arcade service, the games and the campaign pages.
 * No simulation imports here: each game page loads only its own verifier. */
export const CHALLENGE_VERSION=2;
export const DEFAULT_CAMPAIGN=Object.freeze({
  active:false,name:'Beat the Bots',startsAt:0,endsAt:0,
  cupEnabled:true,rumbleEnabled:true,
  track:'night-market',vehicle:'comet',botVehicle:'spectre',botPace:.82,
  capacity:0,addressStartsAt:0,addressEndsAt:0,
  gtdSlots:100,gtdEndsAt:0,gtdAddressEndsAt:0,
  chainId:4663,announcementUrl:'',
});
/** Clearing any route earns the account its one FCFS WL spot; clearing another route
 * is recorded and scores points. `sprint` is the retired single-race challenge;
 * spots saved under it remain honored. */
export const ROUTES=Object.freeze({
  cup:Object.freeze({id:'cup',name:'Barry Cup',short:'CUP',game:'Wen Lambo',task:'Beat BarryBot on points across all six courses.',href:'/os/lambo'}),
  rumble:Object.freeze({id:'rumble',name:'Rekt Rumble Circuit',short:'RUMBLE',game:'Rekt Rumble',task:'Win all six fights in one official circuit.',href:'/os/rumble'}),
  sprint:Object.freeze({id:'sprint',name:'Barry Sprint',short:'SPRINT',game:'Wen Lambo',task:'Original single-race challenge (retired).',href:null,legacy:true}),
});
export const OPEN_ROUTES=Object.freeze(['cup','rumble']);
export const POINTS=Object.freeze({raceWin:10,cupWin:50,fightWin:10,circuitClear:50,legacySprint:10});
export const BARRY=Object.freeze({
  id:'barrybot',name:'BARRYBOT',portrait:'diamond-hands-pepe',
  taunt:'My bags are slow. I’m not.',
  beaten:'Barry would like a recount.',
  won:'Barry has already posted the screenshot.',
});
/** Capacity 0 means FCFS spots are unlimited; otherwise later saves are waitlisted. */
export const poolFull=(config,confirmed)=>!!config.capacity&&confirmed>=config.capacity;
export function campaignOpen(config,now=Date.now()){
  return config.active&&now>=config.startsAt&&(!config.endsAt||now<config.endsAt);
}
export function routeOpen(config,route,now=Date.now()){
  return campaignOpen(config,now)&&(route==='cup'?config.cupEnabled:route==='rumble'?config.rumbleEnabled:false);
}
export function addressWindow(config,now=Date.now()){
  const startsAt=config.addressStartsAt||0,endsAt=config.addressEndsAt||0;
  return {
    open:(!startsAt||now>=startsAt)&&(!endsAt||now<endsAt),
    frozen:!!endsAt&&now>=endsAt,
    scheduled:!!startsAt||!!endsAt,
  };
}
/** Deterministic 32-bit mix: the same seed and index give the same value on the
 * server and in the browser. */
export function mixSeed(seed,index){
  let n=(seed^Math.imul(index+1,0x9e3779b9))>>>0;
  n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);
  return (n^(n>>>15))>>>0;
}
export function captureInput(replay,input){
  const last=replay.at(-1);if(last&&last[1]===input)last[0]++;else replay.push([1,input]);
}
/** Run-length frames [ticks,input]. Bounded before any simulation work. */
export function checkReplay(replay,maxTicks,maxInput){
  if(!Array.isArray(replay)||!replay.length||replay.length>maxTicks)throw new Error('Invalid replay');
  let ticks=0;
  for(const frame of replay){
    if(!Array.isArray(frame)||frame.length!==2||!Number.isInteger(frame[0])||frame[0]<1||!Number.isInteger(frame[1])||frame[1]<0||frame[1]>maxInput)throw new Error('Invalid replay input');
    ticks+=frame[0];if(ticks>maxTicks)throw new Error('Replay too long');
  }
}
/** The frames the simulation consumed, so trailing input cannot vary a fingerprint. */
export function canonicalReplay(replay,ticks){
  if(!Number.isInteger(ticks)||ticks<1)throw new Error('Invalid replay length');
  const canonical=[];let remaining=ticks;
  for(const [duration,input]of replay){
    if(!remaining)break;
    const used=Math.min(duration,remaining),last=canonical.at(-1);
    if(last&&last[1]===input)last[0]+=used;else canonical.push([used,input]);
    remaining-=used;
  }
  if(remaining)throw new Error('Replay ended before the result');
  return canonical;
}
export function raceTime(ticks){if(ticks===null||ticks===undefined)return 'DNF';const ms=Math.round(ticks*1000/60);return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
/** Spot rows: the account's FCFS spot carries its status; further route clears are `cleared`. */
export const FCFS_STATUSES=Object.freeze(['qualified','review','waitlist','banned']);
export const spotLabel=status=>status==='qualified'?'FCFS WL SPOT':status==='review'?'UNDER REVIEW':status==='waitlist'?'WAITLIST · POOL FULL':status==='banned'?'SUSPENDED':status==='cleared'?'CLEARED':'NOT EARNED';
/** GTD spots go to the top of the leaderboard when the marketing period closes. */
export const GTD_NOTE='GTD (guaranteed) WL spots are reserved for their holders during the WL phase.';
export function gtdWindow(config,finalized,now=Date.now()){
  return {scheduled:!!config.gtdEndsAt&&config.gtdSlots>0,closed:!!finalized,
    submitOpen:!!finalized&&(!config.gtdAddressEndsAt||now<config.gtdAddressEndsAt)};
}
export const FCFS_NOTE='FCFS (first come, first served) WL spots let you mint during the WL phase while supply lasts. One per person. They are not GTD: an FCFS spot does not reserve an NFT.';
/** One line describing a verified official result, for cards, passes and challenge pages. */
export function resultSummary(kind,result){
  if(!result)return '';
  if(kind==='cup')return `${result.points[0]}–${result.points[1]} PTS VS BARRYBOT`;
  if(kind==='rumble')return `6/6 FIGHTS · ${result.losses} ${result.losses===1?'RETRY':'RETRIES'}`;
  return `${raceTime(result.playerTicks)} VS BARRYBOT`;
}
