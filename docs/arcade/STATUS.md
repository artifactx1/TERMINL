# Arcade V1 status

`/os` leads with **Wen Lambo** and **Rekt Rumble**, followed by **Moon Mission**.
The old OS sidebar, Pixel Shop, credits, trophies, receipt exports and ghost-challenge
flow have been removed. Rug or Bond is an unpromoted standalone prototype.

## Playable

- Wen Lambo: six free rides, six-course cup, quick races, guided lesson, varied
  rivals and private online racing. Rules v5 preserve mobile handling and assist
  keyboard steering. All vehicles have moving tire detail.
- Rekt Rumble: six fighters, eleven moves each, two stages, training, practice,
  private online fights and a six-fight solo circuit with saved progression.
- Moon Mission: ten longer levels with sequential unlocks, saved checkpoints,
  distinctive terrain and obstacles, and the six-hit Liquidation Warden finale.
- Online rooms retain spectator, reconnect, rematch, authoritative results and
  authenticated replay support. Solo modes need no server or wallet.

See [V1.md](V1.md) for the campaign structure and verification commands,
[RACING.md](RACING.md) for handling, and [MULTIPLAYER.md](MULTIPLAYER.md) for hosting.

## Development

Run `npm run dev` and open `http://localhost:4000/os`. Run `npm run arcade:server`
separately for local online rooms. `ARCADE_LABS=1` exposes the asset review tools.
Production uses the existing Railway authority and `NEXT_PUBLIC_ARCADE_WS_URL`.

Public matchmaking, accounts, ranked seasons and cross-device campaign saves are
outside V1. Local saves stay on the current browser. Hardware controller feel,
production load and backup/restore drills remain separate operational checks.
