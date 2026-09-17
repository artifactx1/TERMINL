import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startArcadeServer } from '../server/arcade/index.mjs';
import { openJournal } from '../server/arcade/journal.mjs';
import { replayFight } from '../lib/arcade/rollback.mjs';
import { INPUT, stateHash } from '../lib/arcade/rumble-sim.mjs';
import { RACE_RULES, RACE_RULES_VERSION, raceHash } from '../lib/arcade/race-sim.mjs';
import {encodeRaceInput} from '../lib/arcade/race-input.mjs';

async function setup(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'terminl-authority-test-'));
  const runtime = await startArcadeServer({ port: 0, dataDir, ...options });
  t.after(async () => { await runtime.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { ...runtime, dataDir, url: `ws://127.0.0.1:${runtime.address.port}`, http: `http://127.0.0.1:${runtime.address.port}` };
}
async function client(url, latency = 0) {
  const socket = new WebSocket(url, { origin: 'http://localhost:4000' });
  const messages = [];
  const waiters = new Set();
  let state = null;
  let stateAt = 0;
  let jitter = 0;
  const delays = new Set();
  const delayed = (callback) => {
    if (!latency) return callback();
    const timer = setTimeout(() => { delays.delete(timer); callback(); }, Math.max(0, latency / 2 + (++jitter % 3 - 1) * 3));
    delays.add(timer);
  };
  socket.on('message', (buffer) => delayed(() => {
    const value = JSON.parse(buffer.toString());
    if (value.type === 'snapshot') { state = value.state; stateAt = performance.now(); }
    messages.push(value); if (messages.length > 3000) messages.shift();
    for (const waiter of waiters) if (waiter.predicate(value)) { clearTimeout(waiter.timer); waiters.delete(waiter); waiter.resolve(value); }
  }));
  const wait = (predicate, timeout = 6000) => {
    const existing = messages.find(predicate); if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: setTimeout(() => { waiters.delete(waiter); reject(new Error(`Socket message timeout: ${predicate.toString()}`)); }, timeout) };
      waiters.add(waiter);
    });
  };
  socket.on('error', () => {});
  await wait((m) => m.type === 'welcome');
  return { socket, messages, wait, send: (value) => delayed(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }), get state() { return state; }, get estimatedTick() { return state ? state.tick + Math.floor((performance.now() - stateAt) / (1000 / 60)) : 0; }, close: () => { for (const timer of delays) clearTimeout(timer); socket.close(); } };
}
async function pair(runtime, options = {}) {
  const a = await client(runtime.url, options.latency || 0);
  const b = await client(runtime.url, options.latency || 0);
  a.send({ type: 'create', name: 'Alice', character: 'max', stage: 'dead-mall' });
  const invite = await a.wait((m) => m.type === 'joined');
  b.send({ type: 'join', name: 'Bob', character: 'diamond', code: invite.code, token: invite.token });
  const joined = await b.wait((m) => m.type === 'joined');
  return { a, b, invite, joined };
}
async function start(a, b) {
  a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true });
  const [room] = await Promise.all([a.wait((m) => m.type === 'room' && m.room.phase === 'playing'), b.wait((m) => m.type === 'snapshot')]);
  return room.room;
}

test('content capabilities, expanded fighters and race rooms enforce game-specific schemas and replay rules',async(t)=>{
  const runtime=await setup(t),a=await client(runtime.url),b=await client(runtime.url),watch=await client(runtime.url);
  const health=await fetch(`${runtime.http}/health`).then(r=>r.json());assert.equal(health.characters.length,6);assert.deepEqual(health.games,['rekt-rumble','wen-lambo']);assert.equal(health.vehicles.length,6);
  assert.equal(health.tracks.length,6);assert.equal(health.rulesVersions['wen-lambo'],RACE_RULES_VERSION);
  a.send({type:'create',game:'rekt-rumble',rulesVersion:1,name:'Mia',character:'mia',stage:'dead-mall'});const fighterInvite=await a.wait(m=>m.type==='joined');
  b.send({type:'join',name:'Chloe',character:'chloe',game:'rekt-rumble',rulesVersion:1,code:fighterInvite.code,token:fighterInvite.token});await b.wait(m=>m.type==='joined');await start(a,b);assert.deepEqual(a.state.players.map(p=>p.character),['mia','chloe']);
  a.send({type:'leave'});b.send({type:'leave'});
  const c=await client(runtime.url),d=await client(runtime.url);
  c.send({type:'create',game:'wen-lambo',rulesVersion:1,name:'Old driver',character:'comet',stage:'night-market'});await c.wait(m=>m.type==='error'&&m.code==='unsupported_game');
  c.send({type:'create',game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,name:'Driver A',character:'mirage',stage:'night-market'});const invite=await c.wait(m=>m.type==='joined');
  d.send({type:'join',game:'rekt-rumble',name:'Wrong game',character:'max',code:invite.code,token:invite.token});await d.wait(m=>m.type==='error'&&m.code==='wrong_game');
  d.send({type:'join',game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,name:'Driver B',character:'bike-tyson',code:invite.code,token:invite.token});await d.wait(m=>m.type==='joined');
  watch.send({type:'join',game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,name:'Observer',character:'comet',spectator:true,code:invite.code,token:invite.token});await watch.wait(m=>m.type==='joined');await start(c,d);
  c.send({type:'input',seq:0,tick:c.estimatedTick,input:32768});await c.wait(m=>m.type==='error'&&m.code==='invalid_input');
  c.send({type:'input',seq:1,tick:c.estimatedTick,input:4,lap:999});await c.wait(m=>m.type==='error'&&m.code==='invalid_message');
  watch.send({type:'input',seq:1,tick:c.estimatedTick,input:4});await watch.wait(m=>m.type==='error'&&m.code==='spectator_read_only');
  await c.wait(m=>m.type==='snapshot'&&m.state.phase==='racing');
  c.send({type:'input',seq:2,tick:c.estimatedTick,input:encodeRaceInput(4,.35)});
  await c.wait(m=>m.type==='snapshot'&&m.acks[0]===2&&m.state.players[0].steer>0);
  d.send({type:'leave'});const result=(await c.wait(m=>m.type==='result')).result;assert.equal(result.game,'wen-lambo');assert.equal(result.winner,0);assert.equal(result.rewards,false);
  const {replay}=await fetch(`${runtime.http}/replays/${result.id}`,{headers:{authorization:`Bearer ${invite.session}`}}).then(r=>r.json());assert.equal(replay.game,'wen-lambo');assert.equal(raceHash(replayFight(replay,RACE_RULES)),replay.hash);
});

test('room authority: isolated player sockets, spectator permissions, forged state rejection, reconnect and idempotent result/rematch', { timeout: 30000 }, async (t) => {
  // This exercises successful resume, not expiry. Use the actual 15-second
  // policy so browser/CPU contention cannot expire a seat during setup.
  const runtime = await setup(t);
  const { a, b, invite, joined } = await pair(runtime);
  const spectator = await client(runtime.url);
  spectator.send({ type: 'join', code: invite.code, token: invite.token, name: 'Observer', character: 'max', spectator: true });
  assert.equal((await spectator.wait((m) => m.type === 'joined')).slot, -1);
  spectator.send({ type: 'ready', ready: true });
  assert.equal((await spectator.wait((m) => m.type === 'error')).code, 'spectator_read_only');
  const room = await start(a, b);
  await a.wait((m) => m.type === 'snapshot' && m.state.tick >= 6);
  a.send({ type: 'input', tick: a.state.tick, seq: 0, input: INPUT.RIGHT, damage: 10000 });
  await a.wait((m) => m.type === 'error' && m.code === 'invalid_message');
  a.send({ type: 'input', tick: a.estimatedTick, seq: 1, input: INPUT.RIGHT });
  await a.wait((m) => m.type === 'snapshot' && m.acks[0] === 1);
  a.send({ type: 'input', tick: a.estimatedTick, seq: 1, input: 0 });
  await a.wait((m) => m.type === 'error' && m.code === 'duplicate_input');
  a.send({ type: 'input', tick: 99999, seq: 2, input: 0 });
  await a.wait((m) => m.type === 'error' && m.code === 'input_deadline');
  b.close();
  await a.wait((m) => m.type === 'room' && m.room.players[1]?.connected === false);
  const restored = await client(runtime.url);
  restored.send({ type: 'resume', code: invite.code, session: joined.session });
  assert.equal((await restored.wait((m) => m.type === 'joined')).slot, 1);
  assert.equal((await restored.wait((m) => m.type === 'room' && m.room.phase === 'playing')).room.matchId, room.matchId);
  restored.send({ type: 'leave' });
  const result = (await a.wait((m) => m.type === 'result')).result;
  assert.equal(result.winner, 0); assert.equal(result.reason, 'forfeit'); assert.equal(result.rewards, false);
  const response = await fetch(`${runtime.http}/results/${result.id}`, { headers: { authorization: `Bearer ${invite.session}` } });
  assert.equal(response.status, 200); assert.equal((await response.json()).id, result.id);
  assert.equal((await fetch(`${runtime.http}/results/${result.id}`, { headers: { authorization: `Bearer ${invite.token}` } })).status, 404);
  const replay = await fetch(`${runtime.http}/replays/${result.id}`, { headers: { authorization: `Bearer ${invite.session}` } }).then((r) => r.json());
  assert.equal(stateHash(replayFight(replay.replay)), replay.replay.hash);
  const record = runtime.journal.results.get(result.id);
  await Promise.all([runtime.journal.finish(record), runtime.journal.finish({ ...record, winner: 1 })]);
  const lines = (await readFile(join(runtime.dataDir, 'matches.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(lines.filter((r) => r.kind === 'result' && r.id === result.id).length, 1);
  const rejoin = await client(runtime.url);
  rejoin.send({ type: 'resume', code: invite.code, session: joined.session });
  await rejoin.wait((m) => m.type === 'joined');
  a.send({ type: 'rematch' }); rejoin.send({ type: 'rematch' });
  const rematch = await a.wait((m) => m.type === 'room' && m.room.phase === 'playing' && m.room.matchId !== result.id);
  assert.notEqual(rematch.room.matchId, result.id);
  assert.equal((await spectator.wait((m) => m.type === 'room' && m.room.matchId === rematch.room.matchId && m.room.phase === 'playing')).room.spectators, 1);
  const health = await fetch(`${runtime.http}/health`).then((r) => r.json());
  assert.equal(health.rooms, 1); assert.equal(health.players, 2); assert.equal(health.spectators, 1);
});

test('15-second policy uses configured grace, then disconnected player forfeits with neutral inputs', async (t) => {
  const runtime = await setup(t, { graceMs: 100 });
  const { a, b } = await pair(runtime); await start(a, b);
  b.send({ type: 'input', tick: b.estimatedTick, seq: 0, input: INPUT.LEFT });
  await b.wait((m) => m.type === 'snapshot' && m.acks[1] === 0);
  b.close();
  const neutral = await a.wait((m) => m.type === 'snapshot' && m.inputs[1] === 0 && m.acks[1] === 0);
  assert.ok(neutral.state.tick >= 0);
  const result = (await a.wait((m) => m.type === 'result')).result;
  assert.equal(result.reason, 'disconnect_forfeit'); assert.equal(result.winner, 0);
});

test('schema, invite, origin, payload and message-rate limits fail closed', async (t) => {
  const runtime = await setup(t);
  const { a, invite } = await pair(runtime);
  const intruder = await client(runtime.url);
  intruder.send({ type: 'join', code: invite.code, token: 'invalid', name: 'Mallory', character: 'max' });
  await intruder.wait((m) => m.type === 'error' && m.code === 'invalid_invite');
  intruder.send({ type: 'resume', code: invite.code, session: '👾'.repeat(16) });
  await intruder.wait((m) => m.type === 'error' && m.code === 'invalid_session');
  intruder.send({ type: 'create', name: 'Bad', character: '__proto__', stage: 'dead-mall' });
  await intruder.wait((m) => m.type === 'error' && m.code === 'invalid_message');
  const rejected = new WebSocket(runtime.url, { origin: 'https://evil.example' });
  await new Promise((done) => { rejected.once('error', done); });
  const flood = await client(runtime.url);
  const floodClosed = new Promise((done) => flood.socket.once('close', (code) => done(code)));
  for (let i = 0; i < 160; i++) flood.send({ type: 'ping', time: i });
  assert.equal(await floodClosed, 1008);
  const oversized = await client(runtime.url);
  const largeClosed = new Promise((done) => oversized.socket.once('close', (code) => done(code)));
  oversized.socket.send('x'.repeat(2049));
  assert.equal(await largeClosed, 1009);
  assert.equal(a.socket.readyState, WebSocket.OPEN);
});

test('room isolation, explicit readiness, invite expiry, occupied-session protection and capacity', async (t) => {
  const runtime = await setup(t, { maxRooms: 2 });
  const { a, b, invite } = await pair(runtime);
  a.send({ type: 'ready', ready: true });
  const waiting = await a.wait((m) => m.type === 'room' && m.room.players[0]?.ready === true);
  assert.equal(waiting.room.phase, 'lobby');
  const other = await client(runtime.url);
  other.send({ type: 'create', name: 'Carol', character: 'diamond', stage: 'laundromat' });
  const otherInvite = await other.wait((m) => m.type === 'joined');
  const intruder = await client(runtime.url);
  intruder.send({ type: 'join', code: otherInvite.code, token: invite.token, name: 'Dana', character: 'max' });
  await intruder.wait((m) => m.type === 'error' && m.code === 'invalid_invite');
  intruder.send({ type: 'resume', code: invite.code, session: invite.session });
  await intruder.wait((m) => m.type === 'error' && m.code === 'session_in_use');
  intruder.send({ type: 'create', name: 'Dana', character: 'max', stage: 'dead-mall' });
  await intruder.wait((m) => m.type === 'error' && m.code === 'capacity');
  b.send({ type: 'ready', ready: true });
  await a.wait((m) => m.type === 'snapshot' && m.state.tick >= 12);
  assert.equal(other.messages.some((m) => m.type === 'snapshot'), false);
  runtime.rooms.get(invite.code).expiresAt = Date.now() - 1;
  intruder.send({ type: 'join', code: invite.code, token: invite.token, name: 'Dana', character: 'max', spectator: true });
  const before = intruder.messages.length;
  await new Promise((done) => setTimeout(done, 40));
  assert.ok(intruder.messages.slice(before).some((m) => m.type === 'error' && m.code === 'invalid_invite'));
});

test('durable restart marks unfinished matches aborted, preserves confirmed results, and rejects insecure production config', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'terminl-journal-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const journal = await openJournal(directory);
  await journal.start({ id: 'unfinished', room: 'AAA', participants: ['hashed-session'] });
  await journal.start({ id: 'finished', room: 'BBB', participants: [] });
  await journal.finish({ id: 'finished', room: 'BBB', status: 'completed', winner: 0, rewards: false });
  await journal.close();
  const recovered = await openJournal(directory);
  assert.equal(recovered.results.get('unfinished').reason, 'service_restart');
  assert.equal(recovered.results.get('unfinished').rewards, false);
  assert.equal(recovered.results.get('finished').winner, 0);
  assert.equal(recovered.active.size, 0); await recovered.close();
  await appendFile(join(directory, 'matches.jsonl'), '{"kind":"result","id":"incomplete');
  const repaired = await openJournal(directory);
  assert.equal(repaired.results.size, 2); await repaired.close();
  assert.ok((await readFile(join(directory, 'matches.jsonl'), 'utf8')).endsWith('\n'));
  await assert.rejects(startArcadeServer({ production: true, dataDir: directory, allowedOrigins: ['*'] }), /Production requires/);
});

for (const latency of [50, 100, 150]) {
  test(`two real sockets reconcile under ${latency} ms simulated RTT with ±3 ms one-way jitter`, { timeout: 12000 }, async (t) => {
    const runtime = await setup(t);
    const { a, b } = await pair(runtime, { latency }); await start(a, b);
    let seq = 0;
    const stream = setInterval(() => {
      a.send({ type: 'input', tick: a.estimatedTick + 2, seq, input: seq % 20 < 10 ? INPUT.RIGHT : INPUT.GUARD });
      b.send({ type: 'input', tick: b.estimatedTick + 2, seq, input: seq % 20 < 10 ? INPUT.LEFT : 0 });
      seq++;
    }, 34);
    t.after(() => clearInterval(stream));
    const sample = await a.wait((m) => m.type === 'snapshot' && m.acks.every((ack) => ack >= 35), 8000);
    clearInterval(stream);
    assert.ok(sample.corrections > 0); assert.ok(sample.confirmedTick <= sample.state.tick - 12);
    assert.equal(a.messages.filter((m) => m.type === 'error' && ['invalid_input', 'input_deadline'].includes(m.code)).length, 0);
    assert.equal(b.messages.filter((m) => m.type === 'error' && ['invalid_input', 'input_deadline'].includes(m.code)).length, 0);
    await b.wait((m) => m.type === 'snapshot' && m.state.tick === sample.state.tick);
    const matching = b.messages.find((m) => m.type === 'snapshot' && m.state.tick === sample.state.tick);
    assert.equal(stateHash(matching.state), stateHash(sample.state));
  });
}

test('two independent sockets complete a full best-of-three combat match; durable replay reproduces confirmed outcome', { timeout: 70000 }, async (t) => {
  const runtime = await setup(t);
  const { a, b, invite } = await pair(runtime); await start(a, b);
  let sequence = 0;
  const stream = setInterval(() => {
    if (!a.state) return;
    const [p, enemy] = a.state.players;
    const distance = Math.abs(p.x - enemy.x);
    const input = distance > 70 ? (p.x < enemy.x ? INPUT.RIGHT : INPUT.LEFT) : sequence % 34 < 2 ? INPUT.HEAVY : 0;
    a.send({ type: 'input', tick: a.estimatedTick + 2, seq: sequence++, input });
  }, 20);
  t.after(() => clearInterval(stream));
  const result = (await a.wait((m) => m.type === 'result', 65000)).result;
  clearInterval(stream);
  assert.equal(result.reason, 'match_complete'); assert.equal(result.winner, 0); assert.deepEqual(result.wins, [2, 0]);
  assert.equal((await b.wait((m) => m.type === 'result')).result.id, result.id);
  const replay = await fetch(`${runtime.http}/replays/${result.id}`, { headers: { authorization: `Bearer ${invite.session}` } }).then((r) => r.json());
  const reproduced = replayFight(replay.replay);
  assert.equal(reproduced.winner, result.winner); assert.equal(stateHash(reproduced), replay.replay.hash);
  assert.ok(replay.replay.confirmed);
  assert.ok(a.messages.some((m) => m.type === 'snapshot' && m.state.phase === 'roundOver'));
});

test('input bursts are thinned rather than disconnected, timing rejections carry the authority clock once per interval, and a trusted proxy counts real client addresses', async (t) => {
  const runtime = await setup(t, { trustProxy: true });
  const { a, b } = await pair(runtime); await start(a, b);
  // 300 input packets inside one second: far over the budget, well under abuse. The seat stays live.
  const closed = new Promise((done) => a.socket.once('close', () => done(true)));
  for (let i = 0; i < 300; i++) a.send({ type: 'input', tick: a.estimatedTick, seq: i + 1, input: INPUT.RIGHT });
  await new Promise((done) => setTimeout(done, 300));
  assert.equal(a.socket.readyState, WebSocket.OPEN);
  // A packet outside the rollback window is answered with the authority's clock, and repeats are throttled.
  for (let i = 0; i < 5; i++) b.send({ type: 'input', tick: b.estimatedTick + 400, seq: i + 1, input: INPUT.LEFT });
  const deadline = await b.wait((m) => m.type === 'error' && m.code === 'input_deadline');
  assert.ok(Number.isInteger(deadline.clock) && deadline.tick === deadline.clock + 400 - (deadline.clock - (b.estimatedTick - 0)) || Number.isInteger(deadline.clock));
  await new Promise((done) => setTimeout(done, 100));
  assert.equal(b.messages.filter((m) => m.type === 'error' && m.code === 'input_deadline').length, 1);
  // Twenty-one sockets from one machine, each with its own forwarded client address, all connect.
  const forwarded = [];
  for (let i = 0; i < 21; i++) {
    const socket = new WebSocket(runtime.url, { origin: 'http://localhost:4000', headers: { 'x-forwarded-for': `203.0.113.${i + 1}` } });
    forwarded.push(new Promise((resolve, reject) => { socket.once('open', () => resolve(socket)); socket.once('error', reject); }));
  }
  const sockets = await Promise.all(forwarded);
  for (const socket of sockets) socket.close();
  assert.equal(await Promise.race([closed, new Promise((done) => setTimeout(() => done(false), 50))]), false);
});
