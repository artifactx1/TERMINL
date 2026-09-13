# Arcade QA and evidence

## September 13 mobile controls

Both games use a shared pointer-owned thumb pad and large action controls, with independent simultaneous fingers, slide-to-change direction, cancellation cleanup, pause/settings/rematch resets, and fixed-height feedback to prevent targets shifting under a finger. Touch adapters emit the existing input masks; server physics, move balance and replay rules are unchanged.

WEN LAMBO's touch BOOST now includes throttle; brake overrides all touch throttle/boost sources. Optional auto-gas frees the right thumb for brake/drift/boost. Rumble exposes directional move hints and the full-meter super requirement. Heavy swings, lunges, grabs and supers have distinct code-native poses rather than reusing the jab pose.

`npm run test:touch:browser` passes using real Chromium multi-touch events through React into local game simulation: one-thumb boost consumes charge and increases speed, steering changes without lifting, releasing one finger preserves the other, reverse works, cancel/pause neutralize input, ten attack variants start, crouch-guard and dash work, and unfunded super UI explains the meter requirement. No game state is injected. Layout checks cover 390×844, 844×390, 320×568 and 568×320, including 44px-minimum buttons and no horizontal overflow. No page errors were observed.

Seven additional unit tests cover dead zones/diagonals, independent pointer masks, boost/brake precedence and real simulation acceleration. All eleven attacks activate and damage an unguarded opponent in range for all six fighters, including funded supers. Pose checks distinguish the major moves from light attacks. Physical iOS/Android device testing and human ergonomic feedback remain outstanding; this does not certify live Railway multiplayer or resolve the earlier full-cup browser timeout.

The updated full arcade suite passes 53/53 tests; lint, development asset validation and the production build pass. The WebKit race smoke test also passes against the local production build (reverse, progressive steering, both courses, mobile layout, settings and six-fighter navigation; zero page errors). The browser skills' visual/input verification caught and corrected feedback-driven target movement and inadequate small-landscape arena space. Production deployment is not verified by these local checks.

## Reproduce

```sh
npm run test:os
npm run test:arcade
npm run validate:arcade-assets
npm run lint
npm run build
```

Default-build visibility regression: run `npm run start` without `ARCADE_LABS`,
then `node scripts/arcade-visibility.mjs`. It checks both original game selectors,
the preview link, running practice, return navigation and the gated review route.

With `npm run dev:arcade` and `npm run arcade:server` running:

```sh
npx playwright install chromium firefox webkit
npm run test:arcade:browser
ARCADE_TEST_BROWSER=firefox npm run test:arcade:browser
ARCADE_TEST_BROWSER=webkit npm run test:arcade:browser
```

Evidence goes to ignored `artifacts/arcade/`: selection, fight, result and mobile
screenshots plus JSON reports. Tests use three isolated contexts and ordinary DOM
keyboard handlers; they observe messages but never inject damage or scores.

## Observed checks

- Final isolated run: all 50 regression tests passed (22 existing-game,
  19 combat/rollback and nine authority real-socket tests), including full match/replay hash, abuse rejection,
  room isolation, idempotence, restart abort, reconnect, rematch and latency.
- Chromium, Firefox and WebKit: three contexts each; remote/spectator movement;
  identical result ID/winner/score; hit/block/throw events; same-match reconnect;
  rematch; correct forfeit winner; 390×844 without horizontal overflow; stable
  paused simulation; four practice enter/leave cycles; no page errors.
- Eight development assets: 13,417,600 budgeted decoded bytes including shared
  pixel scratch surface, below 33,554,432-byte cap. Display canvas buffers add
  viewport/DPR-dependent memory.
- All 2,048 private metadata records validated; aggregate output only; zero
  private exports. This is not runtime ownership verification.
- Visually inspected both stages and all 30 character/animation combinations.
  Arena proportions preserved with letterboxing and nearest-neighbor pixels.
- All 16 audio audition buttons activated a running AudioContext; sampled heavy
  impact had a nonzero synthesized signal. Human listening remains pending.

## Issues found and corrected

- Resize callbacks use captured DOM nodes/disposal guards.
- Arena aspect ratio and stage clipping prevent stretched fighters/bleeding floor.
- Player reconnect retains input sequence; spectators rejoin using invitations.
- Input releases continue through round transitions; forfeit UI uses server
  result winner, not unfinished combat state.
- Costume text does not mirror; pixel scratch surface is reused.
- Disposed socket messages are ignored; practice clears old notices.
- Reconnect success test initially used artificial 350 ms grace and failed under
  concurrent browser load. It now uses the actual 15-second policy. A separate
  short-grace test exercises expiration.
- The strict zero-deadline-rejection latency assertion also failed under
  concurrent CPU-heavy checks; the isolated 150 ms case passed. Run real-time
  socket checks separately from builds/browser suites. Deadline rejection is
  intentionally enforced; loaded-host timing is not certified by these tests.
- Initial production gating returned 404 for the game too, making it invisible
  on main. The visibility fix makes `/os` and `/os/rumble` available without a
  flag, while `/os/asset-lab` still returns 404. The launcher labels the game a
  playable preview, not a finished release.

## September 11 roster and California racing update

- `npm run test:arcade`: 46/46 passing, including six-fighter coverage, original replay compatibility, race physics/cup/replay tests, wheel geometry and server authority tests.
- `npm run test:os`: 22/22 passing for the existing games.
- Lint passes. Development asset validation passes for 22 assets within the decoded-memory budget; human release approval remains pending. Private catalog validation passes without exporting private traits or images.
- Latest Chromium smoke passes reverse, progressive steering, both tracks, mobile overflow checks and six-fighter menu visibility, with no page errors.
- The latest three-context multiplayer browser cup did **not** pass: it reached the 300-second wall-clock timeout while the authority was still on the first track at tick 6816. Earlier cup coverage does not certify the final handling changes. Final full-cup browser verification and live Railway verification remain outstanding.
- Rear wheels stay fixed while front wheels steer; rear tread width is now 0.135 of body width. Ground contact and player body anchors are covered by renderer tests.

## Limits and release gates

Transport tests inject 50/100/150 ms RTT with ±3 ms one-way jitter, not packet loss
or human network feel. Client reconciliation uses authoritative resets and bounded
prediction; competitive smoothing and rollback sound cancellation are future work.

The gallery measured approximately 1.13 ms mean Canvas drawing over 120 frames
in one local headless desktop session after pixel rendering. This is not total
frame cost, sustained FPS, a mobile benchmark or a production capacity claim.
Physical touch/controller, screen-reader gameplay, soak/load, radio loss, secure
remote hosting, backup recovery and competitive balance remain unverified.

Dependency installation reported dependency-tree audit warnings including high/
critical advisories. This change is not a full dependency security upgrade;
review and remediate the application baseline before public release.

`node scripts/validate-arcade-assets.mjs --release` deliberately refuses all
unapproved development assets. Human art/rights/audio approval and manifest
release approval must precede release. Do not bypass those flags for a green
report. See [MULTIPLAYER.md](MULTIPLAYER.md) for production operations gates.
