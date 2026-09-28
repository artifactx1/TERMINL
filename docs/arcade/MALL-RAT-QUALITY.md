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
