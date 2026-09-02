import { useState } from "react";
import { useAccount } from "wagmi";
import styles from "../styles/Terminl.module.css";
import { openWallet } from "../lib/wallet/open";

/* 0x1234…abcd — enough to recognise, short enough for the nav. */
export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/**
 * The nav's wallet control. Disconnected it opens the picker; connected it
 * shows the address and opens AppKit's account sheet, which is where
 * "disconnect" lives — same as the ArtifactX header.
 */
export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await openWallet(isConnected ? { view: "Account" } : undefined);
    } catch {
      // The mint panel reports wallet errors where there is room to read them.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={isConnected ? `${styles.wallet} ${styles.walletOn}` : styles.wallet}
      onClick={onClick}
      title={isConnected ? address : "Connect a wallet"}
    >
      {isConnected ? shortAddress(address) : "CONNECT"}
    </button>
  );
}
