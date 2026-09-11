# Integration decisions / first verified slice

## Inventory

TERMINL: 2,048 generative CRT NFTs. Next.js 14 Pages Router, React 18, npm lockfile,
CSS Modules. Existing Rug Runner and Moon Mission use Canvas and isolated pure
ES modules. `/os` and its `terminl-os:v2` browser save remain intact.

The public catalog contains 16 showcase machines and 15 named companion portraits.
The complete locked catalog is outside this repository; `scripts/snapshot.mjs`
is the existing manual publication boundary. No full-catalog metadata, token IDs,
unpublished images, or generator layers are added to browser bundles.

Wallets use Reown AppKit/wagmi on the configured Robinhood chain; mint APIs read
drop state and allowlists. There is no application login, verified cosmetic
entitlement service, account database, room service, or server-held arcade balance.
Do not mistake a connected wallet or selected guest station for proof of ownership.

## Decisions

- Reuse Canvas for 2D games; no Phaser migration or second UI framework.
- Renderer-independent `.mjs` simulation with a typed `.d.ts` module/protocol
  boundary, matching the repo's executable-JS tooling. No divergent server copy.
- REKT RUMBLE gets a lazily loaded public preview at `/os/rumble`, linked in `/os`.
  Only asset-review tooling requires `ARCADE_LABS=1`. No unfinished roadmap game
  becomes a released tile; the fighter is explicitly labeled a development build.
- Dedicated Node/ws service on 4010, fixed 60 Hz simulation, 20 Hz snapshots,
  bounded late-input rollback. React handles menus/HUD; animation uses refs/RAF.
- Anonymous room-scoped guest sessions are not a second wallet connector or a
  permanent account system. No NFT privileges or value-bearing rewards.
- No existing database to reuse: first-slice completed results use a local
  fsync-backed append journal on a durable volume. This is not a production
  multi-node database. Active matches abort on process restart; outcomes already
  recorded do not repeat. Production persistence/account migration remains gated.
- Original generated stage plates + separately articulated character rigs,
  deterministic pose timing, authored hitboxes, and original synthesized audio.
  Art remains development-reviewed until the user approves the character quality.

## Hosting verification

[Current Vercel WebSocket documentation](https://vercel.com/docs/functions/websockets)
supports WebSockets in beta, but connections close at the function duration limit
and new connections may reach a different instance. A process-local authoritative
room cannot simply be placed in an ordinary existing mint API route. This slice
therefore supplies a standalone local service; production requires explicit
room placement, durable storage, TLS, origins, and hosting approval. No service
has been provisioned and no infrastructure cost/concurrency claim is made.

## Broader roadmap, intentionally not advertised as playable

WEN LAMBO: two authored vehicles/tracks first, prediction/reconciliation and cup.
RUG OR BOND: five-round isolated simulation ledger, fixed-liquidity integer-cost
LMSR, future verified beacon proofs and crash-safe settlement before release.
EXIT LIQUIDITY: duel/two maps before team expansion; authoritative objectives.
CANDLE CLASH: seven-column falling pairs, deterministic cascades and attack
cancellation, best-of-three PvP before six scenario expansion.
