# Caching drop state for the marketplace

A note for ArtifactX (the ELEMENT repo), written from the TERMINL site, where
the same change shipped first. TERMINL's `pages/api/drop.js` and the
`readDropFacts` / `serializeDropFacts` / `reviveDropFacts` / `fetchDropFacts` helpers in `lib/mint.js` are the
reference implementation; this file explains why it matters for the
marketplace and how to carry it across.

## The problem

The drop and edition mint pages read the chain **per visitor**: claim
conditions, supply, drop end time, open-edition flag. Those reads sit on React
Query with 10–30 second stale times, which dedupes inside one browser tab and
nowhere else. So RPC traffic scales with people *looking* at a mint page, not
with people minting:

- 2,000 visitors × 3–4 reads every 30 seconds ≈ 200–270 RPC calls per second,
  before a single transaction.
- On most chains those calls go through thirdweb's RPC edge under the
  marketplace's client id, which is rate limited **and metered** — a hot mint
  is a bill as well as a risk.
- On Robinhood mainnet (4663) thirdweb does not serve the chain, so the
  fallback is the official public RPC, which has no published rate limit. If
  it throttles, the mint page shows stale or empty state while the chain is
  fine.

## The fix

One API route per drop that makes the reads once, and a CDN cache that answers
everyone else for a few seconds. Two thousand browsers then cost the RPC
roughly one read per five seconds per CDN region.

```
Cache-Control: public, s-maxage=5, stale-while-revalidate=15
```

Five seconds is invisible on a mint page (the client already tolerates 30) and
`stale-while-revalidate` means a burst never waits on the RPC: the CDN serves
the last copy and refreshes in the background.

### Benefits

| | before | after |
|---|---|---|
| RPC calls at 2,000 viewers | ~200–270 / s | ~0.2 / s per CDN region |
| thirdweb RPC spend on a hot drop | scales with viewers | flat |
| public-RPC throttling risk (Robinhood) | real | negligible |
| code touched | — | one route + the drop-state query functions |
| server / database involvement | — | none — it runs on Vercel beside the pages |

What does **not** change: per-wallet reads (minted by wallet, allowlist stage
counts), simulations and sends still go direct. They are one call per wallet
action, not one per viewer per tick, and must never be shared between wallets.

## How TERMINL does it

Three layers, from the outside in, each verified on the testnet contract:

- **CDN** — `pages/api/drop.js` answers with `public, s-maxage=5,
  stale-while-revalidate=15` while a drop is live or upcoming, and
  `s-maxage=300` once it is sold out or closed, because nothing about a
  terminal drop changes again. An RPC failure returns 503 with `no-store`, so
  a blip is never cached as the truth.
- **The function** — instances are reused between requests, so the route keeps
  a module-level memo of the last answer (2 s) and a single in-flight read.
  Measured: **40 concurrent requests against a cold route produced one
  upstream request.**
- **The reads** — `readDropFacts()` in `lib/mint.js` batches the three calls
  into one JSON-RPC request (both Robinhood's node and Alchemy accept
  batches), and tries the keyed endpoint first with the public one as
  fallback. Measured: with the keyed URL pointed at a dead port, the route
  still answered 200 from the public endpoint.

The route serves **facts** — timestamps, counts, price — never state. The
panel decides "started" and "ended" on every tick against a clock corrected to
chain time, with the CDN's `Age` header folded in. `fetchDropFacts()` falls
back to reading the chain directly if the route is unreachable.

## Instructions for the marketplace

1. **Add the route** — `pages/api/drop-state.js` (the `pages/api` directory
   already exists). Inputs: `chain`, `address`, optional `tokenId` for
   editions. Reuse the existing helpers rather than re-encoding anything:
   `detectDropKind`, `getArtifactXDropState721`, `getArtifactXDropState1155`
   from `utils/thirdweb/artifactx-drop.js`, and the prebuilt claim-condition
   readers the mint hooks already use. Build the thirdweb contract server-side
   with `getRpcUrlsForChainId` from `utils/wallet/rpc-config.js`, so the route
   uses exactly the RPC the client would have.
2. **Handle both contract kinds.** ArtifactX drops are single-phase and read
   one condition plus `dropEndsAt`; thirdweb prebuilts read a phase array.
   `detectDropKind` already tells them apart — return a `kind` field and the
   state shape each hook expects.
3. **Restrict what the route will read.** The marketplace serves many
   contracts, so an open route is a free RPC relay for anyone. Accept only
   addresses that exist as collections (a cheap lookup against ElementServer
   or the collections query the page already makes) and only chains in
   `NETWORKS`. Reject everything else with 404 before touching the RPC.
4. **Serialise bigints as strings** and revive on the client. Copy TERMINL's
   `BIG_FIELDS` pattern: one shared list, `String()` out, `BigInt()` in.
5. **Set the headers.** Success: `public, s-maxage=5,
   stale-while-revalidate=15`. Failure: 503 with `no-store`. GET only, 405
   otherwise.
6. **Swap the query functions.** In `Components/features/drop-mint/hooks/`
   (`use-claim-conditions.js`, `use-mint-stats.js`, `use-mint-page-data.js`)
   and the edition equivalents under `edition-drop/edition-detail/`, point the
   React Query `queryFn`s at the route instead of `readContract`. Keep the
   query keys and stale times; only the data source changes. Fall back to the
   direct read if the fetch fails.
7. **Keep wallet-scoped reads direct.** `getSupplyClaimedByWallet*`,
   `getStageMintedByWallet*` and the allowlist claim lookup stay as they are.
8. **Fold in `Age`** anywhere the UI counts down from a chain timestamp, or
   the countdown can run up to 20 s off while the cache is warm.
9. **Verify** with a production start: `curl -i` the route and check the
   header, JSON, and that a bad address returns 404 without an RPC call. Then
   load a mint page with the network tab open — the drop reads should all hit
   the route, and repeated loads should show `age` climbing on the response.
10. **Roll out** behind the mint hooks only. Nothing else on the marketplace
    reads drop state from the RPC, so there is no second consumer to migrate.

## Lessons learned, in the order they bit

Everything below was found while building TERMINL's version and applies
unchanged to the marketplace's mint pages.

1. **Cache facts, derive state.** The first version cached the derived
   `started`/`ended` booleans. That is a trap: the moment a phase opens, every
   visitor whose countdown hits zero refetches, gets the stale "not started"
   copy, and refetches again on every render until the cache expires — a
   self-inflicted stampede at the exact second that matters most. Cache
   timestamps and counts, and let the client derive the state against a
   corrected clock. A cached start time is never wrong.
2. **Fold the cache age into the clock.** A cached chain timestamp is up to
   `s-maxage + stale-while-revalidate` seconds old. Read the CDN's `Age`
   header and subtract it, or the countdown drifts by the cache lifetime.
3. **Batch the reads.** One JSON-RPC batch replaces N round trips. The
   provider still meters each call, but latency and function time drop, and a
   batch is atomic with respect to which block it read from, so the price and
   the count on the page come from the same moment.
4. **Coalesce inside the function.** CDN caches are per region, and a cold
   route can miss in every region at once. A module-level memo plus one
   in-flight promise turns that burst into one upstream read per instance.
   This is the layer that protects the free tier's 500 CU/s ceiling.
5. **Vary the cache lifetime by state.** Live and upcoming: seconds. Sold out
   or ended: minutes. Never cache an error body.
6. **Keyed provider on the server only, public as fallback.** `RPC_URL` with
   no `NEXT_PUBLIC_` prefix never reaches the client bundle — the build
   compiles the server branch away entirely. On a transport failure (429,
   5xx, network) fall through to the public endpoint; on a revert, do not —
   a revert is an answer. Expose which provider answered as a response header
   (`X-RPC-Source`) so a load test can watch the fallback engage.
7. **Keep wallet-scoped reads off the keyed endpoint** unless the caller is
   authenticated. A route that answers for any address anyone types is a way
   to spend the key's allowance from outside. TERMINL has no sessions, so its
   per-wallet reads stay in the browser on the public RPC (one call per
   connect, bounded by minters). The marketplace has SIWE sessions, so it can
   proxy those reads behind auth with a per-user limit.
8. **Wallet chain config carries the public RPC, never the keyed URL.**
   `wallet_addEthereumChain` embeds the URL in the user's wallet forever.
9. **Poll only what can change, only while it is looked at.** Stop polling on
   a terminal drop, slow down when the opening is more than ten minutes away,
   skip ticks while the tab is hidden and refresh on return. Cheap, and it is
   most of the idle traffic on a marketplace with many tabs left open.
10. **Back off receipt polling.** Fast chains land most receipts on the first
    or second look; a fixed 2 s poll for three minutes per minter is the
    single largest per-minter cost.
11. **Free-tier arithmetic.** One drop refresh is 72 CU (two `eth_call` at 26,
    one block read at 20). With a 5 s cache the worst case is one refresh per
    region per 5 s — under 300 CU/s even if every region is busy, inside the
    500 CU/s free ceiling. Viewer count no longer appears in the equation.
12. **Test with a counting proxy, not a provider.** Point `RPC_URL` at a
    local proxy that counts requests and forwards to the public node; fire a
    burst at the route; expect one upstream request. Then point it at a dead
    port and expect a 200 from the fallback. Both take a minute.
13. **Check the port before trusting a test.** A stale `next start` on the
    same port served an old build for one whole test run and made the new
    headers look missing. `lsof -iTCP:4000 -sTCP:LISTEN` first.

## Things to keep in mind

- CDN caches are per region. Ten regions still mean ten reads per five
  seconds, which is nothing.
- `s-maxage` is honoured by Vercel's CDN; browsers ignore it, which is what
  you want — the client should always ask the CDN.
- The route removes viewer load only. Minting itself (simulation, send,
  receipt polling) still costs RPC per minter, which is unavoidable and
  bounded by supply.
- If a drop page ever shows a number the chain disagrees with, the first
  suspect is a cached error body. The `no-store` on failures is what prevents
  that; do not drop it.
