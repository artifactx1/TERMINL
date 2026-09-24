# Before the mint

Launch configuration updated 2026-09-23. Older verification items below remain
open unless explicitly checked.

## Official contract readiness

- [x] Official Robinhood mainnet contract selected:
      `0xc9A4088fD8D2A3327BE33b28646d789549f0188A` (chain `4663`).
- [ ] Prepare the collection's tokens/metadata on the contract (`lazyMint`).
      The launch check returned zero lazy-minted supply and zero minted tokens.
- [ ] Configure and sign the intended public mint condition and/or allowlist
      stages. The launch check returned an unset public condition and no
      published allowlist stages. Updating the website address does not open
      minting by itself.

## Vercel environment

- [x] `NEXT_PUBLIC_TERMINL_CONTRACT` and `NEXT_PUBLIC_CHAIN_ID` — official
      mainnet address above and `4663` on Production and Preview, with matching
      committed production defaults and local configuration.
- [x] `ALLOWLIST_API_URL` — `https://artifactxserver-production.up.railway.app`
      on Production and Preview. The backend responds for the official contract;
      stage definitions and proofs are selected by contract address.
- [x] `NEXT_PUBLIC_REOWN_PROJECT_ID` — set on Production and Preview
      (2026-09-03) to the ArtifactX project id from ELEMENT/.env.testnet.
- [ ] Add `https://terminl.net` (and the Vercel preview domain while testing)
      to that Reown project's allowed domains at cloud.reown.com — a dashboard
      step, no CLI. Without it WalletConnect shows a verification warning in
      the wallet; connections still work.
- [x] `RPC_URL` — verified Alchemy Robinhood mainnet endpoint restored on
      Production, Preview and local development. The public mainnet endpoint
      remains the fallback, and wallet chain configuration carries no key.
- [ ] Upgrade Alchemy from Free before launch and confirm the account's actual
      throughput allowance. The other app is not live; capacity planning is
      primarily for TERMINL. See `docs/MINT_LAUNCH.md` for limits and evidence.
- [x] `NEXT_PUBLIC_SITE_URL` — `https://terminl.net` on Production
      (2026-09-03), for `og:url`, `canonical` and the WalletConnect metadata.

## Assets

- [ ] Re-upload the share card and icons — they were regenerated in the
      Robinhood yellow but the bucket still serves the green ones:
      `node --env-file=../ElementServer/.env scripts/upload-art.mjs`

## Alchemy

- [ ] Use paid capacity for launch: shared viewer caching does not eliminate
      per-minter simulation/confirmation calls. The older free-tier estimate in
      MARKETPLACE_DROP_CACHE.md applies only to shared drop reads and is obsolete
      for the complete mint flow.
- [ ] Restrict the key to server use in the Alchemy dashboard (no browser
      origins needed — nothing in the browser calls it).

## Verification on a preview deployment

- [ ] Load test `/api/drop` on a Vercel preview: a burst of a few thousand
      requests, then check the Alchemy dashboard shows a handful. Confirm the
      `age` header climbs between requests and `X-RPC-Source` reads `keyed`.
- [ ] Connect flow on a phone: WalletConnect QR from desktop, and the in-wallet
      browser on mobile. Confirm the wallet is offered the PUBLIC Robinhood
      RPC when it adds the chain, not the keyed one.
- [ ] **Mint on a phone over WalletConnect**, which is the case the 2026-09-03
      fixes were for: the wallet app should come forward on its own when MINT
      is pressed. The claim is now simulated ahead of the tap and cached, so
      nothing is awaited between the press and the wallet request — an
      `await` there spends iOS's user-activation budget and the app switch is
      refused silently. If it still does not surface, the panel shows an
      "OPEN WALLET TO CONFIRM" link (built from the connected session's own
      redirect metadata); confirm that appears and works. Also confirm the
      wallet returns to the site after signing, which is what
      `metadata.redirect.universal` is for — it needs `NEXT_PUBLIC_SITE_URL`
      set, so it only works on Production and Preview, not on localhost.
- [ ] One real testnet mint end to end once a phase is configured: simulate,
      confirm, receipt, "MINTED ✓" link resolves on the explorer.

## Allowlist

Built 2026-09-03. GTD and FCFS stages mint on this site through
`claimAllowlist`; see README → The mint → Allowlist stages.

- [x] Eligibility for the connected wallet: `/api/allowlist/<wallet>` proxies
      `GET /drop-allowlist/<contract>/claim/<wallet>` server-to-server (which
      passes the backend's CORS), cached 30 s per wallet, fetched once per
      connection, no polling. Failure reads as "could not check", never as
      "not on the list".
- [x] `claimAllowlist` hand-encoded in `lib/mint.js` rather than pulling in
      viem — `MintParams` is seven static words and the proof is a `bytes32[]`,
      so it encodes with fewer moving parts than the public `claim`. Verified
      against `cast calldata` at proof depths 0-12, and simulated against the
      deployed testnet contract (reaches `verifyAllowlistClaim`, reverts
      `AllowlistNotConfigured` as expected with no root published). Cost: 1.4 kB
      on the page, 2 kB first-load.
- [x] Stage price and cap take precedence over the public phase while a stage
      is live, counted per stage via `stageMintedByWallet(uint32,address)`.
      The panel no longer says "MINT NOT OPEN YET" above a LIVE row.
- [x] All ten `Stage*` / allowlist error selectors in `lib/mint.js` ERRORS.

- [ ] **End-to-end test on a real stage.** Everything above is verified against
      `cast`, the live contract and a stub backend, but no stage has ever been
      published for this drop — so no proof has been through the real path.
      Before launch: publish a one-wallet GTD stage on the TESTNET drop from the
      studio, sign the root, and mint it here.
- [ ] The drop must exist as a `collections` row on the backend for the studio
      to accept stages (`saveAllowlistStages` 404s otherwise, 403 if the signer
      is not the collection owner). Import it if it was deployed outside
      ArtifactX.
- [ ] Publishing stages through the studio also lists the drop on artifactx.app
      (Explore → Drops, the homepage rail, the cards). Decide whether TERMINL
      should appear there or stay standalone.
- [ ] Keep GTD and FCFS windows sequential. If two overlap and a wallet holds
      both, only the lower stage index is reachable from this panel.

## Marketplace

- [ ] Carry the cached drop-state route to ELEMENT's mint pages per
      MARKETPLACE_DROP_CACHE.md.
