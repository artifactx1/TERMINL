# Arcade status — roster and California racing expansion

Four playable games remain accessible from /os: Rug Runner, Moon Mission, REKT RUMBLE and WEN LAMBO. The new games are previews, not the completed five-game master release.

## Implemented

- REKT RUMBLE now has six freely selectable canonical pixel fighters: Max, Diamond Hands Pepe, Buy-High Brian, MEV Mia, Bridge Burn Bernie and Cold Storage Chloe. Each has an articulated rig and eleven authored moves. Original Max/Diamond rules retain eight pre-expansion replay hashes.
- Two Rumble stages, training, selectable bot opponent, private two-player PvP, spectator/reconnect/rematch and durable results.
- WEN LAMBO at /os/lambo: California-style behind-car Canvas perspective, two generated environments, two open-cockpit roadsters with Pepe, independently animated wheels, front-only steering, progressive handling, reverse, drift-earned boost, keyboard/touch controls and a guided lesson.
- Pacific Coast Run and Sunset Canyon, three laps each, two-race points cup, labeled bot practice and genuine private two-driver online racing with spectators and authoritative checkpoint/finish logic.
- Shared server advertises game/roster/car capabilities; old backend builds give an update-required notice. Race/combat rooms validate different input masks and content IDs. Replay reproduction uses the matching rules module.
- No money/NFT prizes, paid entry, ownership-based power, hidden collection exports or fake live population.

See [RACING.md](RACING.md), [ROSTER.md](ROSTER.md), [MULTIPLAYER.md](MULTIPLAYER.md), [CALIFORNIA-ART.md](CALIFORNIA-ART.md) and [QA.md](QA.md).

## Remaining release work

Human art/audio approval, physical controller/touch testing, public matchmaking, permanent accounts, ownership cosmetics, ranked seasons, multi-region routing, production load/backup/restore drills and operational hardening remain pending. The eventual larger roster/stage/track/player targets are not claimed complete. RUG OR BOND, EXIT LIQUIDITY and CANDLE CLASH remain unimplemented, not launcher buttons.

The user has a Railway authority; this change reuses its process and journal, not a second paid service. A local test does not verify that user's deployment. The exact live endpoint was not supplied for this iteration.

## Play

Run npm run dev:arcade and npm run arcade:server separately. Open http://localhost:4000/os. Both new routes are visible without ARCADE_LABS; that flag only exposes the asset review lab.

Online requires the deployed authority running this update and NEXT_PUBLIC_ARCADE_WS_URL pointing at it. Both guests ready up; a third can spectate. Practice needs no backend.
