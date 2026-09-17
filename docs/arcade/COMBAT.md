# REKT RUMBLE — rules and rollback v1

This is the **first two-character, two-stage development slice**, not the full eight-character / six-stage release. Margin Call Max and Diamond Hands Pepe use the project’s canonical character references. Their new attack names and victory gags are proposed game fiction, not newly asserted collection lore. No ownership bonus changes damage, movement, health, range, meter or collision.

## Simulation contract

### Browser controls

The default keyboard layout keeps movement under the left hand and fighting under the right:

| Keys | Actions |
| --- | --- |
| A / D | Move left / right |
| W / S | Jump / crouch |
| J / K / L | Punch / kick / special |
| U / I / O | Dash / grab / super |
| Space | Block |

Arrow keys also work for movement. Settings and Move List show the current bindings; Settings supports remapping and resetting the layout. Existing untouched legacy defaults migrate automatically, while custom mappings are preserved. Touch buttons use the same action names. Internal simulation identifiers remain light/heavy/guard/throw for punch/kick/block/grab.

Touch input releases are observed at the window as well as the control. A normal lift releases only that finger; cancellation, lost capture, page exit, focus loss and viewport changes clear held controls. Moon buttons support sliding between directions and release when dragged outside. A missing controller clears its last polled input. Keyboard releases track physical keys even if modifiers or focus change before keyup.

Run `npm run test:controls:browser` against `ARCADE_TEST_URL` to check release recovery, Moon sliding, controller disappearance, the keyboard layout and saved mappings. `npm run test:touch:browser` checks real multi-touch gameplay, auto-gas and mobile layouts.

### Deterministic simulation

`lib/arcade/rumble-sim.mjs` is a pure, renderer-independent 60 Hz simulation. `createFight({characters: ['max', 'diamond'], stage: 'dead-mall'})` creates the match; `stepFight(state, [mask0, mask1])` returns a new serializable state. All positions, movement, attack clocks, armor consumption, held inputs, buffer state, throw windows, meter, stun, round clocks and environmental phases are serialized. Coordinates use a 1,000-unit-wide arena and **height above the floor** for `y`. Position/velocity integration is quantized to 0.001 units. No random source, wall clock, DOM or animation callback participates in outcomes.

The authoritative match has a 90-frame introduction, 3,600-frame rounds, 120-frame round aftermath, 1,000 health and 0–1,000 meter. First to two round wins takes the match. A timeout awards the round to higher remaining health. Equal health or simultaneous knockout draws the round. Draws do not award a win; five rounds is the absolute cap, at which point higher round wins decides, or the match is explicitly a draw. Meter carries across rounds; health resets. Impact freeze does not stop the 60-second clock. Finished-state ticks continue advancing to close the rollback deadline.

Input masks: left `1`, right `2`, jump `4`, down `8`, light `16`, heavy `32`, special `64`, guard `128`, dash `256`, throw `512`, super `1024`. Invalid masks are neutral in the pure simulator and rejected by the input gateway. Opposing horizontal directions cancel. Attack actions require rising edges, avoiding hold-to-repeat spam. Priority is super → throw → special → heavy → light. A six-frame buffer catches late recovery inputs and samples attack edges during hit-stop. Light normals can cancel a confirmed hit into one of the three specials during the authored cancel window; neither heavy nor special loops cancel into themselves.

## Characters and authored moves

Max walks at 3.7 units/frame, jumps with initial velocity 14.8, and has a short command grab as his neutral special. Diamond walks at 3.2, jumps at 14.4, and has a longer neutral special with one startup armor hit. Both have identical base health and meter capacity. Armor halves one hit’s damage but does not stop a throw or protect later recovery. Gravity is 0.62/frame; dash travels 8/frame for 12 frames and does not grant invulnerability.

Every move in `MOVES[character][id]` includes readable name and input, startup/active/recovery, damage, hitstun/blockstun, last-active-frame hit/block advantage, range, authored attack volume, pushback, cancel permissions, resource cost/gain and explicit counterplay. These data drive both the in-game move list and attack timing, not just documentation.

| Move | Startup / active / recovery | Damage | Purpose / defense |
| --- | --- | --- | --- |
| Standing light | 6 / 3 / 13 | 55 | Fast range check; either guard; special cancel on hit |
| Standing heavy | 15 / 4 / 25 | Max 125 / Diamond 115 | Longer whiff punish; slow and punishable |
| Crouching light | 7 / 3 / 14 | 45 | Low; crouch-guard; special cancel on hit |
| Crouching heavy | 16 / 4 / 27 | 100 | Low sweep knockdown; crouch-guard or jump |
| Air light | 7 / 4 / 15 | 60 | Overhead; stand-guard or anti-air |
| Air heavy | 12 / 5 / 24 | 100 | Slower overhead; stand-guard; punish landing |
| Max neutral special | 24 / 5 / 35 | 170 | Command grab; jump, retreat or throw-escape |
| Diamond neutral special | 18 / 5 / 28 | 120 | One-hit startup armor; throw or punish recovery |
| Down special | 10 / 6 / 32 | 130 | Tall anti-air launch; bait and punish on ground |
| Forward special | 19 / 6 / 32 | Max 145 / Diamond 135 | Advancing commitment; guard, then punish |
| Throw | 5 / 2 / 27 | Max 145 / Diamond 120 | Beats guard; range/jump/escape counterplay |
| Super | 14 / 8 / 48 | 300 | Full-meter commitment; eight startup invulnerability frames only |

Range differs by archetype: Max heavy reaches 115 units versus Diamond’s 145; lights reach 75/85. Neutral specials reach 82/160. Consult executable move data for every range and vertical volume. “Advantage” fields assume contact on the last active frame; earlier contact has additional recovery remaining.

Standing hurt volume is ±22 units wide and 170 high; crouching is 105 high. `hurtboxFor()` exposes the same volume to debug rendering. Low attack volumes sit near the floor; anti-air extends to 230. Push-body separation uses a separate 45-unit-wide collision capsule with a 90-unit vertical-overlap condition, allowing airborne crossovers. Foreground art and costume attachments never enlarge hurtboxes.

## Defense, contact and pressure

Hold guard to defend; down + guard blocks lows. Air normals are overheads and require standing guard. Mid attacks allow either guard. Air guard is not available. Guard height can change during blockstun, while movement remains locked. Throws cannot connect against airborne, invulnerable, hitstunned, blockstunned or knocked-down targets. A successful grab provides six simulation frames to press throw and escape. Simultaneous grabs tech automatically. A strike beats a simultaneous grab. Both strike contacts are gathered before damage is applied, so equal-time attacks trade without player-index priority.

Normal blocked damage is 5% rounded down and cannot deliver the final health point. Blockstun is ten frames; recovery/startup and pushback leave an escape or punish gap rather than a perpetual block loop. Blocking earns 25 meter. Landing attacks earns the move’s authored meter; taking a clean hit earns 45% of scaled damage rounded to the nearest point. Supers cost exactly 1,000 and earn no attack meter. Normal successful throws earn 60. Resources clamp to 0–1,000.

Successive clean combo hits scale to 100%, 80%, 60%, then 40% damage, with a 35% minimum if future content extends the sequence. A fourth hit forces knockdown, resets the combo counter, and gives knockdown duration plus 12 frames of invulnerability. Sweeps/supers also provide protected knockdown. Combo tracking expires after 70 non-frozen frames. Brief hit-stop is three frames for smaller impacts or five for damage ≥120. Startup armor and super invulnerability are deliberately different mechanics.

Training events report `WRONG GUARD`, `COUNTER / RECOVERY PUNISH`, `CLEAN HIT`, block, armor, throw escape and protected reset. An event has deterministic `tick:index` identity. Reconciliation consumers must deduplicate these IDs so a replayed impact never sounds twice. The newest 24 events remain in state.

## Stages

- **Dead Mall Exchange:** fixed legal horizontal positions 42–958. No environmental damage or changing geometry.
- **Liquidation Laundromat:** casual timed side-lane closure. Every 1,200 combat phase frames, frames 480–599 show a two-second warning; frames 600–959 close the edges to 160–840, then reopen. This changes usable spacing and corner pressure, not merely colors. Closure safely clamps positions and never directly damages players. The clock and bounds are server-owned and replayable.

These are casual stage rules, not a claim of ranked certification. Balance, latency and visual-quality playtesting remain release gates. The other four fighter stages, remaining six characters, full circuit and increasingly difficult practice ladder are not implemented by this slice.

## Authoritative rollback contract

`lib/arcade/rollback.mjs` provides `RollbackFight`. Input tick `t` drives the transition from state `t` to `t + 1`. Missing updates hold the last accepted mask. `submit(slot, tick, input, seq)` accepts only slots 0/1, safe nonnegative integer sequence/tick and known mask bits. Sequences strictly increase per slot. A newer sequence may replace a same-tick mask, accommodating multiple key changes inside one rendered frame. Duplicate or older sequences are rejected. Inputs more than **12 frames late** or **6 frames ahead** are rejected. Transport-level rate limits and identity validation belong to the room service.

The wrapper retains the current snapshot plus 120 previous snapshots, restoring the snapshot before a late input and re-simulating at most 12 frames. Timeline entries retain accepted inputs for replay. `advance()` steps once. `clock`, `state`, `acks`, `confirmedTick`, `corrections` and `confirmed` expose authoritative status. `confirmedTick` is `max(0, clock - 12)`. A natural final result becomes confirmed only after 12 additional ticks have elapsed; confirmed matches reject further input. `forceNeutral(slot)` cancels queued future movement and inserts neutral now without consuming the client’s sequence number, enabling safe disconnected-player behavior.

`exportReplay()` records version, rules options, tick count, ordered input changes, final hash and confirmation status. `replayFight(record)` validates and replays that timeline. `stateHash()` is a compact deterministic FNV-1a debugging checksum, **not** a cryptographic integrity proof. Server-authenticated persisted records, not a client-supplied checksum, establish result authenticity. Administrative forfeits must be recorded as an explicit service result outside the natural combat replay; mutating health to simulate a forfeit would make input-only replay misleading.

## Verification

Run `node --test scripts/rumble-sim.test.mjs`. Tests exercise deterministic/immutable playback, all authored move metadata, movement/jump/dash/bounds, startup and range, high/low guard, throw escapes and trades, distinct specials/armor/anti-air, meter, scaling/protected knockdown, hit-stop input buffering, guard switching, stage warnings/geometry, round/draw policy, late input equivalence, replay hashes, rejected input, disconnect-neutral behavior and delayed final confirmation. These unit tests do not establish browser responsiveness, visual quality or independent-human multiplayer readiness; those require the separate browser and room-service verification.
