import Head from "next/head";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/Terminl.module.css";
import Mint from "../components/Mint";
import { loreFor } from "../data/degen-lore";
import ChainBadge from "../components/ChainBadge";
import WalletButton from "../components/WalletButton";
import { CHAIN, CONTRACT } from "../lib/mint";

const HERO_ROTATE_MS = 5200;

/*
 * Art is addressed by opaque slug, never by token id — the numbers are part of
 * the surprise. The files themselves are produced by `npm run snapshot`, which
 * is the only thing that ever reads the locked collection; the deployed app has
 * no path back to the pieces it did not publish.
 *
 * Unset, this serves the copies committed under public/art. Point it at a
 * bucket or CDN to serve them from there instead.
 */
const ART_BASE = (process.env.NEXT_PUBLIC_ART_BASE_URL || "/art").replace(/\/$/, "");
const img = (slug) => `${ART_BASE}/${slug}.webp`;

/* Portraits sit beside the art, wherever that is. */
const DEGEN_BASE = ART_BASE.replace(/\/art$/, "/degens");

/* Authored, not generated — see data/degen-lore.js. */
const degenPortrait = (slug) => `${DEGEN_BASE}/${slug}.webp`;

/*
 * Sharing metadata.
 *
 * og:image has to be an absolute URL — every scraper rejects a relative one,
 * and a Vercel preview domain changes on each deploy. So the card is served
 * from the bucket by default, which is stable before the site even has a
 * domain. Override either value once the real hostname is settled.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "")
).replace(/\/$/, "");

const OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE
  || "https://storage.googleapis.com/curent-marketplace/terminl/og.jpg";

const OG_TITLE = "TERMINL — WAGMI. Or maybe we won't.";

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

  /* Reused by every scraper. Three short facts ending on the hook — X truncates
     around 200 characters and Discord clips harder still. */
  const blurb = `${data.supply} pixel machines. ${data.outcomes.rekt} already rekt. `
    + `Only ${shown.length} have ever been shown.`;

  return (
    <>
      <Head>
        <title>{OG_TITLE}</title>
        <meta name="description" content={blurb} />
        <meta name="theme-color" content="#060907" />
        {SITE_URL && <link rel="canonical" href={SITE_URL} />}

        {/*
          * Warm the hosts the wallet picker will need, before anyone taps it.
          *
          * Opening the picker is the first time the page talks to Reown at
          * all, so that tap pays for DNS, TLS and the wallet list on a
          * connection it has never used — a few hundred milliseconds on
          * cellular, and the reason CONNECT feels quick on one visit and
          * sluggish on the next. preconnect gets the handshakes out of the way
          * during the page load, where nobody is waiting on them.
          *
          * The art bucket is here for the same reason: the hero is the first
          * paint that matters and it is on another origin.
          */}
        <link rel="preconnect" href="https://api.web3modal.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://pulse.walletconnect.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://storage.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://relay.walletconnect.org" />

        {/* Open Graph — Discord, Telegram, Slack, iMessage, LinkedIn, Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TERMINL" />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={blurb} />
        {SITE_URL && <meta property="og:url" content={SITE_URL} />}
        <meta property="og:image" content={OG_IMAGE} />
        {/* Declared dimensions let a scraper reserve the wide card before it
            has finished downloading the image; without them some fall back to
            a small thumbnail. */}
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:alt" content="TERMINL — pixel art terminals" />
        <meta property="og:locale" content="en_US" />

        {/* X/Twitter reads its own namespace and ignores og:* for card type */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={blurb} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:image:alt" content="TERMINL — pixel art terminals" />

        <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>

      <main className={viewing !== null ? `${styles.shell} ${styles.frozen}` : styles.shell}>
        <div className={styles.scanlines} />

        <nav className={styles.nav}>
          <a className={styles.wordmark} href="#top"><b>TERMINL</b><span>{data.supply}</span></a>
          <div className={styles.navRight}>
            <a href="#story">STORY</a>
            <a href="#art">ART</a>
            <a href="#degens">DEGENS</a>
            <a href="#tape">TAPE</a>
            {CONTRACT ? (
              <a className={styles.os} href={`${CHAIN.explorer}/address/${CONTRACT}`} target="_blank" rel="noreferrer">CONTRACT ↗</a>
            ) : (
              <a className={styles.os} href="#top">MINT</a>
            )}
            <WalletButton />
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
            <h1 className={styles.headline}>WAGMI.<br />Or maybe<br />we won&rsquo;t.</h1>
            <p className={styles.blurb}>
              {data.supply} pixel machines. Only {shown.length} have ever been shown.
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

            <ChainBadge />
            <Mint />
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
              That&rsquo;s all you get. The other {hidden} stay dark until somebody mints
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

        <Degens data={data} />
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
              changes we&rsquo;ll say so.
            </p>
            <p>
              What you get today: {data.supply} pieces of pixel art, every trait published,
              stored on Arweave forever, and {data.traitTotals.Companion} degens who are all
              down bad.
            </p>
          </div>
        </section>

        {viewing !== null && (
          <Lightbox
            item={shown[viewing]}
            at={viewing}
            total={shown.length}
            onClose={close}
            onStep={step}
            neighbours={[shown[(viewing + 1) % shown.length], shown[(viewing - 1 + shown.length) % shown.length]]}
          />
        )}

        <footer className={styles.foot}>
          <a className={styles.footCta} href="#top">MINT TERMINL</a>
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
/**
 * Escape closes, arrows step, the page behind stops scrolling, and focus lands
 * somewhere useful. Shared by both overlays so they cannot drift apart — a
 * modal that traps the scroll and one that does not is a bug waiting for
 * whichever one gets edited second.
 */
function useOverlay({ onClose, onStep, focusRef }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, onStep, focusRef]);
}

function Lightbox({ item, at, total, onClose, onStep, neighbours }) {
  const closeButton = useRef(null);
  useOverlay({ onClose, onStep, focusRef: closeButton });

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
          {/* Warms the next and previous pieces so arrow navigation does not
              wait on a cold image request. */}
          <div hidden>
            {neighbours.map((n) => (
              <Image key={n.slug} src={img(n.slug)} alt="" width={1080} height={1080} quality={80} />
            ))}
          </div>
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
  /* Every number below is snapshot output, not prose — see storyFacts in
   * scripts/snapshot.mjs. A count that goes missing drops its clause instead of
   * printing something the collection no longer supports. */
  const f = data.storyFacts || {};

  return (
    <section className={styles.story} id="story">
      <div className={styles.storyArt}>
        {data.storyArt.map((t) => (
          <Art key={t.slug} slug={t.slug} size={384} alt={describe(t)} />
        ))}
      </div>
      <div className={styles.storyText}>
        <h2>Who&rsquo;s standing there</h2>
        <p>
          Barry bought the top. Not this top — an earlier one, that nobody brings up any
          more. He is still at the same machine in the same dead mall, holding a trophy he
          bought for himself.
        </p>
        <p>
          There are {f.regulars ?? data.traitTotals.Companion} of them and they have all
          got a version of that. Paper Hands Paul, who sold and now has to watch.{" "}
          {f.mostCommon ? `${f.mostCommon.name}, who turns up ${f.mostCommon.count} times because he keeps doing it. ` : ""}
          A pigeon that smokes.{" "}
          {f.gasFeeReceipt ? `${f.gasFeeReceipt} of them are holding a gas fee receipt. ` : ""}
          {f.emptyWallet ? `${f.emptyWallet} are holding an empty wallet — not a joke about being broke, an actual trait, and ${f.emptyWallet} people are going to own it.` : ""}
        </p>
        <p>
          The machines were already in the room. Somebody&rsquo;s boombox, a payphone, a
          handheld left in a drawer in 1997, bolted down and wired up and still printing.
          Nobody maintains them. Nobody turns them off either. That is not the interesting
          part — the interesting part is who keeps showing up to watch.
        </p>
        <p className={styles.storyLast}>
          {data.outcomes.winner} of these people made it. {data.outcomes.rekt} got rekt. The
          other {data.outcomes.open} are still standing there at 4am, waiting to find out
          which.
        </p>
      </div>
    </section>
  );
}

/**
 * The cast, as portraits.
 *
 * Only the degens standing in the sixteen published pieces are here, so this
 * reveals nothing new — you can already see every one of them in the gallery.
 * Everyone else stays behind the mint.
 */
function Degens({ data }) {
  const rest = data.traitTotals.Companion - data.degens.length;

  /* Which degen is open, by index, so the arrows can walk the cast. */
  const [meeting, setMeeting] = useState(null);
  const close = useCallback(() => setMeeting(null), []);
  const step = useCallback(
    (by) => setMeeting((i) => (i === null ? i : (i + by + data.degens.length) % data.degens.length)),
    [data.degens.length],
  );

  return (
    <section className={styles.section} id="degens">
      <div className={styles.sectionHead}>
        <h2>The degens</h2>
        <p>
          Every machine comes with one. They stand there holding something stupid and they
          don&rsquo;t leave. There are {data.traitTotals.Companion} of them and you probably
          know a few personally.
        </p>
      </div>
      <div className={styles.cast}>
        {data.degens.map((d, i) => (
          <button key={d.slug} type="button" className={styles.degen} onClick={() => setMeeting(i)}>
            <Image src={degenPortrait(d.slug)} alt={d.name} width={340} height={560} quality={80} />
            <b>{d.name}</b>
          </button>
        ))}
        <div className={styles.castRest}>+ {rest} more<br />you meet by minting</div>
      </div>

      {meeting !== null && (
        <DegenCard
          degen={data.degens[meeting]}
          at={meeting}
          total={data.degens.length}
          onClose={close}
          onStep={step}
        />
      )}
    </section>
  );
}

/**
 * A degen, at length.
 *
 * The same modal a piece opens in, because they are the same kind of thing to
 * look at: a portrait, some rows, and the story underneath. The rows are ENTRY
 * / EXIT / DAMAGE / COPE rather than the machine's traits, which is the only
 * real difference — a machine has specifications, a degen has a history.
 */
function DegenCard({ degen, at, total, onClose, onStep }) {
  const closeButton = useRef(null);
  useOverlay({ onClose, onStep, focusRef: closeButton });
  const lore = loreFor(degen.slug);

  return (
    <div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={degen.name}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events --
        * Same as the piece lightbox: stops an inside click reaching the
        * backdrop. Keyboard users get Escape, handled on the document. */}
      <div className={`${styles.lightboxPanel} ${styles.degenPanel}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.degenArt}>
          <Image
            key={degen.slug}
            src={degenPortrait(degen.slug)}
            alt={degen.name}
            width={340}
            height={560}
            quality={85}
            priority
          />
        </div>

        <div className={styles.lightboxSide}>
          <div className={styles.lightboxHead}>
            <b>{degen.name.toUpperCase()}</b>
            <span>{at + 1} / {total}</span>
          </div>

          {lore?.epithet && <p className={styles.degenEpithet}>{lore.epithet}</p>}

          {lore?.spec && (
            <dl className={styles.specs}>
              {Object.entries(lore.spec).map(([k, v]) => <Spec key={k} k={k} v={v} />)}
            </dl>
          )}

          {lore?.story && <p className={styles.degenStory}>{lore.story}</p>}

          <p className={styles.lightboxHint}>← → TO BROWSE · ESC TO CLOSE</p>
          <div className={styles.lightboxNav}>
            <button type="button" onClick={() => onStep(-1)} aria-label="Previous degen">←</button>
            <button type="button" onClick={() => onStep(1)} aria-label="Next degen">→</button>
            <button type="button" ref={closeButton} className={styles.lightboxClose} onClick={onClose}>
              CLOSE ✕
            </button>
          </div>
        </div>
      </div>
    </div>
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
  /*
   * Everything the page renders was resolved by `npm run snapshot` and
   * committed. There is no filesystem access and no collection lookup here —
   * the build reads a 12 kB JSON file and nothing else.
   */
  // eslint-disable-next-line global-require
  const site = require("../data/site.json");
  const bySlug = new Map(site.showcase.map((t) => [t.slug, t]));

  return {
    props: {
      data: { ...site, storyArt: site.storyArt.map((slug) => bySlug.get(slug)).filter(Boolean) },
      error: null,
    },
  };
}
