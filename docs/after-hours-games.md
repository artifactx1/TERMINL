# MALL RAT and RUG.EXE

Implementation of the supplied `TERMINL_Mall_Rat_RUG_EXE_Astra_Build_Brief.md`, following movement → scoring/combat → playable route → content → verification. Both games use the existing TERMINL theme and arcade navigation, with new cards linking to `/os/mall-rat` and `/os/rug-exe`. Mint, wallet and existing game protocols are unchanged by these games.

## Runtime

- Three.js 0.180.0, loaded only through the two dynamically imported game pages. WebGL 2 is required; unsupported browsers receive an actionable fallback.
- Fixed 60 Hz simulations, bounded catch-up, render-independent movement, responsive canvas sizing, high/low render resolution, reduced-motion presentation.
- Illustrated degen skate poses, mall props/storefronts, shooter enemies, first-person weapons and terminal wall textures over skateable/shootable 3D geometry. All runtime art is served locally; music and effects remain procedural. Card previews are captures of the actual games.
- State/physics, scoring, world content, weapons/AI, rendering, input, audio and persistence are separate modules under `lib/arcade/after-hours`.
- Keyboard, controller and dedicated two-thumb touch controls. RUG.EXE supports pointer lock, drag aiming and controller aiming. Escape/blur/visibility loss clears inputs and pauses; restart is R.
- F3 displays collision geometry, position, rail/combo diagnostics or enemy/projectile counts. Tuning exports are in each simulation module.

## MALL RAT

180-second score attack or untimed free skate. Max, Diamond Hands Pepe, MEV Mia and Cold Storage Chloe have four illustrated skate poses each, recognizable canonical outfits, small traits and different specials. Legacy character IDs preserve existing saves and perks. The interconnected mall includes the atrium, garage, food court, arcade, store, theater, service area, elevated roof and basement. A minimap and zone signs orient the player.

Movement includes acceleration/braking, steering, ollies, air rotation, flip/grab variations, forgiving rail snapping, manuals, wallrides, quick-turn/revert, bails and quick recovery. Ground movement preserves momentum. Rails, ramps, the fountain gap and rooftop access establish repeatable lines.

Trick repetition receives diminishing returns. Landings provide a continuation window; manuals or another trick keep a combo alive. B banks safely, a bail loses only unbanked points, and long holds increase the multiplier. Character specials, zone transfers, gaps, destruction and secrets add score. A second property-damage score and a secondary REKT total reward chaos.

Destructible props persist for the run. Guards escalate into pursuit, carts and gates. Seeded run events include flash crash/rebound, bull run, floor collapse, power outage, walkers and gas war. Three seeded challenges vary the route. Nine VHS tapes unlock board colors and a RUG.EXE clue. Finishing the shooter unlocks the corrupted board.

Local records retain total score, damage, longest combo, max multiplier, biggest bail and fastest challenge. The best scoring run stores bounded 10 Hz movement samples for a personal ghost. Free skate does not submit timed-run records. Tape discoveries save during play, including free skate.

## RUG.EXE

Eight campaign segments: Presale, Liquidity Pool, Order Book, Mempool, The Bridge, Cold Storage, Exit Liquidity and Dev Wallet. Presale and the Liquidity Pool slice are available initially; completing a segment unlocks the next.

The shared combat foundation is fast running/strafing, jump and air control, crouch/slide, dash, recoil launch, portfolio health, damage-absorbing collateral and seven leverage tiers. Quick kills raise leverage; downtime resets it. High leverage slightly increases incoming risk.

All eight weapon roles are implemented: accurate infinite sidearm, close-range shotgun, continuous GWEI burner, collateral-powered explosive, delayed area airdrop, projectile reflection, knockback bag and rare area-clear/escape ultimate. Pickups and secret rooms unlock the advanced weapons. Enemy behavior covers ranged bots, splitting Sybils, telegraphed snipers, slam Whales, durable Bagholders, buffing Influencers, zone-placing Moderators and fleeing/spawning Managers.

Each segment has flanking lanes, ramps, pickups, two required controls, a kill quota, three secret methods and an exit. Level rules add drained shortcuts, moving order platforms, conveyors, bridge interruption/gaps, slippery power restoration, disappearing false scenery, and the final collapsing escape. The final sequence returns to the entrance portal; it does not use a boss health bar. Successful escape shows FUNDS ARE SAFU, an illegal-operation screen and the result summary.

## Persistence and scope

Versioned, bounded local storage uses `terminl:after-hours:v1`. Missing, malformed or unavailable storage falls back to a usable in-memory session. No wallet or online account is required.

Records and ghosts are local, not a verified public leaderboard. Optional synchronous trick-attack multiplayer, friend/public ghosts and licensed music are not implemented. Art combines generated illustrations with code-native geometry. Physical-device performance and human balance/playtesting remain distinct from browser automation. Automated completion demonstrates reachable objectives and functioning loops, not a subjective guarantee that the games meet the brief's “one more run” bar. Expert scripted routes are much faster than a first exploratory playthrough; 5–10 minute human shooter pacing remains to be measured.

## Verification

- `node --test scripts/after-hours.test.mjs`: movement, rails, scoring, run duration, storage fallback, weapon ranges/resources/cover, Sybil splitting, collateral, leverage, objectives, secret rooms and final escape.
- `node scripts/after-hours-pilot.mjs --output=/tmp/terminl-rug-plans.json`: reproducible full campaign routes using ordinary simulation inputs, including resource pickups and combat. It asserts every level completes without editing health, enemies, controls or outcomes.
- `node scripts/after-hours-browser.mjs`: uses those input plans through browser keyboard/pointer handlers. It checks the full skate timer/result/save, every campaign completion, progression, cross-game cosmetic and mobile menu. Rendering is throttled during accelerated playback; screenshots use the real renderer.
- Existing arcade regression tests and lint remain part of final verification.

Renderer reference: [Three.js official documentation](https://threejs.org/docs/).

Verification covers the full eight-level browser campaign, a timed skate run, persistence, mobile multi-touch, asset inventory, lint and a production build. The focused suite also checks queued taps, neutral friction, brake priority and assisted rail release. Static immutable scenery is batched by material; mutable gameplay objects retain separate meshes.

## September 2026 visual and touch rebuild

- Mall Rat: selected degen atlas, illustrated palm/bench/kiosk/cabinet/security props, marble-and-brass storefronts, terrazzo concourse, glass balcony rails, skylight structure and contact shadows. Board unlocks now tint under-board lighting. Texture assets live in `public/arcade/mall-rat`.
- Touch skating: proportional left thumbstick, automatic push while held, pull down to brake, assisted grinds/manuals; contextual OLLIE/FLIP plus BANK and SPECIAL. Ollies suppress rail reattachment during ascent. BANK queues until landing.
- RUG.EXE: six enemy illustrations with telegraph/hit feedback, eight distinct first-person weapon illustrations, textured terminal walls, grating floors and lit paths. Sybil/manager variants reuse related silhouettes with distinct tint/behavior. Texture assets live in `public/arcade/rug-exe`.
- Touch shooting: proportional movement/strafe stick, right-side drag aim, hold-and-drag FIRE, jump/dash/use/slide buttons, reachable weapon selector. Captured pointers release on up/cancel/lost capture; blur and pause clear all movement/fire/aim state.
- Asset creation used built-in imagegen, with canonical project portraits as skater identity references. Prompt sets: `docs/mall-rat-art-prompts.json`, `docs/mall-rat-props-prompt.txt`, `docs/rug-exe-art-prompts.json`. Background extraction and spacing edits produced the final alpha sheets; packing scripts retain disconnected details and isolate sprites.
- `scripts/mall-touch-browser.mjs` and `scripts/rug-touch-browser.mjs` use actual CDP multi-touch input at 390×844 and 844×390. Captures are under `artifacts/after-hours-v2`.
- The complete inventory remains bounded at 192 MiB decoded. Each game loads only its route assets; Mall Rat loads only the chosen skater. Source PNG sheets are for reproducibility and are not fetched by gameplay.

### Mall Rat directional skating upgrade (2026-09-25)

The original camera-facing body-and-board sprite made forward travel look backward. All four canonical degens now have twelve body-only poses, with rear chase views for pushing, crouching, ollies, flips, grabs and grinds, plus left, front and right views. `mall-animation.mjs` selects the facing from the actual camera-to-rider angle. An independent 3D deck, grip, trucks and wheels share the rider's heading and animate board flips separately. The new atlases replace the v1 atlases in the runtime asset inventory; the total decoded inventory stays under 192 MiB.

Original transparent sheets are `public/arcade/mall-rat/*-motion-v2.png`; runtime atlases are `*-motion-atlas-v2.webp`. Exact generation prompts are in `docs/mall-rat-motion-prompts.json`. Rebuild atlases and frame/foot metadata with `node scripts/prepare-mall-motion.mjs`. The packer uses a consistent anatomical scale across each sheet rather than independently stretching every pose.

Skating now has smoothed steering, airborne momentum with independent body spins, ramp-lip launches, downhill surface following, buffered ollies, landing compression and impact cues, trick cooldowns, manual/grind balance, and grind sparks. Opposing plywood banks create an opening fountain transfer. The chase camera follows turns and speed, pulls in at walls, and fades props and the fountain sculpture when they hide the rider. Touch controls retain assisted grinds/manuals and add GRAB. Assistance enters a manual only when a combo exists. Individual press IDs preserve a second quick touch tap even if no released-input frame occurs between taps.

Verification: focused simulation tests cover directional selection, atlas bounds, air momentum, ramp ascent/descent, landing, buffered ollies, cooldowns, balance and quick taps. `node scripts/mall-motion-browser.mjs` exercises all four degens through real keyboard input and captures each animation in `artifacts/mall-motion-v2/`. Portrait/landscape touch checks cover both games; the complete after-hours browser flow covers Mall Rat's timer, banks, saves and ghost plus all eight RUG.EXE levels. This remains an illustrated sprite-based arcade skating game with four directional views, not a fully skeletal 3D character system.

Final release checks: 119 arcade tests passed; lint, asset validation and the isolated production build passed. All four skater motion flows passed. Portrait and landscape touch tests now use a controlled simulation clock and release the correct CDP contact; they explicitly verify flip and grab poses, preventing unrelated combo points from producing a false pass. Full campaign verification reported no browser errors.

### Skateboard stability fix

The grip plane was coplanar with the deck's upper bevel, causing depth flicker. It now has physical separation, an opaque alpha-cutout material, and a small depth offset. Wheel axles are baked into the geometry; rotation runs only around that axle and accumulates from distance travelled instead of multiplying the run's age by its current speed. The board pitches with ramps. Ordinary air steering no longer adds a spin: hold a flip/grab with steering to request one. Touch ollies do not request a spin. Landing clears the visual spin and old trick animation so a new ollie cannot replay a previous flip.

Verification adds regression coverage for deck/grip separation, wheel axle geometry, distance-based rotation, ordinary air steering, held touch ollies, and landing/rejump state. All 27 after-hours tests passed; desktop motion checks passed for all four skaters and two-thumb ollie/flip/grab checks passed in portrait and landscape.

### Deck-center pivot and rider contact correction

The earlier stability fix left the board assembly pivot at ground level while the slab sat above it. The assembly is now centered on the slab's actual geometry bounds, preserving its resting placement. `poseSkateboard` rotates the centered assembly and derives the rider's foot anchor from the transformed grip surface. Ordinary ollies and grabs no longer add an independent vertical hover. Flips briefly separate the feet, complete one rotation, and return to a planted catch pose during the final fifth of the trick.

Regression coverage tracks the actual deck center through 25 flip angles and verifies that planted feet follow the grip through combined pitch, roll and heading changes. The browser script captures takeoff, quarter-turn, inverted, three-quarter-turn and catch frames, with the comparison in `artifacts/mall-motion-v2/flip-pivot-sequence.png`. All 28 focused tests and all four skater browser flows passed.

### Steering direction and shared rider transform

The steering defect had two additional causes: simulation yaw uses `(sin(yaw), -cos(yaw))` for forward travel, but a Three.js model whose nose is local `-Z` requires **negative** Y rotation for that convention. Also, the rider was a camera-facing `THREE.Sprite`, so the board turned independently underneath an image that stayed facing the camera.

The rider is now an alpha-cutout textured mesh. Rider and board share one parent heading transform; front/side/rear art compensates only for its authored viewing direction. The foot anchor follows the transformed deck. Tests compare the real transformed board nose against travel and compare rider/board world directions, including left and right turns. Browser checks also compare the board nose against measured player displacement, with a steering contact sheet in `artifacts/mall-motion-v2/steering-connected.png`.


### Combo flow and bail recovery (2026-09-26)

- Long transfers now provide at least 45 simulation ticks to link the next ollie
  or manual after landing. The HUD shows the remaining continuation window;
  coasting still banks the line automatically.
- A fresh trick press during the final 12 ticks of a catch queues one next aerial.
  Held buttons do not repeat moves. Landing and bailing discard queued actions.
- Bails clear airborne moves, rotations, queued jumps and grind balance. A held
  grind/manual must be released before another link, preventing an involuntary
  manual as soon as the skater recovers.
- Focused simulation checks cover long transfers with buffered ollies, queued
  catches, held-input recovery and existing course routes. The touch browser
  suite additionally exercises these transitions with real input handlers.


### Full-height chase camera and terrain clearance (2026-09-26)

The previous camera followed 65% of airborne height. Replaying the canal and
Snake Run lines projected the rider's head beyond the viewport on 37 frames.
The camera now tracks the full jump with bounded vertical smoothing and follows
its own terrain clearance. A shortened wall/rim camera also shortens look-ahead,
keeping the deck visible instead of aiming past the player.

`mall-camera.test.mjs` checks head/deck framing and lens clearance through all
five gaps, both timed routes and the complete district tour on desktop,
portrait and landscape. `mall-camera-browser.mjs` checks real input-driven
transfers and bowl entry in the renderer; captures live under
`artifacts/mall-camera/`. The travel heading remains shared with the board,
preserving the previous steering-direction fix.

The bowl itself now has a flat pocket and smooth entry/exit transitions. The old
hemisphere approached a vertical cliff at the coping; it caused a sharp ground
height change and a one-unit camera pull-in. The new profile keeps the normal
chase distance through the tested bowl entry. Decorative depth bands sample the
same surface as collision and rendering. Regression checks bound the transition
slope and verify that the coping joins the deck smoothly.

### Rail transfers and mobile pop-offs (2026-09-28)

The rail yard now has three 105-unit rails spaced eight units apart. Jumping
with left/right steering launches toward the adjacent rail; holding GRIND again
catches it on descent. Catches align position and travel heading immediately,
and rail jumps no longer inherit lift from an earlier ramp.

Releasing GRIND exits immediately, while an eight-tick jump window lets one
thumb move from GRIND to JUMP and still pop off the rail. Different-rail catches
award transfer points, show the chain in the HUD, and save the longest chain in
local records. Ground landings, bails and banking break the transfer chain.

`mall-rails.test.mjs` covers three catches from spawn, delayed mobile jumps,
release expiry, same-rail scoring, stale ramp lift, resets and saved records.
`mall-rails-browser.mjs` replays the line on desktop and uses actual two-thumb
input in portrait/landscape, checking release, both transfers and banking.
Captures are in `artifacts/mall-rails/`. All 150 arcade tests, lint and the
isolated production build passed for this update.

### Grind styles and readable phone tricks (2026-09-28)

Rail tricks now cycle through 50-50, boardslide, 5-0 and nosegrind. On keyboard,
tap J while holding L; on controller use X while holding Y. On touch, keep GRIND
held and slide that thumb left. Return the thumb and slide again to change to
the next style. The button shows this hint while grinding. Releasing or
cancelling the contact still releases the rail immediately.

Changes need a short settling period, and a style earns points after eighteen
ticks held. Each style scores once per catch, so repeated taps cannot farm
awards. The rider and deck turn together into a boardslide; 5-0s and nosegrinds
lift the appropriate end, with contact placed at the truck. Exits blend back
toward travel, and bails clear all grind pose state.

Portrait combo text moves above the action to keep the feet and deck visible.
`mall-grinds.test.mjs` checks a real spawn-to-rail line, score timing, held input,
recovery, and transformed foot/truck/deck contact. Run
`node scripts/mall-rails-browser.mjs --styles` for rendered keyboard and
two-thumb checks; add `--small` for a 375×667 phone. Screenshots live in
`artifacts/mall-rails/style-*.png`. The default browser suite still checks rail
transfers and mobile pop-offs.

### Reuse the park between runs (2026-09-28)

Starting or retrying with the same skater, board and graphics settings now
reuses the loaded Mall Rat renderer. Each run still gets fresh simulation,
input handlers and score/save bookkeeping. Camera smoothing, sparks, particles
and audio beat state reset, so effects from the previous line do not carry over.
The next draw restores props, tapes, route markers, lighting and actors from
the new simulation. Changing render configuration replaces the scene; leaving
the page disposes it. RUG.EXE retains its existing per-level scene lifecycle.

`npm run test:after-hours:restart` audits actual WebGL context, shader and
texture operations across eight retries, compares the spawn image after
smashing scenery, changes skater/quality, checks route-exit disposal, and
smoke-tests RUG.EXE firing and retry. `--baseline` profiles the old behavior
without requiring reuse. Screenshots are under `artifacts/mall-restart/`.

The pre-change production profile rebuilt thirteen shader programs on every
start/retry; two measured retries took about 1.8 seconds each. The local reuse
profile retained those programs and measured roughly 0.3–0.6 seconds across
eight retries, including an eighty-millisecond test wait. These are browser
automation measurements, not a physical-phone performance guarantee.

### Skatebook and persistent career (2026-09-28)

The menu and paused park map now expose eight career goals with measured
progress, practice hints and district guide buttons. Gap Hunt names all five
gaps and their approaches; district visits accumulate across sessions; the two
marked routes show personal times. Deck Unlocks explains the existing tape
and RUG.EXE rewards. Choosing a practice destination from the menu starts the
selected timed/free-skate mode; choosing one from the map resumes the paused
run. Guidance targets the district, with the text explaining where to skate
inside it.

Career checkpoints now include banked score/combo records, landed airtime and
jump distance, visited districts, discoveries and route personal times.
Previously, a free-skate line with no tape/gap/route discovery could lose its
milestones on reload. Route improvements also save after the rolling run
history reaches twenty entries. Free skate does not create timed leaderboard
records or overwrite the timed ghost. Schema-v1 saves retain existing earned
goals and use their prior best score as a starting career record. Local storage
failure retains progress for the current visit and displays a notice.

`node --test scripts/mall-career.test.mjs` covers real-input rail progression,
cumulative discoveries, legacy saves, route history limits, unbanked/bail
exclusion and storage failure. `node scripts/mall-career-browser.mjs` exercises
a real rail line, persistence through reload, goal progress, menu practice
routing, paused-map shortcut isolation and guide/resume at 1280×850, 375×667
and 844×390. Screenshots are in `artifacts/mall-career/`.

This improves session continuity and discovery. It does not establish Tony
Hawk Pro Skater parity, long-term replay appeal or physical-phone performance;
those remain broader play-quality requirements, beyond these regression tests.

### Free-skate starting spots (2026-09-28)

Free skate can start in any of the seventeen districts. The menu exposes a
starting-spot selector when Free skate is checked; the paused map also offers
“Start free skate here” for its selected district. These are authored runups,
not arbitrary teleports onto a ramp edge. Each has a short first-line hint.
The rail-yard runup catches its center rail with push + grind in under two
seconds; the mega, plaza, canal and snake starts lead into their named gaps.

A session start creates a fresh free-skate run and clears the active combo,
input, rail/manual state and score. The map says this before the action.
Previously earned career progress remains on this device. R and the pause
menu's “Retry this spot” reuse the selected start, renderer and assets. Timed
runs ignore this preference and always start in the atrium; free-skate runs
continue to stay out of timed records and ghosts. Selecting a district counts
as visiting it for the local career, just as arriving there on the board does.

`mall-spots.test.mjs` checks all starts and their first-second runups, terrain
height, camera framing at three aspect ratios, real rail/gap approaches,
retry/save separation and timed-start isolation. `mall-spots-browser.mjs`
checks the full menu → rail catch → backflip → bank → retry → map session flow,
held-input release, rooftop/basement starts, retained career progress and the
return to a timed run at desktop, portrait phone and landscape phone sizes.
It visits all seventeen starts on desktop and the elevated/lowered starts on
both phone layouts. Screenshots are in `artifacts/mall-spots/`.

Starting directly at a destination skips that already-satisfied arrival goal
when picking the three session challenges. It gives no arrival trick points.
The big-air start sits six metres off the centerline so a concourse lamp does
not obscure the rider. Phone session hints sit clear of the riding-status
readout and disappear as soon as a combo begins.

### Rail landings and board contact audio (2026-09-28)

Catching a rail closes the incoming jump: airtime, distance and eligible named
gaps count at the catch, while the combo stays alive. Holding a grind adds no
air distance. Riding off starts a new measured fall; bailing discards its
unfinished measurement and clears pending aerial state. This fixes rail catches
missing jump records and exits inheriting distance from a previous jump.

Wheel rumble and metallic grinding now follow actual board contact and speed.
Airborne skating is quiet between the short pop and landing clacks. Manuals
have a quieter rolling sound; rail catches have a brighter impact. These are
procedural Web Audio sounds, with two reusable filtered-noise loops and bounded
short-lived impact voices. Pause, results and disposal silence contact audio;
the existing Sound control applies to it alongside music and other effects.

`mall-contact.test.mjs` covers real rail catches/exits, gap-to-rail scoring,
bail cleanup, career persistence and contact levels. `mall-audio-browser.mjs`
renders the sound engine through OfflineAudioContext and checks actual amplitude
and silence, then exercises rail contact, falling, pause/resume, mute, retry
reuse and route-exit cleanup in desktop and mobile layouts. It writes a seven-
second sound preview to `artifacts/mall-contact/contact-preview.wav`.
