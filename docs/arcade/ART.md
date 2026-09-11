# REKT RUMBLE art and audio bible — development slice v1

This document covers two playable rigs and two environments, not the final
eight-character/six-stage roster. All new assets are **development-only pending
human visual and rights approval**. Generated scenery and code-authored rigs are
real files used by the game; they are not promises of future asset generation.
They are a coherent playable foundation, not a claim of finished indie-release
animation polish. Existing Rug Runner and Moon Mission assets are unchanged.

## Canon and identity

The public references are `public/degens/margin-call-max.webp` and
`public/degens/diamond-hands-pepe.webp`, each 340 × 560. Their canonical names and
clothing come from `data/site.json`, `data/degen-lore.js` and inspection of the
actual images. No unpublished collection character is used or copied.

| Character | Must remain recognizable | Rig treatment |
| --- | --- | --- |
| Margin Call Max | Tired human face, dark REKT tee, gold chain, purple −99% shorts, mismatched lower-leg clothing, sandals | Slumped shoulders, anxious eyes, receipt-colored impact accents; grapples extend both arms |
| Diamond Hands Pepe | Green frog, dark shades, orange lips, black jacket, gold chain, enormous icy fist | Wider head and jacket, bent defensive stance, separately faceted cyan fist, metallic guard cues |

The source portrait is allowed in selection and reference UI. It is **never**
drawn as a gameplay sprite. Each character is built from a torso polygon, neck,
independent head, two upper/lower arm chains, hands, two upper/lower leg chains,
shoes, costume panels, jewelry and facial detail. Knees, elbows, head and hands
change position according to move phase; jumping a static full-body cutout is
not the implementation.

## Visual treatment and timing

- Heavy charcoal contours (`#101619`), restrained warm paper highlights, dusty
  clothing and muted skin; cyan ice and warm sparks are reserved for readability.
- Fighters use pixelated, simplified interpretations of the collection. Each
  articulated pose is rasterized at half-world resolution into a reused
  200 × 180 scratch surface, then upscaled with nearest-neighbor sampling.
  Standing characters are approximately 96 native pixels high. This is genuine
  animated geometry rendered as pixels, not a moving portrait. Generated arena
  paintings add architectural detail; human review of cohesion remains pending.
- The authored view is 1000 × 600, floor y=500, with fighters roughly 194 pixels
  high at ground level. `fighter.y` is height above the floor. Near/far limbs are
  layered deliberately; floor shadows stay separate from animation transforms.
- Idle uses breathing/eye detail; walking changes knees, feet and arms; crouch
  folds the body; jumping tucks legs; landing compresses the torso. Attack
  anticipation, active extension and recovery use authoritative move frames.
- Six normals, three specials, throw and super read the engine's `moveFor`
  timings. Sweeps extend a leg, low jabs extend a lowered arm, anti-airs punch
  upward, air attacks reach down, throws reach with both arms. They share a
  reusable articulated skeleton, not identical whole-image poses.
- Guard closes the hand/head silhouette; hit reaction moves torso and head
  backward; knockdown falls onto the side; the final eight knockdown frames use
  a supported wake-up pose. Victory raises both arms. Defeat retains the fallen
  pose while harmless paper receipts flutter from the loser.
- Hit-stop, invulnerability, attack windows, collisions and damage are owned
  entirely by `rumble-sim.mjs`. The renderer cannot award damage. Debug boxes use
  `hurtboxFor` and the actual move hitbox; they are not inferred from art pixels.
- Reduced-motion mode removes camera shake and ambient movement. Important
  hit/guard and steam-state indications remain visible without motion.

`RIG_ANCHORS` is the reference bind pose. `attachmentAnchors(fighter, tick)` gives
posed local coordinates for feet, hip, chest, head, hat, chain, front/rear hand
and effect origin. The headgear socket follows the head; chain follows the chest;
effect origin follows the striking hand. Debug anchors are visible in the asset
gallery. `fighter.silhouette=true` provides silhouette inspection. Gameplay
palette/hat variants are not claimed as shipped NFT cosmetics.

## Layered stages and authored mechanics

Generated paintings are `public/arcade/dead-mall-v1.webp` and
`public/arcade/laundromat-v1.webp`, each 1600 × 900. Their generation briefs and
identity constraints are recorded in [ASSET-PROMPTS.md](ASSET-PROMPTS.md).

Dead Mall Exchange has a shuttered financial arcade, escalator/atrium painting,
an authored exchange sign, four animated trading cabinets, gesturing spectators,
and a perspective floor. Its bounds are stable.

Liquidation Laundromat has six separately animated washing drums, exchange-rate
readouts, overhead pipework and a distinct illustrated storefront. The
authoritative simulation warns for two seconds before steam closes the side
lanes. The renderer draws the warning boundaries and active steam strip from
`state.bounds`, never a guessed local timer. This stage is explicitly casual;
the current slice does not claim a ranked hazard-free circuit.

Both use depth layers: painting/architecture → authored signs/machines →
spectators → floor/shadows → independently posed fighters → collision feedback
and receipts. Cabinets, washing machines and scenery do not secretly collide.
If a backdrop cannot load, an authored code background renders instead; this is
also development art, not a missing asset silently labeled production-quality.

## Original synthesized sound

`RumbleAudio` generates audio using Web Audio oscillators and a deterministic
noise buffer. There are no downloaded loops, sampled games, imitated announcers,
voice assets or external music licenses. Audio is activated only by a user
gesture via `unlock()` and closes via `dispose()`.

The original 104 BPM score uses a fixed 16-step sequence with bass, a quiet chord
bed, kick/snare/hat layers, and mechanical ambience. The laundromat changes its
root and machine texture. Separate music and SFX gain controls each permit full
mute. Voice concurrency is bounded at 40 and a compressor limits stacked impact
peaks. Browser audio availability failures leave a fully playable silent game.

The sixteen audition cues are UI, light, heavy, block, armor, throw, tech, jump,
land, dash, special, super, warning, fight, win and loss. Distinct body/metal/ice
families make hit versus block audible. Every important event also has visual
feedback; there are no essential spoken lines requiring captions. Authoritative
event IDs are deduplicated across repeated/rollback snapshots. This is not a
claim of rollback cancellation of a sound already played.

## Inventory, budgets and validation

`data/arcade-assets.json` records eight versioned asset entries: reference
portraits, two code rigs, two painted stages, code stage layers/effects and the
sound bank. Every entry has provenance, rights statement, approval status,
dimensions or geometry budget, runtime variants, games and decoded-memory budget.

The two stage textures use 11,520,000 decoded RGBA bytes together; the portraits
use 1,523,200. Including the conservatively budgeted noise buffer, the complete
inventory plus the shared 144,000-byte pixel surface totals 13,417,600 bytes under
a 32 MiB limit (display canvas backing buffers are additional). The development slice
preloads both 5.76 MB stage plates for immediate stage switching and gallery
comparison; selected-stage-only loading is a later optimization, not a claimed
current feature. Rigs reuse one scratch surface per target canvas. Compressed file sizes
are not treated as decoded memory measurements. Low quality skips optional
particles and atmosphere. Bitmap/voice disposal belongs to the mounting UI and
audio owner, rather than module-level retained DOM objects.

Run `node scripts/validate-arcade-assets.mjs` for missing sources, actual image
decoding/dimensions, decoded budgets, duplicate IDs, rig anchors, sampled required
clips, source references and atlas bounds if atlases are added. It prints
development warnings. `--release` intentionally fails until every shipped asset
has explicit human approval and the manifest's release gate is opened. Do not
flip these fields merely to make a release build pass.

## Private collection pipeline

`node scripts/validate-arcade-catalog.mjs --require-full` is an **offline private
validation command**, not a deployment/build step. It reads the existing locked
2,048-record `bulk-upload.json` in the sibling collection directory, validates
the entire schema and reports aggregate counts only. Override its source via
`TERMINL_PRIVATE_CATALOG` or `--catalog=…` when running in another private
workspace. A missing catalog is reported as unverified, never a fake pass; use
`--require-full` to require it.

Required trait categories are Background, Chassis, Chassis Finish and Screen /
Face. Prop, companion and effect slots are intentionally optional. The validator
checks duplicate names/categories, required fields and trait value types. No
locked token names, IDs, trait values, image paths, mappings or artwork are
printed, written, copied into public files or bundled by the application.

The initial audit found 2,048 valid records, 91 references compatible with the
two current base rigs, and 1,957 safe-fallback records. These are **compatibility
counts**, not a claim that NFT ownership cosmetics are implemented. Everyone may
choose either public base rig for free. Unsupported identities fall back to a
user-selected recognizable public rig, without guessing trait attachments or
changing competitive statistics. No token has unique damage or hitboxes.

Next pipeline work requires an authenticated, verified ownership adapter and an
allowlisted public cosmetic mapping. Never fetch the locked full catalog into a
client to accomplish this. Hat, banner, palette and wrap attachments must undergo
rig-compatible visual approval; absent approval, preserve the public base rig.

## Honest remaining asset gates

Human art and rights review; finer frame-to-frame facial/cloth polish; authored
per-character super/victory flourishes beyond the current shared structure;
additional six fighters/four arenas; approved modular cosmetic attachments;
audio listening/mix pass on real speakers/mobile; and the later games' actual
vehicle/puzzle/heist assets remain work. The other games must remain behind
development flags until their own playable slices and asset galleries exist.

Reusable next-asset briefs:

- **Character parts / clips:** use the published portrait, canonical name and
  the constraints above. Side-view orthographic gameplay camera, feet on the same
  baseline, near/far limb parts, separate head/jaw/torso/upper-lower limbs/hands/
  shoes, transparent background, flat neutral light plus separate rim layer.
  Provide the fifteen named clips at a fixed scale and anchors. Reject extra
  limbs, changed costume text, missing gold chain, perspective changes, baked
  backdrop/UI or a single bobbing portrait. Do not copy any other fighter's moves.
- **Stage layers:** original after-hours financial fever dream with background,
  midground and foreground exported independently. Target 1600 × 900 WebP,
  unobstructed floor through center and readable fighter contrast. No real
  brands, HUD text, baked fighter silhouettes or untelegraphed hazards. Reject
  scenery that hides contact points or alters competitive bounds visually.
- **Later original vehicle:** no manufacturer badges or copyrighted model copy.
  Consistent authored exotic silhouette with separate wheels/material regions,
  steering/suspension anchors and documented collision proxy. Inspect from the
  actual chase camera, not only a marketing render. Geometry or full directional
  sprite set must exist before calling it a playable car asset.
