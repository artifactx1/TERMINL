# WEN LAMBO — California cup preview

Play `/os/lambo`, or choose WEN LAMBO from `/os`. REKT RUMBLE, Rug Runner and Moon Mission remain available. This is a two-driver, six-course Grand Tour preview, not the master brief's eventual eight-track/eight-player release.

## Drive

- Up/W or GAS accelerates. Down/S or BRAKE / REV brakes, then reverses at a stop. Reverse is speed-limited and steering reverses with travel direction.
- Left/right or A/D progressively turn the steering wheel. Wheel travel and yaw are damped, rather than instantly changing heading. The chase camera interpolates on the render clock between simulation/network updates.
- Space while turning at speed drifts. Release to bank earned charge; Shift spends boost on forward acceleration. Checkpoints also grant a small boost refill.
- R returns behind the last valid checkpoint, costs 15 boost, and has a three-second cooldown. It never advances progress. Ghosting briefly prevents spawn/recovery collisions.
- Escape pauses practice only. Blur/hidden tabs clear held input. Online clocks continue through settings and disconnects.

Controller mapping: left stick/D-pad steer, RT/A gas, LT/B brake/reverse, X drift, RB boost, Y recover. Physical controller and touch-device validation remains pending.

Mobile: slide the left thumb pad without lifting to change direction; the simulation still applies progressive steering. Auto-gas is on by default, starts only after touching a driving control, and can be switched off. BOOST includes GAS even in manual mode, so steering + boost takes two thumbs, not three fingers. BRAKE / REV overrides auto-gas, held gas and boost. Hold it at a stop to reverse. DRIFT banks charge on release as before. Touch interruption, pause, settings, resizing and leaving clear pointer ownership and cruise activation; resume requires fresh input. Controls adapt to portrait/landscape and respect safe-area padding.

Touch steering uses a 28% center dead zone and a progressive thumb-distance curve. The client feathers existing direction inputs against actual/predicted wheel travel, so a held small correction cannot gradually become full lock. The precision zone stays gentle. Deliberate outer-rim travel reaches full lock at rest and 70% at full Comet speed. Lower-speed turning, braking and off-road reverse traction are improved; barrier contact removes inward velocity without wiping out movement along the wall. The seven-bit input format is unchanged, but racing physics is now rules version 2. Deliberate DRIFT keeps continuous directional input to preserve drift-charge banking. Physical handling and latency feel still need human evaluation.

Choose LEARN TO DRIVE for a guided single-track practice run. QUICK RACE runs the selected course against a labeled bot without the lesson overlay. SIX-COURSE CUP runs all six tracks. All cars and the Pepe driver are free; no ownership or paid performance advantage is claimed.

## Cup rules

Pacific Coast Run, Sunset Canyon, Redwood Rush, Diamondback Pass, Neon Afterhours and Golden Hour GP each require three laps through every ordered checkpoint. The internal IDs `night-market` and `liquidation-docks` are retained from development fixtures; displayed names/art now follow the California direction.

First finisher gets 10 points, second 6, exact simultaneous finishes 8 each, DNF 0. Each race ends at 120 seconds, or 30 seconds after the first finish. The eight-second results interval leads to the next course. Highest combined points wins; lower combined race time breaks a tie. A DNF counts as 120 seconds for that comparison. Exact equal totals draw. No cash, token, NFT or mint rewards are written.

## Real online play

CREATE RACE gives a private invitation. A second browser joins and both drivers ready up; invited spectators see the same authority. The existing Railway process hosts both games. `NEXT_PUBLIC_ARCADE_WS_URL` is the shared public WSS endpoint. Deploy the updated backend before using the new content. `/health` and the WebSocket welcome advertise `games`, `characters`, `vehicles`, `tracks`, `rulesVersions`, and `build`; old authorities produce a clear update-required notice, not a broken join.

Inputs are seven bits (0–127); clients cannot submit coordinates, checkpoints, time, score or winner. Fixed 60 Hz authority, 20 Hz snapshots, bounded rollback, local prediction, remote interpolation, 15-second reconnect grace, forfeit, two-vote rematch, durable results and participant-authorized replays use the shared room/transport foundation. Client render/art cannot grant a lap or finish.

## Art and verification

The playable road is a perspective projection of the actual shared world geometry, not an animated road movie. This is a Canvas 2.5D presentation, not a full 3D licensed car simulator. Generated California plates and sprite layers are used in the game; cars are unbranded design homages with Pepe seated in the cockpit. The original pixel fighters remain code-native articulated rigs. See `CALIFORNIA-ART.md` and `GRAND-TOUR-ART.md` for prompts, source paths, provenance and approval limits.

`node --test scripts/race-sim.test.mjs` checks deterministic cups, reverse/steering, input validation, checkpoint order, recovery, physics penalties, scoring, bounded rollback and replay reproduction. `node scripts/race-smoke.mjs` checks actual browser driving, reverse, all six environments, the rival tracker, settings, mobile layout and six-fighter navigation. `npm run test:race:browser` runs two independent browser drivers and a spectator through a real full cup, reconnect, durable replay, rematch and forfeit. Browser pilots use ordinary DOM keys; they never inject positions or results. Browser engine can be selected with `ARCADE_TEST_BROWSER=firefox` or `webkit`.

Automated correctness is not a substitute for your steering-feel feedback or human art/audio approval. Hardware touch/controller, sustained multi-room load, packet loss, production-origin/TLS and Railway volume/restart drills remain release work.

## Rival tracker and version compatibility

The live map uses lime for YOU, pink for RIVAL and a pale square for the next gate. Heading markers stay readable on high-DPI phones. The nearby rival panel reports approximate course distance ahead/behind and physical bearing relative to the car, including rivals outside the chase camera. These are display-only estimates using validated sectors, not race authority or time gaps. Distance uses the same arcade scale as the speed display.

Racing rules version 2 requires matching frontend/backend versions. Old racing clients are rejected; old authorities show an update notice. Rumble stays version 1. Archived v1 race replays still reproduce their original hashes through `race-sim-v1.mjs`; new replays carry `rulesVersion:2`. The bounded race replay limit is 48,000 ticks for a maximum-duration six-course cup. Results remain reward-free.

`node scripts/grand-tour-browser.mjs` verifies six online course starts with two real browser clients, reconnect, forfeit and authenticated saved replays against an isolated local authority. This is not a full online-cup soak test. See `STAKED-RACING-DESIGN.md` for the separate, unimplemented player-funded Duel proposal.
