# Illustrated companion fighters

The primary Rumble renderer now draws the detailed generated combat poses. The original Max sheet shown by the user was recovered alongside matching Pepe, Brian, Mia and Bernie sheets. Chloe was generated with the built-in image tool using that Max sheet as the style and pose-layout reference and the public Chloe companion as the identity reference.

## Assets and preparation

- Source sheets: `public/arcade/fighters/{max,diamond,brian,mia,bernie,chloe}-poses-v1.png`.
- Runtime atlases: `public/arcade/fighters/{character}-atlas-v1.webp`.
- Frame metadata: `lib/arcade/rumble-sprite-data.mjs`.
- Preparation: `node scripts/prepare-rumble-sprites.mjs`.
- Rendering and phase selection: `lib/arcade/rumble-sprites.mjs`.

Original source sheets are retained unmodified. Preparation identifies nine connected character shapes, associates detached details with the nearest pose, and packs them into a lossless WebP atlas without repainting or rescaling their illustration pixels. Near-transparent fringe pixels below alpha 32 and isolated specks smaller than five pixels are omitted. Connected-component extraction matters: the generated sheets have uneven cells, and Mia's receipt crosses a nominal grid boundary. A simple 3 × 3 rectangular cut would pull neighboring character fragments into gameplay.

Every character has nine authored illustrations: ready stance, punch, high kick, character special, low sweep, airborne attack, hit reaction, guard and victory. The renderer selects poses from the current simulation phase and action. Anticipation uses guard; active attacks select their corresponding illustration; recovery returns to stance. Crouch/landing compress guard slightly; knockdown rotates the hit pose and seats its bounds on the floor. Idle breathing and walking bob are small presentation transforms. These are nine-pose animations, not a claim of a complete hand-drawn walk cycle or unique in-between frames for every move.

A single scale per fighter, derived from a 220-world-unit idle height, preserves anatomy between frames. Per-pose foot and horizontal anchors keep kicks and crouches aligned. The detailed atlases bypass the old low-resolution scratch canvas entirely. Simulation values, hitboxes, attack timing, input handling and replay rules are unchanged. The old code rig remains available only when an atlas has not loaded or failed, and for its original debug anchors; those anchors are rig diagnostics, not a skeleton extracted from the bitmap poses.

The app and asset lab load real atlas URLs alongside their stage images, release image references on unmount, and report failures. The game canvas exposes `data-fighter-art="illustrated-sprites"` only when both fighters' sheets have loaded. The manifest records actual atlas dimensions, frame bounds, decoded memory and development review status; its aggregate budget includes assets for the other arcade games too.

## Validation

`npm run test:rumble:art:browser` checks all 540 clip/move/facing variants against the actual loaded atlases, asserts that the renderer draws those source images, exercises all 54 illustrated poses, then selects each fighter in the app and checks attacks, jumps and a mobile view. Screenshots are saved under `artifacts/rumble-art/`. `ARCADE_TEST_URL` selects the local server.

`npm run validate:arcade-assets` verifies decoding, atlas dimensions, source rectangles, runtime metadata and aggregate budgets. The existing roster, simulation and circuit tests protect combat behavior and original replay hashes.

## Chloe generation prompt

Built-in image tool, September 16, 2026. Inputs: recovered Max nine-pose sheet (quality, camera and layout); `public/degens/cold-storage-chloe.webp` (character identity).

> Use case: stylized-concept. Asset type: production 2D fighting-game sprite sheet, genuinely transparent PNG background. Image 1 is the exact QUALITY, FORMAT, CAMERA and POSE-LAYOUT reference (the nine-pose Margin Call Max sheet); Image 2 is the CHARACTER IDENTITY reference (Cold Storage Chloe). Create the matching Chloe sheet: square canvas, strict 3 by 3 equal-size cells, one full-body Chloe per cell, generous transparent gaps, every limb fully inside its cell. Same richly shaded, densely textured hand-illustrated pixel art as Image 1, gritty premium arcade character, NOT simplified flat vector artwork, NOT chibi. Chloe is an adult woman with chestnut swept hair and bun, gold hoop earrings and necklace, mirrored purple-blue sunglasses, glossy quilted cobalt-blue puffer jacket with cream fur collar, white crop tee reading COLD, charcoal cargo joggers, blue and white high-top sneakers. All poses face RIGHT in three-quarter side view, identical face, costume, proportions and drawing scale in every cell. Carry her compact steel safe as a combat prop in special pose, otherwise empty combat-ready hands. Row 1: ready boxing stance; straight forward punch; high forward side kick. Row 2: forward special safe swing with BOTH hands holding the safe; crouching low sweeping kick; airborne forward kick with legs tucked. Row 3: recoiling from a hit; standing block covering head; victory with raised fists. Match Image 1 pose layout and natural anatomy. Grounded poses share foot baseline near bottom of each cell; keep airborne pose around center height. Sharp detailed ink outlines, nuanced skin shading, hair strands, fabric folds, individual puffer panels, shoe laces and metallic details. Preserve Chloe's identity exactly. No floor, no ground shadow, no checkerboard drawn into pixels, no scenery, no cell borders, no labels, no extra characters. Actual transparent alpha background.
