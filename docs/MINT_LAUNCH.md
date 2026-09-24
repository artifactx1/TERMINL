# TERMINL mint launch audit — 2026-09-23

## Scope and status

Official contract: `0xc9A4088fD8D2A3327BE33b28646d789549f0188A`.
Network: Robinhood mainnet, chain ID `4663`. Expected collection: 2,048 NFTs.
Planning assumption: about 1,000 visitors, with a potentially concentrated mint burst.

App hardening and automated verification do **not** establish that the drop is
ready to open. The live read-only audit at `2026-09-24T01:45:10Z` found:

- Contract name: `TERMINL`.
- Owner: `0xa894a5422a1eD5Aee9Fba393E3962AdEbC48E38B`.
- Collection metadata URI is set (IPFS).
- Prepared/lazy-minted token supply: **0**; minted: **0**.
- Public claim condition: **unset**.
- Allowlist root: **zero**; backend stages: **none published**.

Before opening, the owner must prepare the 2,048 tokens with the intended metadata,
configure/sign the intended phases, and confirm dates, prices, wallet limits,
and a matching published allowlist root. Run `npm run check:mint` again afterward.
That command is read-only and exits 2 when configuration blockers remain.

## Changes

### Provider and request handling

- Restored a verified Alchemy **mainnet** endpoint in server-only `RPC_URL` for
  Vercel production, preview, and local development. No key is committed.
- The public mainnet endpoint remains the fallback. Browser/wallet chain
  configuration keeps the public URL; no Alchemy credential is placed into a
  user's wallet via `wallet_addEthereumChain`.
- Added `/api/mint-rpc` for application wallet counters, claim simulations,
  receipt checks, and failed-transaction replay. Wallet signing/submission still
  belongs to the wallet; the server cannot sign or broadcast transactions.
- This route permits only fixed-contract wallet counter reads and the two mint
  selectors, plus transaction receipt lookups. It rejects arbitrary contracts,
  sends, logs, batches, state overrides, extra transaction fields, and excessive
  payloads/quantities. Simulations require receiver = caller.
- Added same-origin validation when Origin is present, a 120-request/minute/IP
  per-instance limit, a 64-distinct-inflight per-instance ceiling, and bounded
  caches/maps. These are **not a distributed quota or authentication**.
- Concurrent identical calls share one promise. Wallet counters and simulations
  are not cached after completion: a post-mint count must not reuse a pre-mint
  count on a fast chain. Receipts have a one-second cache.
- Provider calls time out after six seconds; the browser's server-proxy timeout
  is fifteen seconds to allow primary/fallback handling. HTTP throttling,
  provider JSON-RPC capacity errors, malformed responses, and network failures
  trigger fallback. Actual contract reverts preserve their error data.
- A failed primary is skipped for fifteen seconds per instance. A failed site
  RPC route still permits a browser to fall back to public RPC reads.
- Added safe structured failure events: `mint_drop_read_failed`,
  `mint_rpc_unavailable`, `mint_phases_read_failed`, `mint_allowlist_read_failed`.
  Provider URLs, keys, and wallet lists are not logged.

### Refresh and transaction behavior

- Unconfigured drops and initial read failures keep refreshing, so a tab opened
  before setup does not remain closed forever.
- Phase definitions and connected-wallet eligibility refresh every thirty
  seconds while visible, on tab return, and on network reconnection.
- Phase/allowlist CDN cache windows are fifteen seconds fresh plus fifteen
  seconds stale-while-revalidate. Successful previous schedule data survives a
  transient refresh failure. An allowlist outage is never treated as ineligibility.
- Drop read failures no longer clear transaction errors on the next successful poll.
- An exhausted public phase is not treated as a completed collection for long
  caching or stopping refreshes; later allowlist activity can still change totals.
- In-flight wallet reads cannot overwrite a newly selected wallet's count.
- Preflight identity includes public/stage terms and proof changes, plus the
  wallet and local confirmed-mint generation.
- A synchronous in-flight guard prevents double taps and the main/sticky controls
  from opening duplicate wallet requests before React renders disabled buttons.
- Pending transaction accounting uses its original wallet even if the user switches.
- Pending/success/failure status remains visible when the final token sells out
  or a phase ends. Receipt status 0 is never displayed as successful.
- A receipt timeout keeps new minting disabled and offers a confirmation recheck.
- Submitted transaction hashes persist in sessionStorage, scoped by chain,
  contract and wallet. Reloading resumes confirmation without resubmitting.
  This cannot recover a hash the wallet never returned, and storage-disabled
  browsers cannot persist it. Existing wallet-counter recovery handles some
  lost WalletConnect replies; it is not transaction-hash attribution.
- The wallet-reset control explicitly asks users to cancel the wallet request
  before resetting. A site cannot cancel an already-broadcast transaction.

## Evidence

Tests use fixture wallets; no real user transaction was signed or broadcast.

| Check | Result / scope |
| --- | --- |
| Production build and lint | Passed |
| Mint quantity + reliability tests | 13 tests passed, including actual six-second timeout cancellation |
| ABI verification | All 54 checks matched Foundry `cast` |
| Quantity browser suite | GTD, partially spent GTD, mobile FCFS, public, external mint refresh passed |
| Chromium flow suite | Public/allowlist success, last-token sellout, rejection, simulation revert, failed receipt, late configuration, allowlist recovery, wrong chain, delayed receipt, pending reload passed |
| WebKit flow suite | The same 11 scenarios passed in the Safari engine with a fixture wallet |
| Browser credential scan | Private RPC key absent from all 117 generated browser asset files |
| 1,000 concurrent handler drop requests | Two upstream HTTP requests, six RPC methods |
| 1,000 concurrent identical wallet reads | One upstream call |
| 1,000 HTTP drop requests, concurrency 100 | Zero errors; two upstream requests; observed p95 436 ms, maximum 495 ms |
| 1,000 distinct wallet HTTP reads, concurrency 40 | Zero errors; 1,000 upstream requests; observed p95 486 ms, maximum 693 ms |

HTTP load tests ran against a **local production Next.js server and counting
mock RPC with 15 ms response delay**. Latencies describe that machine/test only.
They prove application coalescing and request handling, not Alchemy throughput,
public-node capacity, a distributed CDN, or 1,000 simultaneous real signatures.

## Capacity and remaining launch checks

The account is currently Free; the owner intends to upgrade before mint. The
other application is not live, so TERMINL is the primary capacity workload.

As checked on 2026-09-23, [Alchemy pricing](https://www.alchemy.com/pricing)
lists 500 CU/s on Free and 10,000 CU/s included with Pay As You Go. Actual dashboard
limits must be confirmed. [Throughput](https://www.alchemy.com/docs/reference/throughput)
is evaluated over a ten-second rolling window and shared at account level.
Viewer caching does not remove unique-wallet simulations or receipt polling.

For scale intuition only: 1,000 minters averaging five RPC calls each across
thirty seconds means roughly 167 methods/second, before extra wallet checks,
retries, and shared reads. An instantaneous synchronized rush can exceed that.
Validate the actual method mix and upgraded allowance; do not treat collection
supply as a cap on requests, failed attempts, or retries. Do not buy additional
capacity solely from this estimate.

Remaining launch gates:

1. Confirm the paid Alchemy plan is active and its dashboard allowance meets the
   intended burst; observe usage and 429s during the final rehearsal.
2. Owner completes token metadata/lazy supply and public/allowlist phase setup;
   verify root, time windows, prices, caps and available supply with `check:mint`.
3. Confirm token metadata/images resolve after the final upload and mint setup.
4. Complete a real end-to-end mint rehearsal on a test deployment with the same
   configuration pattern, including eligible and ineligible wallets. Do not spend
   real launch supply just to test without the owner's explicit choice.
5. Verify real iOS WalletConnect/app handoff and return, plus an injected wallet.
   Desktop WebKit and an injected fixture do not verify the mobile relay/app switch.
6. Confirm `terminl.net` is allowed in the Reown dashboard and check the real
   WalletConnect picker/connection on the production domain.

## Reproduce

```sh
npm run build
npm run test:mint
npm run verify-calldata
npm run test:mint:load

# Keep an isolated production build + local RPC fixtures running:
node scripts/mint-load.mjs --serve
MINT_TEST_URL=http://127.0.0.1:4007 npm run test:mint:browser
MINT_TEST_URL=http://127.0.0.1:4007 npm run test:mint:flow
MINT_TEST_URL=http://127.0.0.1:4007 MINT_TEST_BROWSER=webkit npm run test:mint:flow

# Uses local/hosting server configuration; read-only:
npm run check:mint
```

Production observation: check `/api/drop` for `X-RPC-Source: keyed` and successful
JSON, verify the official contract link, inspect `/api/phases` and eligibility,
and scan Vercel runtime errors after deployment. Keep the public fallback as
recovery capacity, not an assumed production SLA.
