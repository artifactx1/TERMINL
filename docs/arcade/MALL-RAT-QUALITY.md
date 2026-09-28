# Mall Rat quality audit

The full goal remains a large, varied, responsive skateboarding game with
recognizable TERMINL degens, convincing trick animation, long connected lines,
usable mobile controls and enough replay value to invite another run. Automated
checks alone do not establish parity with Tony Hawk's Pro Skater.

## Current evidence

- Park area: 392 × 392 units, seventeen districts, bowl, transfer decks, rail
  yard, five named gaps and two timed routes. `mall-lines-pilot.mjs` traverses
  every named gap and route from spawn using movement inputs.
- Tricks: twelve aerials include front/backflips, varials, tre flips, hardflips,
  grabs and shuvits. Dedicated 360 input and held directional rotation cover
  540/720. `mall-upgrade.test.mjs` checks completion, score timing and poses.
- Presentation: four canonical degens have directional movement and acrobatics
  atlases. Board and rider share heading; the board rotates at the deck center.
  Existing transform regressions cover board direction and foot contact.
- Flow: glancing collisions slide instead of immediately bailing; broad outer
  banks return the player toward the park. Long landings preserve a continuation
  window, and late catch inputs can queue one subsequent aerial.
- Recovery: manual release, rail alignment/cooldown and post-bail release gates
  are covered by simulation checks. Portrait and landscape browser input tests
  exercise real controls rather than changing player state directly.
- Rail lines: the three 105-unit rail-yard rails are eight units apart, allowing
  steered pop-offs into another grind. A spawn-to-three-catch input route passes
  with immediate jumps and with three/seven ticks between release and jump.
  Browser checks cover desktop and actual two-thumb release/jump/catch sequences
  in both phone orientations, including banking the line after releasing controls.
  Transfer bonuses and longest-chain records are covered by regression tests.
- Grind variety: 50-50, boardslide, 5-0 and nosegrind share the rider/board
  heading. Matrix checks verify foot contact and the truck/deck contact with
  the rail. The browser style suite uses ordinary inputs from spawn and checks
  keyboard changes, two-thumb swipe changes, and cancellation without sticking.
  Each new style must be held before scoring; holding the change input does not
  repeat awards. Portrait scoring sits above the rider instead of over the deck.
- Spin landings: odd half-turns land fakie; full turns retain the original
  stance. The catch preserves the visible heading and settles the remaining
  wheel alignment over twelve ticks without changing travel direction. Reverts
  rotate the stance over eighteen ticks and award one link per recent landing.
  The mobile/controller rotate action reverts on the ground and spins in the
  air, resolved from simulation state even before its UI label catches up.
  `mall-heading.test.mjs` covers 180/540/720 catches, repeated inputs, ramp pitch,
  bail cleanup and consistent standing height for all four degen view sets.
  `mall-heading-browser.mjs` checks actual spawn-to-180-to-revert-to-360 lines,
  board/rider alignment, two-thumb reverts, and banking on desktop and phones.
- Retry responsiveness: identical skater/board/graphics runs reuse the loaded
  renderer, geometry, textures and shaders. A browser audit counts actual WebGL
  allocations across retries and compares the restored spawn view after smashing
  scenery. It also covers configuration changes and disposal on route exit.

- Wayfinding: an expandable park map shows districts, walls, ramps, rails and
  the current heading. Selecting a district supplies an obstacle-aware route
  and distance cue; leaving the route triggers recalculation. The map pauses
  the simulation and exposes all three session goals with their current progress.
  `mall-navigation.test.mjs` drives from spawn to all seventeen destinations
  using only steering/push/brake, with no bails, and checks the route segments
  against solid walls. Arrival checks use the destination's actual floor height.
  `mall-map-browser.mjs` verifies desktop, 375 × 667 portrait and 844 × 390
  landscape: goal visibility, paused clock, shortcut isolation, Escape/focus,
  clear destination, and a real-input trip to the rail yard. Mobile checks open
  the map with a second touch while the first holds the stick, then verify that
  movement is released. Rendered HUD bounds keep the cue above the location label.
  These are navigable suggestions, not automatic steering or collision immunity.

- Camera: `mall-camera.test.mjs` projects the rider's head and deck throughout
  every gap, both routes and the full district tour at three screen ratios.
  The browser camera suite follows actual control inputs through the three
  largest transfers and the bowl rim, checks framing/terrain clearance, and
  captures the rendered peak positions. The bowl now has a flat pocket and smooth
  transitions, preserving the chase distance at entry. This addresses measured transfer
  clipping; it is not a blanket claim that all scenery occlusion is solved.

## Completion remains unproven

- Full-course visual consistency and camera readability during complex lines,
  including rails, rooftops and transfers, need broader rendered inspection.
- The rider is still an illustrated mesh using authored view frames, not a
  continuously articulated character. Smoothness between those views needs
  evaluation during fast turns and compounded tricks.
- Physical phone performance, first-time learning, difficulty and repeated
  human sessions remain distinct from deterministic browser verification.
- The variety and satisfaction of the longer-term session loop must be assessed
  against the full goal, not inferred from the number of tricks or a green suite.

## Directional action art

The front and side views now select a pose for the current action instead of
reusing a single standing illustration. Each of the four canonical degens has
fifteen additional frames: left/front/right coast, crouch, air tuck, grab and
grind. Rear push cycles and the existing somersault sheets remain in use.
Directional actions scale against their own view's standing height so a tuck
compresses naturally. Foot anchors are measured from the shoe region rather
than the image midpoint, keeping asymmetric arm poses attached to the board.

- Sources and exact built-in image generation prompts:
  `docs/mall-rat-directional-prompts.json` and `docs/art/mall-rat/`.
- Reproduce the four runtime WebP atlases and metadata with
  `node scripts/prepare-mall-directional.mjs`.
- `mall-directional.test.mjs` checks every frame's alpha gutters, image bounds,
  shoe region and action scale, verifies action selection, and checks real
  authored foot anchors against transformed Three.js board matrices.
- `mall-directional-browser.mjs` drives each degen from spawn through fakie
  rolling, an ollie, grab, landing, side grab and boardslide. It checks release
  back to rolling and records rendered desktop/portrait screenshots. Rail
  approaches account for each character's movement tuning.

These are additional illustrated action poses, not a fully articulated model.
Side/front pushing still uses the coast pose. The broader completion limits
above continue to apply.

## Last-line overtime and replay

At zero, an active combo keeps the run open through aerials, rails, manuals and
the landing link window. The first bank or bail resolves overtime and ends the
session; idle or already-bailed runs still end on time. Closing time no longer
starts a random event. The clock displays elapsed overtime, the result shows
what the final line banked or lost, and the saved record includes that outcome.
The score, next medal target and retry action precede an expandable run breakdown,
so phone players can start again without scrolling through ten statistics.

Ghost recording retains the complete timed run, including overtime and the final
frame, within the existing 2,000-sample cap. Longer runs progressively reduce
sample density. Playback follows timestamps and interpolates position and the
shortest heading arc, including older saves with gaps during bail recovery; the
ghost disappears after its recorded run ends. This remains a position replay,
not a recording of every trick animation or input.

`mall-session.test.mjs` exercises a full three-minute run with a backflip across
the buzzer, successful catch/bank, bail loss, rail/style/release, manual and
landing links, one-time resolution, free skate, saved records, and long ghost
sampling. `mall-session-browser.mjs` uses complete simulation time and real
keyboard/two-touch controls on desktop, portrait and landscape. It checks
overtime pause/resume, result persistence, visible retry controls, the stats
expander, reset state and an ordinary idle timer finish.
