# REKT RUMBLE: six-fighter expansion

Six free fighters share the same 1,000 health and universal inputs. No NFT or payment gives a combat advantage. The original Max and Diamond move data and simulation behavior remain unchanged; expansion moves are separate authored profiles.

| Fighter | Identity and pixel art | How to play |
| --- | --- | --- |
| Margin Call Max | Exhausted eyes, stubble, messy hair, REKT tee, gold medallion, purple shorts and mismatched socks with sandals | Close-range grappler; command grab punishes guard |
| Diamond Hands Pepe | Raised frog eyelids, orange lips, shades, leather jacket and oversized faceted diamond fist with ice points | Defensive bruiser; armored startup |
| Buy-High Brian | Mullet, visor, floral overshirt, BUY HIGH tee, cargo shorts and sandals | Big damage and charging Market Buy; slow, punishable swings |
| MEV Mia | Ponytail, perched shades, MEVD crop top, denim shorts, pink sneakers and a receipt-whip special | Fastest movement and light checks; lower damage and no armor |
| Bridge Burn Bernie | Gaunt mechanic face, WAGMI cap, work shirt, tool belt, patched knees and wrench | Long-range wrench punishment; slow startup and movement |
| Cold Storage Chloe | Mirrored shades, swept hair and bun, quilted blue puffer with fur collar, COLD tee, cargo pants, safe special and blue sneakers | Patient armored counters; throws beat Vault Door |

All six fighters now use detailed illustrated nine-pose combat atlases based on the existing public companions. The original Max, Pepe, Brian, Mia and Bernie sheets were recovered; Chloe was generated to match. These assets are the primary gameplay art, with the old code rigs retained as loading/error fallbacks. See [FIGHTER-SPRITES.md](FIGHTER-SPRITES.md) for the preparation pipeline, exact generation prompt, pose mappings and animation limits.

Each fighter has eleven authored moves: standing, crouching and air light/heavy, three specials, throw and full-meter super. All six use the fifteen existing animation states. The selection menu, practice-opponent picker, move list, online lobby portraits and asset lab use the shared roster. Only the first selection portrait is prioritized; other portraits are lazy-loaded. No private collection metadata is bundled.

Validation: `node --test scripts/rumble-roster.test.mjs scripts/rumble-sim.test.mjs scripts/rumble-circuit.test.mjs` checks all 36 ordered matchups, six distinct move profiles, 90 finite pose/anchor combinations, 540 drawn move/clip/facing variants, eight pre-expansion replay hashes, canonical asset references, solo progression and existing combat regressions. `npm run validate:arcade-assets` validates manifest geometry, portrait dimensions, runtime atlas frame metadata and aggregate decoded budget.

`npm run test:rumble:art:browser` verifies all 540 clip/move/facing combinations draw the real atlas images, covering all 54 illustrated poses. It selects all six fighters in the app, exercises attacks and jumps, and captures desktop and mobile screenshots under `artifacts/rumble-art/`. Set `ARCADE_TEST_URL` to target a different local server.

These are development balance profiles, not competitively calibrated characters. Human art approval, controller-hardware testing and a representative human balance/playtest cohort remain pending. Both client and room server must run the expanded version to create online rooms with the four additions. Existing recorded matches continue to use unchanged original fighter data.
