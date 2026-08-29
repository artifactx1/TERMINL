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

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export function collection() {
  const lock = readJson(path.join(collectionRoot, "LOCK.json"));
  const rarity = readJson(path.join(collectionRoot, "proofs", "rarity-report.json"));

  /*
   * The rarity report carries a "None" row for every optional slot — the share
   * of tokens with no prop/effect/companion, not a trait anyone can own.
   * Counting it inflates every published variant count by one, which on a mint
   * page is a factual error people will check.
   */
  const traits = {};
  const noneShare = {};
  for (const [category, values] of Object.entries(rarity.categories || {})) {
    const none = values.find((v) => v.name === "None");
    if (none) noneShare[category] = { count: none.count, percent: none.percent };
    traits[category] = values
      .filter((v) => v.name !== "None")
      .map((v) => ({ name: v.name, count: v.count, percent: v.percent }))
      .sort((a, b) => a.count - b.count);
  }

  return {
    name: lock.collection,
    symbol: lock.symbol,
    supply: lock.supply,
    storage: lock.storage,
    imageTx: lock.imageTx || process.env.NEXT_PUBLIC_ARWEAVE_IMAGE_TX || null,
    counts: lock.counts,
    tiers: rarity.tiers,
    traitCategories: traits,
    traitTotals: Object.fromEntries(Object.entries(traits).map(([k, v]) => [k, v.length])),
    noneShare,
    grails: grailList(),
  };
}

function manifest() {
  return readJson(path.join(collectionRoot, "bulk-upload.json"));
}

function grailList() {
  return manifest()
    .map((token, tokenId) => ({ tokenId, token }))
    .filter(({ token }) => token.attributes.some(
      (a) => a.trait_type === "Companion" && /1\/1 Grail/.test(a.value)))
    .map(({ tokenId, token }) => ({
      tokenId,
      id: String(tokenId).padStart(4, "0"),
      name: token.attributes.find((a) => a.trait_type === "Companion").value.replace(" (1/1 Grail)", ""),
    }));
}

/**
 * Traits for the hero rotation, resolved at build time. Fetching these per
 * frame would make the spec panel depend on client hydration and leave it
 * reading "none" beside fully rendered art.
 */
export function heroTokens(ids) {
  const tokens = manifest();
  return ids.map((tokenId) => {
    const token = tokens[tokenId];
    if (!token) return null;
    const attributes = {};
    for (const a of token.attributes) attributes[a.trait_type] = a.value;
    return { tokenId, id: String(tokenId).padStart(4, "0"), attributes };
  }).filter(Boolean);
}

export function imagePath(tokenId) {
  const id = String(Number(tokenId)).padStart(4, "0");
  if (!/^\d{4}$/.test(id)) return null;
  const file = path.join(collectionRoot, "images", `${id}.png`);
  return fs.existsSync(file) ? file : null;
}
