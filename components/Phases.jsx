import { useState } from "react";
import Link from "next/link";
import styles from "../styles/Terminl.module.css";
import { formatEth } from "../lib/mint";
import { buildSchedule, whenLabel, windowStatus } from "../lib/phases";
import { fetchAllowlist } from "../lib/allowlist";
import { campaignRequest } from "../lib/arcade/campaign-client";

const STATUS = {
  upcoming: "UPCOMING",
  live: "LIVE",
  ended: "ENDED",
  closed: "CLOSED",
};

/**
 * The mint schedule, under the mint control: every allowlist stage and the
 * public phase, soonest first, each with its terms and a live status. The
 * wallet checker stays available before any mint phase is published.
 */
export default function Phases({ drop, phases, chainNow }) {
  const rows = buildSchedule({ drop, phases, chainNowMs: chainNow });
  return (
    <div className={styles.phases} aria-label="Mint schedule and wallet checker">
      {rows.length > 0 && <>
      <div className={styles.phasesHead}>SCHEDULE</div>
      {rows.map((r) => {
        const terms = [
          formatEth(r.price) + (r.native ? "" : " (token)"),
          r.perWallet !== null ? `max ${String(r.perWallet)} per wallet` : "no wallet cap",
          r.supplyCap !== null ? `up to ${String(r.supplyCap)} minted` : null,
        ].filter(Boolean);
        const when = r.status === "upcoming"
          ? `opens ${whenLabel(r.startsAt)}${r.countdown ? ` · in ${r.countdown}` : ""}`
          : r.status === "live"
            ? (r.endsAt ? `ends ${whenLabel(r.endsAt)}${r.countdown ? ` · in ${r.countdown}` : ""}` : "no end time")
            : (r.endsAt ? `ended ${whenLabel(r.endsAt)}` : "");
        return (
          <div key={r.key} className={`${styles.phase} ${styles[`phase_${r.status}`] || ""}`}>
            <div className={styles.phaseTop}>
              <b>{r.name}</b>
              {r.kind !== r.name && <span className={styles.phaseKind}>{r.kind}</span>}
              <em className={styles.phaseStatus}>{STATUS[r.status]}</em>
            </div>
            <div className={styles.phaseTerms}>{terms.join(" · ")}</div>
            {(when || r.note) && (
              <div className={styles.phaseWhen}>
                {when}
                {r.note && <span className={styles.phaseNote}>{when ? " · " : ""}{r.note}</span>}
              </div>
            )}
          </div>
        );
      })}
      </>}
      <Eligibility chainNow={chainNow} onchain={(phases?.stages?.length ?? 0) > 0} phasesFailed={!!phases?.failed} />
    </div>
  );
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Check any address against the allowlist, without connecting anything.
 *
 * Before phases are published, the campaign backend reports saved offchain
 * spots. Once phases exist, the mint backend checks actual phase eligibility.
 * Neither lookup connects a wallet.
 *
 * It answers about ONE address at a time, typed deliberately. That is a
 * question someone asks about their own wallet, not a way to enumerate a list.
 */
function Eligibility({ chainNow, onchain, phasesFailed }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState(null); // { checking } | { address, stages, reason, failed }

  const check = async (e) => {
    e.preventDefault();
    const address = value.trim();
    if (!ADDRESS.test(address)) {
      setState({ invalid: true });
      return;
    }
    setState({ checking: true });
    if (onchain) {
      const result = await fetchAllowlist(address);
      setState({ address, ...result, mode: "mint" });
      void campaignRequest('/wl/check-event',{
        address,source:'mint',outcome:result.failed?'failed':result.stages.length?'listed':'not_listed',
      }).catch(()=>{});
    } else {
      try {
        const result = await campaignRequest(`/wl/check/${address}?source=mint`);
        setState({ address, ...result, mode: "offchain" });
      } catch {
        setState({ address, failed: true, mode: "offchain" });
      }
    }
  };

  const nowSec = Math.floor(chainNow / 1000);

  return (
    <form className={styles.check} onSubmit={check}>
      <div className={styles.checkHead}>{onchain ? "AM I ON THE MINT LIST?" : "CHECK YOUR WL STATUS"}</div>
      {!onchain && <p className={styles.checkNote}>The GTD and FCFS lists are updated daily. Don&apos;t see your wallet yet? Check back tomorrow. No wallet connection needed.{phasesFailed ? " Mint phase data is temporarily unavailable." : ""}</p>}
      <div className={styles.checkRow}>
        <input
          className={styles.checkInput}
          value={value}
          onChange={(e) => { setValue(e.target.value); setState(null); }}
          placeholder="0x…"
          aria-label="Wallet address"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className={styles.checkBtn} disabled={state?.checking}>
          {state?.checking ? "…" : "CHECK"}
        </button>
      </div>

      {state?.invalid && (
        <p className={styles.checkNote}>that is not a wallet address — paste the 0x… one</p>
      )}

      {/* A failed lookup is not a "no". Say which it is. */}
      {state?.failed && (
        <p className={styles.checkNote}>could not check the list — try again in a moment</p>
      )}

      {state?.address && !state.failed && (
        state.mode === "offchain" ? (
          state.lists?.length ? <div className={styles.checkOk}>
            <b>{short(state.address)} is on the list</b>
            {state.lists.map((entry) => <div key={entry.kind} className={styles.checkStage}>
              <span>{entry.kind.toUpperCase()}</span>
              <em>{entry.source === "arcade" ? "ARCADE PASS" : "APPROVED"}</em>
            </div>)}
            <p className={styles.checkNote}>Mint access follows the published phase and its final terms.</p>
          </div> : <p className={styles.checkNote}>{short(state.address)} is not on the current list. <Link href="/wl">Apply for WL →</Link></p>
        ) : state.stages.length ? (
          <div className={styles.checkOk}>
            <b>{short(state.address)} is on the list</b>
            {state.stages.map((s) => {
              const start = Number(s.params.startTime || 0);
              const end = Number(s.params.endTime || 0);
              const status = windowStatus(start, end, nowSec);
              return (
                <div key={s.stageIndex} className={styles.checkStage}>
                  <span>{(s.name || `STAGE ${s.stageIndex}`).toUpperCase()}</span>
                  <em>{status === "live" ? "LIVE NOW" : status === "upcoming" ? `opens ${whenLabel(start)}` : "ended"}</em>
                  <span className={styles.checkTerms}>
                    {formatEth(BigInt(s.params.pricePerToken || 0))} · max {String(s.params.maxMintableByWallet)} per wallet
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.checkNote}>
            {state.reason === "root_not_published"
              ? "the allowlist is saved but not published on-chain yet — check back shortly"
              : state.reason === "no_allowlist"
                ? "this drop has no allowlist"
                : `${short(state.address)} is not on the list for this drop`}
          </p>
        )
      )}
    </form>
  );
}

/** How far along the drop is. Only meaningful once a supply is known. */
export function Progress({ drop }) {
  if (!drop || drop.supply <= 0n) return null;
  const pct = Number((drop.minted * 1000n) / drop.supply) / 10; // one decimal
  const shown = pct > 0 && pct < 1 ? "<1" : Math.min(100, Math.round(pct));
  return (
    <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <i style={{ width: `${Math.min(100, pct)}%` }} />
      <span>{shown}% MINTED · {String(drop.minted)} / {String(drop.supply)}</span>
    </div>
  );
}
