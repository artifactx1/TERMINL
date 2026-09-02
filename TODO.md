# Before the mint

Open items from the 2026-09-02 session, in the order they block launch.

## Vercel environment

- [ ] `NEXT_PUBLIC_TERMINL_CONTRACT` — the mainnet drop, once deployed.
      Testnet contract for previews: `0x417EeE67E4A9B34D9b310273C82F075492a1F32E`
      (chain `46630`, set `NEXT_PUBLIC_CHAIN_ID=46630` alongside it). It is an
      ArtifactXERC721Drop with no phase configured and no allowlist root
      published yet, so the panel reads "MINT NOT OPEN YET" until
      `setDropConditions` is called.
- [ ] `NEXT_PUBLIC_REOWN_PROJECT_ID` — reuse the ArtifactX project id, then add
      the TERMINL domain (and the Vercel preview domain while testing) to that
      project's allowed domains at cloud.reown.com. Without the domain,
      WalletConnect shows a verification warning in the wallet.
- [ ] `RPC_URL` — server-side only, never `NEXT_PUBLIC_`:
      `https://robinhood-mainnet.g.alchemy.com/v2/<key>` on production,
      `https://robinhood-testnet.g.alchemy.com/v2/<key>` on previews. The
      key is the one ElementServer already uses on Railway (`ALCHEMY_API_KEY`).
- [ ] `NEXT_PUBLIC_SITE_URL` — the production domain, for `og:url` and the
      WalletConnect metadata.

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
