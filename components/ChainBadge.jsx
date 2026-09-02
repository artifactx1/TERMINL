import { useState } from "react";
import styles from "../styles/Terminl.module.css";
import { CHAIN } from "../lib/mint";

/* The chain the drop lives on, stated plainly and above the fold.
 *
 * This renders in every mint state — including "MINT OPENS SOON", which is the
 * only state anyone has seen so far — because "what chain is this on?" gets
 * asked long before the mint is live. Previously the network was named once, in
 * 9px grey, inside a branch that only renders after the contract is deployed.
 *
 * The mark is Robinhood's, used nominatively to identify the network the drop
 * deploys to. Drop the official asset at public/robinhood-chain.svg and it
 * appears. Until it exists the badge degrades to text rather than shipping a
 * broken image or a stand-in mark that is not theirs. */
const LOGO = "/robinhood-chain.svg";

export default function ChainBadge() {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <div className={styles.chainBadge}>
      {logoOk && (
        /* Not next/image: this is a fixed-size local SVG, and the onError
           fallback below is the whole point. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.chainLogo}
          src={LOGO}
          alt=""
          width={26}
          height={26}
          onError={() => setLogoOk(false)}
        />
      )}
      <div className={styles.chainText}>
        <span>MINTING ON</span>
        <b>{CHAIN.label}</b>
      </div>
    </div>
  );
}
