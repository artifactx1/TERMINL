import fs from "fs";
import { imagePath, padId } from "../../../lib/collection";
import { resolveSlug } from "../../../lib/showcase";

const IMAGE_TX = process.env.NEXT_PUBLIC_ARWEAVE_IMAGE_TX || "";

/**
 * The only route that serves art.
 *
 * It resolves the 32 published slugs and nothing else, so the rest of the
 * collection cannot be pulled by guessing a token id — which the previous
 * `/api/token?id=N` route allowed. Token ids never appear in a URL either;
 * that is the point of the slug.
 */
export default async function handler(req, res) {
  const tokenId = resolveSlug(String(req.query.slug || ""));
  if (tokenId === null) return res.status(404).json({ error: "Not found" });

  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", "image/png");

  // After the upload the art lives on Arweave and this proxies it, so the
  // gateway URL (which contains the token id) never reaches the browser.
  if (IMAGE_TX) {
    const upstream = await fetch(`https://arweave.net/${IMAGE_TX}/${padId(tokenId)}.png`);
    if (!upstream.ok) return res.status(502).json({ error: "Upstream unavailable" });
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  }

  const file = imagePath(tokenId);
  if (!file) return res.status(404).json({ error: "Not found" });
  return fs.createReadStream(file).pipe(res);
}
