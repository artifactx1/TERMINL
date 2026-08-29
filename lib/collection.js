import fs from "fs";
import path from "path";

/**
 * The locked collection lives outside this repo — it is gigabytes of art owned
 * by the generator project. Point at it with TERMINL_COLLECTION_DIR for local
 * previews. In production the art is served from Arweave and this is unused.
 */
export const collectionRoot = path.resolve(
  process.cwd(),
  process.env.TERMINL_COLLECTION_DIR
    || "../ELEMENT/nft-projects/tickerbots/v2/output/collection-2048-terminl",
);

import { SHOWCASE, REGULARS_TEASE, slugFor } from "./showcase";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/*
 * The eight full-canvas 1/1s are an easter egg. They are in the collection and
 * in the metadata, but nothing on this site names them, counts them or puts
 * them in a grid — they are found, not advertised. Everything below filters on
 * this marker, so there is one place to change if that ever stops being true.
 */
const SECRET = /1\/1 Grail/;

/** Rows published per trait category in "The tape". */
const TAPE_ROWS = 10;
const isSecret = (token) => token.attributes.some((a) => SECRET.test(a.value));

let cache = null;

function manifest() {
  if (!cache) cache = readJson(path.join(collectionRoot, "bulk-upload.json"));
  return cache;
}

const traitsOf = (token) => Object.fromEntries(token.attributes.map((a) => [a.trait_type, a.value]));

export function collection() {
  const lock = readJson(path.join(collectionRoot, "LOCK.json"));
  const rarity = readJson(path.join(collectionRoot, "proofs", "rarity-report.json"));
  const tokens = manifest();

  /*
   * The rarity report carries a "None" row for every optional slot — the share
   * of tokens with no prop/effect/companion, not a trait anyone can own.
   * Counting it inflates every published variant count by one, which on a mint
   * page is a factual error people will check.
   */
  const traits = {};
  for (const [category, values] of Object.entries(rarity.categories || {})) {
    traits[category] = values
      .filter((v) => v.name !== "None" && !SECRET.test(v.name))
      .map((v) => ({ name: v.name, count: v.count, percent: v.percent }))
      .sort((a, b) => b.count - a.count);
  }

  const outcomes = Object.fromEntries((rarity.outcomes || [])
    .map((o) => [/winner/i.test(o.name) ? "winner" : /rekt/i.test(o.name) ? "rekt" : "open", o.count]));

  return {
    name: lock.collection,
    symbol: lock.symbol,
    supply: lock.supply,
    storage: lock.storage,
    imageTx: lock.imageTx || process.env.NEXT_PUBLIC_ARWEAVE_IMAGE_TX || null,
    counts: lock.counts,
    tiers: rarity.tiers,
    /*
     * Only the rows the page actually renders. Shipping every variant and
     * slicing in the component put all 150 companion names and all 93 screen
     * names in the HTML, which gives away the roster the same way a full
     * gallery would give away the art. Totals are computed before the trim, so
     * the "N variants" labels stay honest.
     */
    traitCategories: Object.fromEntries(
      Object.entries(traits).map(([k, v]) => [k, v.slice(0, TAPE_ROWS)]),
    ),
    traitTotals: Object.fromEntries(Object.entries(traits).map(([k, v]) => [k, v.length])),
    outcomes,
    regulars: REGULARS_TEASE,
    showcase: showcase(tokens),
  };
}

/**
 * The published art, and the only art. Reading the whole manifest into the page
 * would put all 2048 pieces one view-source away, which defeats the reveal —
 * so nothing outside SHOWCASE ever reaches the client.
 */
function showcase(tokens) {
  return SHOWCASE
    .filter((tokenId) => tokens[tokenId] && !isSecret(tokens[tokenId]))
    .map((tokenId) => {
      const t = traitsOf(tokens[tokenId]);
      return {
        // Deliberately no tokenId — see slugFor() in ./showcase.
        slug: slugFor(tokenId),
        screen: t["Screen / Face"] || null,
        chassis: t.Chassis || null,
        finish: t["Chassis Finish"] || null,
        room: t.Background || null,
        prop: t["Primary Prop"] || null,
        companion: t.Companion || null,
      };
    });
}

export function imagePath(tokenId) {
  const id = String(Number(tokenId)).padStart(4, "0");
  if (!/^\d{4}$/.test(id)) return null;
  const file = path.join(collectionRoot, "images", `${id}.png`);
  return fs.existsSync(file) ? file : null;
}

export const padId = (tokenId) => String(tokenId).padStart(4, "0");
