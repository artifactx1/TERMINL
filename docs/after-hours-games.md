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

150-second score attack or untimed free skate. Max, Diamond Hands Pepe, MEV Mia and Cold Storage Chloe have four illustrated skate poses each, recognizable canonical outfits, small traits and different specials. Legacy character IDs preserve existing saves and perks. The interconnected mall includes the atrium, garage, food court, arcade, store, theater, service area, elevated roof and basement. A minimap and zone signs orient the player.

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
