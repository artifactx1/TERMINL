# Mall Rat park and trick expansion

User goal: a substantially larger, flowing and replayable TERMINL skating game with more jumps, 360s, front/backflips and varials, better art, and no unwanted grind/manual state. The quality reference is Tony Hawk Pro Skater; passing a narrow test is not evidence of that overall quality.

Required work and acceptance evidence:
- Expanded connected park: at least four times current skateable area, distinct bowls/transfer/rail/street areas, readable routes, generous landing zones and forgiving wall contact. Verify full input-driven tours and render every area on desktop/mobile.
- Trick depth: flips, shuvits, varials, tre flips, multiple grabs, explicit 360/540/720 spins, front/backflips, linked grinds/manuals/reverts. Verify input, actual visible motion, scoring, repeat handling, landing and cancellation.
- Remove stuck grind/manual: explicit state lifetimes; airborne aligned rail catches; reliable dismount/end/release; mobile assistance cannot leave the rider balancing forever. Test actual touch holds/releases and rail exits.
- New art: canonical degens, coherent front/backflip sequences, stable pivots and foot contact. Inspect original sheets, packed atlases and frame sequences in the game.
- Replay loop: named gaps, routes, medals/milestones, persistent records and progression, clear feedback and immediate retry; avoid score exploits. Verify saves, restart, full sessions and free skate.
- Controls: discoverable desktop/controller controls and usable two-thumb mobile controls for the entire expanded trick set. Verify portrait and landscape.
- Performance and production: bounded effects/actors, suitable mobile rendering, no regressions to RUG.EXE/shared code, lint/build/tests, live verification after deployment.

Release baseline: main 92919c0. Prior yaw handedness, shared rider/board heading, centered flip pivot and travel-aligned camera fixes remain intact.

## Implemented in the park expansion

- A 392 × 392 connected park (5.2 times the previous footprint), seventeen districts, a recessed bowl, mega ramp, street transfers, canal banks, rail yard and outer loop. Shorter storefront barriers and glancing wall slides reduce interruptions.
- Twelve aerial tricks, explicit 360 spins and held directional spins, variable jump height, buffered jumps, ramp launches and timed catches. Grinds require an aligned airborne approach; releasing grind/manual ends the hold.
- New eight-frame somersault art for all four canonical degens. Versioned motion and acrobatics atlases stay within the existing decoded texture budget. Source prompts are in the adjacent acrobatics prompt JSON files.
- Five named gaps, two timed routes, score medals, milestones, three-minute runs and persistent discoveries, route records and ghosts.
- Fixed mobile JUMP, selected TRICK, 360 and GRIND controls; a visible eight-trick picker; automatic banking after landing and release; larger touch targets and separate mobile help.

## Verification before release

- Full arcade suite: 135 passing tests before the final takeoff-origin correction. After-hours suite: 39 passing tests after that correction, including an input-driven traversal of every named gap and both routes.
- Production build, lint and asset validation passed. Decoded textures: 196,097,848 bytes within the 201,326,592-byte budget.
- Browser: all seventeen districts toured with movement input on desktop and mobile; all four degens' front/backflip sequences captured and checked through inversion, catch and banking.
- Browser: portrait and landscape two-thumb jump/trick/spin, picker, steering, manual release, automatic banking and pause/help passed. Primary controls remain reachable and secondary targets are at least 44 pixels.
- Browser: all five gaps and both routes awarded and saved; full timed run, records and ghost passed. All eight RUG.EXE campaign stages and portrait/landscape RUG touch checks passed.

This is a tested release checkpoint, not a claim of quality equivalence with Tony Hawk Pro Skater. Further playtesting should examine long free-skate progression, advanced control parity, steep ramp back faces, map legibility and linked rail lines. Physical-device frame rate and touch comfort still need human playtesting.
