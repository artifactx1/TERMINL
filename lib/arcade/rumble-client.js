import { stepFight } from "./rumble-sim.mjs";
import { ROLLBACK_WINDOW, FUTURE_WINDOW } from "./rollback.mjs";

const STEP=1000/60;
/* Rejections the authority answers at input rate. They are timing signals, not
 * something to show the player; the client re-aims and keeps going. */
const TRANSIENT=new Set(['input_deadline','duplicate_input','input_rejected','invalid_phase','invalid_input']);
const SEND_BUDGET=110; // packets per second, under the authority's input budget
const PONG_TIMEOUT_MS=8000;

/** WebSocket transport + bounded client prediction. Never grants results. */
export class RumbleClient {
  constructor(url, notify, {game='rekt-rumble',step=stepFight,phase='fight',rulesVersion=1,graceMs=15000}={}) {
    this.rulesVersion=rulesVersion;this.game=game;this.step=step;this.activePhase=phase;this.storageKey=game==='rekt-rumble'?'terminl:rumble-session':'terminl:race-session';
    this.url=url;this.notify=notify;this.socket=null;this.state=null;this.room=null;
    this.seq=0;this.slot=-1;this.input=0;this.rtt=0;this.lastPacket=-1;this.lastInput=null;
    this.snapshotAt=0;this.inputs=[0,0];this.closed=false;this.pending=null;
    this.session=null;this.spectatorJoin=null;this.retries=0;this.frames=[];this.corrections=0;this.joined=false;
    // Timing: the authority's clock is estimated from the last snapshot plus measured
    // round-trip time; `bias` absorbs whatever that estimate still gets wrong, learned
    // from the authority's own clock on each deadline rejection.
    this.bias=0;this.latest=Infinity;this.rejected=0;this.biasAt=0;
    this.graceMs=graceMs;this.lostAt=null;this.pongAt=0;this.sent=[];
  }
  connect(action) {
    this.pending=action||this.pending;this.closed=false;this.joined=false;
    if(action?.type==="join"&&action.spectator)this.spectatorJoin=action;
    this.notify({type:"connection",status:this.retries?"reconnecting":"connecting"});
    const socket=new WebSocket(this.url);this.socket=socket;
    socket.onopen=()=>{
      if(this.socket!==socket)return;
      this.notify({type:"connection",status:"connected"});
      this.pongAt=performance.now();
      this.send({type:"ping",time:Date.now()});
      this.pingTimer=setInterval(()=>{
        // A socket that stopped answering is dead for our purposes: reconnect now,
        // inside the seat's grace period, instead of waiting for the OS to notice.
        if(performance.now()-this.pongAt>PONG_TIMEOUT_MS){try{socket.close();}catch{}return;}
        this.send({type:"ping",time:Date.now()});
      },2000);
      this.inputTimer=setInterval(()=>this.flushInput(),STEP);
    };
    socket.onmessage=event=>{
      if(this.closed||this.socket!==socket)return;
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.type==='welcome'){
        const supported=message.games||['rekt-rumble'],choices=this.game==='wen-lambo'?message.vehicles:message.characters||['max','diamond'];
        const action=this.pending||this.spectatorJoin;
        if((message.rulesVersions?.[this.game]??1)!==this.rulesVersion||!supported.includes(this.game)||action?.character&&!choices?.includes(action.character)){
          this.notify({type:'error',code:'server_update_required',message:'The game server needs the latest main-branch deployment for this game or character. Practice still works.'});
          this.notify({type:'connection',status:'unavailable'});this.dispose({leave:false});return;
        }
        if(this.session)this.send({type:'resume',code:this.session.code,session:this.session.session,...(this.game==='wen-lambo'?{game:this.game,rulesVersion:this.rulesVersion}:{})});
        else if(this.pending){this.send(this.pending);this.pending=null;}
        else if(this.spectatorJoin)this.send(this.spectatorJoin);
      }
      if(message.type==="joined"){
        this.joined=true;this.retries=0;this.lostAt=null;
        this.slot=message.slot;
        if(this.slot>=0){this.session={code:message.code,session:message.session};try{sessionStorage.setItem(this.storageKey,JSON.stringify({...this.session,url:this.url}));}catch{}}
      }
      if(message.type==="room"){
        if(this.room?.matchId!==message.room.matchId){this.lastPacket=-1;this.lastInput=null;this.seq=0;}
        this.room=message.room;
      }
      if(message.state){
        this.previousState=this.state;
        this.state=message.state;this.snapshotAt=performance.now();
        this.inputs=message.inputs||message.state.players.map(p=>p.previousInput||0);
        this.corrections=message.corrections||0;
        if(message.acks&&this.slot>=0)this.seq=Math.max(this.seq,message.acks[this.slot]||0);
      }
      if(message.type==="pong"&&Number.isFinite(message.time)){
        this.pongAt=performance.now();
        const sample=Math.max(0,Date.now()-message.time);
        this.rtt=this.rtt?Math.round(this.rtt*.7+sample*.3):sample;this.notify({type:"latency",rtt:this.rtt});
      }
      if(message.type==="error"&&["invalid_session","not_found","expired"].includes(message.code)){
        this.session=null;try{sessionStorage.removeItem(this.storageKey);}catch{}
      }
      if(message.type==="error"&&TRANSIENT.has(message.code)){
        this.rejected++;
        if(message.code==='input_deadline'&&Number.isFinite(message.clock)&&Number.isFinite(message.tick)){
          // The packet for `tick` met the authority at `clock`. Re-aim so the next one
          // lands about two ticks ahead of the clock, whichever side it missed on.
          this.bias=Math.max(-30,Math.min(60,this.bias+(message.clock-message.tick)+2));this.biasAt=performance.now();
          this.lastPacket=-1;
        }
        return;
      }
      this.notify(message);
    };
    socket.onerror=()=>this.notify({type:"connection",status:"unavailable"});
    socket.onclose=()=>{
      clearInterval(this.pingTimer);clearInterval(this.inputTimer);
      if(this.closed||this.socket!==socket)return;
      this.input=0;this.lastPacket=-1;this.lastInput=null;
      const now=Date.now();if(this.lostAt===null)this.lostAt=now;
      // Keep trying for as long as the seat can still be reclaimed.
      if((this.session||this.spectatorJoin)&&now-this.lostAt<this.graceMs-1500){
        this.notify({type:"connection",status:"reconnecting"});
        this.retryTimer=setTimeout(()=>this.connect(),Math.min(1500,300*++this.retries));
      }else this.notify({type:"connection",status:"disconnected"});
    };
  }
  /** A player-initiated retry after automatic attempts gave up. */
  canReconnect(){return !this.closed&&!!(this.session||this.spectatorJoin)&&(!this.socket||this.socket.readyState>=2);}
  reconnect(){if(!this.canReconnect())return false;clearTimeout(this.retryTimer);this.retries=0;this.lostAt=null;this.connect();return true;}
  send(message){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
  setInput(input){this.input=input;this.flushInput();}
  targetTick(){
    if(!this.state)return 0;
    const now=performance.now();
    if(this.bias&&now-this.biasAt>4000){this.bias+=this.bias>0?-1:1;this.biasAt=now;}
    // Where the authority's clock will be when a packet sent now arrives: the snapshot's
    // tick, plus the half trip it already spent, plus the time since, plus the half trip
    // ahead. Aim two ticks past that; never past the authority's future window.
    const elapsed=now-this.snapshotAt,serverNow=this.state.tick+(elapsed+this.rtt/2)/STEP;
    const arrival=serverNow+this.rtt/2/STEP+this.bias;
    this.latest=Math.floor(arrival)+FUTURE_WINDOW-1;
    const earliest=Math.max(this.state.tick+1,Math.floor(serverNow)-ROLLBACK_WINDOW+3);
    return Math.max(earliest,Math.min(Math.floor(arrival+2),this.latest));
  }
  flushInput(){
    if(!this.joined||this.slot<0||!this.state||this.state.phase==="finished"||this.room?.phase!=="playing")return;
    let tick=this.targetTick();
    // Ticks only move forward within a match: a lower tick would leave an older
    // packet ahead of it in the timeline, briefly restoring a released control.
    if(this.lastPacket>tick)tick=Math.min(this.lastPacket,this.latest??Infinity);
    if(tick===this.lastPacket&&this.input===this.lastInput)return;
    const now=performance.now();
    while(this.sent.length&&now-this.sent[0]>1000)this.sent.shift();
    if(this.sent.length>=SEND_BUDGET)return; // the 60 Hz timer retries with the same mask
    this.sent.push(now);this.lastPacket=tick;this.lastInput=this.input;
    this.send({type:"input",seq:++this.seq,tick,input:this.input});
  }
  predictedState(){
    if(!this.state)return null;
    if(this.slot<0||this.state.phase!==this.activePhase)return this.state;
    let predicted=this.state;
    const inputs=[...this.inputs];inputs[this.slot]=this.input;
    const frames=Math.min(6,Math.max(0,this.targetTick()-this.state.tick));
    for(let i=0;i<frames;i++)predicted=this.step(predicted,inputs);
    // Both racers use this same predicted tick. Rewinding only the rival to the
    // previous snapshot hides close passes and pulls finished cars behind the line.
    // Predict motion and poses, but do not invent speculative hit effects.
    predicted.events=this.state.events;
    predicted.effectTick=this.state.tick;
    return predicted;
  }
  dispose({leave=true}={}){
    this.closed=true;clearTimeout(this.retryTimer);clearInterval(this.pingTimer);clearInterval(this.inputTimer);
    if(leave){this.send({type:"leave"});try{sessionStorage.removeItem(this.storageKey);}catch{}}
    this.socket?.close();this.socket=null;
  }
}
