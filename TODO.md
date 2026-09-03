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
- [ ] `ALLOWLIST_API_URL` — the mainnet ArtifactX backend host, server-side
      only, so the schedule can list allowlist stages. Testnet is built in.
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
- [ ] One real testnet mint end to end once a phase is configured: simulate,
      confirm, receipt, "MINTED ✓" link resolves on the explorer.

## Allowlist (parked)

- [ ] While an allowlist stage is live and the public phase is not, the panel
      still says "MINT NOT OPEN YET" above a LIVE row. Correct once allowlist
      minting exists here; until then the schedule row is the truth.

- [ ] Eligibility check for the connected wallet, same logic as ArtifactX:
      a narrow Next API route proxies `GET /drop-allowlist/<contract>/claim/<wallet>`
      on ElementServer (server-to-server, which passes its CORS) and the panel
      shows eligible / not on the list / no allowlist. Prefetch at connect,
      cache 30 s per wallet, no polling.
- [ ] If an allowlist phase mints here: `claimAllowlist` via viem's encoder
      (the proof is a `bytes32[]`), the stage's price and cap take precedence
      over the public phase, and the `Stage*` error selectors go into
      `lib/mint.js`. Testnet API host for previews:
      `https://precious-blessing-production-fc0b.up.railway.app`.

## Marketplace

- [ ] Carry the cached drop-state route to ELEMENT's mint pages per
      MARKETPLACE_DROP_CACHE.md.
