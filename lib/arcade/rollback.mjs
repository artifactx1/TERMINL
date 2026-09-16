import {createFight,stepFight,stateHash} from './rumble-sim.mjs';

export const ROLLBACK_WINDOW=12;
export const HISTORY_LIMIT=120;
export const FUTURE_WINDOW=6;
const FIGHT_RULES={id:'rekt-rumble',create:createFight,step:stepFight,hash:stateHash,maxInput:2047};

/** Authoritative bounded rollback. Input tick t drives state t -> t+1.
 * Missing inputs repeat the last accepted held mask. Inputs are sequence checked,
 * and render/audio consumers deduplicate deterministic event IDs after correction.
 */
export class RollbackFight {
  constructor(options={},rules=FIGHT_RULES) {
    this.rules=rules;
    this.options=structuredClone(options);
    this.state=rules.create(options);
    this.history=new Map([[0,structuredClone(this.state)]]);
    this.timeline=new Map();
    this.lastSeq=[-1,-1];
    this.held=[0,0];
    this.finishedAt=null;
    this.corrections=0;
  }
  get confirmed(){return this.state.phase==='finished'&&this.finishedAt!==null&&this.state.tick-this.finishedAt>=ROLLBACK_WINDOW;}
  get clock(){return this.state.tick;}
  get confirmedTick(){return Math.max(0,this.state.tick-ROLLBACK_WINDOW);}
  get acks(){return [...this.lastSeq];}
  forceNeutral(slot) {
    if(slot!==0&&slot!==1)throw new Error('Unknown input slot');
    for(const [tick,entry] of this.timeline)if(tick>=this.clock){entry[slot]=null;if(entry.every(x=>x===null))this.timeline.delete(tick);}
    const entry=this.timeline.get(this.clock)||[null,null];entry[slot]={input:0,seq:this.lastSeq[slot]};this.timeline.set(this.clock,entry);this.held[slot]=0;
  }
  submit(slot,tick,input,seq) {
    if(slot!==0&&slot!==1)return {ok:false,reason:'slot'};
    if(!Number.isSafeInteger(tick)||tick<0||!Number.isInteger(input)||input<0||input>this.rules.maxInput||!Number.isSafeInteger(seq)||seq<0)return {ok:false,reason:'schema'};
    if(this.confirmed)return {ok:false,reason:'confirmed'};
    if(seq<=this.lastSeq[slot])return {ok:false,reason:'sequence'};
    if(tick<this.state.tick-ROLLBACK_WINDOW)return {ok:false,reason:'late'};
    if(tick>this.state.tick+FUTURE_WINDOW)return {ok:false,reason:'future'};
    if(tick<this.state.tick&&!this.history.has(tick))return {ok:false,reason:'history'};
    const entry=this.timeline.get(tick)||[null,null];
    entry[slot]={input,seq};this.timeline.set(tick,entry);this.lastSeq[slot]=seq;
    const rolledBack=tick<this.state.tick;
    if(rolledBack)this.rewind(tick);
    return {ok:true,rolledBack,tick:this.state.tick,hash:this.rules.hash(this.state)};
  }
  heldBefore(tick) {
    const inputs=[0,0],latest=[-1,-1];
    for(const [t,entry] of this.timeline) if(t<tick) for(let slot=0;slot<2;slot++) if(entry[slot]&&t>latest[slot]){inputs[slot]=entry[slot].input;latest[slot]=t;}
    return inputs;
  }
  rewind(tick) {
    const target=this.state.tick;
    this.state=structuredClone(this.history.get(tick));this.held=this.heldBefore(tick);
    if(this.finishedAt!==null&&this.finishedAt>tick)this.finishedAt=null;
    for(const key of this.history.keys())if(key>tick)this.history.delete(key);
    while(this.state.tick<target)this.advance();
    this.corrections++;
  }
  advance(inputs) {
    if(inputs)for(let slot=0;slot<2;slot++)this.submit(slot,this.state.tick,inputs[slot]||0,this.lastSeq[slot]+1);
    const entry=this.timeline.get(this.state.tick);
    if(entry)for(let slot=0;slot<2;slot++)if(entry[slot])this.held[slot]=entry[slot].input;
    this.state=this.rules.step(this.state,this.held);
    if(this.state.phase==='finished'&&this.finishedAt===null)this.finishedAt=this.state.tick;
    this.history.set(this.state.tick,structuredClone(this.state));
    for(const tick of this.history.keys())if(tick<this.state.tick-HISTORY_LIMIT)this.history.delete(tick);
    return this.state;
  }
  exportReplay() {
    return {version:1,game:this.rules.id,...(this.rules.id==='wen-lambo'?{rulesVersion:this.state.version}:{}),options:structuredClone(this.options),ticks:this.state.tick,
      inputs:[...this.timeline].sort((a,b)=>a[0]-b[0]).map(([tick,slots])=>({tick,slots:structuredClone(slots)})),
      hash:this.rules.hash(this.state),confirmed:this.confirmed,winner:this.confirmed?this.state.winner:null};
  }
}

export function replayFight(replay,rules=FIGHT_RULES) {
  const limit=rules.id==='wen-lambo'?48000:21000;
  const maxInput=rules.id==='wen-lambo'&&(replay?.rulesVersion??1)<4?127:rules.maxInput;
  if(replay?.version!==1||replay.game!==rules.id||!Number.isInteger(replay.ticks)||replay.ticks<0||replay.ticks>limit||!Array.isArray(replay.inputs)||replay.inputs.length>limit)throw new Error('Invalid replay');
  let state=rules.create(rules.id==='wen-lambo'?{...replay.options,rulesVersion:replay.rulesVersion??1}:replay.options),held=[0,0],index=0,previous=-1;
  for(const entry of replay.inputs) {
    if(!Number.isInteger(entry.tick)||entry.tick<=previous||entry.tick>replay.ticks+FUTURE_WINDOW||!Array.isArray(entry.slots)||entry.slots.length!==2)throw new Error('Invalid replay frame');
    for(const item of entry.slots)if(item!==null&&(!Number.isInteger(item.input)||item.input<0||item.input>maxInput))throw new Error('Invalid replay input');
    previous=entry.tick;
  }
  while(state.tick<replay.ticks) {
    const entry=replay.inputs[index];
    if(entry&&entry.tick===state.tick){for(let slot=0;slot<2;slot++)if(entry.slots[slot])held[slot]=entry.slots[slot].input;index++;}
    state=rules.step(state,held);
  }
  return state;
}
