# TERMINL

Mint site for **TERMINL** — 2048 generative CRT terminals, stored permanently on
Arweave.

Standalone on purpose. It shares no code with the ArtifactX marketplace: a mint
page should not inherit that app's wallet stack, theme provider or build. Inside
ELEMENT the first load was 393 kB and hydration stalled behind a Suspense-wrapped
wallet provider, leaving the hero blank. Here it is **84 kB** and renders server-side.

## Run it

```bash
npm install
npm run dev        # http://localhost:4000
```

## Where the art comes from

Two modes, one switch.

**Before the Arweave upload** the site previews art off disk. Point at the locked
collection in `.env.local`:

```
TERMINL_COLLECTION_DIR=../ELEMENT/nft-projects/tickerbots/v2/output/collection-2048-terminl
```

It reads `LOCK.json`, `proofs/rarity-report.json` and `bulk-upload.json`, so every
number on the page — trait counts, tier sizes, grail ids — is the real locked
data. Nothing is hand-maintained.

**After the upload** set the image manifest transaction and the site stops
touching the filesystem entirely:

```
NEXT_PUBLIC_ARWEAVE_IMAGE_TX=<43-char manifest tx>
```

Images then resolve as `https://arweave.net/<tx>/0000.png`. Deploy with this set;
`TERMINL_COLLECTION_DIR` is still needed at **build** time to bake in trait data,
but not at runtime.

## Structure

```
lib/collection.js     reads the locked collection; the only place that touches disk
pages/index.jsx       the site — getStaticProps, ISR 60s
pages/api/token.js    local art preview only; unused once the Arweave tx is set
styles/               CRT/terminal treatment
```

## Deliberate choices

- **Server-rendered, not client-fetched.** The art is the pitch; it must be in
  the HTML, not behind a spinner. Also puts traits in link previews.
- **Trait counts exclude `None`.** The rarity report has a `None` row per
  optional slot. Counting it published "159 companions" when there are 158.
- **No wallet code yet.** The mint button is deliberately inert until the
  contract is deployed — a dead connect button costs more trust than an honest
  "opens soon".
- **`outputFileTracingExcludes`** keeps the multi-gigabyte collection out of any
  deployment bundle.

## Still to wire

1. Contract address + chain, then replace the inert CTA with a real mint call.
2. `NEXT_PUBLIC_ARWEAVE_IMAGE_TX` after running the `arweave-upload` skill.
3. Live minted count — currently hardcoded to 0; read it from the contract.
4. OG image + favicon.
