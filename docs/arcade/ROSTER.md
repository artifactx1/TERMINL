# REKT RUMBLE: six-fighter expansion

Six free fighters share the same 1,000 health and universal inputs. No NFT or payment gives a combat advantage. The original Max and Diamond move data and simulation behavior remain unchanged; expansion moves are separate authored profiles.

| Fighter | Identity and pixel art | How to play |
| --- | --- | --- |
| Margin Call Max | Existing REKT tee, purple shorts and sandals | Close-range grappler; command grab punishes guard |
| Diamond Hands Pepe | Existing frog, leather jacket and diamond fist | Defensive bruiser; armored startup |
| Buy-High Brian | Mullet, visor, floral overshirt, BUY HIGH tee, ramen cup, cargo shorts | Big damage and charging Market Buy; slow, punishable swings |
| MEV Mia | Ponytail, perched shades, MEVD crop top, denim shorts, pink sneakers, phone and receipt | Fastest movement and light checks; lower damage and no armor |
| Bridge Burn Bernie | WAGMI cap, work shirt, tool belt, patched knees and wrench | Long-range wrench punishment; slow startup and movement |
| Cold Storage Chloe | Mirrored shades, blue puffer, COLD tee, cargo pants, safe and blue sneakers | Patient armored counters; throws beat Vault Door |

All four additions are based only on the existing public portraits in `public/degens` and `data/degen-lore.js`. Each reference was inspected visually. New costumes, hair silhouettes and props are code-native articulated geometry rendered to the existing low-resolution sprite surface and enlarged with nearest-neighbor sampling. Gameplay never animates a static portrait. Elbows, knees, head and held props follow the current authored pose; the renderer does not determine damage.

Each fighter has eleven authored moves: standing, crouching and air light/heavy, three specials, throw and full-meter super. All six use the fifteen existing animation states. The selection menu, practice-opponent picker, move list, online lobby portraits and asset lab use the shared roster. Only the first selection portrait is prioritized; other portraits are lazy-loaded. No private collection metadata is bundled.

Validation: `node --test scripts/rumble-roster.test.mjs scripts/rumble-sim.test.mjs` checks all 36 ordered matchups, six distinct move profiles, 90 finite pose/anchor combinations, 540 drawn move/clip/facing variants, eight pre-expansion replay hashes, canonical asset references and existing combat regressions. `npm run validate:arcade-assets` validates manifest geometry, portrait dimensions and total decoded budget (16,464,000 bytes).

Implementation-agent visual review used actual Chromium Canvas and direct imports of the current source, independently of the app server: all six idle and active poses, plus all four new fighters in crouch, jump, guard, knockdown and victory (32 inspected poses). The character costumes, prop attachments, pixel silhouettes and mirrored labels were readable, with no browser runtime errors. Local contact sheets are `/private/tmp/terminl-roster-idle.png`, `/private/tmp/terminl-roster-active.png`, and `/private/tmp/terminl-roster-extremes.png`; these are diagnostic screenshots, not new shipped assets. Application UI and multiplayer browser evidence is recorded in the integration verification report.

These are development balance profiles, not competitively calibrated characters. Human art approval, controller-hardware testing and a representative human balance/playtest cohort remain pending. Both client and room server must run the expanded version to create online rooms with the four additions. Existing recorded matches continue to use unchanged original fighter data.
