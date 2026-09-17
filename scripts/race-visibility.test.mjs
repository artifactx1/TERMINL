import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,stepRace,trackGeometry,CUP_TRACKS,RACE_RULES_VERSION,GATE_MARGIN} from '../lib/arcade/race-sim.mjs';
import {raceProjection,finishLineTiles} from '../lib/arcade/race-camera.mjs';
import {RumbleClient} from '../lib/arcade/rumble-client.js';

function at(g,forward,lateral){const gate=g.gates[0];return {x:gate.x+Math.cos(gate.angle)*forward-Math.sin(gate.angle)*lateral,y:gate.y+Math.sin(gate.angle)*forward+Math.cos(gate.angle)*lateral,angle:gate.angle};}

test('nearby rivals stay visible through a pass in both lanes and seats on every screen shape',()=>{
  for(const track of CUP_TRACKS)for(const [width,height] of [[390,452],[390,650],[568,104],[1000,600]])for(const slot of [0,1])for(const lateral of [-110,-50,50,110]){
    const state=createRace({track}),g=trackGeometry(track);Object.assign(state.players[slot],at(g,-80,0));
    let priorY=Infinity;
    for(const forward of [-30,-15,0,15,30,60,120]){
      Object.assign(state.players[1-slot],at(g,-80+forward,lateral));
      const before=JSON.stringify(state),projection=raceProjection(state,{width,height,slot,roadWidth:g.width});
      const me=projection.carFrame(state.players[slot]),rival=projection.carFrame(state.players[1-slot]);
      assert.ok(rival.x-rival.width/2>=0&&rival.x+rival.width/2<=width,`${track}, ${width}x${height}, ${lateral}, ${forward}`);
      assert.ok(rival.y-rival.width*.72<height&&rival.y>0,'passing car overlaps visible canvas');
      assert.ok(rival.y<priorY,'rival moves continuously from below to above the player');priorY=rival.y;
      assert.ok(Math.abs(me.y-height*.87)<1e-6);
      if(forward===0){assert.ok(Math.abs(rival.y-me.y)<1e-6);assert.ok(Math.abs(rival.width-me.width)<1e-6);}
      if(forward>0)assert.ok(rival.y<me.y);
      assert.equal(JSON.stringify(state),before);
    }
  }
});

test('checkerboard lies on the authoritative finish plane and finishers stop on that stripe',()=>{
  for(const track of CUP_TRACKS){
    const g=trackGeometry(track),gate=g.gates[0],tiles=finishLineTiles(g);
    const forward=p=>(p.x-gate.x)*Math.cos(gate.angle)+(p.y-gate.y)*Math.sin(gate.angle);
    const lateral=p=>-(p.x-gate.x)*Math.sin(gate.angle)+(p.y-gate.y)*Math.cos(gate.angle);
    for(const {points} of tiles)for(const p of points){assert.ok(Math.abs(forward(p))<=8.00001);assert.ok(Math.abs(lateral(p))<=g.width/2+GATE_MARGIN+.00001);}
    assert.ok(tiles.some(t=>t.points.some(p=>Math.abs(forward(p))<1e-6)));
    for(const side of [-g.width/2+4,0,g.width/2-4]){
      let s=createRace({track,cup:false});s.phase='racing';s.raceTicks=3000;
      Object.assign(s.players[1],at(g,-2,side),{passed:g.gates.length*g.laps,nextCheckpoint:0,lap:g.laps-1,vx:Math.cos(gate.angle)*5,vy:Math.sin(gate.angle)*5,speed:5,ghost:90});
      s=stepRace(s,[0,4]);const finished=s.players[1];assert.notEqual(finished.finishedTick,null,track);assert.equal(finished.nextCheckpoint,1);
      assert.ok(forward(finished)>0&&forward(finished)<8,`${track}: finish position is on stripe`);
      const after=stepRace(s,[0,0]);assert.equal(after.players[1].x,finished.x);assert.equal(after.players[1].y,finished.y);
      Object.assign(s.players[0],at(g,-100,side-30));
      const projection=raceProjection(s,{width:390,height:650,roadWidth:g.width});
      assert.ok(Math.abs(projection.carFrame(finished).y-projection.project(projection.view(gate.x,gate.y)).y)<12);
    }
  }
});

test('online racers share a predicted tick and finished rivals never rewind behind the line',()=>{
  for(const slot of [0,1]){
    const g=trackGeometry('night-market'),client=new RumbleClient('',()=>{},{game:'wen-lambo',step:stepRace,phase:'racing',rulesVersion:RACE_RULES_VERSION});
    let state=createRace();state.phase='racing';state.raceTicks=3000;
    for(const [i,p] of state.players.entries())Object.assign(p,at(g,-2,i?25:-25),{passed:g.gates.length*g.laps,nextCheckpoint:0,lap:2,vx:Math.cos(p.angle)*5,vy:Math.sin(p.angle)*5,speed:5});
    client.slot=slot;client.input=4;client.inputs=[4,4];client.previousState=structuredClone(state);client.state=state;client.targetTick=()=>state.tick+3;
    let expected=state;for(let i=0;i<3;i++)expected=stepRace(expected,[4,4]);
    const before=JSON.stringify(state);assert.deepEqual(client.predictedState().players,expected.players);assert.equal(JSON.stringify(state),before);
    state=stepRace(state,[4,4]);client.state=state;client.snapshotAt=performance.now();
    const drawn=client.predictedState();assert.notEqual(drawn.players[1-slot].finishedTick,null);
    assert.equal(drawn.players[1-slot].x,state.players[1-slot].x);assert.equal(drawn.players[1-slot].y,state.players[1-slot].y);
  }
});
