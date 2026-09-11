# Shared arcade authority — REKT RUMBLE + WEN LAMBO, protocol v1

This is a real, standalone Node 20 WebSocket authority, not a bot presented as another person. Two independent browser connections submit control masks to one renderer-independent fight simulation. The current slice supports two players, up to eight invited spectators, six fighter archetypes/two stages or two racing cars/two tracks. It does **not** yet provide production accounts, NFT ownership verification, public matchmaking, ranked seasons, cross-region routing, or infrastructure provisioning. Guests receive no financial or mint-related rewards.

## Run locally

```sh
npm install
npm run arcade:server
npm run dev:arcade
```

The authority listens on `127.0.0.1:4010`; the site is at `http://localhost:4000`. The UI must configure/use `ws://localhost:4010` for local development. Open two independent browser profiles or devices pointed at a reachable development host. Create a private room in REKT RUMBLE, send the invite link, join, and have both players ready up. Localhost links only work on the same computer. Do not advertise the game as globally online until a reachable secure runtime is configured.

For programmatic tests:

```js
import {startArcadeServer} from './server/arcade/index.mjs';
const runtime = await startArcadeServer({
  port: 0,
  host: '127.0.0.1',
  dataDir: '/absolute/path/to/test-volume',
  allowedOrigins: ['http://localhost:4000'],
});
console.log(runtime.address.port);
await runtime.close();
```

Only the test/runtime owner may inspect the returned `rooms`/`journal` maps. Neither is exposed as a public HTTP mutation API.

## Authority and rollback

Simulation runs at a fixed **60 Hz** using a monotonic accumulator; snapshots are sent at **20 Hz**. A scheduler turn processes at most eight fixed steps. Accumulated delay is bounded to eight additional steps and increments `droppedCatchups` if truncated. An overloaded machine therefore does not silently speed up fights; it must be treated as unhealthy capacity and measured before release. Browser paint rate never advances server gameplay.

`lib/arcade/rollback.mjs` is shared between authority and replay verification. A packet for tick *t* controls the transition from state *t* to *t+1*. Accepted input masks persist until superseded. The server accepts at most **12 ticks late (200 ms)** or **six ticks ahead (100 ms)**; the client normally targets estimated authority tick +2. Higher sequence numbers may replace a same-tick input. Duplicate/decreasing sequence numbers are rejected. Reconnect continues the existing sequence number; the client starts above the snapshot's acknowledged sequence for its slot.

Complete simulation snapshots are retained for bounded rollback. Late input restores a snapshot and replays the original input timeline, including timers, meter, hit state, movement, round state, and authored stage boundaries. A changed timeline increments `corrections`. Event IDs are deterministic so presentation can deduplicate replayed effects. The server never accepts client positions, damage, winners, scores, or time elapsed. The simulation, not renderer animation events, owns all attack windows and collision outcomes.

An apparent finish remains provisional for the rollback window. Only after it is confirmed and its result is durably appended does the room enter `finished` and emit `result`. An administrative forfeit is a separate result reason: its saved replay reproduces the fight up to disconnection, not an invented simulated KO. The winner of a forfeit is assigned by the documented disconnect policy rather than the final simulated health comparison.

## Protocol

Connect using WebSocket with an allowlisted `Origin`. JSON messages must be at most 2,048 bytes. Unknown message types or fields are rejected. See `lib/arcade/contracts.d.ts` for client message shapes.

| Client message | Effect |
| --- | --- |
| `create {name, character, stage}` | Creates an unlisted room; caller occupies slot 0. |
| `join {code, token, name, character, spectator?}` | Scoped invite required. Player seat only in lobby; spectators can join a live match. |
| `resume {code, session}` | Reclaims a disconnected player's existing seat during grace; cannot replace a still-connected player. |
| `ready {ready}` | Lobby readiness. Both connected players ready starts a journaled match. |
| `input {seq, tick, input}` | Player-only control mask: Rumble 0–2047, racing 0–127. |
| `rematch` | Votes to restart. Both connected players must vote; gets a new match ID. |
| `leave` | Leaves room. Leaving an active fight forfeits immediately. |
| `ping {time}` | Returns client timestamp plus server clock; use for measured RTT, not trusted simulation time. |

| Server message | Fields |
| --- | --- |
| `welcome` | `version: 1`, `games`, `characters`, `vehicles`, `build` |
| `joined` | `code`, scoped invite `token`, private resume `session`, `slot` (0/1; **−1 spectator**) |
| `room` | Public `room` with code, phase, stage, matchId, player names/archetypes/readiness/connectivity/rematch votes, actual spectator count, expiresAt, region, result; full `state` if started |
| `snapshot` | `matchId`, complete `state`, currently held `inputs`, `confirmedTick`, `acks`, cumulative `corrections` |
| `result` | Persisted public `result`: ID, winner/wins, reason, stage, terminal tick/time, `rewards:false` |
| `error` | Stable `code`, display-safe `message` |
| `pong` | Echoed `time`, `serverTime` |

The state machine is `lobby → starting → playing → finished`; rematch returns through `starting`. Storage failure or service shutdown can produce `aborted`. The invite lifetime defaults to 30 minutes. Finish renews the room's idle expiration. No host owns simulation: if a lobby creator leaves, the other seat can still ready up with a new participant. Empty/expired idle rooms are reclaimed by the authority. There is deliberately no fake public population ticker.

## Disconnect, abuse, and identity boundaries

A disconnection immediately neutralizes the player's held and queued future inputs. The fight clock continues. The guest has **15 seconds** to resume the same room and seat; after that the opponent wins by disconnect forfeit. If both players have exceeded grace by the same check, the match has no winner. Idle lobby seats are held for the same grace period and then freed. A spectator has no match-control permissions and rejoins through the invite rather than a player resume token.

Invite and resume credentials are independently generated 192-bit cryptographic random values. Invite tokens only authorize room entry; private sessions authorize resuming one seat and reading that participant's persisted results. A stolen guest session is a stolen guest identity: this is not account authentication. Never put private sessions in shared URLs or logs. TLS is required outside localhost. The server persists only SHA-256 session digests, never raw session secrets.

Limits are 100 rooms by default, two player seats and eight spectators per room, 20 simultaneous connections per immediate source address, 150 messages/second per connection, and 15 control messages/second. Input schema rejects unknown fields and invalid numeric ranges. Excess total message rate closes the socket. Payloads over 2 KiB are closed by the WebSocket library; outgoing backpressure over 256 KiB closes a slow client. Compression is disabled. Heartbeats terminate unresponsive sockets. A reverse proxy must add its own connection/request limits; source-address accounting intentionally does not trust arbitrary forwarded headers.

The service does not authenticate wallets or trust claimed NFT metadata. There are no currency balances, mint entitlements, prizes, paid entry, or reward writes. Results explicitly contain `rewards:false`.

## Durable results and restart behavior

`ARCADE_DATA_DIR/matches.jsonl` is a **single-writer append journal**. Each match start is written and fsynced before gameplay starts; a terminal result is appended and fsynced before acknowledgement. Match ID deduplication covers concurrent/repeated result processing. Input timelines and simulation hashes are retained with completed results for replay checks. The journal stores no raw invite/session credentials. Player names are not required in result storage.

On boot, unfinished journaled matches become `aborted / service_restart` with no winner and no rewards. The runtime does **not** pretend to recover active rooms, their authentication credentials, or half-completed matches. A final partial journal line is discarded; corruption in an earlier complete line fails startup. Storage write failures disable new matches instead of fabricating successful persistence.

Shutdown stops accepting new rooms, persists active matches as `aborted / service_shutdown`, notifies connected clients, and closes sockets with code 1012. This is safe abort-and-reconnect behavior, **not** seamless rolling migration. Coordinate planned maintenance so users can finish first. Journal capacity, rotation, retention, backups, access control, and deletion policy must be specified before a public service; this development implementation loads the journal index into memory and is not an unlimited-scale database.

Read-only HTTP endpoints:

- `GET /health`: actual connection/room/player/spectator counts, region, overload count, and status. Returns 503 while draining or after storage failure. No player names or credentials.
- `GET /results/:id`: a participating player's `Authorization: Bearer <session>` or configured admin token is required. Unknown/unauthorized IDs both return 404. Invite tokens do not grant result access.
- `GET /replays/:id`: same authorization; returns the immutable stored input replay (or null for an aborted match).

There is no public results-write, restart, mutation, admin-list, or secret-debug endpoint. `ARCADE_ADMIN_TOKEN`, if set, must remain service-side and must never use a `NEXT_PUBLIC_` prefix.

## Production deployment decision — not provisioned

Run one persistent Node process per room-owning shard behind a TLS reverse proxy, with a durable writable volume and an explicit origin allowlist. Bind `ARCADE_HOST=0.0.0.0` only in the intended container/network. Configure a public `wss://` client endpoint separately from the mint site's static/Next hosting. Restrict the volume to that one writer; do not horizontally scale multiple processes against one journal. No provider, paid resource, domain, or production deployment has been created.

Required production environment:

```text
NODE_ENV=production
ARCADE_ALLOWED_ORIGINS=https://your-actual-mint-domain.example
ARCADE_DATA_DIR=/absolute/persistent/volume/arcade
ARCADE_HOST=0.0.0.0
ARCADE_PORT=4010
ARCADE_REGION=your-real-region
```

Production startup fails closed without an explicit data directory and non-wildcard origin list. WebSocket upgrades without a matching origin are rejected. Production infrastructure must supply TLS, durable disk, process supervision, backups, region placement, health checks, and operational alerts; costs depend on the chosen provider and actual load and are not estimated as free.

Vercel now documents [WebSockets in Functions (beta)](https://vercel.com/docs/functions/websockets). It is inaccurate to say Vercel cannot accept WebSockets. Its function-duration and reconnect/instance behavior still require explicit state ownership and migration design. This slice intentionally uses a standalone persistent authority to own its fixed-step rooms and durable journal; ordinary Next API routes are not substituted for that design. A future distributed runtime needs room routing/stickiness, shared durable identity/results, and a tested ownership lease before scaling beyond one shard.

## Verification and remaining gates

Run `node --test scripts/arcade-server.test.mjs` where localhost ports are permitted. The suite creates real isolated WebSocket clients and verifies room creation/join/readiness, spectator read-only enforcement, schema/origin/invite/session/rate/payload rejection, reconnect with the same match ID, neutral input/disconnect forfeit, durable result deduplication, rematch, and a full normally completed best-of-three fight with replay hash verification. Short-grace tests override the duration to keep the suite fast; production defaults remain 15 seconds.

The transport tests inject **50/100/150 ms total round-trip latency**, split across sends/receives, with deterministic ±3 ms one-way jitter. They verify acknowledged inputs, rollback corrections, deadline bounds, and matching authoritative snapshots across two actual sockets. They are transport correctness tests, **not** claims of competitive-quality remote game feel or deployment latency. They do not simulate packet loss, mobile radio stalls, NAT failure, cross-region infrastructure, or sustained production load.

Before public release, perform independent-browser human play at those latencies, keyboard/controller/touch checks, packet-loss and long-stall tests, reconnect during each round/result transition, authenticated production-origin tests, TLS/proxy timeouts, full-capacity load and memory/CPU profiling, disk-full/corrupt-journal recovery drills, backup restore, and planned/unplanned restart drills. The final game's full content/visual/online release gates remain separate from this runnable first slice.

## Railway/content expansion

Use the existing repository/service and start command `node server/arcade/index.mjs`.
The process accepts `ARCADE_PORT`, otherwise Railway's `PORT`, otherwise 4010.
Keep the existing persistent `ARCADE_DATA_DIR`, explicit allowed origins and `ARCADE_HOST=0.0.0.0`.
Use one replica per journal; this is not a shared-volume horizontally scaled runtime.

Deploy the backend update before the new client content. Health/welcome must advertise `games: ["rekt-rumble","wen-lambo"]`, six character IDs, two vehicles and `build: "arcade-content-2"`.
The client waits for welcome before creating/resuming a room and displays an update-required notice for unsupported content. No extra service or database is needed for this slice.

Racing create/join packets carry `game:"wen-lambo", rulesVersion:1`; character means vehicle ID and stage means track ID. Cross-game invitations are rejected. Legacy Rumble packets without game still select Rumble. Race results include `game`, `rulesVersion` and per-race times/points. Replay with `replayFight(replay,RACE_RULES)`.
