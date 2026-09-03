# Before the mint

Open items from the 2026-09-02 session, in the order they block launch.

## Vercel environment

- [x] `NEXT_PUBLIC_TERMINL_CONTRACT` — set on Production and Preview
      (2026-09-02) to the TESTNET contract
      `0x417EeE67E4A9B34D9b310273C82F075492a1F32E`, with
      `NEXT_PUBLIC_CHAIN_ID=46630` on both. It is an ArtifactXERC721Drop with
      no phase configured and no allowlist root published yet, so the panel
      reads "MINT NOT OPEN YET" until `setDropConditions` is called.
- [ ] Swap both to the MAINNET contract and `NEXT_PUBLIC_CHAIN_ID=4663` once
      it is deployed. Production currently mints testnet.
- [ ] `ALLOWLIST_API_URL` — `https://artifactxserver-production.up.railway.app`,
      the MAINNET ArtifactX backend, server-side only, so the schedule can list
      allowlist stages. Set it in the same change as the mainnet contract, not
      before: the testnet host is built into `lib/phases.js` under chain 46630,
      and this one holds a different database, so pointing at it while the
      testnet contract is live returns an empty schedule. Confirmed serving
      2026-09-03 (it 502s while the mainnet server is mid-migration).
- [x] `NEXT_PUBLIC_REOWN_PROJECT_ID` — set on Production and Preview
      (2026-09-03) to the ArtifactX project id from ELEMENT/.env.testnet.
- [ ] Add `https://terminl.net` (and the Vercel preview domain while testing)
      to that Reown project's allowed domains at cloud.reown.com — a dashboard
      step, no CLI. Without it WalletConnect shows a verification warning in
      the wallet; connections still work.
- [x] `RPC_URL` — set on Production and Preview (2026-09-03) to the Alchemy
      **testnet** host with the key from artifactx-testnet-railway.env (the
      one in ElementServer/.env does not answer on Alchemy). Server-side only.
- [ ] At the mainnet swap, change Production's `RPC_URL` to
      `https://robinhood-mainnet.g.alchemy.com/v2/<key>` in the same step as
      the contract and chain id — a testnet RPC with a mainnet chain id reads
      as "READING THE CHAIN…" forever.
- [x] `NEXT_PUBLIC_SITE_URL` — `https://terminl.net` on Production
      (2026-09-03), for `og:url`, `canonical` and the WalletConnect metadata.

## Assets

- [ ] Re-upload the share card and icons — they were regenerated in the
      Robinhood yellow but the bucket still serves the green ones:
      `node --env-file=../ElementServer/.env scripts/upload-art.mjs`

## Alchemy

- [ ] Decide free tier vs pay-as-you-go. The cached route keeps the site under
      the free ceiling (500 CU/s) regardless of visitors; PAYG is insurance,
      not a requirement. See MARKETPLACE_DROP_CACHE.md, lesson 11.
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
