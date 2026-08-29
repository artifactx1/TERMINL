# TERMINL

Site for **TERMINL** — 2048 generative CRT terminals. The mint runs here, on
Robinhood Chain, against the collection's own drop contract; the site exists to
sell the art without giving it away.

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
npm run og                                              # card uses the new set
node --env-file=../ElementServer/.env scripts/upload-art.mjs
git add data/site.json public/art public/degens public/og.jpg && git commit
```

Worth rerunning afterwards — no token ids in the markup, one slug per piece:

```bash
npm run build
# expect 0. The \b matters: without it the theme-color meta (#060907) matches
# as a false positive, and a check that cries wolf stops being read.
grep -cE '#[0-9]{4}\b|/[0-9]{4}\.png' .next/server/pages/index.html
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

## Sharing

`npm run og` builds `public/og.jpg` (1200×630) and the icon set from the
published art — no runtime rendering. Scrapers do not run JavaScript, time out
aggressively and cache hard, so a static file on a stable URL is what actually
survives being pasted somewhere.

The card is **served from the bucket**, not the site:

```
https://storage.googleapis.com/curent-marketplace/terminl/og.jpg
```

`og:image` must be absolute — every scraper rejects a relative URL — and a
Vercel preview domain changes on each deploy, so pointing at the bucket means
previews work before the site has a domain. Override with
`NEXT_PUBLIC_OG_IMAGE` once the real hostname is settled.

A few details that decide whether a platform renders the wide card at all:

- **JPEG, not PNG.** The same card is 1.1 MB as PNG; WhatsApp skips previews
  over roughly 300 kB and every other scraper just gets slower. 157 kB now.
- **`og:image:width`/`height` are declared.** They let a scraper commit to the
  wide layout before the image finishes downloading; without them some fall
  back to a small square thumbnail.
- **`twitter:card` is set explicitly.** X reads its own namespace and will not
  infer `summary_large_image` from `og:*`.
- **The description is one sentence under ~200 characters,** because X truncates
  around there and Discord clips harder still.

Covers X, Discord, Telegram, Slack, iMessage, LinkedIn, Facebook and WhatsApp.
Check a deploy with X's Card Validator, Facebook's Sharing Debugger, or by
pasting the link into a Discord DM to yourself.

## Deploying

Import the repo on Vercel. Nothing else is required. Two optional variables:

| variable | effect if unset |
|---|---|
| `NEXT_PUBLIC_TERMINL_CONTRACT` | the mint panel reads "MINT OPENS SOON" — **set this after deploying** |
| `NEXT_PUBLIC_CHAIN_ID` | `4663` (Robinhood mainnet); `46630` is the testnet |
| `NEXT_PUBLIC_RPC_URL` | the chain's public RPC, which is live |
| `NEXT_PUBLIC_ART_BASE_URL` | serves the committed images from `/art` |
| `NEXT_PUBLIC_SITE_URL` | `og:url` and `canonical` are omitted; set to the production domain |
| `NEXT_PUBLIC_OG_IMAGE` | card is served from the bucket, which is correct |

`TERMINL_COLLECTION_DIR` is *not* needed to build or deploy. It is only read by
`npm run snapshot`, on whichever machine holds the collection.

## Structure

```
lib/showcase.js        the sixteen published ids and the slug hash
scripts/snapshot.mjs   the only code that reads the locked collection
scripts/og.mjs         share card + icons, built from the published art
scripts/upload-art.mjs pushes the snapshot and the card to the ELEMENT bucket
data/site.json         every number and string the page renders (12 kB)
public/art/            the sixteen published images
public/degens/         portraits of the cast who appear in them
pages/index.jsx        the site
styles/                CRT/terminal treatment
```

## Deliberate choices

- **The art is the page.** Hero, marquee, story and gallery, in that order.
  Copy comes from the collection's own vocabulary — rooms, props and companion
  names are real trait values.
- **The cast is teased, not published.** "The degens" shows portraits for the
  15 characters who already stand in the sixteen published pieces, so it reveals
  nothing new — you can see every one of them in the gallery. The other 135 stay
  behind the mint. Portraits are cropped from the character sprites by the
  snapshot, normalised onto one 340×560 canvas so every figure shares a baseline.
- **Trait tables are trimmed server-side** to the rows actually rendered.
  Shipping every variant and slicing in the component had put all 150 companion
  names and all 93 screen names in the markup.
- **No roadmap section, stated plainly.** No utility, no staking, no token; more
  may follow depending on the mint. Written as an honest position rather than a
  promise, so nothing has to be walked back.
- **The mint is hand-encoded, not an SDK.** Wallet libraries are what made
  this a separate repo in the first place — inside ELEMENT the first load was
  393 kB and the hero stalled behind a Suspense-wrapped wallet provider. So the
  four reads and one write the drop needs are ABI-encoded by hand in
  `lib/mint.js`, over `window.ethereum` and plain `eth_call`. The whole mint
  costs **8.7 kB**; the page is 92.7 kB. That is only defensible because the
  encoding is *checked* rather than trusted — `scripts/verify-calldata.mjs`
  diffs it against `cast calldata` across five cases and fails the build if any
  byte differs. **If an allowlist phase is ever added, stop and pull in viem:**
  a merkle proof makes the encoding genuinely dynamic and hand-rolling stops
  being worth it.
- **Nothing about the drop is hardcoded.** Price, supply, remaining, and the
  per-wallet cap are read from the contract, so the page cannot advertise terms
  the chain disagrees with. Before deployment it renders an inert "opens soon"
  panel — the previous version shipped a MINT button pointing at an OpenSea
  collection that 404s, and a dead link costs more trust than a closed sign.
- **Images go through the optimizer.** The snapshot already reduces each piece
  to 1200px, and `next/image` derives the grid and marquee variants. No tile
  passes a `sizes` prop — passing one silently switches `next/image` to the
  `deviceSizes` srcset and fetches a 640px variant for a 210px tile.
- **The marquee loads eagerly.** Its track is translated by a keyframe
  animation, so its tiles never reliably satisfy the lazy-loading observer.
- **No `image-rendering: pixelated`.** The sources are 2048px renders being
  scaled *down*, where it only causes aliasing.
- **No `backdrop-filter` anywhere.** The lightbox had one over the full
  viewport, which forces the compositor to re-render everything behind it every
  frame — and behind it sat a ~7000px marquee on an infinite transform plus a
  fixed scanline layer. Its background is 97% opaque, so the blur was buying
  nothing. The sticky nav had the same problem for the same non-gain.
- **The lightbox pauses what is behind it.** `.frozen` stops the marquee and the
  CRT sweep while the overlay is up; nothing invisible should be driving frames.
- **`min-height: 0` on the lightbox art cell.** Without it the square piece
  forced its grid row taller than the panel and `overflow: hidden` clipped the
  top and bottom of the art on any short window.
- **Trait counts exclude `None`.** The rarity report has a `None` row per
  optional slot. Counting it published "159 companions" when there are 150.

## The mint

The drop contract is `ArtifactXERC721Drop` in the `nftcontracts` repo — a
thirdweb `ERC721Drop` with an immutable platform-fee carve-out, a royalty cap
and a reentrancy-guarded claim. Deploy it with
`script/DeployTerminl.s.sol`, which does the three steps in the order the
contract requires (`lazyMint` → `adminMint` reserves → `setDropConditions`):

```bash
cd ../developement_projects/nftcontracts
export PRIVATE_KEY=0x...
export TERMINL_BASE_URI="ar://<metadata-manifest-tx>/"   # trailing slash
export TERMINL_PRICE_WEI=0            # free mint; 5000000000000000 = 0.005 ETH
export TERMINL_PER_WALLET=10
export TERMINL_RESERVE=0              # team allocation, minted before the phase opens

# dry run first
forge script script/DeployTerminl.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com

# then for real
forge script script/DeployTerminl.s.sol --broadcast \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

Put the printed address in `NEXT_PUBLIC_TERMINL_CONTRACT` and the mint is live.
Nothing else on the site changes.

**`TERMINL_BASE_URI` must be the finished Arweave manifest.** `lazyMint` bakes
it into the batch; correcting it afterwards is a reveal, not an edit. Upload the
art and the metadata first, verify a few tokens resolve, then deploy.

## Still to wire

1. **The Arweave upload.** Every metadata file still carries the
   `ar://__IMAGE_TX__/` placeholder from `LOCK.json`. Until the images and
   metadata are up and the real tx substituted, there is no `TERMINL_BASE_URI`
   to deploy against.
2. `NEXT_PUBLIC_SITE_URL` once the domain is settled, so `og:url` and the
   canonical link are emitted.
3. Revisit `SHOWCASE` once the mint sells out — no reason to keep the rest
   hidden when every piece has an owner.
