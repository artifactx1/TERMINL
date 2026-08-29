/**
 * The only art this site is allowed to show.
 *
 * The collection is 2048 pieces and the reveal is the point — a visitor should
 * leave wanting to see the rest, not having already seen it. So the hero, the
 * marquee and the gallery all draw from this hand-picked list and nothing else.
 * Adding an id here publishes that piece; there is no other path from the
 * locked collection to the page.
 *
 * Picked off contact sheets for spread rather than rarity: every chassis, the
 * loud finishes (Gold, Hologram, Diamond Ice, Toxic Neon, Platinum, Chrome),
 * the six rare rooms (Memecoin Casino, Vapor Rooftop, Lunar Dark Pool,
 * Liquidation Foundry, Ticker Tunnel, Degen Basement), and a screen mix of
 * tickers, slogans, arcade and late-night TV. None of the 1/1s are here and
 * none ever should be — those stay an easter egg.
 */
import crypto from "crypto";

export const SHOWCASE = [
  0,    // Gold, Memecoin Casino, Bitcoin — the loudest piece in the set
  37,   // "PROBABLY NOTHING" over liquidation fire
  153,  // Gold handheld
  185,  // Platinum boombox, WAGMI
  259,  // Matte Black, Lunar Dark Pool
  264,  // Gold boombox, TRON
  355,  // Terminal Green payphone, Vapor Rooftop
  419,  // Cobalt, NGMI, leverage arcs
  530,  // Emergency Red, RUGGED, Memecoin Casino
  569,  // Cobalt, WAGMI, diamond hand
  585,  // Toxic Neon, Ethereum, Memecoin Casino
  618,  // late-night TV on the screen
  637,  // Terminal Green cabinet, Liquidation Foundry
  660,  // Bone, Vapor Rooftop, Bitcoin
  728,  // Hologram payphone, REKT
  836,  // Diamond Ice, Street Fighter
  840,  // Cobalt, Solana
  904,  // Hologram handheld, GM
  955,  // Blood Red, Pump.fun
  1127, // Platinum cabinet, Memecoin Casino
  1137, // Terminal Green, rocket
  1155, // Terminal Green boombox, Pac-Man
  1177, // Bone, Overworld Quest
  1260, // Chrome, Ticker Tunnel
  1265, // Memecoin Casino, Street Fighter
  1271, // Bone, fireworks
  1299, // Toxic Neon, Ethereum
  1404, // Gold boombox, liquidation fire
  1457, // Terminal Green handheld
  1482, // Cobalt payphone, Neon Laundromat
  1522, // Diamond Ice boombox, WAGMI
  1701, // Emergency Red cabinet, After-Hours Video Store
];

/** Pieces the story section sits beside. */
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
