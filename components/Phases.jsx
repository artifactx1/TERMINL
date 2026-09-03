import styles from "../styles/Terminl.module.css";
import { formatEth } from "../lib/mint";
import { buildSchedule, whenLabel } from "../lib/phases";

const STATUS = {
  upcoming: "UPCOMING",
  live: "LIVE",
  ended: "ENDED",
  closed: "CLOSED",
};

/**
 * The mint schedule, under the mint control: every allowlist stage and the
 * public phase, soonest first, each with its terms and a live status. Renders
 * nothing until there is a phase to show — an empty list beside "MINT OPENS
 * SOON" would only restate it.
 */
export default function Phases({ drop, phases, chainNow }) {
  const rows = buildSchedule({ drop, phases, chainNowMs: chainNow });
  if (rows.length === 0) return null;

  return (
    <div className={styles.phases} aria-label="Mint schedule">
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
    </div>
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
