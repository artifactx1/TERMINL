# Rumble finishers

Rumble rules v2 adds a four-second finisher window after a match-winning knockout. The winner presses their mapped SUPER key, controller RT, touch SUPER, or FINISH THEM. A fresh press is required; a held attack cannot trigger it. No meter is spent. Letting the window expire takes the normal win. Timeout wins, draws, and ordinary round wins skip this window.

The 210-tick cinematic emits its impact at tick 60. Combat is frozen; health and earned round scores cannot change. Results, circuit advancement, rematches, and server confirmation follow the cinematic. Practice opponents can use their own finishers. Reduced motion removes zoom, shake, launch motion and afterimages. All opponents remain intact.

| Fighter | Finisher | Visual |
| --- | --- | --- |
| Margin Call Max | Margin Call | Rising uppercut and high launch |
| Diamond Hands Pepe | Diamond Standard | Diamond punch and crystal shockwave |
| Buy-High Brian | All In | Shoulder charge and knockdown |
| MEV Mia | Front Run | Afterimages and spinning knockout kick |
| Bridge Burn Bernie | Bridge Closed | Wrench floor slam and shockwave |
| Cold Storage Chloe | Cold Shutdown | Ice blast, ice enclosure, and knockout |

Receipt particles, receipt-themed move names and victory lines, and Mia's illustrated and fallback paper whip were removed. Her special is now Flash Strike.

## Protocol and replay compatibility

Deploy the updated arcade authority with the site for online play. The authority advertises Rumble rules v2; mismatched clients/servers fail the existing version handshake. Solo play remains available. Replays now include Rumble rulesVersion. Archived replays without that field use v1, retaining the old match flow and fixture hashes.

## Assets and generation

Mode: built-in imagegen. Reference images: existing `public/arcade/fighters/{character}-poses-v1.png` files. The generated source sheets, packed WebP atlases, and runtime frame data are all stored in this repository. Existing reference portraits are unchanged.

- Six new `public/arcade/fighters/{character}-finisher-poses-v1.png` sheets.
- Six new `public/arcade/fighters/{character}-finisher-atlas-v1.webp` runtime atlases.
- Mia's updated `mia-poses-v2.png` and `mia-atlas-v2.webp`.
- `node scripts/prepare-rumble-finishers.mjs` rebuilds finisher atlases and frame metadata.
- `node scripts/prepare-rumble-sprites.mjs` rebuilds normal combat atlases, using Mia v2.

Finisher prompt template:

> Use case: illustration. Asset: a NEW finisher animation sprite sheet for the supplied adult fighting game character {name}. Reference image is character identity and pixel illustration style only; do not reproduce its nine-pose layout. Create exactly THREE separate full-body sprites in ONE HORIZONTAL ROW, each in an equal-width cell. Transparent alpha background, wide landscape 3:1 canvas. All three face RIGHT in three-quarter side view, feet on the same baseline, consistent head and body scale, full hands and shoes visible with generous transparent gutters. Poses in order left to right: {poses} Preserve the reference character's face, hair, costume, colors, accessories, chunky outlined detailed pixel-art rendering. No opponent, no injury, no blood, no dismemberment, no gore. No paper, receipts, text labels, frame numbers, backdrop, floor, border, checkerboard or watermark. Effects must remain close to the fighter inside each cell, never touch a neighboring sprite. The game supplies camera movement and the opponent separately.

Pose substitutions:

- Max: He crouches and winds up both fists; he drives an enormous rising uppercut with a compact orange impact arc; he stands triumphantly cracking his knuckles.
- Diamond: He braces his oversized diamond fist against his chest; he drives that diamond fist forward in a powerful straight punch with a cyan crystal shockwave; he coolly adjusts his sunglasses with his other hand.
- Brian: He lowers his shoulder and digs his sandals into the ground; he lunges forward in an explosive shoulder tackle with an amber speed arc; he raises a fist and grins triumphantly.
- Mia: She coils low with both fists ready; she executes a high spinning heel kick with a compact magenta speed arc; she lands with one fist up and a confident grin. No paper receipt, ribbon, whip or phone.
- Bernie: He lifts his heavy wrench overhead with both hands; he slams the wrench down onto the empty ground with a compact orange spark arc; he rests the wrench over one shoulder, triumphant.
- Chloe: She gathers cold energy between her palms; she thrusts both palms forward with a compact cyan ice blast; she folds her arms confidently, with small frost crystals around her shoes.

Mia combat-sheet edit prompt:

> Edit target: the supplied transparent 3x3 game sprite sheet of adult MEV Mia. Change ONLY the special-attack pose in row 2 column 1: remove the long white paper receipt whip completely, and make her outstretched right hand a clenched fist performing a long reaching punch, with a small magenta energy trail attached to the fist. No paper, receipts, ribbons, scrolls or loose props anywhere. Preserve exactly the other eight poses, her face, costume, anatomy, pixel illustration style, pose scale, 3x3 arrangement and transparent background. Preserve the sheet dimensions and separate the nine full-body poses with clear transparent gutters. No opponent, no injuries or blood.

## Verification

All 97 arcade regression tests passed, including the real two-socket match/finisher/replay test. All six finishers were also reached through full browser practice matches using normal keyboard inputs, triggered with the actual FINISH THEM button, and observed through windup, impact, victory and result. Portrait/landscape mobile prompts and reduced-motion presentation were checked. Screenshots are in the local `artifacts/finishers` directory.
