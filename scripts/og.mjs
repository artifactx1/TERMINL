/**
 * Builds the share card and the icon set.
 *
 * Runs off `public/art` and `data/site.json`, so it does not need the locked
 * collection — regenerate it any time the published set changes.
 *
 *   npm run og
 *
 * The card is a real file rather than a runtime-rendered image: it is requested
 * by scrapers that do not run JavaScript, are aggressive about timeouts, and
 * cache hard. A static PNG on a stable URL is the thing that actually survives
 * being pasted into Discord, iMessage and Slack.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const W = 1200;
const H = 630;
const OUT = "public";
const site = JSON.parse(fs.readFileSync("data/site.json", "utf8"));
const art = (slug) => path.join("public", "art", `${slug}.webp`);

/** Pick by look, falling back to position so this never throws on a reshuffle. */
const find = (finish, room, fallback) =>
  (site.showcase.find((t) => t.finish === finish && t.room === room) || site.showcase[fallback]).slug;

const HERO = find("Gold", "Memecoin Casino", 0);
const THUMBS = [
  find("Terminal Green", "Vapor Rooftop", 1),
  find("Hologram", "Dead Mall Corridor", 2),
  find("Diamond Ice", "Neon Laundromat", 3),
  find("Emergency Red", "After-Hours Video Store", 4),
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function card() {
  const ART_W = 630;
  const PANEL = W - ART_W; // 570

  const hero = await sharp(art(HERO)).resize(ART_W, ART_W).toBuffer();

  const thumbs = [];
  const TH = 96;
  for (let i = 0; i < THUMBS.length; i++) {
    thumbs.push({
      input: await sharp(art(THUMBS[i])).resize(TH, TH).toBuffer(),
      left: 56 + i * (TH + 12),
      top: 452,
    });
  }

  /*
   * A hard edge between the art and the panel looks like two images stuck
   * together; the fade reads as one composition and keeps the headline legible
   * over whatever the piece happens to be doing at that edge.
   */
  const fade = Buffer.from(
    `<svg width="${ART_W}" height="${H}"><defs><linearGradient id="f" x1="0" x2="1">
       <stop offset="0" stop-color="#060907" stop-opacity="1"/>
       <stop offset="0.28" stop-color="#060907" stop-opacity="0"/>
     </linearGradient></defs><rect width="${ART_W}" height="${H}" fill="url(#f)"/></svg>`,
  );

  const text = Buffer.from(`<svg width="${W}" height="${H}">
    <text x="56" y="124" font-family="monospace" font-size="62" font-weight="700"
          fill="#ffffff" letter-spacing="20">TERMINL</text>
    <rect x="58" y="152" width="86" height="3" fill="#c8f800"/>
    <text x="56" y="232" font-family="monospace" font-size="52" font-weight="700" fill="#ffffff">WAGMI.</text>
    <text x="56" y="286" font-family="monospace" font-size="52" font-weight="700" fill="#ffffff">Or maybe</text>
    <text x="56" y="340" font-family="monospace" font-size="52" font-weight="700" fill="#ffffff">we won&#8217;t.</text>
    <text x="56" y="394" font-family="monospace" font-size="20" fill="#9aa89f">${esc(
      `${site.supply} machines. ${site.outcomes.rekt} already rekt.`,
    )}</text>
    <text x="56" y="426" font-family="monospace" font-size="20" fill="#c8f800" letter-spacing="2">${esc(
      `ONLY ${site.showcase.length} SHOWN · MINTING ON OPENSEA`,
    )}</text>
  </svg>`);

  await sharp({ create: { width: W, height: H, channels: 3, background: "#060907" } })
    .composite([
      { input: hero, left: PANEL, top: -Math.round((ART_W - H) / 2) },
      { input: fade, left: PANEL, top: 0 },
      ...thumbs,
      { input: text, left: 0, top: 0 },
    ])
    /*
     * JPEG, not PNG. The same card is 1.1 MB as PNG, and WhatsApp skips link
     * previews over roughly 300 kB while every other scraper just gets slower.
     * At the size these are actually displayed the artefacts are invisible.
     */
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(OUT, "og.jpg"));

  const kb = (fs.statSync(path.join(OUT, "og.jpg")).size / 1024).toFixed(0);
  console.log(`public/og.jpg        ${W}x${H}  ${kb} kB`);
}

/** A screen with a cursor on it. Has to survive being drawn at 16 px. */
function markSvg(size) {
  const r = Math.round(size * 0.16);
  const inset = Math.round(size * 0.13);
  const screen = size - inset * 2;
  return Buffer.from(`<svg width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="#060907"/>
    <rect x="${inset}" y="${inset}" width="${screen}" height="${screen}" rx="${Math.round(r * 0.5)}"
          fill="none" stroke="#c8f800" stroke-width="${Math.max(2, Math.round(size * 0.075))}"/>
    <rect x="${Math.round(size * 0.34)}" y="${Math.round(size * 0.4)}"
          width="${Math.round(size * 0.32)}" height="${Math.round(size * 0.2)}" fill="#c8f800"/>
  </svg>`);
}

async function icons() {
  for (const [name, size] of [
    ["favicon-16.png", 16], ["favicon-32.png", 32],
    ["apple-touch-icon.png", 180], ["icon-512.png", 512],
  ]) {
    await sharp(markSvg(size)).png().toFile(path.join(OUT, name));
    console.log(`public/${name.padEnd(21)}${size}x${size}`);
  }
}

await card();
await icons();
