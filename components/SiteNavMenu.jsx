import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "../styles/Terminl.module.css";

export default function SiteNavMenu({ contractUrl }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  return <div className={styles.navMenu} ref={root}>
    <button
      ref={button}
      type="button"
      className={`${styles.menuButton} ${open ? styles.menuButtonOpen : ""}`}
      aria-label={open ? "Close site menu" : "Open site menu"}
      aria-expanded={open}
      aria-controls="site-menu"
      onClick={() => setOpen((value) => !value)}
    >
      <span className={styles.menuIcon} aria-hidden="true"><i /><i /><i /></span>
      <span>MENU</span>
    </button>
    {open && <div className={styles.menuPanel} id="site-menu">
      <div className={styles.menuGroup}>
        <span className={styles.menuHeading}>MINT &amp; WL</span>
        <Link href="/#top" onClick={close}>MINT HOME <span>↗</span></Link>
        <Link href="/wl" onClick={close}>APPLY FOR WL <span>↗</span></Link>
        <Link href="/#updates" onClick={close}>LAUNCH UPDATES <span>↗</span></Link>
        {contractUrl && <a href={contractUrl} target="_blank" rel="noreferrer" onClick={close}>CONTRACT <span>↗</span></a>}
      </div>
      <div className={styles.menuGroup}>
        <span className={styles.menuHeading}>THE ARCADE</span>
        <Link href="/os" onClick={close}>PLAY GAMES <span>↗</span></Link>
        <Link href="/beat-the-bots" onClick={close}>BEAT THE BOTS <span>↗</span></Link>
        <Link href="/leaderboard" onClick={close}>LEADERBOARD <span>↗</span></Link>
      </div>
      <div className={styles.menuGroup}>
        <span className={styles.menuHeading}>THE COLLECTION</span>
        <Link href="/#story" onClick={close}>STORY <span>↗</span></Link>
        <Link href="/#art" onClick={close}>ART <span>↗</span></Link>
        <Link href="/#degens" onClick={close}>DEGENS <span>↗</span></Link>
        <Link href="/#tape" onClick={close}>TAPE <span>↗</span></Link>
      </div>
    </div>}
  </div>;
}
