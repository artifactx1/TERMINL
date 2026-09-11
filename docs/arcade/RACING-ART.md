# Historical top-down art prototype (superseded for live racing)

The user redirected the racer to a California-style rear chase camera. Current generated art, Pepe body layers and independent wheels are documented in [CALIFORNIA-ART.md](CALIFORNIA-ART.md). The code-native overview renderer below remains available as internal course/debug art; its top-down vehicle rigs are not the live player-car presentation.

# WEN LAMBO — original pixel racing art

Two original top-down vehicles (Comet GT and Spectre RX) share a real steering-wheel / body / exhaust rig, with different silhouettes, glass, body panels, lighting, aerodynamic details and colors. The 66 × 42 native pixel sprite cache has six entries: two cars × three steering positions. Garage previews and races call the same `drawVehicle` function. No portrait is moved around as a car, and neither vehicle represents a licensed automobile.

Night Market Run has rooftop vents, neon-trimmed buildings, the Dead Mall, exchange signs and checkerboard grid markings. Liquidation Docks has striped containers, waterfront piling, quay walls, a crane and dock safety paint. Both are rasterized from the simulation's exact sampled course to cached 1168 × 864 pixel plates; cache capacity is two plates (8,073,216 decoded RGBA bytes). Authored scenery is cosmetic: the drivable road and collision margin come from the simulation, never the artwork. An occupancy mask keeps modular scenery off the course. Named landmarks are authored at the simulation's own positions.

The chase camera follows the local vehicle, looks ahead with speed, rotates the course toward the top of the screen and eases correction over a bounded per-canvas state. This is a 2D game, not a 3D simulation. The optional overview shows the complete actual circuit. The minimap identifies both actual players and the next mandatory checkpoint. A screen-space arrow, road chevrons and checkpoint posts provide route guidance. Tire marks are limited to 140 entries / 220 simulation ticks; smoke and exhaust come from real drift and boost states. Reduced-motion mode removes smoke and speed-dependent zoom; low quality suppresses smoke. Rendering never writes gameplay state.

Original Web Audio synthesis supplies a speed-responsive engine, tire noise, boost, checkpoint, countdown, lap and result cues, plus a small 126 BPM original score. Music and SFX have independent volume buses (zero is mute). Audio is created/resumed only by explicit `unlock()` from a user gesture. `setPaused()` fades the entire output; `dispose()` stops voices, loops, timers and the context. No recordings, third-party samples or remote audio downloads are used. Engine and tire loop gains follow the selected player's authoritative state. Event IDs are deduplicated across repeated snapshots.

Source files: `lib/arcade/race-render.js`, `lib/arcade/race-audio.js`. Runtime exports: `drawRace`, `drawVehicle`, `RACE_ART_MANIFEST`, `RaceAudio`, `RACE_SOUND_CUES`. Final visual, audio and device QA is tracked in the release verification notes; authored assets are not a claim of human approval or production performance certification.

## Isolated browser checks

An isolated Chromium canvas review covered both complete track overviews, the chase view, enlarged car bodies, visible steering and boost exhaust. A serialized state comparison before/after drawing remained identical. Across 120 warmed 1000 × 600 draws, measured JavaScript canvas submission averaged 0.0675 ms with a 0.2 ms p95 on the development machine; this excludes GPU completion, layout, React, networking and frame pacing, so it is not an FPS or mobile performance claim.

The audio context was null before a user gesture. A real test button click unlocked a running context with engine and tire loops; independent buses accepted zero-volume mute, pause was set, and disposal released the context and all tracked voices. The browser reported no errors. This validates lifecycle behavior, not subjective listening quality. End-to-end integrated gameplay, device support and human sound review remain separate checks.
