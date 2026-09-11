# TERMINL OS / Rug Runner

Play at `/os`, linked from the mint navigation and landing page. The desktop uses
the mint site's black/green CRT palette, monospace type, sharp borders, and
scanlines. It uses only already-published showcase machines and portraits.
No new application dependencies, environment variables, or external services.

## The game

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

## Simulated tokenomics

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
again but not another daily bonus. Eight trophies and four phosphor themes
persist in the browser. XP increases the operator level. PNG receipts include
art, ticker, exit score, run duration, pickups, and streak.

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

Browser checks cover keyboard/touch controls, pause/resume, cashing out, rewards,
theme persistence, separate-session challenges, receipt generation, and the mint
entry point on desktop and mobile.

Valuable prizes or holder-linked progress would require authenticated wallets,
verified ownership, server-authoritative matches, persistent balances, abuse
controls, and explicit prize funding/terms. These are not implied by this arcade.
