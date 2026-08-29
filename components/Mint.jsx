import { useCallback, useEffect, useState } from "react";
import styles from "../styles/Terminl.module.css";
import {
  CHAIN, CONTRACT, encodeClaim, explorerTx, formatEth, readClaimedBy, readDrop,
} from "../lib/mint";

/*
 * The mint.
 *
 * Everything shown here is read from the contract — price, supply, how many are
 * gone, the per-wallet cap. Nothing about the drop is hardcoded on this page,
 * so the site cannot advertise a price the chain disagrees with.
 *
 * Before the drop is deployed NEXT_PUBLIC_TERMINL_CONTRACT is unset and this
 * renders an inert "opens soon" panel. That is deliberate: the previous version
 * shipped a MINT button pointing at an OpenSea collection that 404s, and a dead
 * link costs more trust than an honest closed sign.
 */

const hex = (n) => `0x${Number(n).toString(16)}`;

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
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [claimed, setClaimed] = useState(0n);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const eth = typeof window !== "undefined" ? window.ethereum : undefined;

  /* Live drop state, with or without a wallet — a visitor who has not connected
   * still gets the real price and the real count. */
  const refresh = useCallback(() => {
    readDrop().then(setDrop).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!eth) return undefined;
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

  useEffect(() => {
    if (!account) { setClaimed(0n); return; }
    readClaimedBy(account).then(setClaimed).catch(() => {});
  }, [account, txHash]);

  const connect = async () => {
    setError(null);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] || null);
    } catch (e) { setError(readable(e)); }
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
        } catch (addError) { setError(readable(addError)); }
      } else setError(readable(e));
    }
  };

  const mint = async () => {
    setError(null); setBusy(true); setTxHash(null);
    try {
      const value = drop.native ? drop.price * BigInt(quantity) : 0n;
      const hash = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: account,
          to: CONTRACT,
          data: encodeClaim({
            receiver: account,
            quantity,
            currency: drop.currency,
            pricePerToken: drop.price,
          }),
          ...(value > 0n ? { value: `0x${value.toString(16)}` } : {}),
        }],
      });
      setTxHash(hash);
      refresh();
    } catch (e) {
      setError(readable(e));
    } finally {
      setBusy(false);
    }
  };

  /* ---- states that are not a mint button ---- */

  if (!CONTRACT) {
    return (
      <div className={styles.mint}>
        <div className={styles.mintClosed}>MINT OPENS SOON</div>
        <p className={styles.note}>2048 pieces · stored on Arweave, forever</p>
      </div>
    );
  }

  if (!drop) {
    return <div className={styles.mint}><div className={styles.mintClosed}>{error || "READING THE CHAIN…"}</div></div>;
  }

  if (!drop.configured) {
    return (
      <div className={styles.mint}>
        <div className={styles.mintClosed}>MINT NOT OPEN YET</div>
        <p className={styles.note}>the drop is deployed, the phase is not live</p>
      </div>
    );
  }

  if (drop.soldOut) {
    return (
      <div className={styles.mint}>
        <div className={styles.mintClosed}>SOLD OUT</div>
        <p className={styles.note}>all {String(drop.supply)} gone</p>
      </div>
    );
  }

  const wrongChain = chainId !== null && chainId !== CHAIN.id;
  const cap = drop.perWallet > 0n && drop.perWallet < 1000000n ? drop.perWallet : null;
  const left = cap ? Number(cap - claimed) : 20;
  const max = Math.max(1, Math.min(left, Number(drop.remaining), 20));
  const total = drop.price * BigInt(quantity);

  return (
    <div className={styles.mint}>
      <div className={styles.mintStats}>
        <div><b>{String(drop.minted)}</b><span>MINTED</span></div>
        <div><b>{String(drop.remaining)}</b><span>LEFT</span></div>
        <div><b>{formatEth(drop.price)}</b><span>EACH</span></div>
      </div>

      {!eth ? (
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
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="One fewer">−</button>
            <b>{quantity}</b>
            <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={quantity >= max} aria-label="One more">+</button>
          </div>
          <button type="button" className={styles.cta} onClick={mint} disabled={busy}>
            {busy ? "CONFIRM IN WALLET…" : `MINT ${quantity} — ${formatEth(total)}`}
          </button>
        </>
      )}

      {txHash && (
        <a className={styles.mintOk} href={explorerTx(txHash)} target="_blank" rel="noreferrer">
          MINTED ✓ VIEW TRANSACTION ↗
        </a>
      )}
      {error && <p className={styles.mintErr}>{error}</p>}
      <p className={styles.note}>
        {cap ? `max ${String(cap)} per wallet · ` : ""}on {CHAIN.name} · art on Arweave, forever
      </p>
    </div>
  );
}

/* Wallet errors are objects with a code and a nested reason. Surface the part a
 * person can act on, not the JSON-RPC envelope. */
function readable(e) {
  if (e?.code === 4001) return "You rejected the request.";
  const raw = e?.data?.message || e?.error?.message || e?.message || String(e);
  if (/insufficient funds/i.test(raw)) return "Not enough ETH for the mint plus gas.";
  if (/!PriceOrCurrency/.test(raw)) return "The price changed on-chain. Reload and try again.";
  if (/!MaxSupply|exceed/i.test(raw)) return "That would go past the supply left.";
  if (/!Qty|quantity/i.test(raw)) return "That is more than this wallet may mint.";
  if (/DropEnded/.test(raw)) return "The drop has ended.";
  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
}
