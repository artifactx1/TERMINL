import { CONTRACT } from "../../../lib/mint";
import { allowlistBase } from "../../../lib/phases";

/*
 * What one wallet may claim from the allowlist: its stage terms and, for each,
 * the merkle proof that unlocks them.
 *
 * Server-to-server for the same reason /api/phases is — the backend's CORS
 * admits browsers from artifactx.app only, and a request from this function
 * carries no Origin header and passes. Narrow on purpose: one fixed contract,
 * GET only, the wallet validated as an address before it reaches the upstream
 * path, and the reply trimmed to the fields the mint uses. It cannot be used
 * as a general relay into the marketplace API.
 *
 * The proof is not a secret — the backend serves this route publicly, and a
 * proof is only usable by the wallet whose leaf it belongs to, because the
 * contract hashes msg.sender into the leaf it verifies. So a shared cache is
 * safe: the URL contains the wallet, and every entry is public data. Kept
 * short all the same, since a stage's terms stop being claimable the second
 * its window closes.
 */
const CACHE = "public, s-maxage=30, stale-while-revalidate=60";
const NONE = { eligible: false, reason: "no_allowlist", stages: [] };

const isAddress = (v) => /^0x[0-9a-fA-F]{40}$/.test(String(v || ""));

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  const { wallet } = req.query;
  if (!isAddress(wallet)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ error: "wallet must be an address" });
  }

  if (!CONTRACT) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ error: "no contract configured" });
  }

  const base = allowlistBase();
  if (!base) {
    // No backend for this chain: nobody is on a list, because there is no list.
    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json(NONE);
  }

  try {
    const upstream = await fetch(
      `${base}/drop-allowlist/${CONTRACT.toLowerCase()}/claim/${String(wallet).toLowerCase()}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
    );
    if (!upstream.ok) throw new Error(`allowlist api ${upstream.status}`);
    const json = await upstream.json();

    res.setHeader("Cache-Control", CACHE);
    return res.status(200).json({
      /* eligible:false is a normal answer, not a failure. `reason` separates
       * "there is no allowlist" from "the artist has not signed the root yet"
       * from "you are not on it" — three different things to tell someone. */
      eligible: Boolean(json.eligible),
      reason: json.reason || null,
      stages: (json.stages || []).map((s) => ({
        stageIndex: Number(s.stageIndex),
        name: s.name || null,
        kind: s.kind || null,
        /* Passed through verbatim, in the contract's struct order. Every field
         * is a proven term: the contract re-derives the leaf from exactly
         * these values, so anything "corrected" here — a rounded price, a
         * checksummed address, a number where a string was — invalidates the
         * proof rather than fixing anything. */
        params: {
          pricePerToken: String(s.params?.pricePerToken ?? "0"),
          currency: s.params?.currency,
          maxMintableByWallet: String(s.params?.maxMintableByWallet ?? "0"),
          maxSupplyForStage: String(s.params?.maxSupplyForStage ?? "0"),
          startTime: String(s.params?.startTime ?? "0"),
          endTime: String(s.params?.endTime ?? "0"),
          stageIndex: Number(s.params?.stageIndex ?? s.stageIndex),
        },
        proof: Array.isArray(s.proof) ? s.proof : [],
      })),
    });
  } catch (e) {
    /* A backend that cannot be reached must not read as "not on the list" —
     * that would quietly turn a server outage into a closed door for people who
     * are on it. Say it failed and let the panel offer a retry. */
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: e?.message || "allowlist api failed" });
  }
}
