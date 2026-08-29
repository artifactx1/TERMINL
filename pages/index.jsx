/* eslint-disable @next/next/no-img-element --
 * Token art is served from a local API route off the locked collection and is
 * already the exact pixel size it renders at; next/image would add an
 * unoptimized passthrough and fight the pixelated rendering.
 */
import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/Terminl.module.css";

const pad = (n) => String(n).padStart(4, "0");

const MINT_PRICE_ETH = 0.0169;
const MAX_PER_WALLET = 10;
const HERO_ROTATE_MS = 4200;

/*
 * Before the Arweave upload the art is previewed off disk; afterwards the site
 * points straight at the gateway and stops touching the filesystem entirely.
 * One switch, set by NEXT_PUBLIC_ARWEAVE_IMAGE_TX.
 */
const IMAGE_TX = process.env.NEXT_PUBLIC_ARWEAVE_IMAGE_TX || "";
const img = (tokenId) => (IMAGE_TX
  ? `https://arweave.net/${IMAGE_TX}/${pad(tokenId)}.png`
  : `/api/token?id=${tokenId}`);

/** Deterministic spread so the hero never shows two neighbours in a row. */
function heroOrder(supply, count) {
  const step = Math.max(1, Math.floor(supply / count));
  return Array.from({ length: count }, (_, i) => (i * step * 7 + 137) % supply);
}

/**
 * Collection data is resolved at build time, not fetched on mount. The page
 * lives inside _app's Suspense-wrapped wallet stack, so a client-only bootstrap
 * leaves the hero blank until hydration completes — and on a mint page the art
 * is the pitch. Server-rendering it also means the traits are in the HTML for
 * crawlers and link previews.
 */
export default function Home({ data, error }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [minted] = useState(0);
  const paused = useRef(false);

  const rotation = data?.hero || [];
  const current = rotation.length ? rotation[heroIndex % rotation.length] : null;
  const currentId = current ? current.tokenId : null;

  useEffect(() => {
    if (!rotation.length) return undefined;
    const timer = setInterval(() => {
      if (!paused.current) setHeroIndex((i) => i + 1);
    }, HERO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [rotation.length]);

  const advance = useCallback(() => setHeroIndex((i) => i + 1), []);

  if (error || !data) {
    return (
      <main className={styles.shell}>
        <div style={{ padding: 60, color: "#ff716a" }}>{error || "Collection unavailable"}</div>
      </main>
    );
  }

  const attr = (name) => current?.attributes?.[name] || "—";
  const remaining = data.supply - minted;
  const strip = heroOrder(data.supply, 26);

  return (
    <>
      <Head>
        <title>TERMINL — 2048 terminally online machines</title>
        <meta name="description" content={`${data.supply} generative CRT terminals. ${data.traitTotals.Companion} companions, ${data.grails.length} one-of-ones, permanently on Arweave.`} />
      </Head>

      <main className={styles.shell}>
        <div className={styles.scanlines} />
        <div className={styles.vignette} />

        <nav className={styles.nav}>
          <div className={styles.wordmark}>
            <b>TERMINL</b><span>{data.supply} UNITS</span>
          </div>
          <div className={styles.navRight}>
            <a href="#grails">GRAILS</a>
            <a href="#traits">TRAITS</a>
            <a href="#rarity">RARITY</a>
          </div>
        </nav>

        <section className={styles.hero}>
          <div
            className={styles.stageWrap}
            onMouseEnter={() => { paused.current = true; }}
            onMouseLeave={() => { paused.current = false; }}
          >
            <div className={styles.stage} onClick={advance} role="presentation">
              {currentId !== null && (
                <img key={currentId} className={styles.stageFade} src={img(currentId)} alt={`TERMINL #${pad(currentId)}`} />
              )}
              <div className={styles.sweep} />
              <div className={styles.stageTag}>
                <b>#{pad(currentId ?? 0)}</b>
                <span>{attr("Chassis")}</span>
                <span>·</span>
                <span>{attr("Screen / Face")}</span>
              </div>
            </div>
          </div>

          <div className={styles.readout}>
            <div>
              <p className={styles.kicker}>GENERATIVE · {data.storage.toUpperCase()} · FOREVER</p>
              <h1 className={styles.headline}>Terminally<br />online.</h1>
            </div>
            <p className={styles.blurb}>
              {data.supply} CRT machines, each assembled from a chassis, a live screen, a finish,
              a prop and one of {data.traitTotals.Companion} companions who never log off.
              Every unit is unique. {data.grails.length} are one-of-one.
            </p>

            <dl className={styles.specs}>
              {[
                ["CHASSIS", attr("Chassis")],
                ["FINISH", attr("Chassis Finish")],
                ["SCREEN", attr("Screen / Face")],
                ["PROP", attr("Primary Prop")],
                ["COMPANION", attr("Companion")],
                ["EFFECT", attr("Effect")],
              ].map(([k, v]) => (
                <div key={k} className={styles.specRow}>
                  <dt>{k}</dt><dd>{v === "—" ? <em>none</em> : v}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.mintBox}>
              <div className={styles.mintTop}>
                <b>{MINT_PRICE_ETH} ETH</b>
                <span>MAX {MAX_PER_WALLET} / WALLET</span>
              </div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${(minted / data.supply) * 100}%` }} />
              </div>
              <div className={styles.barLabel}>
                <span>{minted} MINTED</span><span>{remaining} REMAINING</span>
              </div>
              <div className={styles.qty}>
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
                <div>{quantity}</div>
                <button onClick={() => setQuantity((q) => Math.min(MAX_PER_WALLET, q + 1))} disabled={quantity >= MAX_PER_WALLET}>+</button>
              </div>
              <button className={styles.cta} disabled>MINT OPENS SOON</button>
              <p className={styles.mintNote}>
                {(MINT_PRICE_ETH * quantity).toFixed(4)} ETH + gas · art stored permanently on Arweave
              </p>
            </div>
          </div>
        </section>

        <div className={styles.stripWrap}>
          <div className={styles.strip}>
            {[...strip, ...strip].map((id, i) => (
              <img key={`${id}-${i}`} src={img(id)} alt="" loading="lazy" />
            ))}
          </div>
        </div>

        <section className={styles.section} id="grails">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>{data.grails.length} OF {data.supply}</p>
            <h2>The one-of-ones</h2>
            <p>
              Eight units abandon the machine entirely and become a full-canvas scene.
              Each exists once, at a fixed token id, and cannot be pulled again.
            </p>
          </div>
          <div className={styles.grailGrid}>
            {data.grails.map((g) => (
              <a key={g.tokenId} className={styles.grail} href={img(g.tokenId)} target="_blank" rel="noreferrer">
                <img src={img(g.tokenId)} alt={g.name} loading="lazy" />
                <figcaption><b>{g.name}</b><span>#{g.id}</span></figcaption>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.section} id="rarity">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>DISTRIBUTION</p>
            <h2>Tiers cut at real gaps</h2>
            <p>
              Tiers are placed where the rarity score actually separates, not at round numbers.
              Rarity is deliberately absent from token metadata — the traits are published, the
              ranking is yours to compute.
            </p>
          </div>
          <div className={styles.tierRow}>
            {data.tiers.map((t) => (
              <div key={t.name} className={styles.tier}>
                <b>{t.assigned ?? t.count}</b>
                <span>{t.name}</span>
                <i style={{ width: `${Math.max(4, (t.percent || 0))}%` }} />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} id="traits">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>PROVENANCE</p>
            <h2>Every trait, every count</h2>
            <p>Rarest first. These are the real counts from the locked collection, not projections.</p>
          </div>
          <div className={styles.traitWrap}>
            {Object.entries(data.traitCategories).map(([category, values]) => {
              const max = Math.max(...values.map((v) => v.count));
              return (
                <div key={category} className={styles.traitCard}>
                  <h3>{category}</h3>
                  <small>{values.length} variants</small>
                  {values.slice(0, 9).map((v) => (
                    <div key={v.name} className={styles.traitRow}>
                      <span title={v.name}>{v.name}</span>
                      <b>{v.count}</b>
                      <i className={styles.traitTrack}><i style={{ width: `${(v.count / max) * 100}%` }} /></i>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <footer className={styles.foot}>
          <div>{data.name} · {data.symbol} · {data.counts.uniqueDna} UNIQUE OF {data.supply}</div>
          <div><code>{data.imageTx ? `ar://${data.imageTx}` : "ARWEAVE MANIFEST PENDING UPLOAD"}</code></div>
        </footer>
      </main>
    </>
  );
}

export async function getStaticProps() {
  try {
    // eslint-disable-next-line global-require
    const { collection, heroTokens } = require("../lib/collection");
    const data = collection();
    return {
      props: { data: { ...data, hero: heroTokens(heroOrder(data.supply, 48)) }, error: null },
      revalidate: 60,
    };
  } catch (failure) {
    // The locked collection lives outside the repo, so a build without it must
    // still succeed rather than break the whole site.
    return { props: { data: null, error: `Collection not readable: ${failure.message}` }, revalidate: 30 };
  }
}
