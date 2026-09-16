> Historical V0 design. The OS shell, shop, receipts and challenge UI described below are retired. See [Arcade V1](docs/arcade/V1.md) for the current launcher and campaigns.

# TERMINL OS / The Arcade

Play at `/os`, linked from the mint navigation and landing page. The desktop uses
the mint site's black/green CRT palette, monospace type, sharp borders, and
scanlines. It uses only already-published showcase machines and portraits.
No new application dependencies, environment variables, or external services.

## Rug Runner

Rug Runner is a 45-second, three-lane skill arcade:

- Move with left/right arrows, A/D, or tap the destination lane on mobile.
- Green candles give free token allocations. Consecutive pickups build a
  multiplier up to ×5; gold candles give triple allocations.
- A red collision costs one of three lives and 30% of the bag. Blue shields
  absorb one hit. Losing all three lives wipes out the bag and ends the run.
- Cash out after five seconds to bank the current exit quote and end the run.
  Surviving the full 45 seconds banks automatically.
- A solo win requires 1,000 points; a duel win requires beating the rival.
  Ties are not wins. P pauses; changing apps or hiding the browser pauses play.

## Moon Mission

Select the Moon Mission cartridge, then Play Moon Mission. A 90-second
side-scrolling pixel platformer starring a little walking CRT terminal:

- Arrow keys or A/D run; Space, W, or Up jumps. Release and press again for
  a double jump. Mobile has hold-to-run buttons and a separate Jump button.
- Explore elevated platforms in a neon city. Gold coins give 100 points,
  purple gems give 500, and blue diamonds absorb one enemy hit.
- Stomp red candle enemies from above for 250 points and a bounce. Side hits
  cost a life and 20% of the score. Brief invulnerability prevents repeat hits.
- Cross toxic pools and purple bridges that collapse after half a second.
  Falls cost a life and 20% of the score, then return you to your last flag.
- Reach the rocket for 1,000 points plus a remaining-time bonus. This is a
  solo win. Running out of time keeps collected points; losing all lives
  wipes the score. There is no early cash-out in this game.
- P/Escape or the Pause button pauses. Hiding the tab or opening the quit
  confirmation also pauses. The rocket and stomping unlock two new trophies.

The world layout is fixed and enemy patrol phases use the course seed.
Bot duels and friend challenges replay full movement/jump inputs at 60 Hz.
Highest score wins a duel, with identical scores drawing. Ghosts cannot
collide with or take pickups from your character.

## Rug Runner simulated tokenomics

Pickups and the seeded bot crowd trade against a fictional constant-product
curve. Buying raises the quote/token price; selling lowers it. The cash-out
value is the actual simulated full-bag sell quote, including its price impact
and a 1% selling fee. Pickup allocations use the same curve with a 1% buy fee.
There is no personal entry stake; pickup allocation budgets are supplied by
the arcade. All assets, prices, and returns are fictional.

Seeded market regimes include buying waves, ordinary selling, and a possible
dev dump preceded by a warning. This makes continuing versus banking a real
decision. The course accelerates, but every obstacle row has a safe lane.

The constant-product concept is informed by
[Pump's public documentation](https://pump.fun/docs/bonding-curve).
This is a deliberately simplified arcade model. It does not reproduce Pump's
reserves, fees, graduation rules, or production contracts.

## Modes and ghosts

Daily runs share a course and crowd seed per UTC date. Practice opponents
(Max, Chloe, Brian) generate deterministic recorded lane changes, with different
risk behavior; they are explicitly bots. Chloe may bank before a dev dump.

Finish any run to create a compact challenge link. A friend races the recorded
ghost with the same course and crowd flow. Each player's pickups move their
own simulated pool, so their precise price history can differ. Result scores
are replayed from recorded inputs, never trusted from URL-provided scores.
Challenges use validated, bounded, versioned data in the URL fragment. A friend
can send their result link back; results are not delivered automatically.

PvP is asynchronous and unranked. No live matchmaking or global leaderboard.
Client state and seeds are inspectable, so this is a casual arcade, not an
authoritative contest suitable for monetary prizes.

## Rewards and persistence

Each finish awards 60 credits. A win adds 80; each new trophy adds 50; the first
daily finish on its UTC date adds 100. Daily replays can earn base/win rewards
again but not another daily bonus. The bonus is shared across both games.
Ten trophies and four phosphor themes
persist in the browser. XP increases the operator level. PNG receipts include
art, game, ticker, score, duration, pickups, and streak or enemies stomped.

The `terminl-os:v2` localStorage profile holds completed runs (latest 30),
credits, cosmetics, callsign, selected guest station, and sound. Corrupt saves
fall back safely; inaccessible storage shows a warning. Active runs remain in
memory while switching OS apps, but reloading loses them. Clearing browser
data clears the profile. Progress is not wallet-linked or synchronized between
devices; guest station selection is not proof of NFT ownership.

Credits cannot be purchased, transferred, or redeemed for cash or NFTs.

## Checks

```sh
npm run test:os
npm run lint
npm run build
npm run dev
```

Engine tests cover curve invariants and slippage, obstacle fairness, collisions,
shields, combos, death, early banking, exact replay, challenge validation, reward
idempotence, daily bonuses, ghost outcomes, purchases, and save recovery.
Moon tests also cover movement, variable-height double jumps, platform landing,
bridge collapse/return, stomps, checkpoints, timeouts, complete winning routes,
and compatibility with existing saves and version-2 Rug Runner challenges.

Browser checks cover keyboard/touch controls, pause/resume, cashing out, rewards,
theme persistence, separate-session challenges, receipt generation, and the mint
entry point on desktop and mobile.

Moon Mission browser verification: a complete keyboard-driven daily run reached
the rocket in 23.3 seconds with 6,066 points and saved 440 CR on a fresh profile.
A separate mobile session accepted its challenge and launched the correct game.
Touch cancellation cleared movement, pausing froze tick 50, and its receipt
exported as a 900×1260 PNG. Five open/close cycles, with deliberately delayed
ResizeObserver callbacks after unmount, produced no errors. Rug Runner still
launched afterward with the earned shared balance intact.

Valuable prizes or holder-linked progress would require authenticated wallets,
verified ownership, server-authoritative matches, persistent balances, abuse
controls, and explicit prize funding/terms. These are not implied by this arcade.
