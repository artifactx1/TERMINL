/**
 * Builds everything the website is allowed to know about the collection.
 *
 * This is the only code that ever opens the locked collection, and it does not
 * run at build or request time — you run it by hand, commit what it emits, and
 * deploy that. The consequence is the point: the deployed app has no path back
 * to the other 2032 pieces, because they are not in the build. Nothing is
 * filtering them out at runtime; they simply are not there.
 *
 *   TERMINL_COLLECTION_DIR=../path/to/collection npm run snapshot
 *
 * Emits:
 *   data/site.json      every number and string the page renders
 *   public/art/<slug>.webp   the published pieces, keyed by opaque slug
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { SHOWCASE, STORY_ART, slugFor } from "../lib/showcase.js";

const ROOT = path.resolve(
  process.cwd(),
  process.env.TERMINL_COLLECTION_DIR
    || "../ELEMENT/nft-projects/tickerbots/v2/output/collection-2048-terminl",
);

/** Character sprites, for the cast portraits. Transparent PNGs, one per name. */
const LAYERS = path.resolve(
  process.cwd(),
  process.env.TERMINL_LAYERS_DIR || path.join(ROOT, "..", "..", "layers"),
);

/** Rows published per trait category in "The tape". */
const TAPE_ROWS = 10;
/** Master width. The hero is the largest render; everything else derives from it. */
const ART_WIDTH = 1200;
const ART_QUALITY = 80;
/*
 * Portraits render onto one fixed canvas rather than keeping each sprite's own
 * aspect. Every figure then sits on the same baseline so the row reads as a
 * line-up, and a single width/height pair covers all of them downstream.
 */
const DEGEN_W = 340;
const DEGEN_H = 560;

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const SECRET = /1\/1 Grail/;
const traitsOf = (t) => Object.fromEntries(t.attributes.map((a) => [a.trait_type, a.value]));
const padId = (n) => String(n).padStart(4, "0");

async function main() {
  if (!fs.existsSync(ROOT)) {
    throw new Error(`No collection at ${ROOT}. Set TERMINL_COLLECTION_DIR.`);
  }

  const lock = readJson("LOCK.json");
  const rarity = readJson(path.join("proofs", "rarity-report.json"));
  const tokens = readJson("bulk-upload.json");

  /*
   * The rarity report carries a "None" row for every optional slot — the share
   * of tokens with no prop/effect/companion, not a trait anyone can own.
   * Counting it inflates every published variant count by one. The 1/1s are
   * stripped here too, so they never reach a trait table.
   */
  const traits = {};
  for (const [category, values] of Object.entries(rarity.categories || {})) {
    traits[category] = values
      .filter((v) => v.name !== "None" && !SECRET.test(v.name))
      .map((v) => ({ name: v.name, count: v.count, percent: v.percent }))
      .sort((a, b) => b.count - a.count);
  }

  const outcomes = Object.fromEntries((rarity.outcomes || []).map((o) => [
    /winner/i.test(o.name) ? "winner" : /rekt/i.test(o.name) ? "rekt" : "open",
    o.count,
  ]));

  const showcase = [];
  for (const tokenId of SHOWCASE) {
    const token = tokens[tokenId];
    if (!token) throw new Error(`Token ${tokenId} is not in the manifest`);
    if (token.attributes.some((a) => SECRET.test(a.value))) {
      throw new Error(`Token ${tokenId} is a 1/1 and must never be published`);
    }
    const t = traitsOf(token);
    const slug = slugFor(tokenId);

    const source = path.join(ROOT, "images", `${padId(tokenId)}.png`);
    const out = path.join("public", "art", `${slug}.webp`);
    await sharp(source)
      .resize(ART_WIDTH, ART_WIDTH)
      .webp({ quality: ART_QUALITY, effort: 6 })
      .toFile(out);

    // Deliberately no token id — the numbers are part of the surprise.
    showcase.push({
      slug,
      screen: t["Screen / Face"] || null,
      chassis: t.Chassis || null,
      finish: t["Chassis Finish"] || null,
      room: t.Background || null,
      prop: t["Primary Prop"] || null,
      companion: t.Companion || null,
    });
    process.stdout.write(`  ${slug}.webp  ${(fs.statSync(out).size / 1024).toFixed(0)} kB\n`);
  }

  /*
   * Cast portraits, cropped from the character sprites.
   *
   * Only the degens who already appear in the sixteen published pieces are
   * built, so this reveals nothing new — you can already see every one of them
   * standing in the gallery. Anyone not on that list stays unpublished.
   */
  fs.mkdirSync("public/degens", { recursive: true });
  const degens = await portraits(showcase);

  const site = {
    name: lock.collection,
    symbol: lock.symbol,
    supply: lock.supply,
    storage: lock.storage,
    counts: { uniqueDna: lock.counts.uniqueDna },
    tiers: rarity.tiers,
    outcomes,
    // Totals are counted before the trim, so the "N variants" labels stay honest
    // while only the rendered rows ship.
    traitTotals: Object.fromEntries(Object.entries(traits).map(([k, v]) => [k, v.length])),
    traitCategories: Object.fromEntries(
      Object.entries(traits).map(([k, v]) => [k, v.slice(0, TAPE_ROWS)]),
    ),
    degens,
    showcase,
    storyArt: STORY_ART.map(slugFor),
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync("data/site.json", `${JSON.stringify(site, null, 2)}\n`);
  console.log(`\ndata/site.json  ${(fs.statSync("data/site.json").size / 1024).toFixed(0)} kB`);
  console.log(`${showcase.length} pieces published, ${lock.supply - showcase.length} withheld`);
}

const nameSlug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function portraits(showcase) {
  const seen = new Map();
  for (const piece of showcase) {
    if (piece.companion && !seen.has(piece.companion)) seen.set(piece.companion, piece.companion);
  }

  const out = [];
  for (const name of seen.keys()) {
    const file = path.join(LAYERS, "companion", `${nameSlug(name)}.png`);
    if (!fs.existsSync(file)) {
      console.warn(`  ! no sprite for ${name}`);
      continue;
    }
    const slug = nameSlug(name);
    // trim() drops the transparent margin so the figure is framed on itself
    // rather than on whatever padding its sprite happened to carry.
    const figure = await sharp(file)
      .trim()
      .resize({ width: DEGEN_W, height: DEGEN_H, fit: "inside", withoutEnlargement: true })
      .toBuffer();
    const meta = await sharp(figure).metadata();

    await sharp({
      create: {
        width: DEGEN_W, height: DEGEN_H, channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: figure,
        left: Math.round((DEGEN_W - meta.width) / 2),
        top: DEGEN_H - meta.height,
      }])
      .webp({ quality: 78, effort: 6, alphaQuality: 80 })
      .toFile(path.join("public", "degens", `${slug}.webp`));
    out.push({ slug, name });
  }
  const kb = out.reduce((n, d) =>
    n + fs.statSync(path.join("public", "degens", `${d.slug}.webp`)).size, 0) / 1024;
  console.log(`\n${out.length} cast portraits  ${DEGEN_W}x${DEGEN_H}  ${kb.toFixed(0)} kB total`);
  return out;
}

main().catch((e) => {
  console.error(`snapshot failed: ${e.message}`);
  process.exit(1);
});
