import test from 'node:test';
import assert from 'node:assert/strict';
import {RollbackFight,ROLLBACK_WINDOW,FUTURE_WINDOW} from '../lib/arcade/rollback.mjs';
import {RumbleClient} from '../lib/arcade/rumble-client.js';
import {INPUT,stateHash} from '../lib/arcade/rumble-sim.mjs';
import {createRace,stepRace,raceBotInput,trackGeometry,GATE_MARGIN,raceLost,RACE_RULES_VERSION} from '../lib/arcade/race-sim.mjs';
import {createRace as createV5} from '../lib/arcade/race-sim-v5.mjs';

const STEP=1000/60;
globalThis.WebSocket??=class{};

test('a late packet that repeats the simulated mask records without a rewind; a changed mask still rewinds',()=>{
  const fight=new RollbackFight({stage:'dead-mall',characters:['max','diamond']});
  fight.submit(0,0,INPUT.RIGHT,0);
  while(fight.state.phase!=='fight')fight.advance();
  for(let i=0;i<30;i++)fight.advance();
  const hash=stateHash(fight.state),corrections=fight.corrections;
  // Same held mask, five ticks late: the authority already simulated exactly this.
  assert.deepEqual(fight.submit(0,fight.clock-5,INPUT.RIGHT,1),{ok:true,rolledBack:false,tick:fight.clock,hash});
  assert.equal(fight.corrections,corrections);
  // A different mask for a past tick changes the timeline and must replay it.
  const changed=fight.submit(0,fight.clock-5,INPUT.LEFT,2);
  assert.equal(changed.rolledBack,true);assert.equal(fight.corrections,corrections+1);assert.notEqual(stateHash(fight.state),hash);
  // The recorded held history matches a from-scratch replay of the same timeline.
  const twin=new RollbackFight({stage:'dead-mall',characters:['max','diamond']});
  twin.submit(0,0,INPUT.RIGHT,0);
  while(twin.clock<fight.clock-5)twin.advance();
  twin.submit(0,twin.clock,INPUT.LEFT,1);
  while(twin.clock<fight.clock)twin.advance();
  assert.equal(stateHash(twin.state),stateHash(fight.state));
  assert.ok(ROLLBACK_WINDOW>=18,'late inputs tolerate a 300 ms spike');
});

test('client input timing lands inside the authority window across realistic round trips',()=>{
  for(const rtt of [0,40,100,200,320,500]){
    const client=new RumbleClient('',()=>{},{game:'wen-lambo',step:stepRace,phase:'racing',rulesVersion:RACE_RULES_VERSION});
    client.state={tick:600,phase:'racing',players:[{},{}],events:[]};client.rtt=rtt;
    for(const elapsedMs of [0,16,33,50]){
      client.snapshotAt=performance.now()-elapsedMs;
      const tick=client.targetTick();
      // The authority reaches snapshot tick + one way trip + elapsed + one way trip by arrival.
      const clockAtArrival=600+(rtt+elapsedMs)/STEP;
      assert.ok(tick>=clockAtArrival-ROLLBACK_WINDOW+1,`rtt ${rtt} elapsed ${elapsedMs}: ${tick} is too late for ${clockAtArrival}`);
      assert.ok(tick<=Math.floor(clockAtArrival)+FUTURE_WINDOW,`rtt ${rtt} elapsed ${elapsedMs}: ${tick} is too early for ${clockAtArrival}`);
      if(rtt<=200)assert.ok(tick>=Math.floor(clockAtArrival),'ordinary latency needs no rollback at all');
    }
  }
});

test('deadline rejections re-aim the client instead of surfacing as notices, and packets never step backwards',()=>{
  const sockets=[];
  globalThis.WebSocket=class{constructor(){this.readyState=1;this.sent=[];sockets.push(this);}send(v){this.sent.push(JSON.parse(v));}close(){this.readyState=3;this.onclose?.();}};
  globalThis.WebSocket.OPEN=1;
  const notices=[];
  const client=new RumbleClient('ws://test',m=>notices.push(m),{game:'wen-lambo',step:stepRace,phase:'racing',rulesVersion:RACE_RULES_VERSION});
  client.connect({type:'create',game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,name:'A',character:'comet',stage:'night-market'});
  const socket=sockets[0];socket.onopen();
  const deliver=message=>socket.onmessage({data:JSON.stringify(message)});
  deliver({type:'welcome',games:['wen-lambo'],vehicles:['comet'],rulesVersions:{'wen-lambo':RACE_RULES_VERSION}});
  deliver({type:'joined',code:'ROOM',token:'t',session:'s',slot:0});
  deliver({type:'room',room:{matchId:'m1',phase:'playing'},state:{tick:100,phase:'racing',players:[{},{}],events:[]}});
  const inputs=()=>socket.sent.filter(m=>m.type==='input');
  client.setInput(4);assert.equal(inputs().length,1);const first=inputs()[0].tick;
  client.setInput(4);assert.equal(inputs().length,1,'an unchanged mask for the same tick is not resent');
  client.setInput(6);assert.equal(inputs().length,2);assert.ok(inputs()[1].tick>=first,'ticks never move backwards');
  deliver({type:'error',code:'input_deadline',message:'x',tick:106,clock:140});
  assert.equal(notices.filter(n=>n.type==='error').length,0,'timing rejections are not player notices');
  assert.equal(client.bias,36,'aim moves to two ticks past the authority clock');
  client.setInput(2);const aimed=inputs().at(-1).tick;assert.ok(aimed>=136&&aimed<=146,`re-aimed packet ${aimed} reaches the authority window`);
  deliver({type:'error',code:'input_deadline',message:'x',tick:200,clock:150});
  assert.equal(client.bias,-12,'an early packet pulls the aim back');
  deliver({type:'error',code:'invalid_invite',message:'shown'});
  assert.equal(notices.filter(n=>n.type==='error').length,1,'real errors still surface');
  client.dispose({leave:false});
});

test('rules v6 credits any in-bounds crossing; archived v5 keeps the narrow gate; finish events name the place; skipped gates are flagged',()=>{
  const wide=(state,slot,offset)=>{const g=trackGeometry(state.track),gate=g.gates[1],p=state.players[slot];Object.assign(p,{x:gate.x-Math.cos(gate.angle)*4-Math.sin(gate.angle)*offset,y:gate.y-Math.sin(gate.angle)*4+Math.cos(gate.angle)*offset,angle:gate.angle,vx:Math.cos(gate.angle)*6,vy:Math.sin(gate.angle)*6,speed:6,passed:1,nextCheckpoint:1,ghost:0});};
  const g=trackGeometry('night-market'),offset=g.width/2+30;assert.ok(offset<g.width/2+GATE_MARGIN);
  let v6=createRace({cup:false});v6.phase='racing';v6.raceTicks=600;wide(v6,0,offset);wide(v6,1,-offset);
  for(let i=0;i<5;i++)v6=stepRace(v6,[4,4]);
  assert.equal(v6.players[0].passed,2,'a crossing near the barrier counts');assert.equal(v6.players[1].passed,2);
  let v5=createV5({cup:false});v5.phase='racing';v5.raceTicks=600;wide(v5,0,offset);
  for(let i=0;i<5;i++)v5=stepRace(v5,[4,4]);
  assert.equal(v5.players[0].passed,1,'the archived rules still void the same crossing');
  // A car that drove past a gate without credit is reported lost until it recovers.
  let lost=createRace({cup:false});lost.phase='racing';lost.raceTicks=600;
  const gate=g.gates[2],p=lost.players[0];Object.assign(p,{x:gate.x+Math.cos(gate.angle)*60,y:gate.y+Math.sin(gate.angle)*60,passed:1,nextCheckpoint:1});
  assert.equal(raceLost(lost,0),true);assert.equal(raceLost(lost,1),false);
  // Finish events carry the placement the standings will record.
  let s=createRace({cup:false});for(let i=0;i<12000&&s.phase!=='raceOver';i++)s=stepRace(s,[raceBotInput(s,0),raceBotInput(s,1)]);
  const finishes=s.events.filter(e=>e.type==='finish');assert.equal(finishes.length,2);
  const [first,second]=s.raceResults[0].order;
  assert.equal(finishes.find(e=>e.player===first).text,'FINISH · 1ST PLACE');assert.equal(finishes.find(e=>e.player===second).text,'FINISH · 2ND PLACE');
});

test('cup standing separates race place from cup place and names the stakes of the next race',async()=>{
  const {cupStanding}=await import('../lib/arcade/race-telemetry.mjs');
  const state=createRace({cup:true});state.phase='racing';state.trackIndex=3;state.players[0].points=16;state.players[1].points=20;state.players[0].place=1;
  const mine=cupStanding(state,0);
  assert.equal(mine.place,2);assert.equal(mine.label,'2nd');assert.equal(mine.remaining,3);assert.equal(mine.status,'WIN THE NEXT RACE TO TAKE THE CUP LEAD');
  assert.equal(cupStanding(state,1).status,'CUP LEAD +4');
  state.players[1].points=38;assert.equal(cupStanding(state,0).status,'CUP TRAILING BY 22 · NEED 6 MORE WINS');
  state.phase='raceOver';state.trackIndex=4;state.players[0].points=48;state.players[1].points=30;
  assert.equal(cupStanding(state,0).status,'CUP CLINCHED');assert.equal(cupStanding(state,1).status,'CUP OUT OF REACH · RACE FOR PRIDE');
  state.phase='finished';state.winner=1;state.players[0].points=28;state.players[1].points=32;
  assert.deepEqual([cupStanding(state,0).status,cupStanding(state,1).status],['CUP LOST ON POINTS','CUP WON']);
});
