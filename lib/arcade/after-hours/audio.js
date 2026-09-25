/** Original procedural synth score and cues; no samples or licensed recordings. */
export class AfterHoursAudio{
 constructor(){this.volume=.12;this.lastBeat=-1;this.active=false;}
 unlock(){if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;this.ctx=new Context();this.gain=this.ctx.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.ctx.destination);}this.ctx.resume().catch(()=>{});this.active=true;}
 tone(frequency,duration=.1,type='square',gain=.2,end){if(!this.ctx||!this.active)return;const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,now);if(end)o.frequency.exponentialRampToValueAtTime(end,now+duration);g.gain.setValueAtTime(gain,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(this.gain);o.start();o.stop(now+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
 update(s){const beat=Math.floor(s.tick/9);if(beat!==this.lastBeat){this.lastBeat=beat;const notes=s.kind==='mall'?[82,82,110,98,73,73,98,110]:[55,55,58,55,73,55,49,58];this.tone(notes[Math.floor(beat/2)%8],.1,'sawtooth',.05);if(beat%4===0)this.tone(110,.14,'sine',.3,32);if(beat%4===2)this.tone(175,.06,'triangle',.12,40);}
 for(const e of s.events){if(['shot','smash','bail','hurt'].includes(e.type))this.tone(e.type==='shot'?170:90,.13,'sawtooth',.22,22);else if(['secret','bank','kill'].includes(e.type)){this.tone(440,.18,'triangle',.18);this.tone(660,.25,'triangle',.1);}else if(e.type==='warning')this.tone(880,.2,'square',.08);else if(e.type==='trick')this.tone(220+s.combo?.mult*24,.08,'triangle',.08);}}
 setVolume(value){this.volume=value;if(this.gain)this.gain.gain.value=value;}
 pause(value){this.active=!value;}
 dispose(){this.active=false;this.ctx?.close().catch(()=>{});}
}
