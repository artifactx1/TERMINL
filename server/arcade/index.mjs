import http from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { RollbackFight } from '../../lib/arcade/rollback.mjs';
import { openJournal } from './journal.mjs';

const STEP = 1000 / 60;
const LATE = 12;
const FUTURE = 6;
const secret = () => randomBytes(24).toString('base64url');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const characters = new Set(['max', 'diamond']);
const stages = new Set(['dead-mall', 'laundromat']);
const nameOf = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 24 && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

export async function startArcadeServer(options = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const dataDir = options.dataDir || process.env.ARCADE_DATA_DIR;
  const configuredOrigins = options.allowedOrigins || process.env.ARCADE_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (production && (!dataDir || !configuredOrigins?.length || configuredOrigins.includes('*'))) throw new Error('Production requires ARCADE_DATA_DIR and explicit ARCADE_ALLOWED_ORIGINS');
  const allowedOrigins = new Set(configuredOrigins || ['http://localhost:4000', 'http://127.0.0.1:4000']);
  const journal = await openJournal(dataDir || resolve('.arcade-data'));
  const rooms = new Map();
  const peers = new Set();
  const connections = new Map();
  const adminToken = options.adminToken || process.env.ARCADE_ADMIN_TOKEN;
  const graceMs = options.graceMs ?? 15000;
  const inviteMs = options.inviteMs ?? 30 * 60000;
  const maxRooms = options.maxRooms ?? 100;
  const region = options.region || process.env.ARCADE_REGION || 'local';
  let draining = false;
  let storageFailed = false;
  let droppedCatchups = 0;
  const send = (peer, value) => {
    if (peer?.socket.readyState !== WebSocket.OPEN) return;
    if (peer.socket.bufferedAmount > 256 * 1024) { peer.socket.close(1013, 'Slow client'); return; }
    peer.socket.send(JSON.stringify(value));
  };
  const error = (peer, code, message) => send(peer, { type: 'error', code, message });
  const members = (room) => [...room.players.filter(Boolean).map((p) => p.peer), ...room.spectators.values()].filter(Boolean);
  const publicRoom = (room) => ({ code: room.code, phase: room.phase, stage: room.stage, matchId: room.matchId || null, players: room.players.map((p) => p ? { name: p.name, character: p.character, ready: p.ready, connected: !!p.peer, rematch: !!p.rematch } : null), spectators: room.spectators.size, expiresAt: room.expiresAt, region, result: room.result || null });
  const broadcastRoom = (room) => members(room).forEach((peer) => send(peer, { type: 'room', room: publicRoom(room), ...(room.state ? { state: room.state } : {}) }));
  const snapshot = (room) => members(room).forEach((peer) => send(peer, { type: 'snapshot', matchId: room.matchId, state: room.state, inputs: room.inputs, confirmedTick: Math.max(0, room.clock - LATE), acks: room.acks, corrections: room.corrections }));
  const publicResult = (result) => { const { participants: _participants, kind: _kind, replay: _replay, ...value } = result; return value; };
  const json = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(body)); };
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET') return json(response, 405, { error: 'method_not_allowed' });
    let path;
    try { path = new URL(request.url, 'http://arcade.local').pathname; }
    catch { return json(response, 400, { error: 'invalid_url' }); }
    if (path === '/health') return json(response, draining || storageFailed ? 503 : 200, { ok: !draining && !storageFailed, version: 1, region, rooms: rooms.size, players: [...rooms.values()].reduce((n, room) => n + room.players.filter((p) => p?.peer).length, 0), spectators: [...rooms.values()].reduce((n, room) => n + room.spectators.size, 0), connections: peers.size, droppedCatchups });
    if (path.startsWith('/results/') || path.startsWith('/replays/')) {
      const result = journal.results.get(path.slice(9));
      const credential = (request.headers.authorization || '').replace(/^Bearer /, '');
      if (!result || !(adminToken && equal(credential, adminToken)) && !result.participants?.includes(digest(credential))) return json(response, 404, { error: 'not_found' });
      return json(response, 200, path.startsWith('/replays/') ? { id: result.id, replay: result.replay || null } : publicResult(result));
    }
    return json(response, 404, { error: 'not_found' });
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    const ip = request.socket.remoteAddress || 'unknown';
    if (draining || storageFailed || !allowedOrigins.has(origin) || (connections.get(ip) || 0) >= 20 || peers.size >= maxRooms * 10) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  const failStorage = () => { storageFailed = true; for (const peer of peers) error(peer, 'storage_unavailable', 'Match storage failed. New matches are disabled.'); };
  async function finish(room, winner, reason = 'match_complete') {
    if (room.settling || room.phase !== 'playing') return;
    room.settling = true;
    try {
      const result = await journal.finish({ id: room.matchId, room: room.code, endedAt: Date.now(), status: 'completed', reason, winner, wins: room.state.wins, tick: room.state.tick, stage: room.stage, rewards: false, replay: room.sim.exportReplay(), participants: room.players.filter(Boolean).map((p) => digest(p.session)) });
      room.result = publicResult(result); room.phase = 'finished'; room.expiresAt = Date.now() + inviteMs;
      snapshot(room); broadcastRoom(room);
      members(room).forEach((peer) => send(peer, { type: 'result', result: room.result }));
    } catch { failStorage(); room.phase = 'aborted'; broadcastRoom(room); }
    finally { room.settling = false; }
  }

  async function begin(room) {
    if (!['lobby', 'finished'].includes(room.phase) || !room.players.every((p) => p?.peer && p.ready) || storageFailed || draining) return;
    room.phase = 'starting'; room.result = null; room.matchId = randomBytes(16).toString('hex');
    broadcastRoom(room);
    try { await journal.start({ id: room.matchId, room: room.code, startedAt: Date.now(), stage: room.stage, participants: room.players.map((p) => digest(p.session)) }); }
    catch { failStorage(); room.phase = 'aborted'; broadcastRoom(room); return; }
    room.sim = new RollbackFight({ stage: room.stage, characters: room.players.map((p) => p.character) });
    room.state = room.sim.state;
    room.clock = 0; room.inputs = [0, 0]; room.acks = [-1, -1]; room.corrections = 0; room.accumulator = 0;
    room.players.forEach((p) => { p.lastSeq = -1; p.rematch = false; });
    room.phase = 'playing'; broadcastRoom(room); snapshot(room);
  }

  function syncRoom(room) {
    room.state = room.sim.state; room.clock = room.state.tick;
    room.inputs = [...room.sim.held]; room.acks = [...room.sim.lastSeq]; room.corrections = room.sim.corrections;
  }

  function stepRoom(room) {
    room.sim.advance(); syncRoom(room);
    if (room.sim.confirmed) void finish(room, room.state.winner);
    if (room.clock % 3 === 0) snapshot(room);
  }

  function detach(peer, voluntary = false) {
    const room = peer.room;
    if (!room) return;
    if (peer.slot < 0) room.spectators.delete(peer.session);
    else {
      const player = room.players[peer.slot];
      if (player?.peer === peer) {
        player.peer = null; player.disconnectedAt = Date.now();
        if (room.phase === 'lobby' && voluntary) { room.players[peer.slot] = null; }
        else if (room.phase === 'playing') {
          room.sim.forceNeutral(peer.slot); syncRoom(room);
          if (voluntary) void finish(room, 1 - peer.slot, 'forfeit');
        }
      }
    }
    peer.room = null;
    if (room.phase === 'lobby' && room.players.every((player) => !player) && !room.spectators.size) rooms.delete(room.code);
    else broadcastRoom(room);
  }

  function attach(peer, room, slot, session) {
    peer.room = room; peer.slot = slot; peer.session = session;
    send(peer, { type: 'joined', code: room.code, token: room.token, session, slot });
    broadcastRoom(room);
    if (room.state) snapshot(room);
  }

  function onMessage(peer, data, binary) {
    const now = Date.now();
    if (now - peer.rateAt >= 1000) { peer.rateAt = now; peer.messages = 0; peer.controls = 0; }
    if (++peer.messages > 150) { error(peer, 'rate_limit', 'Too many messages'); peer.socket.close(1008, 'Rate limit'); return; }
    let message;
    try { if (binary) throw new Error(); message = JSON.parse(data.toString()); } catch { error(peer, 'invalid_message', 'Expected a JSON object'); return; }
    if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') return error(peer, 'invalid_message', 'Expected a typed object');
    if (message.type !== 'input' && ++peer.controls > 15) return error(peer, 'rate_limit', 'Too many control messages');
    const schemas = { create: ['type', 'name', 'character', 'stage'], join: ['type', 'code', 'token', 'name', 'character', 'spectator'], resume: ['type', 'code', 'session'], ready: ['type', 'ready'], input: ['type', 'seq', 'tick', 'input'], rematch: ['type'], leave: ['type'], ping: ['type', 'time'] };
    if (!schemas[message.type] || Object.keys(message).some((key) => !schemas[message.type].includes(key))) return error(peer, 'invalid_message', 'Unknown message fields');
    if (message.type === 'ping') {
      if (typeof message.time !== 'number' || !Number.isFinite(message.time)) return error(peer, 'invalid_message', 'Invalid ping');
      return send(peer, { type: 'pong', time: message.time, serverTime: now });
    }
    if (['create', 'join', 'resume'].includes(message.type)) {
      if (peer.room) return error(peer, 'already_joined', 'Leave the current room first');
      if (draining || storageFailed) return error(peer, 'unavailable', 'Rooms temporarily unavailable');
      if (message.type === 'create') {
        const name = nameOf(message.name);
        if (!name || !characters.has(message.character) || !stages.has(message.stage)) return error(peer, 'invalid_message', 'Invalid name, character, or stage');
        if (rooms.size >= maxRooms) return error(peer, 'capacity', 'Arcade is full');
        let code; do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
        const session = secret();
        const room = { code, token: secret(), expiresAt: now + inviteMs, phase: 'lobby', stage: message.stage, players: [{ name, character: message.character, ready: false, session, peer }, null], spectators: new Map() };
        rooms.set(code, room); return attach(peer, room, 0, session);
      }
      if (typeof message.code !== 'string' || message.code.length > 12) return error(peer, 'invalid_message', 'Invalid room code');
      const room = rooms.get(message.code.toUpperCase());
      if (!room) return error(peer, 'not_found', 'Room unavailable');
      if (message.type === 'resume') {
        const slot = room.players.findIndex((p) => p && equal(message.session, p.session));
        if (slot < 0 || (room.players[slot].disconnectedAt && now - room.players[slot].disconnectedAt > graceMs)) return error(peer, 'invalid_session', 'Reconnect session expired');
        const player = room.players[slot];
        if (player.peer) return error(peer, 'session_in_use', 'Player is already connected');
        player.peer = peer; player.disconnectedAt = null; return attach(peer, room, slot, player.session);
      }
      const name = nameOf(message.name);
      if (!name || !characters.has(message.character) || (message.spectator !== undefined && typeof message.spectator !== 'boolean')) return error(peer, 'invalid_message', 'Invalid guest details');
      if (room.expiresAt <= now || !equal(message.token, room.token)) return error(peer, 'invalid_invite', 'Invite expired or invalid');
      const session = secret();
      if (message.spectator) {
        if (room.spectators.size >= 8) return error(peer, 'capacity', 'Spectator seats are full');
        room.spectators.set(session, peer); return attach(peer, room, -1, session);
      }
      if (room.phase !== 'lobby') return error(peer, 'match_started', 'Match has already started');
      const slot = room.players.findIndex((p) => !p);
      if (slot < 0) return error(peer, 'capacity', 'Player seats are full');
      room.players[slot] = { name, character: message.character, ready: false, session, peer };
      return attach(peer, room, slot, session);
    }
    const room = peer.room;
    if (!room) return error(peer, 'not_joined', 'Join a room first');
    if (message.type === 'leave') return detach(peer, true);
    if (peer.slot < 0) return error(peer, 'spectator_read_only', 'Spectators cannot control matches');
    const player = room.players[peer.slot];
    if (message.type === 'ready') {
      if (typeof message.ready !== 'boolean' || room.phase !== 'lobby') return error(peer, 'invalid_phase', 'Readiness is lobby-only');
      player.ready = message.ready; broadcastRoom(room); void begin(room); return;
    }
    if (message.type === 'rematch') {
      if (room.phase !== 'finished') return error(peer, 'invalid_phase', 'Finish the match first');
      player.rematch = true; broadcastRoom(room);
      if (room.players.every((p) => p?.rematch && p.peer)) { room.players.forEach((p) => { p.ready = true; }); void begin(room); }
      return;
    }
    if (message.type === 'input') {
      if (room.phase !== 'playing' || room.settling) return error(peer, 'invalid_phase', 'Match is not accepting inputs');
      if (!integer(message.seq, 0, 2147483647) || !integer(message.tick, 0, 1000000) || !integer(message.input, 0, 2047)) return error(peer, 'invalid_input', 'Invalid input values');
      if (message.seq <= player.lastSeq) return error(peer, 'duplicate_input', 'Input sequence must increase');
      if (message.tick < room.clock - LATE || message.tick > room.clock + FUTURE) return error(peer, 'input_deadline', 'Input outside rollback window');
      const accepted = room.sim.submit(peer.slot, message.tick, message.input, message.seq);
      if (!accepted.ok) return error(peer, 'input_rejected', `Input rejected: ${accepted.reason}`);
      player.lastSeq = message.seq; syncRoom(room);
    }
  }

  wss.on('connection', (socket, request) => {
    const ip = request.socket.remoteAddress || 'unknown';
    connections.set(ip, (connections.get(ip) || 0) + 1);
    const peer = { socket, room: null, slot: -1, rateAt: Date.now(), messages: 0, controls: 0, alive: true };
    peers.add(peer); send(peer, { type: 'welcome', version: 1 });
    socket.on('pong', () => { peer.alive = true; });
    socket.on('message', (data, binary) => {
      try { onMessage(peer, data, binary); } catch { error(peer, 'invalid_message', 'Message could not be processed'); }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      detach(peer); peers.delete(peer);
      const count = Math.max(0, (connections.get(ip) || 1) - 1);
      if (count) connections.set(ip, count); else connections.delete(ip);
    });
  });
  let lastTime = performance.now();
  const timer = setInterval(() => {
    const current = performance.now(); const elapsed = current - lastTime; lastTime = current;
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.phase === 'lobby') {
        let changed = false;
        room.players.forEach((player, slot) => { if (player && !player.peer && now - player.disconnectedAt >= graceMs) { room.players[slot] = null; changed = true; } });
        if (changed) {
          if (room.players.every((player) => !player) && !room.spectators.size) { rooms.delete(room.code); continue; }
          broadcastRoom(room);
        }
      }
      if (room.phase === 'playing' && !room.settling) {
        const disconnected = room.players.map((p, slot) => !p?.peer && now - p.disconnectedAt >= graceMs ? slot : -1).filter((slot) => slot >= 0);
        if (disconnected.length) { void finish(room, disconnected.length === 2 ? null : 1 - disconnected[0], 'disconnect_forfeit'); continue; }
        room.accumulator += elapsed;
        let count = 0;
        while (room.accumulator >= STEP && count++ < 8 && !room.settling) { room.accumulator -= STEP; stepRoom(room); }
        if (room.accumulator > 8 * STEP) { room.accumulator = 8 * STEP; droppedCatchups++; }
      }
      if (room.expiresAt < now && room.phase !== 'playing' && room.phase !== 'starting') {
        for (const peer of members(room)) { error(peer, 'room_expired', 'Room expired'); peer.room = null; }
        rooms.delete(room.code);
      }
    }
  }, 8);
  const heartbeat = setInterval(() => { for (const peer of peers) { if (!peer.alive) peer.socket.terminate(); else { peer.alive = false; peer.socket.ping(); } } }, 10000);
  try {
    await new Promise((resolveReady, reject) => { server.once('error', reject); server.listen(options.port ?? Number(process.env.ARCADE_PORT || 4010), options.host || process.env.ARCADE_HOST || '127.0.0.1', resolveReady); });
  } catch (error) {
    clearInterval(timer); clearInterval(heartbeat); wss.close(); await journal.close(); throw error;
  }
  let closing;
  const close = () => closing ||= (async () => {
    draining = true; clearInterval(timer); clearInterval(heartbeat);
    let shutdownError = null;
    for (const room of rooms.values()) {
      if (['playing', 'starting'].includes(room.phase)) {
        try {
          const result = await journal.finish({ id: room.matchId, room: room.code, endedAt: Date.now(), status: 'aborted', reason: 'service_shutdown', winner: null, rewards: false, participants: room.players.filter(Boolean).map((p) => digest(p.session)) });
          room.phase = result.status === 'completed' ? 'finished' : 'aborted'; room.result = publicResult(result);
        } catch (error) { shutdownError ||= error; room.phase = 'aborted'; }
        broadcastRoom(room);
      }
    }
    for (const peer of peers) peer.socket.close(1012, 'Service restart');
    const kill = setTimeout(() => { for (const peer of peers) peer.socket.terminate(); }, 500);
    await new Promise((done) => wss.close(done)); clearTimeout(kill);
    await new Promise((done) => server.close(done));
    try { await journal.close(); } catch (error) { shutdownError ||= error; }
    if (shutdownError) throw shutdownError;
  })();
  return { server, address: server.address(), close, rooms, journal };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const runtime = await startArcadeServer();
  process.stdout.write(`TERMINL authority listening on ${runtime.address.address}:${runtime.address.port}\n`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void runtime.close().then(() => process.exit(0), () => process.exit(1)); });
}
