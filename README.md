# TERMINL

Site for **TERMINL** — 2048 generative CRT terminals. Minting happens on
OpenSea; this site exists to sell the art without giving it away.

> A celebration of art, memes and degenerate behavior.

## Run it

```bash
npm install
npm run dev        # http://localhost:4000
```

That is the whole setup. The site has no dependency on the locked collection —
it reads `data/site.json` and the images in `public/art`, both committed.

## The reveal is the product

**Sixteen of the 2048 pieces exist as far as this site is concerned.**

They are not filtered at runtime. `npm run snapshot` is the only code that ever
opens the locked collection; it copies exactly the pieces listed in
`lib/showcase.js` into `public/art/` and their traits into `data/site.json`, and
you commit the result. The deployed app cannot show a seventeenth piece because
a seventeenth piece is not in the build.

The sixteen were picked off contact sheets for spread rather than rarity — all
seven chassis, twelve finishes, twelve rooms — so the set reads as a range
instead of a sample.

**Token ids are masked too.** The numbers are part of the surprise, so none
reaches the browser: not as a caption, not in a filename, not in a URL. Each
piece is addressed by an opaque slug (`slugFor()` in `lib/showcase.js`).

**The 1/1s are an easter egg** and cannot leak: the snapshot strips them from
every trait table and refuses outright if one ever appears in `SHOWCASE`.

### Changing what is public

```bash
# edit lib/showcase.js, then:
TERMINL_COLLECTION_DIR=../path/to/collection npm run snapshot
node --env-file=../ElementServer/.env scripts/upload-art.mjs
git add data/site.json public/art && git commit
```

Worth rerunning afterwards — no token ids in the markup, one slug per piece:

```bash
npm run build
grep -cE '#[0-9]{4}|/[0-9]{4}\.png' .next/server/pages/index.html      # expect 0
grep -oE '[0-9a-f]{16}\.webp' .next/server/pages/index.html | sort -u | wc -l
```

**One caveat, since this repo is public:** `lib/showcase.js` lists which sixteen
token ids are on display, and the slug salt sits beside it. That only ever
identifies the sixteen pieces already published, never the withheld 2032 — but
if you want even that opaque, move `SHOWCASE` into an environment variable.

## Where the images live

`public/art/<slug>.webp` — sixteen 1200px webp files, about 2.9 MB total,
committed so a deploy always works.

They are also on the ELEMENT bucket, which is what production serves:

```
NEXT_PUBLIC_ART_BASE_URL=https://storage.googleapis.com/curent-marketplace/terminl/art
```

Unset that and the site falls back to the committed copies, so a missing
environment variable degrades instead of breaking. `scripts/upload-art.mjs`
pushes the snapshot to the bucket; it reads credentials from the server's env
file at run time and stores nothing in this repo:

```bash
node --env-file=../ElementServer/.env scripts/upload-art.mjs --check   # nothing written
node --env-file=../ElementServer/.env scripts/upload-art.mjs
```

The canonical art for the tokens themselves is Arweave, per the collection's
metadata. These are display copies for the website and nothing more.

## Deploying

Import the repo on Vercel. Nothing else is required. Two optional variables:

| variable | effect if unset |
|---|---|
| `NEXT_PUBLIC_ART_BASE_URL` | serves the committed images from `/art` |
| `NEXT_PUBLIC_OPENSEA_URL` | falls back to a guessed `opensea.io` slug — **set this** |

`TERMINL_COLLECTION_DIR` is *not* needed to build or deploy. It is only read by
`npm run snapshot`, on whichever machine holds the collection.

## Structure

```
lib/showcase.js        the sixteen published ids, the teased names, the slug hash
scripts/snapshot.mjs   the only code that reads the locked collection
scripts/upload-art.mjs pushes the snapshot to the ELEMENT bucket
data/site.json         every number and string the page renders (12 kB)
public/art/            the sixteen published images
pages/index.jsx        the site
styles/                CRT/terminal treatment
```

## Deliberate choices

- **The art is the page.** Hero, marquee, story and gallery, in that order.
  Copy comes from the collection's own vocabulary — rooms, props and companion
  names are real trait values.
- **The roster is teased, not published.** Twenty-four named regulars out of
  150, and trait tables are trimmed by the snapshot to the rows actually
  rendered. Shipping every variant and slicing in the component had put all 150
  companion names and all 93 screen names in the markup.
- **No roadmap section, stated plainly.** No utility, no staking, no token; more
  may follow depending on the mint. Written as an honest position rather than a
  promise, so nothing has to be walked back.
- **No wallet code.** Minting is on OpenSea; the CTA is a link.
- **Images go through the optimizer.** The snapshot already reduces each piece
  to 1200px, and `next/image` derives the grid and marquee variants. No tile
  passes a `sizes` prop — passing one silently switches `next/image` to the
  `deviceSizes` srcset and fetches a 640px variant for a 210px tile.
- **The marquee loads eagerly.** Its track is translated by a keyframe
  animation, so its tiles never reliably satisfy the lazy-loading observer.
- **No `image-rendering: pixelated`.** The sources are 2048px renders being
  scaled *down*, where it only causes aliasing.
- **Trait counts exclude `None`.** The rarity report has a `None` row per
  optional slot. Counting it published "159 companions" when there are 150.

## Still to wire

1. `NEXT_PUBLIC_OPENSEA_URL` — currently defaults to a guessed slug.
2. OG image + favicon.
3. Revisit `SHOWCASE` once the mint sells out — no reason to keep the rest
   hidden when every piece has an owner.
