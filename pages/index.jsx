import Head from "next/head";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/Terminl.module.css";

const HERO_ROTATE_MS = 5200;

const OPENSEA = process.env.NEXT_PUBLIC_OPENSEA_URL || "https://opensea.io/collection/terminl";

/*
 * Art is addressed by opaque slug, never by token id — the numbers are part of
 * the surprise. `/api/art/[slug]` resolves the 32 published pieces and nothing
 * else, and proxies Arweave once the upload is done.
 */
const img = (slug) => `/api/art/${slug}`;

/** Alt text without giving away which piece it is. */
const describe = (t) => ["TERMINL", t.screen && `— ${t.screen} on a ${t.chassis}`]
  .filter(Boolean).join(" ");

/*
 * No `sizes` prop on purpose. Passing one switches next/image to the responsive
 * srcset built from `deviceSizes` (smallest 640) and ignores the `imageSizes`
 * this site actually renders at, so a 210px marquee tile would fetch a 640px
 * variant. Width alone gives a 1x/2x srcset off `imageSizes`.
 */
const Art = ({ slug, size, alt = "", eager = false }) => (
  <Image
    src={img(slug)}
    alt={alt}
    width={size}
    height={size}
    quality={70}
    /*
     * The marquee track is translated by a keyframe animation, so its tiles
     * never reliably satisfy the lazy-loading observer. Anything in it opts out.
     */
    loading={eager ? "eager" : "lazy"}
  />
);

export default function Home({ data, error }) {
  if (error || !data) {
    return <main className={styles.shell}><div className={styles.down}>{error || "Collection unavailable"}</div></main>;
  }
  return <Site data={data} />;
}

function Site({ data }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [viewing, setViewing] = useState(null);
  const paused = useRef(false);
  /* Whatever opened the lightbox, so focus can go back there on close. */
  const trigger = useRef(null);

  const shown = data.showcase;
  const current = shown[heroIndex % shown.length];

  const open = useCallback((i, el) => { trigger.current = el; setViewing(i); }, []);
  const close = useCallback(() => {
    setViewing(null);
    trigger.current?.focus();
  }, []);
  const step = useCallback(
    (d) => setViewing((i) => (i === null ? i : (i + d + shown.length) % shown.length)),
    [shown.length],
  );

  useEffect(() => {
    const timer = setInterval(() => { if (!paused.current) setHeroIndex((i) => i + 1); }, HERO_ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const advance = useCallback(() => setHeroIndex((i) => i + 1), []);
  const upNext = [1, 2, 3, 4, 5].map((n) => shown[(heroIndex + n) % shown.length]);
  const hidden = data.supply - shown.length;

  return (
    <>
      <Head>
        <title>TERMINL — WAGMI. Allegedly.</title>
        <meta
          name="description"
          content={`${data.supply} machines still running in dead malls and empty offices, and the ${data.traitTotals.Companion} degenerates who never left. A celebration of art, memes and degenerate behavior.`}
        />
        <meta property="og:title" content="TERMINL" />
        <meta property="og:description" content={`${data.supply} machines. ${data.outcomes.rekt} of them already rekt. Only ${shown.length} have been shown.`} />
      </Head>

      <main className={styles.shell}>
        <div className={styles.scanlines} />

        <nav className={styles.nav}>
          <a className={styles.wordmark} href="#top"><b>TERMINL</b><span>{data.supply}</span></a>
          <div className={styles.navRight}>
            <a href="#story">STORY</a>
            <a href="#art">ART</a>
            <a href="#regulars">REGULARS</a>
            <a href="#tape">TAPE</a>
            <a className={styles.os} href={OPENSEA} target="_blank" rel="noreferrer">OPENSEA ↗</a>
          </div>
        </nav>

        <section className={styles.hero} id="top">
          <div
            className={styles.stageWrap}
            onMouseEnter={() => { paused.current = true; }}
            onMouseLeave={() => { paused.current = false; }}
          >
            <button type="button" className={styles.stage} onClick={advance} aria-label="Next machine">
              <Image
                key={current.slug}
                className={styles.stageFade}
                src={img(current.slug)}
                alt={describe(current)}
                width={1080}
                height={1080}
                priority
              />
              <span className={styles.sweep} />
            </button>
            <div className={styles.upNext}>
              {upNext.map((t, i) => (
                <button key={`${t.slug}-${i}`} type="button" onClick={() => setHeroIndex((n) => n + i + 1)} aria-label={`Show ${t.screen}`}>
                  <Art slug={t.slug} size={160} eager />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.readout}>
            <h1 className={styles.headline}>WAGMI.<br />Allegedly.</h1>
            <p className={styles.blurb}>
              {data.supply} pixel machines, the memes on their screens, and the{" "}
              {data.traitTotals.Companion} regulars who are still holding.{" "}
              {data.outcomes.rekt} of them are already rekt.
            </p>

            <div className={styles.score}>
              <div><b>{data.outcomes.winner}</b><span>MADE IT</span></div>
              <div className={styles.rekt}><b>{data.outcomes.rekt}</b><span>REKT</span></div>
              <div><b>{data.outcomes.open}</b><span>STILL IN</span></div>
            </div>

            <dl className={styles.specs}>
              <Spec k="ON SCREEN" v={current.screen} />
              <Spec k="MACHINE" v={current.chassis} />
              <Spec k="FINISH" v={current.finish} />
              <Spec k="ROOM" v={current.room} />
              <Spec k="ON THE FLOOR" v={current.prop} />
              <Spec k="STANDING THERE" v={current.companion} />
            </dl>

            <a className={styles.cta} href={OPENSEA} target="_blank" rel="noreferrer">MINT ON OPENSEA ↗</a>
            <p className={styles.note}>{data.supply} pieces · art stored permanently on Arweave</p>
          </div>
        </section>

        <div className={styles.stripWrap}>
          <div className={styles.strip}>
            {[...shown, ...shown].map((t, i) => (
              <Art key={`${t.slug}-${i}`} slug={t.slug} size={256} eager />
            ))}
          </div>
        </div>

        <section className={styles.motto}>
          <p>A celebration of art, memes<br />and degenerate behavior.</p>
        </section>

        <Story data={data} />

        <section className={styles.section} id="art">
          <div className={styles.sectionHead}>
            <h2>{shown.length} of {data.supply}</h2>
            <p>
              That is all you get. The other {hidden} stay in the dark until somebody mints
              them. No preview, no reveal page, no peeking at the metadata.
            </p>
          </div>
          <div className={styles.grid}>
            {shown.map((t, i) => (
              <button
                key={t.slug}
                type="button"
                className={styles.tile}
                onClick={(e) => open(i, e.currentTarget)}
                aria-label={`View ${describe(t)}`}
              >
                <Art slug={t.slug} size={384} alt={describe(t)} />
                <div className={styles.tileMeta}>
                  <b>{t.screen}</b>
                  <span className={styles.tileWith}>{t.companion || "alone"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <Regulars data={data} />
        <Tape data={data} />

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>There is no roadmap</h2>
          </div>
          <div className={styles.plain}>
            <p>
              No utility. No staking. No token. No game. No discord grind, no points, no
              second collection already lined up for whoever misses this one.
            </p>
            <p>
              There might be more later. Depends how the mint goes, honestly. If that
              changes we will just say so.
            </p>
            <p>
              What you get today: {data.supply} pieces of pixel art, every trait published,
              stored on Arweave forever, and {data.traitTotals.Companion} people who are all
              down bad.
            </p>
          </div>
        </section>

        {viewing !== null && (
          <Lightbox item={shown[viewing]} at={viewing} total={shown.length} onClose={close} onStep={step} />
        )}

        <footer className={styles.foot}>
          <a className={styles.footCta} href={OPENSEA} target="_blank" rel="noreferrer">MINT ON OPENSEA ↗</a>
          <div>{data.name} · {data.symbol} · {data.counts.uniqueDna} unique of {data.supply}</div>
          <div><code>{data.imageTx ? `ar://${data.imageTx}` : "arweave manifest pending upload"}</code></div>
        </footer>
      </main>
    </>
  );
}

/**
 * Opening the raw file in a tab meant handing someone a 2048px, multi-megabyte
 * PNG and losing the page. This keeps them here, and keeps the piece next to
 * the traits that describe it.
 */
function Lightbox({ item, at, total, onClose, onStep }) {
  const closeButton = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    };
    document.addEventListener("keydown", onKey);
    // The page behind a full-screen overlay must not scroll with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, onStep]);

  return (
    <div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={describe(item)}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events --
        * Stops a click inside the panel from reaching the backdrop's close
        * handler. Keyboard users get Escape, handled on the document above. */}
      <div className={styles.lightboxPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.lightboxArt}>
          <Image
            key={item.slug}
            src={img(item.slug)}
            alt={describe(item)}
            width={1080}
            height={1080}
            quality={80}
            priority
          />
        </div>

        <div className={styles.lightboxSide}>
          <div className={styles.lightboxHead}>
            <b>TERMINL</b>
            <span>{at + 1} / {total}</span>
          </div>
          <dl className={styles.specs}>
            <Spec k="ON SCREEN" v={item.screen} />
            <Spec k="MACHINE" v={item.chassis} />
            <Spec k="FINISH" v={item.finish} />
            <Spec k="ROOM" v={item.room} />
            <Spec k="ON THE FLOOR" v={item.prop} />
            <Spec k="STANDING THERE" v={item.companion} />
          </dl>
          <p className={styles.lightboxHint}>← → TO BROWSE · ESC TO CLOSE</p>
          <div className={styles.lightboxNav}>
            <button type="button" onClick={() => onStep(-1)} aria-label="Previous piece">←</button>
            <button type="button" onClick={() => onStep(1)} aria-label="Next piece">→</button>
            <button type="button" ref={closeButton} className={styles.lightboxClose} onClick={onClose}>
              CLOSE ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Spec = ({ k, v }) => (
  <div className={styles.specRow}>
    <dt>{k}</dt>
    <dd>{v || <em>nothing</em>}</dd>
  </div>
);

function Story({ data }) {
  return (
    <section className={styles.story} id="story">
      <div className={styles.storyArt}>
        {data.storyArt.map((t) => (
          <Art key={t.slug} slug={t.slug} size={384} alt={describe(t)} />
        ))}
      </div>
      <div className={styles.storyText}>
        <h2>Where they came from</h2>
        <p>Nobody knows where the first one came from.</p>
        <p>
          A market never actually closes. When the exchange dies the order book keeps
          matching — it just moves somewhere with worse lighting. A dead mall. An empty
          office. A motel breezeway at 4am. And wherever it lands it needs something to
          run on.
        </p>
        <p>
          So it takes whatever is in the room. A boombox. A payphone. A handheld somebody
          left in a drawer in 1997. By morning the thing is bolted to the floor, warm to
          the touch, and showing a chart nobody asked for.
        </p>
        <p>
          Then the regulars turn up. Somebody who bought the top and stayed. Somebody who
          sold the bottom and came back to watch anyway. They stand there with a bong, a
          rolling tray and a gas fee receipt they are never getting back, waiting on a green
          candle like it is weather.
        </p>
        <p className={styles.storyLast}>
          Nobody has turned one off. Nobody has really tried.
        </p>
      </div>
    </section>
  );
}

/**
 * A name wall, not a grid — the joke is the roster, and it reads faster as type
 * than as art. Teased, not published: the full cast is withheld for the same
 * reason the full gallery is.
 */
function Regulars({ data }) {
  const named = data.regulars.length;
  const rest = data.traitTotals.Companion - named;

  return (
    <section className={styles.section} id="regulars">
      <div className={styles.sectionHead}>
        <h2>The regulars</h2>
        <p>
          {data.traitTotals.Companion} people show up in this collection. They stand next to
          the machine, hold something stupid, and refuse to leave. Here are {named} of them.
          You know at least one of these people personally.
        </p>
      </div>
      <div className={styles.wall}>
        {data.regulars.map((name) => (
          <span key={name} className={styles.name}>{name}</span>
        ))}
        <span className={styles.nameRest}>+ {rest} you have not met</span>
      </div>
    </section>
  );
}

function Tape({ data }) {
  const order = ["Screen / Face", "Companion", "Background", "Chassis", "Chassis Finish", "Primary Prop", "Effect"];
  const cats = order.filter((c) => data.traitCategories[c]);

  return (
    <section className={styles.section} id="tape">
      <div className={styles.sectionHead}>
        <h2>The tape</h2>
        <p>
          No rarity score in the metadata. Here are the real counts. Do your own homework.
        </p>
      </div>

      <div className={styles.tierRow}>
        {data.tiers.map((t) => (
          <div key={t.name} className={styles.tier}>
            <b>{t.assigned ?? t.count}</b>
            <span>{t.name}</span>
            <i style={{ width: `${Math.max(4, t.percent || 0)}%` }} />
          </div>
        ))}
      </div>

      <div className={styles.traitWrap}>
        {cats.map((category) => {
          const values = data.traitCategories[category];
          const max = values[0].count;
          return (
            <div key={category} className={styles.traitCard}>
              <h3>{category}</h3>
              <small>{values.length} variants</small>
              {values.slice(0, 10).map((v) => (
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
  );
}

export async function getStaticProps() {
  try {
    // eslint-disable-next-line global-require
    const { collection } = require("../lib/collection");
    // eslint-disable-next-line global-require
    const { STORY_ART, slugFor } = require("../lib/showcase");
    const data = collection();
    const bySlug = new Map(data.showcase.map((t) => [t.slug, t]));
    const storyArt = STORY_ART.map((tokenId) => bySlug.get(slugFor(tokenId))).filter(Boolean);
    return { props: { data: { ...data, storyArt }, error: null }, revalidate: 60 };
  } catch (failure) {
    // The locked collection lives outside the repo, so a build without it must
    // still succeed rather than break the whole site.
    return { props: { data: null, error: `Collection not readable: ${failure.message}` }, revalidate: 30 };
  }
}
