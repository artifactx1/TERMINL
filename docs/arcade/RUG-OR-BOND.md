# RUG OR BOND — memecoin trading simulator

Play at `/os/rug-or-bond`, linked from `/os`. A solo session starts with 10 fake
SOL and lasts three minutes. Five token launches, chosen from eight authored
projects, open at 0, 0, 12, 32 and 55 seconds. All open markets move each second.

Choose a token, buy an amount in simulated SOL, and sell 25%, 50% or all of your
position whenever you want. Candlestick charts show market cap in simulated SOL;
the launch feed shows price movement and curve progress. The trade tape, dev
holdings and wallet alerts reveal what simulated traders are doing. Your bags
show invested cost, executable exit value, and realized/unrealized profit or loss.

A token graduates when its curve reaches the reserve target. Trading continues
after graduation. Some creators dump their actual token inventories, followed by
panic selling; holders can still sell at the remaining pool price. A wallet alert
appears six simulated seconds before a scheduled creator dump.

The market can be paused, automatically pauses when the tab is hidden, and restores
paused after a refresh. Cashing out early or reaching three minutes sells all open
positions at executable quotes, accounting for fees and price impact. A session
receipt records every traded token. Starting again resets the wallet to 10 SOL.

## Simulation model

Inspired by [Pump's reserve-based bonding curve](https://pump.fun/docs/bonding-curve):
buys raise prices, sells lower them, and order size affects fills. This game's
parameters, fee and post-graduation behavior are authored simplifications; it does
not connect to or reproduce a deployed protocol.

- Pure deterministic `.mjs` rules shared by UI and replay. One tick is one second.
- Each coin starts with 30 virtual SOL and one billion whole token units. Simulated
  dev/early-buyer purchases initialize the market. Graduation occurs at 85 virtual
  SOL and remains recorded if the token later falls below the threshold.
- SOL accounting uses integer millionths. Curve products/divisions use BigInt with
  conservative rounding. A fictional 1% trade fee leaves the simulation. Quotes
  include both fees and price impact. No margin, borrowing or short selling.
- Bot purchases acquire actual tokens; bot sales cannot exceed acquired inventory.
  Player and bot holdings plus pool token reserves conserve the fixed token supply.
  Dev dumps are sales, not arbitrary token minting or removal of locked liquidity.
- Up to 500 player orders; end-of-session liquidation is always allowed. There is
  no binary outcome wager, winner payout, reveal button or fixed return for bonding.
- The isolated `terminl:rug-or-bond:v2` save contains the seed and accepted actions.
  Restoring replays those actions and rejects invalid/incompatible saves. Completed
  sessions cannot settle twice. Storage failure leaves the game playable for the visit.
- No wallet, real SOL, token issuance, paid entry, prizes, multiplayer or OS-credit
  integration. Client seeds and saves are inspectable; this is casual solo play.

## Verification

`npm run test:rug-or-bond` covers reserve math and rounding, execution price impact,
entry/exit accounting, inventory and cash constraints, partial sales, 40 complete
multi-market sessions, player-triggered graduation, dev dumps, early/automatic
liquidation, repeat-settlement guards and deterministic save recovery.

With `npm run dev` running, `npm run test:rug-or-bond:browser` exercises the launcher,
desktop/mobile token trading, timed market updates, pause/resume, recovery, early
cash-out, automatic expiry, replay, unavailable storage and horizontal overflow.
Screenshots go to `artifacts/arcade/rug-or-bond`. `ARCADE_TEST_URL` selects the server;
`ARCADE_TEST_BROWSER=firefox|webkit` changes the browser.

The prior browser attempt was blocked by this session's macOS sandbox (Chromium
MachPortRendezvousServer permission denied). Visual and interactive browser results
for this corrected version remain unverified.
