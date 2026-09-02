import { CONTRACT, describeDrop, isTerminal, lastRpcSource, readDropFacts, serializeDropFacts } from "../../lib/mint";

/*
 * The drop's facts, read once and shared.
 *
 * Every visitor's panel re-reads the drop on a loop, and that is three RPC
 * calls each against an endpoint with a rate limit. Two thousand people on the
 * page is hundreds of calls a second before anyone has minted. This route makes
 * the reads once — in one batched round trip, on the keyed endpoint when one is
 * configured — and lets the CDN answer everyone else for a few seconds, so the
 * provider sees a handful of calls a second no matter how many are watching.
 *
 * Three layers keep the provider quiet, from the outside in:
 *
 *   1. The CDN. `s-maxage` serves the same body to every visitor in a region;
 *      `stale-while-revalidate` refreshes it in the background so a burst never
 *      waits on the RPC. Sold-out and closed drops never change again and are
 *      cached for minutes.
 *   2. This function. Instances are reused between requests, so a module-level
 *      memo of the last answer, plus a single in-flight read, turns a cold-cache
 *      stampede — every region missing at once — into one read per instance.
 *   3. lib/mint.js. Reads are batched into one HTTP request, and a throttled
 *      or failing keyed provider falls back to the public endpoint.
 *
 * It serves FACTS — timestamps, counts, price — not state. The panel decides
 * "started" and "ended" itself, against a clock corrected to chain time, so a
 * cached copy is never wrong about the phase opening. That is what makes the
 * caching safe.
 *
 * Per-wallet reads stay direct from the browser: they are one call per connect,
 * and a keyed endpoint that answers for any address anyone types is a way to
 * spend the key's allowance from the outside.
 */

/* How long the CDN may serve one copy. Live or upcoming: seconds. Terminal:
 * nothing changes again, so minutes — the admin re-configuring a sold-out drop
 * is not a thing. */
const LIVE_CACHE = "public, s-maxage=5, stale-while-revalidate=15";
const TERMINAL_CACHE = "public, s-maxage=300, stale-while-revalidate=600";

/* In-instance memo. Shorter than the CDN's window on purpose: this only has to
 * absorb the burst of misses that arrive together, not stand in for the CDN. */
const MEMO_MS = 2_000;
let memo = null;     // { at, body, cache, source }
let inflight = null; // Promise for the read in progress, if any

async function readOnce() {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo;
  if (!inflight) {
    inflight = (async () => {
      const facts = await readDropFacts();
      const state = describeDrop(facts.condition, facts.endsAt, facts.chainNow);
      const next = {
        at: Date.now(),
        body: serializeDropFacts(facts),
        cache: isTerminal(state) ? TERMINAL_CACHE : LIVE_CACHE,
        source: lastRpcSource,
      };
      memo = next;
      return next;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }
  if (!CONTRACT) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ error: "no contract configured" });
  }

  try {
    const { body, cache, source } = await readOnce();
    res.setHeader("Cache-Control", cache);
    // Which provider answered — so a load test can watch the fallback engage.
    res.setHeader("X-RPC-Source", source);
    return res.status(200).json(body);
  } catch (e) {
    // Never let a provider blip get cached as the truth.
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: e?.message || "rpc failed" });
  }
}
