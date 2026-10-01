import {INPUT,moveFor} from './rumble-sim.mjs';

/** Official circuit rival. Same health, damage and rules as the player; it is harder
 * because it reads attacks, guards the right height, punishes recovery and breaks
 * throws. It sees only the shared fight state, never the player's input. Each fight
 * in the circuit tightens its reactions. Deterministic for a given state and seed. */
export const RIVAL_LEVELS=Object.freeze([
  {reaction:13,guard:.6,punish:.55,tech:.25,antiCrouch:.25},
  {reaction:12,guard:.66,punish:.62,tech:.32,antiCrouch:.32},
  {reaction:10,guard:.72,punish:.7,tech:.4,antiCrouch:.4},
  {reaction:9,guard:.78,punish:.76,tech:.46,antiCrouch:.48},
  {reaction:8,guard:.83,punish:.82,tech:.52,antiCrouch:.55},
  {reaction:7,guard:.87,punish:.86,tech:.58,antiCrouch:.62},
].map(Object.freeze));
const OFFENSE=['light','heavy','crouchLight','crouchHeavy','special','forwardSpecial','downSpecial'];
const BUTTON={light:INPUT.LIGHT,heavy:INPUT.HEAVY,crouchLight:INPUT.DOWN|INPUT.LIGHT,crouchHeavy:INPUT.DOWN|INPUT.HEAVY,special:INPUT.SPECIAL,downSpecial:INPUT.DOWN|INPUT.SPECIAL,throw:INPUT.THROW,super:INPUT.SUPER};
/** A stable 0–1 roll for one decision: the same moment always gets the same answer. */
function roll(seed,a,b){
  let n=(seed^Math.imul(a+1,0x9e3779b9)^Math.imul(b+7,0x85ebca6b))>>>0;
  n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);
  return ((n^(n>>>15))>>>0)/4294967296;
}
const free=p=>!p.action&&!p.stun&&!p.blockstun&&!p.knockdown&&p.grounded;
/** The fastest attack that reaches and lands before `window` frames pass. */
function punisher(p,distance,window){
  let best=null;
  for(const id of [...OFFENSE,'super']){
    const m=moveFor(p.character,id);if(!m||m.throw||p.meter<m.cost||m.startup>=window||distance>m.range+15)continue;
    if(!best||m.damage>best.damage)best=m;
  }
  return best;
}
export function rivalInput(s,slot,index,seed){
  const level=RIVAL_LEVELS[Math.max(0,Math.min(5,index))];
  if(s.phase==='finishWindow')return s.finisher.player===slot&&s.phaseTick===40?INPUT.SUPER:0;
  if(s.phase!=='fight')return 0;
  const me=s.players[slot],them=s.players[1-slot],distance=Math.abs(me.x-them.x);
  const toward=me.x<them.x?INPUT.RIGHT:INPUT.LEFT,away=toward===INPUT.RIGHT?INPUT.LEFT:INPUT.RIGHT;
  // Mash to break a throw, on some throws.
  if(me.throwPending)return roll(seed,s.tick-me.throwPending.timer,1)<level.tech?(s.tick%2?INPUT.THROW:0):0;
  if(me.stun||me.knockdown)return 0;
  const attack=them.action&&moveFor(them.character,them.action.id);
  if(attack){
    const frame=them.action.frame,started=s.tick-frame,live=frame<attack.startup+attack.active;
    // Read the attack once the reaction time has passed; whether it is guarded is
    // decided once per attack, so holding a button cannot reroll it.
    if(live&&distance<=attack.range+45&&frame>=level.reaction&&!attack.throw&&roll(seed,started,2)<level.guard){
      if(attack.level==='high')return INPUT.GUARD;
      if(attack.level==='low')return INPUT.GUARD|INPUT.DOWN;
      return INPUT.GUARD|(them.crouching?INPUT.DOWN:0);
    }
    if(live&&attack.throw&&distance<attack.range+30&&frame>=level.reaction&&roll(seed,started,3)<level.guard)return away;
    // Recovery: punish with whatever is fast enough to land in time.
    if(!live&&free(me)){
      const left=attack.startup+attack.active+attack.recovery-frame,m=punisher(me,distance,left);
      if(m&&roll(seed,started,4)<level.punish)return BUTTON[m.id]|(m.id==='forwardSpecial'?toward:0);
      if(!m&&distance>60)return toward;
    }
  }
  if(me.blockstun)return INPUT.GUARD|(them.crouching?INPUT.DOWN:0);
  if(!free(me))return 0;
  // Players who sit crouch-guarding get thrown: crouch guard does not stop a grab.
  if(them.crouching&&!them.action&&distance<60&&roll(seed,s.tick>>3,5)<level.antiCrouch)return INPUT.THROW;
  // Someone walking into grab range gets jumped over or jabbed before the grab lands.
  if(!them.crouching&&!them.action&&distance<64&&roll(seed,s.tick>>2,7)<level.tech+.15)return roll(seed,s.tick>>2,8)<.5?away|INPUT.JUMP:BUTTON.light;
  if(me.meter>=1000&&them.action&&distance<moveFor(me.character,'super').range)return INPUT.SUPER;
  const light=moveFor(me.character,'light'),heavy=moveFor(me.character,'heavy'),beat=roll(seed,s.tick>>4,6);
  // Neutral: hold at the edge of the rival's reach, then poke or close in.
  if(distance>heavy.range+30)return toward|(beat<.08?INPUT.DASH:0);
  if(distance<=light.range+5&&beat<.35)return beat<.12?INPUT.THROW:beat<.24?BUTTON.crouchLight:BUTTON.light;
  if(distance<=heavy.range&&beat>.82)return beat>.92?BUTTON.crouchHeavy:BUTTON.heavy;
  if(beat>.6&&beat<.66)return away;
  return distance>light.range?toward:0;
}
