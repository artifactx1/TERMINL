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
