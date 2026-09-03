/**
 * The mint schedule: every phase a visitor could mint in, in order, with its
 * terms and whether it is upcoming, live or over.
 *
 * Two sources, deliberately kept apart:
 *
 *   - The PUBLIC phase lives on the contract and comes with the drop facts —
 *     start, price, per-wallet cap, and the drop-wide end time.
 *   - ALLOWLIST stages live in ArtifactX's backend, because their terms are
 *     sealed inside a merkle leaf rather than stored on chain. The backend's
 *     summary route hands out the stage definitions without the wallet list,
 *     and /api/phases fetches it server-to-server (its CORS only admits
 *     browsers from artifactx.app).
 *
 * Like the drop facts, this is derived on every tick against chain time, so a
 * cached copy is never wrong about a phase opening.
 */
import { CHAIN, countdown, isNative } from "./mint.js";

/* Where ArtifactX's backend lives, per chain. The testnet host is public and
 * already in ELEMENT's env; mainnet has to be set (ALLOWLIST_API_URL). */
export const ALLOWLIST_HOSTS = {
  46630: "https://precious-blessing-production-fc0b.up.railway.app",
};

/** What the panel calls. Empty on any failure: a schedule that cannot be
 *  read is shown as nothing rather than as an error beside the mint. */
export async function fetchPhases() {
  try {
    const res = await fetch("/api/phases", { cache: "no-store" });
    if (!res.ok) throw new Error(`phases route ${res.status}`);
    return await res.json();
  } catch {
    return { published: false, stages: [] };
  }
}

/** Start inclusive, end exclusive (0 = no end) — the contract's own rule. */
export function windowStatus(startsAt, endsAt, nowSec) {
  if (nowSec < startsAt) return "upcoming";
  if (endsAt !== 0 && nowSec >= endsAt) return "ended";
  return "live";
}

/**
 * Rows for the schedule, soonest first.
 *
 * `drop` is the derived drop (describeDrop), or null before the facts arrive.
 * `phases` is /api/phases's body, or null. `chainNowMs` is the corrected clock.
 */
export function buildSchedule({ drop, phases, chainNowMs }) {
  const nowSec = Math.floor(chainNowMs / 1000);
  const rows = [];

  for (const s of phases?.stages || []) {
    const startsAt = Number(s.startTime || 0);
    const endsAt = Number(s.endTime || 0);
    rows.push({
      key: `stage-${s.stageIndex}`,
      name: (s.name || `STAGE ${s.stageIndex}`).toUpperCase(),
      kind: (s.kind || "ALLOWLIST").toUpperCase(),
      status: windowStatus(startsAt, endsAt, nowSec),
      startsAt,
      endsAt,
      price: BigInt(s.pricePerToken || 0),
      native: isNative(s.currency),
      perWallet: s.maxMintableByWallet ? BigInt(s.maxMintableByWallet) : null,
      /* A cumulative watermark over total supply, not a bucket of its own. */
      supplyCap: s.maxSupplyForStage && BigInt(s.maxSupplyForStage) > 0n ? BigInt(s.maxSupplyForStage) : null,
      /* Saved but not signed on-chain yet: proofs are withheld, so say so. */
      note: phases?.published ? null : "not yet published on-chain",
      countdown: null,
    });
  }

  if (drop?.configured) {
    const startsAt = Number(drop.startsAt);
    const endsAt = Number(drop.endsAt);
    let status = windowStatus(startsAt, endsAt, nowSec);
    let note = null;
    if (status !== "upcoming" && drop.soldOut) { status = "ended"; note = "sold out"; }
    else if (status === "live" && drop.nobodyMayMint) { status = "closed"; note = "claiming is closed"; }
    rows.push({
      key: "public",
      name: "PUBLIC",
      kind: "PUBLIC",
      status,
      startsAt,
      endsAt,
      price: drop.price,
      native: drop.native,
      perWallet: drop.capPerWallet,
      supplyCap: drop.supply > 0n ? drop.supply : null,
      note,
      countdown: null,
    });
  }

  rows.sort((a, b) => a.startsAt - b.startsAt);
  for (const r of rows) {
    if (r.status === "upcoming") r.countdown = countdown(r.startsAt, chainNowMs);
    else if (r.status === "live" && r.endsAt !== 0) r.countdown = countdown(r.endsAt, chainNowMs);
  }
  return rows;
}

/** A calendar moment, in the visitor's zone — only ever rendered on the client. */
export function whenLabel(unixSeconds) {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export const chainLabel = CHAIN.name;
