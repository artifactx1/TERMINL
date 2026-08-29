# TERMINL

Site for **TERMINL** — 2048 generative CRT terminals, stored permanently on
Arweave. Minting happens on OpenSea; this site exists to sell the art without
giving it away.

> A celebration of art, memes and degenerate behavior.

Standalone on purpose. It shares no code with the ArtifactX marketplace: this
page should not inherit that app's wallet stack, theme provider or build.
Inside ELEMENT the first load was 393 kB and hydration stalled behind a
Suspense-wrapped wallet provider, leaving the hero blank. Here it is **88 kB**
and renders server-side.

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
number on the page — trait counts, tier sizes, PvP outcomes — is the real locked
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
lib/showcase.js        the 32 published token ids, the teased names, and the slug hash
lib/collection.js      reads the locked collection; the only place that touches disk
pages/index.jsx        the site — getStaticProps, ISR 60s
pages/api/art/[slug].js the only route that serves art; resolves 32 slugs, nothing else
styles/                CRT/terminal treatment
```

## The reveal is the product

**Only 32 of the 2048 pieces are ever published.** `lib/showcase.js` holds that
list and it is the single gate: the hero rotation, the marquee and the gallery
all read from it, and `lib/collection.js` never puts anything else into the
page props. The rendered HTML contains exactly 32 token ids — the rest of the
collection is not one view-source away.

The 32 were picked off contact sheets rather than by rarity score, for spread:
every chassis, the loud finishes (Gold, Hologram, Diamond Ice, Toxic Neon,
Platinum, Chrome), the six rare rooms, and a screen mix of tickers, slogans,
arcade and late-night TV. To change what is public, edit that one list.

**Token ids are masked too.** They are part of the surprise, so no number ever
reaches the browser — not as a caption, not in an image URL. Each published
piece is addressed by an opaque slug (`slugFor()` in `lib/showcase.js`) and
`/api/art/[slug]` is the only route that serves art. It resolves those 32 slugs
and nothing else, so the rest of the collection cannot be pulled by guessing a
number. The route it replaced, `/api/token?id=N`, would happily serve any of the
2048.

Once `NEXT_PUBLIC_ARWEAVE_IMAGE_TX` is set the route proxies the gateway rather
than redirecting to it, because an Arweave URL contains the padded token id.

Checks worth rerunning after editing `SHOWCASE`:

```bash
npm run build
# no token ids in the markup:
grep -cE '#[0-9]{4}|/[0-9]{4}\.png|id%3D[0-9]+' .next/server/pages/index.html   # expect 0
# one slug per published piece:
grep -oE '%2Fapi%2Fart%2F[0-9a-f]{16}' .next/server/pages/index.html | sort -u | wc -l
```

**One caveat, since this repo is public:** `lib/showcase.js` lists which 32 token
ids are on display, and the slug salt sits beside it. That only ever identifies
the 32 pieces already published, never the hidden 2016 — but if you want even
that opaque, move `SHOWCASE` into an environment variable.

## Deliberate choices

- **The art is the page.** Hero, marquee, story and a curated gallery, in that
  order. Copy is short and comes from the collection's own vocabulary — rooms,
  props and companion names are all real trait values — rather than generic
  launch language.
- **No roadmap section, stated plainly.** No utility, no staking, no token; more
  may follow depending on the mint. It is written as an honest position rather
  than a promise, so nothing has to be walked back later.
- **Every render goes through the image optimizer.** Sources are 2048px PNGs
  around 2–3.5 MB each; a grid of them at full size simply never paints. `sharp`
  is a runtime dependency for that reason, and `next.config.js` pins
  `imageSizes` to the widths actually rendered.
- **No `sizes` prop on the tiles.** Passing one switches `next/image` to the
  responsive srcset built from `deviceSizes` (smallest 640) and ignores
  `imageSizes`, so a 210px marquee tile would fetch a 640px variant.
- **Watch the tile count.** Each tile is one cold optimizer resize, doubled by
  the 2x srcset candidate on retina. An earlier 40-tile gallery plus a long
  marquee meant ~170 concurrent jobs on first paint and the hero lost the race.
  The curated 32 keeps the whole page's art under a hundred variants.
- **The 1/1s are an easter egg.** They are in the collection and in the
  metadata, but nothing here names, counts or grids them. `lib/collection.js`
  filters them out of trait counts in one place, and they are absent from
  `SHOWCASE`, so there are two independent reasons they cannot surface.
- **No mint button, no wallet code.** Minting is on OpenSea; the CTA is a link.
  Set `NEXT_PUBLIC_OPENSEA_URL` to the real collection URL.
- **Trait counts exclude `None`.** The rarity report has a `None` row per
  optional slot. Counting it published "159 companions" when there are 150.
- **Server-rendered, not client-fetched.** The art must be in the HTML, not
  behind a spinner. Also puts traits in link previews.
- **`outputFileTracingExcludes`** keeps the multi-gigabyte collection out of any
  deployment bundle.

## Still to wire

1. `NEXT_PUBLIC_OPENSEA_URL` — currently defaults to a guessed slug.
2. `NEXT_PUBLIC_ARWEAVE_IMAGE_TX` after running the `arweave-upload` skill.
3. OG image + favicon.
4. Revisit `SHOWCASE` if the mint sells out — there is no reason to keep the
   rest hidden once every piece has an owner.
