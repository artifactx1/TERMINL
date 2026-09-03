import { CONTRACT } from "../../lib/mint";
import { allowlistBase } from "../../lib/phases";

/*
 * Allowlist stage definitions, from ArtifactX's backend, for the schedule.
 *
 * The backend's summary route is public and returns the stages without the
 * wallet list, but its CORS admits browsers from artifactx.app only. A request
 * from this function carries no Origin header and passes — the same route the
 * eligibility check will use when it lands. Narrow on purpose: one fixed
 * contract, GET only, and the response is trimmed to the fields the schedule
 * renders, so this cannot be used as a relay into the marketplace API.
 *
 * Stage definitions change when the artist edits them, which is rarely and
 * never during a live stage, so the CDN may hold a copy for a minute.
 */
const CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const EMPTY = { published: false, stages: [] };


export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }
  if (!CONTRACT) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ error: "no contract configured" });
  }

  const base = allowlistBase();
  if (!base) {
    // No backend known for this chain: a public-only drop, as far as the
    // schedule is concerned. Cache it — nothing will change until a deploy.
    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json(EMPTY);
  }

  try {
    const upstream = await fetch(`${base}/drop-allowlist/${CONTRACT.toLowerCase()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) throw new Error(`allowlist api ${upstream.status}`);
    const json = await upstream.json();

    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json({
      published: Boolean(json.published),
      stages: (json.stages || []).map((s) => ({
        stageIndex: Number(s.stageIndex),
        name: s.name || null,
        kind: s.kind || null,
        pricePerToken: String(s.pricePerToken ?? "0"),
        currency: s.currency || null,
        maxMintableByWallet: String(s.maxMintableByWallet ?? "0"),
        maxSupplyForStage: String(s.maxSupplyForStage ?? "0"),
        startTime: Number(s.startTime || 0),
        endTime: Number(s.endTime || 0),
        walletCount: Number(s.walletCount || 0),
      })),
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: e?.message || "allowlist api failed" });
  }
}
