/**
 * The allowlist half of the mint.
 *
 * A stage is not a claim condition. Nothing about it is stored on chain — the
 * price, the window, the per-wallet cap and the stage's supply bound all live
 * inside a merkle leaf, and the contract holds one root for the whole drop.
 * That means the chain cannot answer "what may this wallet pay?"; only the
 * backend can, and only for a wallet it has a leaf for. So the terms and the
 * proof arrive together from /api/allowlist/<wallet> and are used as one unit.
 *
 * What is derived here mirrors ArtifactXERC721Drop.verifyAllowlistClaim
 * one-for-one, against chain time, so the panel and the contract cannot
 * disagree about whether a stage is open. Where the two ever differ, the
 * simulation before the wallet opens is the tiebreak — this is the fast path,
 * not the authority.
 */
import { CONTRACT, isNative } from "./mint.js";

/* thirdweb's spelling of "no limit" is MaxUint256; the studio writes an
 * unlimited per-wallet cap as MAX_SAFE_INTEGER. Anything absurd means the same
 * thing, and the same threshold describeDrop uses is used here so the public
 * phase and a stage never render the same cap two different ways. */
const UNLIMITED = 1_000_000n;

/**
 * Careful: zero means opposite things in the two cap fields, because the
 * contract compares them differently.
 *
 *   maxSupplyForStage  0 → uncapped (the bound is simply not checked)
 *   maxMintableByWallet 0 → NOBODY may mint (walletMinted > 0 always reverts)
 *
 * They sit next to each other in the struct, so this is worth stating rather
 * than inferring at each use.
 */
const big = (v) => BigInt(v ?? 0);

/** What the connected wallet may claim. Never throws: a backend that is down
 *  must not read as "not on the list", so failure is its own state. */
export async function fetchAllowlist(wallet) {
  if (!CONTRACT || !wallet) return { eligible: false, reason: null, stages: [], failed: false };
  try {
    const res = await fetch(`/api/allowlist/${wallet}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`allowlist route ${res.status}`);
    const json = await res.json();
    return {
      eligible: Boolean(json.eligible),
      reason: json.reason || null,
      stages: json.stages || [],
      failed: false,
    };
  } catch {
    return { eligible: false, reason: null, stages: [], failed: true };
  }
}

/**
 * The stage this wallet can mint from right now.
 *
 * Start inclusive, end EXCLUSIVE — the contract reverts StageEnded at the
 * endTime second itself, so a stage ending at 12:00:00 is over at 12:00:00 and
 * the one starting then is already open. Sequential stages therefore never
 * overlap by a second in either direction.
 *
 * If the artist does configure two overlapping windows and a wallet holds both
 * (a GTD and an FCFS allocation, say), the lower stage index wins here. Both
 * remain claimable on chain; this only picks which one the button spends.
 */
export function liveStage(stages, nowSec) {
  const now = BigInt(nowSec);
  return (
    [...(stages || [])]
      .sort((a, b) => a.stageIndex - b.stageIndex)
      .find((s) => {
        const start = big(s.params.startTime);
        const end = big(s.params.endTime);
        return now >= start && (end === 0n || now < end);
      }) || null
  );
}

/** The soonest stage this wallet holds that has not opened — for "opens in". */
export function nextStage(stages, nowSec) {
  const now = BigInt(nowSec);
  return (
    [...(stages || [])]
      .filter((s) => big(s.params.startTime) > now)
      .sort((a, b) => Number(big(a.params.startTime) - big(b.params.startTime)))[0] || null
  );
}

/**
 * Everything the panel decides about a stage, derived in one place — the same
 * arrangement describeDrop uses for the public phase, and deliberately the same
 * shape, so the mint control can render either without knowing which it has.
 *
 * `minted` is the contract's monotonic mint counter (nextTokenIdToClaim), NOT
 * the public condition's supplyClaimed: a stage's supply bound is a cumulative
 * watermark over everything ever minted — public claims, other stages and admin
 * reserves included — so measuring it against the public tally would overstate
 * what is left. `now` is unix seconds on chain time.
 */
export function describeStage({ stage, stageClaimed = 0n, minted = 0n, lazySupply = 0n, dropEndsAt = 0n, now }) {
  const p = stage.params;
  const price = big(p.pricePerToken);
  const perWallet = big(p.maxMintableByWallet);
  const watermark = big(p.maxSupplyForStage);
  const startsAt = big(p.startTime);
  const endsAt = big(p.endTime);
  const nowSec = BigInt(now);

  const started = nowSec >= startsAt;
  /* Two ways a stage closes: its own end, and the drop's. verifyAllowlistClaim
   * checks the stage window with >= and the drop's end with >, so they are
   * spelled differently here on purpose. */
  const stageOver = endsAt !== 0n && nowSec >= endsAt;
  const dropOver = dropEndsAt !== 0n && nowSec > dropEndsAt;

  const unlimitedPerWallet = perWallet >= UNLIMITED;
  const capPerWallet = unlimitedPerWallet ? null : perWallet;
  const walletRemaining = unlimitedPerWallet
    ? null
    : (perWallet > stageClaimed ? perWallet - stageClaimed : 0n);

  /* 0 = uncapped. Otherwise the watermark is measured against total minted, so
   * an undersold earlier stage rolls its leftover into this one automatically. */
  const stageRemaining = watermark === 0n ? null : (watermark > minted ? watermark - minted : 0n);

  /* The hard bound underneath every phase: tokens must already be lazy-minted.
   *
   * 0 means NOT KNOWN, not "none left" — the total is derived from the batch
   * metadata and that read is allowed to fail (see readLazySupply). Treating a
   * failed read as zero supply would render a live stage as SOLD OUT, which is
   * the worst possible way to be wrong. Unknown simply drops out of the
   * minimum, and the pre-flight simulation still catches a quantity the
   * contract will not mint. */
  const lazyRemaining = lazySupply === 0n
    ? null
    : (lazySupply > minted ? lazySupply - minted : 0n);

  const bounds = [stageRemaining, lazyRemaining].filter((v) => v !== null);
  /* Nothing bounds it: an uncapped stage on a drop whose total we could not
   * read. The batch ceiling below is what the picker will actually offer. */
  const remaining = bounds.length ? bounds.reduce((a, b) => (a < b ? a : b)) : null;

  /* A per-wallet cap of zero is a stage nobody may mint from — the contract
   * reverts on the very first unit. Distinct from having spent an allocation,
   * and worth saying differently. */
  const nobodyMayMint = perWallet === 0n;
  const spent = walletRemaining !== null && walletRemaining === 0n && !nobodyMayMint;

  return {
    kind: "stage",
    stageIndex: stage.stageIndex,
    name: (stage.name || `STAGE ${stage.stageIndex}`).toUpperCase(),
    label: (stage.kind || "allowlist").toUpperCase(),
    stage,

    price,
    currency: p.currency,
    native: isNative(p.currency),

    startsAt,
    endsAt,
    started,
    ended: stageOver || dropOver,
    nobodyMayMint,
    spent,

    perWallet,
    capPerWallet,
    claimed: stageClaimed,
    walletRemaining,
    remaining,
    soldOut: remaining === 0n,

    open: started && !stageOver && !dropOver && !nobodyMayMint && !spent && remaining !== 0n,
  };
}

/**
 * How many units the picker may offer: the smallest of what the wallet has
 * left in the stage, what the stage has left, and the batch ceiling.
 */
export function maxForStage(state, batchCap) {
  if (!state?.open) return 1;
  const bounds = [state.remaining, state.walletRemaining].filter((v) => v !== null);
  if (!bounds.length) return batchCap;
  const smallest = bounds.reduce((a, b) => (a < b ? a : b));
  return Math.max(1, Math.min(Number(smallest), batchCap));
}

/** Why the wallet is being shown a closed door, in words worth reading. */
export function ineligibleNote(reason) {
  return {
    no_allowlist: null, // a public-only drop: nothing to explain
    root_not_published: "the allowlist has not been published on-chain yet",
    not_allowlisted: "this wallet is not on the list for this stage",
  }[reason] ?? null;
}
