/**
 * The sixteen pieces that exist as far as this site is concerned.
 *
 * This list is only read by `npm run snapshot`, which copies exactly these
 * pieces into `public/art/` and their traits into `data/site.json`. The
 * deployed app never sees the locked collection at all — it cannot show a
 * seventeenth piece, because a seventeenth piece is not in the build.
 *
 * Picked off contact sheets for spread rather than rarity. Sixteen covers all
 * seven chassis, twelve finishes and twelve rooms, so it reads as a range
 * rather than a sample. None of the 1/1s are here and none ever should be.
 *
 * Change this list, re-run the snapshot, commit the result.
 */
import crypto from "crypto";

export const SHOWCASE = [
  0,    // Gold · Memecoin Casino · Bitcoin
  37,   // Industrial Grey · After-Hours Video Store · PROBABLY NOTHING
  259,  // Matte Black · Lunar Dark Pool
  355,  // Terminal Green · Vapor Rooftop · COPE
  419,  // Cobalt · Warehouse Loading Bay · NGMI
  585,  // Toxic Neon · Liquidation Foundry · Ethereum
  660,  // Bone · Vapor Rooftop · Bitcoin
  728,  // Hologram · Midnight Garage · REKT
  836,  // Diamond Ice · Midnight Garage · Street Fighter
  904,  // Hologram · Dead Mall Corridor · GM
  1127, // Platinum · Degen Basement
  1155, // Terminal Green · Off-Air Studio · Pac-Man
  1260, // Chrome · Ticker Tunnel
  1299, // Toxic Neon · Dead Mall Corridor · Ethereum
  1522, // Diamond Ice · Neon Laundromat · WAGMI
  1701, // Emergency Red · After-Hours Video Store
];

/** Pieces the story section sits beside. Must be in SHOWCASE. */
export const STORY_ART = [355, 1701];

/**
 * The regulars we name out loud.
 *
 * There are 150 of them and the roster is the funniest thing in the collection,
 * which is exactly why it is not published in full — the same reason the art
 * is not. These two dozen are the tease; you meet the rest by minting.
 *
 * Picked for the joke rather than for rarity, which is why the counts are not
 * shown beside them: this is a cast list, not a rarity table.
 */
export const REGULARS_TEASE = [
  "Margin Call Max",
  "Paper Hands Paul",
  "Bagholder Barry",
  "Chain-Smoking Pigeon",
  "Buy-High Brian",
  "Rug-Pull Gremlin",
  "Liquidation Vulture",
  "HODL Hank",
  "Leverage Larry",
  "McRugged Mike",
  "Exit Liquidity Chad",
  "Smokin' Pepe",
  "Gas Fee Gary",
  "Laser-Eye Maxi",
  "Top-Tick Tony",
  "FOMO Felicia",
  "Down-Only Donna",
  "Tax-Loss Trevor",
  "Cycle Top Cyrus",
  "Seed Phrase Steve",
  "Jeet Sheet Jay",
  "Phishing Phoebe",
  "Bag Funeral Bea",
  "Dead Cat Dave",
];

/*
 * Token ids are part of the surprise, so they never reach the browser: not as a
 * caption, not in an image URL. Each published piece is addressed by an opaque
 * slug instead, and `/api/art/[slug]` is the only way to fetch art — it can
 * resolve these 32 slugs and nothing else, so the other 2016 pieces cannot be
 * pulled by guessing a number.
 */
const SALT = "terminl-showcase-v1";

export const slugFor = (tokenId) => crypto
  .createHash("sha256")
  .update(`${SALT}:${tokenId}`)
  .digest("hex")
  .slice(0, 16);

/** slug -> tokenId, for the art route. Built from SHOWCASE, so it cannot address anything else. */
export function resolveSlug(slug) {
  const hit = SHOWCASE.find((tokenId) => slugFor(tokenId) === slug);
  return hit === undefined ? null : hit;
}
