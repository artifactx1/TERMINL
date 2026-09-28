const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function skateSoundState(s){
 const p=s.player,speed=clamp(p.speed||0,0,35),moving=s.phase==='playing'&&!p.bail&&speed>.4;
 return {
  roll:moving&&p.grounded&&!p.rail?Math.min(1,speed/25)*.1*(p.manual?.65:1):0,
  grind:moving&&p.rail?Math.min(1,speed/25)*.14:0,
  rollHz:160+speed*21,grindHz:1400+speed*36,
 };
}

/** Reusable contact sounds plus short deck impacts, synthesized without samples. */
export class SkateAudio{
 constructor(context,output){
  this.ctx=context;this.voices=new Set();this.targets=new Map();
  this.gate=context.createGain();this.gate.gain.value=0;this.gate.connect(output);
  this.buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
  const samples=this.buffer.getChannelData(0);let seed=619;
  for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/2147483648-1;}
  this.roll=this.loop(300,.5,0);this.grind=this.loop(1900,.7,.41);
 }
 loop(frequency,q,offset){
  const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
  source.buffer=this.buffer;source.loop=true;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;
  source.connect(filter);filter.connect(gain);gain.connect(this.gate);source.start(this.ctx.currentTime,offset);
  return {source,filter,gain};
 }
 target(param,value,time=.025){
  if(this.targets.get(param)===value)return;
  this.targets.set(param,value);param.setTargetAtTime(value,this.ctx.currentTime,time);
 }
 burst(frequency,duration,level){
  if(this.voices.size>=8)return;
  const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain(),now=this.ctx.currentTime;
  source.buffer=this.buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter);filter.connect(gain);gain.connect(this.gate);
  const voice={source,filter,gain};this.voices.add(voice);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices.delete(voice);};
  source.start(now,.7);source.stop(now+duration);
 }
 update(s){
  if(s.phase!=='playing'){this.pause();return;}
  const sound=skateSoundState(s);
  this.target(this.gate.gain,1,.008);
  this.target(this.roll.gain.gain,sound.roll);this.target(this.grind.gain.gain,sound.grind);
  this.target(this.roll.filter.frequency,Math.round(sound.rollHz/10)*10,.05);
  this.target(this.grind.filter.frequency,Math.round(sound.grindHz/20)*20,.05);
  if(this.lastEventTick===s.tick)return;this.lastEventTick=s.tick;
  for(const event of s.events||[]){
   if(event.type==='jump')this.burst(850,.065,.22);
   else if(event.type==='land')this.burst(event.surface==='rail'?2400:650,.09,.18+clamp(event.strength||0,0,1)*.14);
   else if(event.type==='bail')this.burst(450,.18,.28);
  }
 }
 pause(){this.target(this.gate.gain,0,.008);this.target(this.roll.gain.gain,0);this.target(this.grind.gain.gain,0);}
 dispose(){
  for(const {source,filter,gain}of [this.roll,this.grind,...this.voices]){source.onended=null;source.stop();source.disconnect();filter.disconnect();gain.disconnect();}
  this.voices.clear();this.gate.disconnect();this.targets.clear();this.buffer=null;
 }
}
