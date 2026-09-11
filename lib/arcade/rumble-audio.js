/** Original procedural score and effects. No samples, voice, or external audio. */
const limit=(v)=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):0));
const NOTES=[0,7,10,14,7,3,10,5,0,7,12,10,3,7,5,2];
const hz=(note)=>440*Math.pow(2,(note-69)/12);
export const SOUND_CUES=Object.freeze(['ui','light','heavy','block','armor','throw','tech','jump','land','dash','special','super','warning','fight','win','loss']);

export class RumbleAudio {
  constructor(){
    this.context=null;this.music=null;this.sfx=null;this.output=null;
    this.volumes={music:.3,sfx:.65};this.seen=new Set();this.voices=new Set();
    this.stage='dead-mall';this.phase='intro';this.lastTick=0;this.nextBeat=0;this.beat=0;
    this.disposed=false;this.timer=null;this.noiseBuffer=null;this.paused=false;
  }
  /** Call from a click/keydown/pointerdown only; browsers own gesture permission. */
  async unlock(){
    if(this.disposed||typeof window==='undefined')return false;
    try{
      if(!this.context){
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
        this.context=new Audio();this.output=this.context.createGain();this.output.gain.value=.42;
        const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=15;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.18;
        this.output.connect(compressor);compressor.connect(this.context.destination);this.compressor=compressor;
        this.music=this.context.createGain();this.sfx=this.context.createGain();this.music.connect(this.output);this.sfx.connect(this.output);this.setVolumes(this.volumes);
        const noiseRate=Math.min(96000,this.context.sampleRate),length=Math.round(noiseRate*.6),buffer=this.context.createBuffer(1,length,noiseRate),values=buffer.getChannelData(0);let seed=737;
        for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values[i]=(seed/4294967296)*2-1;}
        this.noiseBuffer=buffer;this.timer=window.setInterval(()=>this.schedule(),70);
      }
      await this.context.resume();this.nextBeat=this.context.currentTime+.04;return this.context.state==='running';
    }catch{return false;}
  }
  setVolumes({music=this.volumes.music,sfx=this.volumes.sfx}={}){
    this.volumes={music:limit(music),sfx:limit(sfx)};
    if(this.context){const t=this.context.currentTime;this.music?.gain.setTargetAtTime(this.volumes.music,t,.02);this.sfx?.gain.setTargetAtTime(this.volumes.sfx,t,.02);}
  }
  setPaused(paused){this.paused=!!paused;if(this.context){this.output.gain.setTargetAtTime(this.paused?0:.42,this.context.currentTime,.03);this.nextBeat=this.context.currentTime+.05;}}
  voice(node,gain,until){
    if(this.voices.size>=40){node.disconnect();gain.disconnect();return false;}
    const voice={node,gain};this.voices.add(voice);node.onended=()=>{node.disconnect();gain.disconnect();this.voices.delete(voice);};node.start(until.start);node.stop(until.end);return true;
  }
  tone(frequency,duration=.12,type='triangle',volume=.3,when,slide=0,bus='sfx'){
    if(!this.context||this.context.state!=='running'||this.disposed)return;
    const t=Math.max(when??this.context.currentTime,this.context.currentTime),osc=this.context.createOscillator(),gain=this.context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(Math.max(20,frequency),t);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),t+.007);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(bus==='music'?this.music:this.sfx);this.voice(osc,gain,{start:t,end:t+duration+.025});
  }
  noise(duration=.12,volume=.2,frequency=1600,when,bus='sfx'){
    if(!this.context||this.context.state!=='running'||this.disposed)return;
    const t=Math.max(when??this.context.currentTime,this.context.currentTime),source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
    source.buffer=this.noiseBuffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;source.connect(filter);filter.connect(gain);gain.connect(bus==='music'?this.music:this.sfx);gain.gain.setValueAtTime(Math.max(.0001,volume),t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    if(this.voices.size>=40){source.disconnect();filter.disconnect();gain.disconnect();return;}
    const voice={node:source,gain,filter};this.voices.add(voice);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices.delete(voice);};source.start(t);source.stop(t+duration+.01);
  }
  schedule(){
    if(!this.context||this.context.state!=='running'||this.paused||this.disposed||this.phase==='finished')return;
    const now=this.context.currentTime;if(this.nextBeat<now-.4)this.nextBeat=now+.02;
    const beatTime=60/104/2;
    while(this.nextBeat<now+.14){
      const t=this.nextBeat,n=this.beat%16,root=this.stage==='laundromat'?38:40;
      if(this.volumes.music>0){
        this.tone(hz(root+NOTES[n]),beatTime*.75,'triangle',.12,t,0,'music');
        if(n%4===0){this.tone(hz(root-12+(n===12?3:0)),.42,'sine',.32,t,0,'music');this.tone(95,.12,'sine',.3,t,38,'music');}
        if(n%4===2)this.noise(.09,.11,1700,t,'music');
        if(n%2===1)this.noise(.035,.065,6400,t,'music');
        if(n===0){[0,7,10].forEach((v,i)=>this.tone(hz(root+12+v),1.2,'sine',.045,t+i*.014,0,'music'));}
        // Tiny mechanical ambience between phrases: vent in mall, drum in wash.
        if(n===12)this.noise(.35,.018,this.stage==='laundromat'?340:130,t,'music');
      }
      this.beat++;this.nextBeat+=beatTime;
    }
  }
  audition(type){
    if(!this.context||this.paused)return;
    const t=this.context.currentTime;
    switch(type){
      case 'ui':this.tone(640,.06,'triangle',.2);this.tone(960,.08,'sine',.12,t+.045);break;
      case 'hit':case 'light':this.tone(160,.1,'sine',.65,t,55);this.noise(.09,.38,1400);break;
      case 'heavy':this.tone(110,.2,'sine',.8,t,30);this.noise(.16,.5,900);this.tone(240,.05,'square',.1);break;
      case 'armor':this.tone(290,.14,'triangle',.32);this.tone(475,.18,'sine',.25);this.noise(.06,.2,3800);break;
      case 'block':this.tone(310,.09,'triangle',.35);this.tone(820,.1,'sine',.2);this.noise(.06,.23,3200);break;
      case 'throw':this.noise(.18,.4,560);this.tone(100,.28,'sine',.7,t+.06,28);this.noise(.12,.3,1200,t+.08);break;
      case 'tech':this.tone(430,.1,'square',.17);this.tone(860,.14,'triangle',.25,t+.04);break;
      case 'jump':this.tone(100,.13,'triangle',.18,t,350);this.noise(.06,.1,1200);break;
      case 'land':this.tone(75,.09,'sine',.25);this.noise(.065,.16,600);break;
      case 'dash':this.noise(.16,.26,1900);this.tone(170,.13,'sine',.1,t,90);break;
      case 'special':case 'super':this.tone(150,.28,'sawtooth',.14,t,900);[0,4,7].forEach((v,i)=>this.tone(hz(57+v),.25,'triangle',.16,t+.1+i*.04));this.noise(.25,.2,2600,t+.13);break;
      case 'warning':for(let i=0;i<3;i++)this.tone(690,.08,'square',.12,t+i*.14);break;
      case 'fight':[40,47,52].forEach((v,i)=>this.tone(hz(v),.17,'sawtooth',.18,t+i*.1));break;
      case 'roundWin':case 'finish':case 'win':[52,55,59,64].forEach((v,i)=>this.tone(hz(v),.38,'triangle',.3,t+i*.13));break;
      case 'loss':[52,49,45,40].forEach((v,i)=>this.tone(hz(v),.4,'triangle',.25,t+i*.16));break;
      default:break;
    }
  }
  /** Dedup authoritative event IDs, including repeated/rollback snapshots. */
  update(state){
    if(!state||this.disposed)return;
    if(state.tick<5&&this.lastTick>120){this.seen.clear();this.beat=0;}
    this.lastTick=state.tick;this.stage=state.stage;this.phase=state.phase;
    for(const e of state.events||[]){
      if(this.seen.has(e.id))continue;this.seen.add(e.id);
      if(state.tick-e.tick>18)continue;
      if(e.type==='hit')this.audition(/1[2-9]\d|[2-9]\d\d/.test(e.text||'')?'heavy':'light');
      else this.audition(e.type);
    }
    if(this.seen.size>2048)this.seen=new Set([...this.seen].slice(-1024));
    this.schedule();
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    if(this.timer!==null&&typeof window!=='undefined')window.clearInterval(this.timer);
    for(const v of this.voices){try{v.node.stop();}catch{}v.node.disconnect();v.gain.disconnect();v.filter?.disconnect();}
    this.voices.clear();this.music?.disconnect();this.sfx?.disconnect();this.output?.disconnect();this.compressor?.disconnect();
    if(this.context&&this.context.state!=='closed')this.context.close().catch(()=>{});
    this.context=null;this.noiseBuffer=null;this.seen.clear();
  }
}
