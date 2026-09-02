import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/Terminl.module.css";
import {
  CHAIN, CONTRACT, buildClaimTx, countdown, explorerTx, formatEth, readClaimedBy,
  readableError, readDrop, revertReason, simulateClaim, waitForReceipt,
} from "../lib/mint";

/*
 * The mint.
 *
 * Everything shown here is read from the contract — price, supply, how many are
 * gone, the per-wallet cap, when the phase opens and when it closes. Nothing
 * about the drop is hardcoded on this page, so the site cannot advertise a
 * price, a count or a deadline the chain disagrees with.
 *
 * Before the drop is deployed NEXT_PUBLIC_TERMINL_CONTRACT is unset and this
 * renders an inert "opens soon" panel. That is deliberate: the previous version
 * shipped a MINT button pointing at an OpenSea collection that 404s, and a dead
 * link costs more trust than an honest closed sign.
 *
 * The transaction lifecycle is the other half of that honesty. A mint is
 * simulated before the wallet is ever opened, and is not called a success until
 * a receipt comes back with status 0x1 — a hash only proves the transaction was
 * submitted, and a claim that reverts on-chain returns one just the same.
 */

const hex = (n) => `0x${Number(n).toString(16)}`;

/* How many the picker will offer at once when the phase sets no per-wallet cap.
 * Not a rule — just a sane ceiling for one signature. */
const BATCH_CAP = 20;

/* Live counts move underneath the page: someone else takes the last one, the
 * phase opens, the clock runs out. Re-read on a slow loop so the panel is never
 * more than this far behind the chain. */
const POLL_MS = 20_000;

/* Wallets do not ship Robinhood Chain, so a plain switch fails with 4902 and we
 * have to offer to add it. Both are attempted in that order. */
const CHAIN_PARAMS = {
  chainId: hex(CHAIN.id),
  chainName: CHAIN.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: [CHAIN.rpc],
  blockExplorerUrls: [CHAIN.explorer],
};

export default function Mint() {
  const [drop, setDrop] = useState(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [claimed, setClaimed] = useState(0n);
  const [quantity, setQuantity] = useState(1);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [mintedAt, setMintedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const eth = typeof window !== "undefined" ? window.ethereum : undefined;
  const busy = phase === "checking" || phase === "wallet" || phase === "pending";

  /* Live drop state, with or without a wallet — a visitor who has not connected
   * still gets the real price and the real count. */
  const refresh = useCallback(() => {
    readDrop().then((d) => { setDrop(d); setError(null); }).catch((e) => setError(readableError(e)));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!eth) return undefined;
    setHasWallet(true);
    eth.request({ method: "eth_accounts" }).then((a) => setAccount(a?.[0] || null)).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => setChainId(Number(c))).catch(() => {});

    const onAccounts = (a) => setAccount(a?.[0] || null);
    const onChain = (c) => setChainId(Number(c));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [eth]);

  /* Per-wallet count, re-read after a mint *confirms* — not when it is sent. */
  useEffect(() => {
    if (!account) { setClaimed(0n); return; }
    readClaimedBy(account).then(setClaimed).catch(() => {});
  }, [account, mintedAt]);

  /* Poll while there is anything left to change. A sold-out or ended drop is
   * terminal, so stop bothering the RPC once it gets there. */
  const shouldPoll = !!drop?.configured && !drop.soldOut && !drop.ended;
  useEffect(() => {
    if (!shouldPoll) return undefined;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [shouldPoll, refresh]);

  /* One-second tick, only while something is actually counting down. */
  const ticking = !!drop && drop.configured && (!drop.started || (drop.endsAt !== 0n && !drop.ended));
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  /* Counted against chain time, corrected for however wrong this machine's
   * clock is — otherwise the countdown and the contract disagree. A countdown
   * that reaches zero has to become a state change, not a "0s". */
  const chainNow = now - (drop?.skewMs ?? 0);
  const opensIn = drop && drop.configured && !drop.started ? countdown(drop.startsAt, chainNow) : null;
  const endsIn = drop && drop.endsAt !== 0n && !drop.ended ? countdown(drop.endsAt, chainNow) : null;
  useEffect(() => {
    if (drop?.configured && ((!drop.started && !opensIn) || (drop.endsAt !== 0n && !drop.ended && !endsIn))) {
      refresh();
    }
  }, [drop, opensIn, endsIn, refresh]);

  /* How many this wallet may still take in one go. */
  const max = useMemo(() => {
    if (!drop) return 1;
    const left = drop.capPerWallet === null
      ? BATCH_CAP
      : Number(drop.capPerWallet > claimed ? drop.capPerWallet - claimed : 0n);
    return Math.max(1, Math.min(left, Number(drop.remaining), BATCH_CAP));
  }, [drop, claimed]);

  /* Supply drains and caps fill while the page is open. Without this the picker
   * keeps a number the contract will now reject. */
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), max));
  }, [max]);

  const connect = async () => {
    setError(null);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] || null);
    } catch (e) { setError(readableError(e)); }
  };

  const switchChain = async () => {
    setError(null);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex(CHAIN.id) }] });
    } catch (e) {
      // 4902: the wallet has never heard of this chain. Offer to add it.
      if (e?.code === 4902 || /unrecognized|not been added/i.test(e?.message || "")) {
        try {
          await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS] });
        } catch (addError) { setError(readableError(addError)); }
      } else setError(readableError(e));
    }
  };

  const mint = async () => {
    setError(null);
    setTxHash(null);
    const tx = buildClaimTx({ account, drop, quantity });

    try {
      /* Never open the wallet for a transaction that cannot succeed. The
       * contract mirrors its end-time check into verifyClaim precisely so this
       * simulation matches what the claim will do. */
      setPhase("checking");
      await simulateClaim(tx);

      setPhase("wallet");
      const hash = await eth.request({ method: "eth_sendTransaction", params: [tx] });
      setTxHash(hash);

      setPhase("pending");
      const { mined, success, receipt } = await waitForReceipt(hash);

      if (!mined) {
        // Still in the mempool after three minutes. Hand them the explorer link
        // rather than claiming either outcome.
        setPhase("slow");
        return;
      }

      if (!success) {
        setPhase("failed");
        setError(await revertReason(tx, receipt.blockNumber) || "The transaction failed on-chain.");
        refresh();
        return;
      }

      setPhase("done");
      setMintedAt(Date.now());
      refresh();
    } catch (e) {
      setError(readableError(e));
      setPhase("idle");
    }
  };

  /* ---- states that are not a mint button ---- */

  const shell = (headline, note) => (
    <div className={styles.mint}>
      <div className={styles.mintClosed}>{headline}</div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );

  if (!CONTRACT) return shell("MINT OPENS SOON", "2048 pieces · stored on Arweave, forever");
  if (!drop) return shell(error || "READING THE CHAIN…");
  if (!drop.configured) return shell("MINT NOT OPEN YET", "the drop is deployed, the phase is not live");
  if (drop.ended) return shell("MINT CLOSED", `${String(drop.minted)} of ${String(drop.supply)} minted`);
  if (drop.soldOut) return shell("SOLD OUT", `all ${String(drop.supply)} gone`);
  if (drop.nobodyMayMint) return shell("MINT NOT OPEN YET", "the phase is live but claiming is closed");
  if (!drop.started) {
    return shell(
      opensIn ? `OPENS IN ${opensIn}` : "OPENING…",
      `${String(drop.supply)} pieces · ${formatEth(drop.price)} each`,
    );
  }

  const wrongChain = chainId !== null && chainId !== CHAIN.id;
  const cap = drop.capPerWallet;
  const total = drop.price * BigInt(quantity);

  const cta = {
    checking: "CHECKING…",
    wallet: "CONFIRM IN WALLET…",
    pending: "MINTING…",
  }[phase] || `MINT ${quantity} — ${formatEth(total)}`;

  return (
    <div className={styles.mint}>
      <div className={styles.mintStats}>
        <div><b>{String(drop.minted)}</b><span>MINTED</span></div>
        <div><b>{String(drop.remaining)}</b><span>LEFT</span></div>
        <div><b>{formatEth(drop.price)}</b><span>EACH</span></div>
      </div>

      {!hasWallet ? (
        <div className={styles.mintClosed}>NO WALLET FOUND</div>
      ) : !account ? (
        <button type="button" className={styles.cta} onClick={connect}>CONNECT WALLET</button>
      ) : wrongChain ? (
        <button type="button" className={styles.cta} onClick={switchChain}>
          SWITCH TO {CHAIN.name.toUpperCase()}
        </button>
      ) : cap && claimed >= cap ? (
        <div className={styles.mintClosed}>YOU&rsquo;VE MINTED YOUR {String(cap)}</div>
      ) : (
        <>
          <div className={styles.qty}>
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={busy || quantity <= 1} aria-label="One fewer">−</button>
            <b>{quantity}</b>
            <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={busy || quantity >= max} aria-label="One more">+</button>
          </div>
          <button type="button" className={styles.cta} onClick={mint} disabled={busy}>{cta}</button>
        </>
      )}

      {/* A hash means "submitted", and says so, until a receipt says otherwise. */}
      {txHash && phase === "pending" && (
        <a className={styles.mintPending} href={explorerTx(txHash)} target="_blank" rel="noreferrer">
          WAITING FOR CONFIRMATION ↗
        </a>
      )}
      {txHash && phase === "slow" && (
        <a className={styles.mintPending} href={explorerTx(txHash)} target="_blank" rel="noreferrer">
          STILL PENDING — FOLLOW IT ON THE EXPLORER ↗
        </a>
      )}
      {txHash && phase === "done" && (
        <a className={styles.mintOk} href={explorerTx(txHash)} target="_blank" rel="noreferrer">
          MINTED ✓ VIEW TRANSACTION ↗
        </a>
      )}
      {txHash && phase === "failed" && (
        <a className={styles.mintPending} href={explorerTx(txHash)} target="_blank" rel="noreferrer">
          TRANSACTION FAILED ↗
        </a>
      )}

      {error && <p className={styles.mintErr}>{error}</p>}
      <p className={styles.note}>
        {cap ? `max ${String(cap)} per wallet · ` : ""}
        {endsIn ? `ends in ${endsIn} · ` : ""}
        on {CHAIN.name} · art on Arweave, forever
      </p>
    </div>
  );
}
