# Arcade implementation status — first verified slice

The master brief is a multi-release target. This implements its requested first
slice: shared foundations and a playable REKT RUMBLE development build, not all
five completed games. Rug Runner and Moon Mission retain existing saves/rules.

## Implemented

- TERMINL-styled `/os/rumble` and `/os/asset-lab`, gated by `ARCADE_LABS=1`.
- Two freely selectable pixelated fighters: Margin Call Max and Diamond Hands
  Pepe, 15 animation states each, 11 authored moves each, guard heights, throw
  escape, hit-stop, armor, meter, bounded combos and best-of-three rounds.
- Two illustrated stages: Dead Mall Exchange and Liquidation Laundromat;
  server-owned, telegraphed steam boundaries distinguish the laundromat.
- Interactive lessons, labeled bot practice, keyboard remapping, pointer
  controls, controller mapping, offline pause, reduced motion, separate audio
  levels, full mute, original synthesized music and 16 effect cues.
- Real private two-player rooms, invited spectators, both-player readiness,
  60 Hz authority, bounded rollback/client prediction, reconnect, forfeit,
  rematch and durable/idempotent results with input replay hashes.
- Scoped guest credentials, origin/schema/rate/payload limits, neutral input
  on disconnect and crash-abort journal. No value-bearing reward writes.
- Asset/provenance manifest, pose/attachment/hitbox gallery, decoded asset
  budget validation and aggregate-only private catalog compatibility check.

No unpublished collection data/art was exported. Two public base rigs are freely
available; NFT-owned trait cosmetics are not implemented. The pixel-art request
is implemented; canonical identities are retained pending clarification of
“shouldn look like the characters.” See [QA.md](QA.md) for evidence and limits.

## Not implemented / not released

- Remaining REKT RUMBLE roster/stages, human art/audio approval, owner cosmetics,
  ranked ladder, public matchmaking, permanent accounts, host/admin UI,
  multi-region routing and production operational hardening.
- WEN LAMBO: racing physics, vehicles/tracks, online races and cup progression.
- RUG OR BOND: LMSR markets, isolated fictional ledger, five-round tournaments,
  verified future randomness proofs and crash-safe settlement.
- EXIT LIQUIDITY: heist maps, objectives and duel/team networking.
- CANDLE CLASH: puzzle engine, cascades, cancellation, PvP and scenarios.

These are next steps, not buttons pretending to be games. No paid infrastructure,
production authority, financial/NFT prizes, redeemable credits, entry fees, mint
entitlements or ownership power advantages were added.

## Play and continue

Run `npm run dev:arcade` and `npm run arcade:server` in separate terminals; open
`http://localhost:4000/os/rumble`. Learn by Fighting works alone. For PvP, create
a room, copy its full invitation into another browser profile and ready both
players. A third can spectate. Localhost works on one computer; remote friends
require a reachable shared TLS authority.

Next: human review of this slice; physical touch/controller and latency
playtests; production-host/persistence decision with explicit approval; then
expand REKT RUMBLE before subsequent game slices. Keep the lab flag off in
production until release gates are met. Asset release approval remains closed.
