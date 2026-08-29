import fs from "fs";
import { imagePath } from "../../lib/collection";

/**
 * Local art preview only. Once NEXT_PUBLIC_ARWEAVE_IMAGE_TX is set the client
 * builds gateway URLs directly and never calls this.
 */
export default function handler(req, res) {
  const tokenId = Number(req.query.id);
  if (!Number.isInteger(tokenId) || tokenId < 0) return res.status(400).json({ error: "Bad token id" });
  const file = imagePath(tokenId);
  if (!file) return res.status(404).json({ error: "No image" });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return fs.createReadStream(file).pipe(res);
}
