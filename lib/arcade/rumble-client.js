import { stepFight } from "./rumble-sim.mjs";

/** WebSocket transport + bounded client prediction. Never grants results. */
export class RumbleClient {
  constructor(url, notify, {game='rekt-rumble',step=stepFight,phase='fight',rulesVersion=1}={}) {
    this.rulesVersion=rulesVersion;this.game=game;this.step=step;this.activePhase=phase;this.storageKey=game==='rekt-rumble'?'terminl:rumble-session':'terminl:race-session';
    this.url=url;this.notify=notify;this.socket=null;this.state=null;this.room=null;
    this.seq=0;this.slot=-1;this.input=0;this.rtt=0;this.lastPacket=-1;
    this.snapshotAt=0;this.inputs=[0,0];this.closed=false;this.pending=null;
    this.session=null;this.spectatorJoin=null;this.retries=0;this.frames=[];this.corrections=0;this.joined=false;
  }
  connect(action) {
    this.pending=action||this.pending;this.closed=false;this.joined=false;
    if(action?.type==="join"&&action.spectator)this.spectatorJoin=action;
    this.notify({type:"connection",status:this.retries?"reconnecting":"connecting"});
    const socket=new WebSocket(this.url);this.socket=socket;
    socket.onopen=()=>{
      if(this.socket!==socket)return;
      this.notify({type:"connection",status:"connected"});
      this.pingTimer=setInterval(()=>this.send({type:"ping",time:Date.now()}),2000);
      this.inputTimer=setInterval(()=>this.flushInput(),1000/60);
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
        this.joined=true;this.retries=0;
        this.slot=message.slot;
        if(this.slot>=0){this.session={code:message.code,session:message.session};try{sessionStorage.setItem(this.storageKey,JSON.stringify({...this.session,url:this.url}));}catch{}}
      }
      if(message.type==="room"){
        if(this.room?.matchId!==message.room.matchId){this.lastPacket=-1;this.seq=0;}
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
        this.rtt=Math.max(0,Date.now()-message.time);this.notify({type:"latency",rtt:this.rtt});
      }
      if(message.type==="error"&&["invalid_session","not_found","expired"].includes(message.code)){
        this.session=null;try{sessionStorage.removeItem(this.storageKey);}catch{}
      }
      this.notify(message);
    };
    socket.onerror=()=>this.notify({type:"connection",status:"unavailable"});
    socket.onclose=()=>{
      clearInterval(this.pingTimer);clearInterval(this.inputTimer);
      if(this.closed||this.socket!==socket)return;
      this.input=0;
      if((this.session||this.spectatorJoin)&&this.retries<6){
        this.notify({type:"connection",status:"reconnecting"});
        this.retryTimer=setTimeout(()=>this.connect(),Math.min(2500,400*++this.retries));
      }else this.notify({type:"connection",status:"disconnected"});
    };
  }
  send(message){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
  setInput(input){this.input=input;this.flushInput(true);}
  targetTick(){
    if(!this.state)return 0;
    return this.state.tick+Math.min(6,Math.max(1,Math.floor((performance.now()-this.snapshotAt+this.rtt/2)/ (1000/60))+2));
  }
  flushInput(force=false){
    if(!this.joined||this.slot<0||!this.state||this.state.phase==="finished"||this.room?.phase!=="playing")return;
    const tick=this.targetTick();if(!force&&tick===this.lastPacket)return;
    this.lastPacket=tick;this.send({type:"input",seq:++this.seq,tick,input:this.input});
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
