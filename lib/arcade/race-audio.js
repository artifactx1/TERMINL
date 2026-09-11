/** Original synthesized racer audio. No recordings, external samples or autoplay. */
import { RumbleAudio } from './rumble-audio.js';

export const RACE_SOUND_CUES=Object.freeze(['countdown','go','checkpoint','lap','drift','boost','wall','reset','finish','cup']);
export class RaceAudio extends RumbleAudio {
  constructor(){super();this.engine=null;this.engineGain=null;this.tires=null;this.tireGain=null;this.lastCheckpoint=null;this.lastCount=null;this.boosting=false;this.track='night-market';this.phase='menu';}
  async unlock(){
    const ready=await super.unlock();if(!ready||this.engine)return ready;
    const ctx=this.context;this.engine=ctx.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=52;this.engineGain=ctx.createGain();this.engineGain.gain.value=0;
    this.engineFilter=ctx.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=420;this.engine.connect(this.engineFilter);this.engineFilter.connect(this.engineGain);this.engineGain.connect(this.sfx);this.engine.start();
    this.tires=ctx.createBufferSource();this.tires.buffer=this.noiseBuffer;this.tires.loop=true;this.tireFilter=ctx.createBiquadFilter();this.tireFilter.type='bandpass';this.tireFilter.frequency.value=2300;this.tireFilter.Q.value=2;
    this.tireGain=ctx.createGain();this.tireGain.gain.value=0;this.tires.connect(this.tireFilter);this.tireFilter.connect(this.tireGain);this.tireGain.connect(this.sfx);this.tires.start();return ready;
  }
  schedule(){
    if(!this.context||this.context.state!=='running'||this.paused||this.disposed||!['countdown','racing'].includes(this.phase))return;
    const now=this.context.currentTime;if(this.nextBeat<now-.4)this.nextBeat=now+.02;const step=60/126/2,notes=[0,0,7,10,0,3,7,12,0,0,7,5,3,3,10,7];
    while(this.nextBeat<now+.14){const t=this.nextBeat,n=this.beat%16,root=this.track==='liquidation-docks'?36:38;const hz=v=>440*Math.pow(2,(v-69)/12);
      if(this.volumes.music>0){this.tone(hz(root+notes[n]),step*.75,'triangle',.14,t,0,'music');if(n%4===0)this.tone(105,.11,'sine',.3,t,34,'music');if(n%4===2)this.noise(.085,.09,1600,t,'music');if(n%2)this.noise(.035,.055,6500,t,'music');if(n===0)[0,7,10].forEach((v,i)=>this.tone(hz(root+12+v),.8,'sine',.04,t+i*.02,0,'music'));}
      this.nextBeat+=step;this.beat++;
    }
  }
  audition(type){
    if(!this.context||this.paused)return;const t=this.context.currentTime;
    switch(type){
      case 'countdown':this.tone(440,.16,'square',.12);break;
      case 'go':[440,660,880].forEach((f,i)=>this.tone(f,.18,'triangle',.25,t+i*.06));break;
      case 'checkpoint':this.tone(780,.06,'sine',.14);this.tone(1040,.08,'sine',.1,t+.035);break;
      case 'lap':[520,650,780].forEach((f,i)=>this.tone(f,.2,'triangle',.23,t+i*.08));break;
      case 'drift':this.tone(300,.18,'triangle',.18,t,1100);this.noise(.12,.08,3600);break;
      case 'boost':this.noise(.45,.18,800);this.tone(80,.35,'sawtooth',.10,t,210);break;
      case 'wall':this.noise(.12,.36,760);this.tone(90,.13,'sine',.4,t,30);break;
      case 'reset':this.tone(460,.3,'triangle',.18,t,90);break;
      case 'finish':case 'cup':super.audition('win');break;
      default:super.audition(type);
    }
  }
  update(state,slot=0){
    if(!state||this.disposed)return;const p=state.players?.[slot]||state.players?.[0];if(!p)return;
    if(state.tick<this.lastTick){this.seen.clear();this.lastCheckpoint=null;this.lastCount=null;this.boosting=false;}
    this.lastTick=state.tick;this.track=state.track;this.phase=state.phase;
    if(this.context&&this.engine){const t=this.context.currentTime,active=this.phase==='racing'&&p.finishedTick===null;
      const rpm=52+Math.max(0,p.speed)*19+(p.boosting?32:0);this.engine.frequency.setTargetAtTime(rpm,t,.07);this.engineFilter.frequency.setTargetAtTime(260+p.speed*100,t,.10);this.engineGain.gain.setTargetAtTime(active?.035+Math.min(.065,p.speed*.01):0,t,.08);this.tireGain.gain.setTargetAtTime(active&&p.drifting?.10:0,t,.05);
    }
    const count=this.phase==='countdown'?Math.ceil((180-state.phaseTick)/60):null;
    if(count!==null&&count!==this.lastCount&&count>0)this.audition('countdown');this.lastCount=count;
    if(this.lastCheckpoint!==null&&p.passed>this.lastCheckpoint&&this.phase==='racing')this.audition('checkpoint');this.lastCheckpoint=p.passed;
    if(p.boosting&&!this.boosting)this.audition('boost');this.boosting=p.boosting;
    for(const e of state.events||[]){if(this.seen.has(e.id))continue;this.seen.add(e.id);if(state.tick-e.tick>18)continue;if(e.player===slot||['go','cup'].includes(e.type))this.audition(e.type);}
    if(this.seen.size>1024)this.seen=new Set([...this.seen].slice(-512));this.schedule();
  }
  dispose(){
    if(this.disposed)return;for(const source of [this.engine,this.tires]){try{source?.stop();}catch{}source?.disconnect();}this.engineFilter?.disconnect();this.tireFilter?.disconnect();this.engineGain?.disconnect();this.tireGain?.disconnect();this.engine=null;this.tires=null;super.dispose();
  }
}
