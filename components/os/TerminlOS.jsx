import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import RugRunner from "./RugRunner";
import MoonMission from "./MoonMission";
import { newMoon, moonBotReplay, MOON_WORLDS } from "../../lib/moon-mission.mjs";
import { drawMoon } from "../../lib/moon-draw";
import { botReplay } from "../../lib/rug-run.mjs";
import s from "../../styles/OS.module.css";
import { BOTS, THEMES, TROPHIES, STORAGE_KEY, freshProfile, readProfile, dailySeed,
  awardRun, purchaseTheme, encodeChallenge, decodeChallenge } from "../../lib/terminl-game.mjs";

const APPS = [{ id: "arcade", name: "The arcade", icon: "arcade", suffix: "01" },
  { id: "trophies", name: "Trophy cabinet", icon: "trophy", suffix: "02" },
  { id: "shop", name: "Pixel shop", icon: "shop", suffix: "03" },
  { id: "machine", name: "My terminal", icon: "terminal", suffix: "04" }];
const fmt = (n) => n.toLocaleString("en-US");
const modeName = (mode) => ({ daily: "DAILY RUN", practice: "BOT DUEL", challenge: "FRIEND CHALLENGE" }[mode]);

function Modal({ title, children, close }) {
  const dialog = useRef(null);
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement;
    el.showModal();
    return () => { el.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className={s.modal} aria-label={title} onCancel={close} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div className={s.windowBar}><span>{title}</span><button aria-label="Close dialog" onClick={close}>×</button></div>
    <div className={s.modalBody}>{children}</div>
  </dialog>;
}

export default function TerminlOS({ machines }) {
  const [profile, setProfile] = useState(freshProfile);
  const profileRef = useRef(profile);
  const [ready, setReady] = useState(false);
  const [app, setApp] = useState("arcade");
  const [selectedGame, setSelectedGame] = useState("rug");
  const [moonLevel, setMoonLevel] = useState(0);
  const [run, setRun] = useState(null);
  const runRef = useRef(null);
  const [incoming, setIncoming] = useState(null);
  const [modal, setModal] = useState(null);
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    try { const p = readProfile(localStorage.getItem(STORAGE_KEY)); profileRef.current = p; setProfile(p); }
    catch { setStorageUnavailable(true); }
    const readInvitation = () => {
      const code = new URLSearchParams(window.location.hash.slice(1)).get("challenge");
      const challenge = code ? decodeChallenge(code) : null;
      setIncoming(challenge);
      if (code && !challenge) setNotice("That challenge link is damaged. You can still start a fresh run.");
    };
    readInvitation();
    window.addEventListener("hashchange", readInvitation);
    setReady(true);
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(timer); window.removeEventListener("hashchange", readInvitation); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => () => { audioRef.current?.close(); }, []);

  const updateProfile = (value) => {
    const next = typeof value === "function" ? value(profileRef.current) : value;
    profileRef.current = next;
    setProfile(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setStorageUnavailable(true); }
  };
  const updateRun = (next) => { runRef.current = next; setRun(next); };
  const beep = (frequency = 440) => {
    if (!profileRef.current.sound) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const ctx = audioRef.current || (audioRef.current = new Context());
      ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = "square"; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.12);
    } catch { /* Sound is optional, including on unsupported browsers. */ }
  };
  const start = (mode, bot = "max", gameId = selectedGame, worldLevel = moonLevel) => {
    if (!ready) return;
    if (runRef.current && !runRef.current.finished) { setApp("arcade"); setNotice("Your run is still open. Finish it or use End run to start another."); return; }
    const seed = mode === "daily" ? dailySeed() : mode === "challenge" && incoming ? incoming.seed : `run-${crypto.randomUUID()}`;
    const opponent = BOTS.find(b => b.id === bot);
    const game = mode === "challenge" && incoming ? incoming.game || "rug" : gameId;
    const level = game === "moon" ? mode === "challenge" && incoming ? incoming.level ?? 0 : worldLevel : undefined;
    const station = machines[profileRef.current.machine % machines.length];
    updateRun({ id: crypto.randomUUID(), seed, mode, game, level, finished: false, coin: mode === "challenge" && incoming ? incoming.coin : game === "moon" ? "MOON" : "COPE",
      character: station.companion.toLowerCase().replaceAll(" ", "-"),
      rivalName: mode === "practice" ? opponent.name : mode === "challenge" && incoming ? incoming.name : null,
      rivalRecord: mode === "practice" ? (game === "moon" ? moonBotReplay : botReplay)(seed, bot, level) : mode === "challenge" && incoming ? {seed: incoming.seed, level, moves: incoming.moves, endTick: incoming.endTick} : null,
      bot: mode === "practice" ? bot : null });
    if (mode === "challenge") setIncoming(null);
    if(game === "moon")setMoonLevel(level);
    setSelectedGame(game); setApp("arcade"); setModal(null); beep(640);
  };
  const finishRun = (record, coin) => {
    const current = runRef.current;
    if (!current || current.finished) return;
    const finished = {...current, record, coin};
    const result = awardRun(profileRef.current, finished);
    updateProfile(result.profile);
    const { profile: ignored, ...summary } = result;
    updateRun({ ...finished, finished: true, summary });
    beep(result.win ? 880 : 180);
  };
  const share = async () => {
    const current = runRef.current;
    if (!current?.finished) return;
    const code = encodeChallenge({ v: current.game === "moon" ? 3 : 2, ...current.record, coin: current.coin, name: profileRef.current.name.trim() || "ANON" });
    const url = `${window.location.origin}/os#challenge=${code}`;
    setShareUrl(url); setModal("share");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setNotice("Challenge copied. Send it to someone with questionable judgment."); }
    catch { setNotice("Select and copy the challenge link below."); }
  };
  const downloadReceipt = async () => {
    try {
      const { saveReceipt } = await import("../../lib/terminl-receipt");
      await saveReceipt(run, profile, machines[profile.machine % machines.length]);
      setNotice("Receipt downloaded. Your accountant would hate this.");
    } catch { setNotice("Receipt could not download. Please try again."); }
  };

  const machine = machines[profile.machine % machines.length];
  const level = Math.floor(profile.xp / 500) + 1;
  const theme = THEMES.find(t => t.id === profile.theme) || THEMES[0];
  const remaining = clock ? 86400 - (clock.getUTCHours() * 3600 + clock.getUTCMinutes() * 60 + clock.getUTCSeconds()) : null;
  const countdown = remaining === null ? "--:--:--" : [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60].map(n => String(n).padStart(2, "0")).join(":");
  const dailyClaimed = clock && profile.dailyClaims.includes(dailySeed(clock));

  return <div className={s.os} style={{ "--accent": theme.color }}>
    <header className={s.topbar}>
      <Link href="/" className={s.brand}><Icon name="terminal" size={23} /><b>TERMINL<span> OS</span></b><small>v.01</small></Link>
      <div className={s.systemStatus}><i /> ALL SYSTEMS QUESTIONABLE</div>
      <div className={s.topActions}><button onClick={() => setModal("help")} aria-label="How to play"><Icon name="help" /></button>
        <button aria-label={profile.sound ? "Mute sound" : "Enable sound"} aria-pressed={profile.sound} onClick={() => { updateProfile(p => ({ ...p, sound: !p.sound })); beep(660); }}><Icon name={profile.sound ? "sound" : "mute"} /></button>
        <time>{clock ? clock.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "--:--"} <small>UTC</small></time>
      </div>
    </header>

    <div className={s.desktop}>
      <aside className={s.sidebar}>
        <div className={s.operator}><div className={s.avatar}><Icon name="terminal" size={24} /></div><div><b>{profile.name}</b><span>LVL {String(level).padStart(2, "0")} · {level < 3 ? "RETAIL ENTHUSIAST" : "CERTIFIED DEGEN"}</span></div></div>
        <div className={s.xpTrack}><span style={{ width: `${profile.xp % 500 / 5}%` }} /></div><div className={s.xpLabel}>{profile.xp % 500} / 500 XP <span>NEXT LEVEL ↗</span></div>
        <div className={s.sideLabel}>YOUR DESKTOP</div>
        <nav className={s.appNav} aria-label="OS applications">{APPS.map(a => <button key={a.id} className={app === a.id ? s.activeApp : ""} aria-current={app === a.id ? "page" : undefined} onClick={() => { setApp(a.id); beep(360); }}><Icon name={a.icon} /><span>{a.name}</span><small>{a.suffix}</small></button>)}</nav>
        <div className={s.sideBottom}><div className={s.disk}><span className={s.statusDot} /> GUEST SESSION <b>01</b></div>
          <p>{storageUnavailable ? "Storage unavailable. Progress lasts for this visit." : "Progress saves in this browser. No wallet needed to play."}</p>
          <Link href="/" className={s.mintLink}>Meet the collection <Icon name="arrow" size={16} /></Link>
        </div>
      </aside>

      <main className={s.main}>
        <div className={s.breadcrumb}><span>DESKTOP / {APPS.find(a => a.id === app)?.name.toUpperCase()}</span><span><i className={s.statusDot} /> PLAYABLE GUEST EDITION</span></div>
        {storageUnavailable && <div className={s.warning}>Browser storage is unavailable. Credits and unlocks will be lost when you leave.</div>}
        <div className={s.invite}><div><b>REKT RUMBLE / SIX FIGHTERS</b><span>Six distinct pixel fighters. Two stages. Practice your combos or invite a friend to a private PvP match.</span></div><Link className={s.darkButton} href="/os/rumble">PLAY REKT RUMBLE ↗</Link></div>
        <div className={s.invite}><div><b>NEW / WEN LAMBO</b><span>Finally rich. Still can’t drive. Five cars, four drivers, six courses, drift-to-boost racing and a private two-player cup.</span></div><Link className={s.darkButton} href="/os/lambo">PLAY WEN LAMBO ↗</Link></div>
        <div className={s.invite}><div><b>NEW / RUG OR BOND</b><span>10 fake SOL. Five live token launches. Buy the curve, ride the candles, and sell before the dev dumps. Solo trading sim.</span></div><Link className={s.darkButton} href="/os/rug-or-bond">PLAY RUG OR BOND ↗</Link></div>
        {incoming && !run && app === "arcade" && <div className={s.invite}><div><b>{incoming.name} left you a challenge.</b><span>{incoming.game === "moon" ? "Moon Mission. Same level. Beat their ghost." : "Rug Runner. Same course. Beat their ghost."}</span></div><button className={s.darkButton} onClick={() => start("challenge")}>Accept challenge <Icon name="swords" size={17} /></button></div>}

        <div className={s.pageHeading}><div><h1>{app === "arcade" ? "Welcome to the trenches." : app === "trophies" ? "Proof you were here." : app === "shop" ? "Spend your bad decisions." : "Make yourself at home."}</h1><p>{app === "arcade" ? "Five games. One terminal. Absolutely no adult supervision." : app === "trophies" ? "Small victories. Spectacular failures. All worth keeping." : app === "shop" ? "Entirely unnecessary upgrades. Extremely necessary energy." : "A little personality for your corner of the internet."}</p></div><div className={s.creditPill}><Icon name="bolt" size={18} /><b>{fmt(profile.credits)}</b><span>CR</span></div></div>

        {<div className={s.contentGrid} style={{ display: app === "arcade" ? undefined : "none" }}>
          <div className={s.primaryColumn}>
            {run ? run.finished ? <GameResult run={run} profile={profile} share={share} download={downloadReceipt} leave={() => updateRun(null)} continueMoon={level=>start(run.mode==="practice"?"practice":"daily",run.bot||"max","moon",level)} /> : run.game === "moon" ? <MoonMission key={run.id} run={run} machine={machine} active={app === "arcade" && !modal} sound={profile.sound} onComplete={finishRun} leave={() => setModal("quit")} /> : <RugRunner key={run.id} run={run} active={app === "arcade" && !modal} sound={profile.sound} onComplete={finishRun} leave={() => setModal("quit")} /> : <>
              <div className={s.libraryHeading}><span>THE CLASSICS</span><small>02 SOLO / GHOST CHALLENGES</small></div>
              <div className={s.gameShelf} aria-label="Choose a game"><button className={selectedGame === "rug" ? s.selectedCartridge : ""} aria-pressed={selectedGame === "rug"} onClick={() => setSelectedGame("rug")}><span className={s.cartridgeIcon}>↗</span><div><b>RUG RUNNER</b><small>DODGE · COLLECT · CASH OUT</small></div><span>01</span></button><button className={selectedGame === "moon" ? s.selectedCartridge : ""} aria-pressed={selectedGame === "moon"} onClick={() => setSelectedGame("moon")}><span className={s.cartridgeIcon}>☾</span><div><b>MOON MISSION</b><small>RUN · JUMP · STOMP · EXPLORE</small></div><span>02</span></button></div>
              {selectedGame==="moon"&&<section className={s.moonWorldPicker} aria-label="Moon Mission worlds">
                <div className={s.sectionLabel}><span>FLIGHT PLAN / SELECT A WORLD</span><small>{profile.moonClears.length}/10 CLEARED</small></div>
                <div className={s.moonWorldGrid}>{MOON_WORLDS.map(world=><button key={world.level} aria-pressed={moonLevel===world.level} onClick={()=>setMoonLevel(world.level)} style={{"--world-accent":world.accent,"--world-sky":world.sky[1]}}>
                  <span>{String(world.level+1).padStart(2,"0")} <i>{profile.moonClears.includes(world.level)?"CLEARED ✓":world.tag}</i></span>
                  <b>{world.name}</b><small>{world.level<3?"EXPLORER":world.level<7?"ADVENTURER":"MOONSHOT"}</small>
                </button>)}</div>
                <p><b>{MOON_WORLDS[moonLevel].name}</b> · {MOON_WORLDS[moonLevel].brief}</p>
              </section>}
              <section className={s.hero}>
                <div className={s.heroNoise} /><div className={s.heroCopy}><div className={s.eyebrow}><span className={s.statusDot} /> NOW RUNNING / {selectedGame === "moon" ? "MOON_MISSION.EXE" : "RUG_RUNNER.EXE"}</div>
                  {selectedGame === "moon" ? <><h2>Little CRT.<br />Big adventure.<br /><em>To the moon.</em></h2><p>Ten worlds. One tiny terminal. A much bigger adventure.<br />Pick a destination. Find the gems. Reach the rocket.</p></> : <><h2>Build a bag.<br />Dodge the rug.<br /><em>Make it out.</em></h2><p>A 45-second sprint through a meme coin meltdown.<br />Bank your score before the market eats it.</p></>}
                  <button className={s.accentButton} disabled={!ready} onClick={() => start("daily")}>{selectedGame === "moon" ? "PLAY MOON MISSION" : dailyClaimed ? "REPLAY THE DAILY" : "PLAY THE DAILY"} <Icon name="arrow" size={19} /></button>
                  <span className={s.heroFine}>{selectedGame === "moon" ? "10 WORLDS · SAVED LOCAL PROGRESS" : "45 SECONDS"} &nbsp;·&nbsp; FREE TO PLAY</span>
                </div>{selectedGame === "moon" ? <div className={s.moonFeatureArt}><MoonCover level={moonLevel} /></div> : <div className={s.heroArt}><div className={s.orbit} /><Image src={`/art/${machine.slug}.webp`} alt={`${machine.chassis} pixel art terminal`} width={420} height={420} priority /><span className={s.artTag}>RUG RUNNER / KEEP YOUR BAG ALIVE ↗</span></div>}
              </section>
              <div className={s.ticker}>{selectedGame === "moon" ? <><span>← → RUN</span><b>SPACE TO JUMP</b><b>PRESS AGAIN TO DOUBLE JUMP</b><em>STOMP THE CANDLES</em><span>REACH THE ROCKET</span></> : <><span>GREEN = BAGS</span><b>GOLD = BIG BAGS</b><b>BLUE = SHIELD</b><em>RED = REKT</em><span>3 LIVES / NO SECOND CHANCES</span></>}</div>
              <div className={s.sectionLabel}><span>CHOOSE YOUR BAD IDEA</span><small>NO ENTRY FEES. JUST EGO.</small></div>
              <div className={s.modeGrid}>
                <button className={s.modeCard} disabled={!ready} onClick={() => start("daily")}><div className={s.modeTop}><span className={s.modeIcon}><Icon name="bolt" size={25} /></span><span className={s.tag}>{dailyClaimed ? "BONUS CLAIMED ✓" : "+100 CR DAILY"}</span></div><h3>{selectedGame === "moon" ? "The daily mission" : "The daily rug run"}</h3><p>{selectedGame === "moon" ? "A neon city, a tiny CRT hero, and a rocket waiting on the other side. Make it there." : "One course. One meme coin market. Grab a bag and bank 1,000 points to win."}</p><div className={s.modeBottom}><span>RESETS IN {countdown}</span><Icon name="arrow" /></div></button>
                <button className={s.modeCard} disabled={!ready} onClick={() => setModal("rivals")}><div className={s.modeTop}><span className={`${s.modeIcon} ${s.purple}`}><Icon name="swords" size={25} /></span><span className={s.tag}>VS. THE DEGENS</span></div><h3>Pick a fight</h3><p>Race the ghosts of Max, Chloe, or Brian. Dodge better. Bank bigger.</p><div className={s.modeBottom}><span>SOLO · BOT DUELS</span><Icon name="arrow" /></div></button>
                <button className={s.modeCard} disabled={!ready} onClick={() => start("challenge")}><div className={s.modeTop}><span className={`${s.modeIcon} ${s.orange}`}><Icon name="share" size={25} /></span><span className={s.tag}>FRIEND VS. FRIEND</span></div><h3>Ruin a friendship</h3><p>Bank a score. Send the link. Your friend races your ghost on the same course.</p><div className={s.modeBottom}><span>ASYNC PVP · UNRANKED</span><Icon name="arrow" /></div></button>
              </div>
            </>}

            <section className={s.activity}><div className={s.sectionLabel}><span>YOUR RECENT QUESTIONABLE ACTIVITY</span><small>LOCAL RUN HISTORY</small></div>
              {profile.history.length === 0 ? <div className={s.emptyActivity}><span>↳</span><p>A spotless record. How embarrassing.<small>Finish a run to leave your first paper trail.</small></p><span className={s.blink}>_</span></div> : <div className={s.history}>{profile.history.slice(0, 4).map(r => <div key={r.id}><span className={r.win ? s.historyWin : s.historyLoss}>{r.win ? "↗" : "↘"}</span><div><b>{r.title}</b><small>{r.game === "moon" ? "MOON MISSION" : "RUG RUNNER"} · {modeName(r.mode)} · {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div><strong>{fmt(r.score)}<small>+{r.reward} CR</small></strong></div>)}</div>}
            </section>
          </div>

          <aside className={s.rightColumn}>
            <section className={s.machineCard}><div className={s.cardHead}><span><Icon name="terminal" size={15} /> YOUR STATION</span><span className={s.statusDot} /></div><div className={s.stationImage}><Image src={`/art/${machine.slug}.webp`} alt={machine.chassis} width={256} height={256} /><span>GUEST MACHINE</span></div><div className={s.machineInfo}><b>{machine.chassis}</b><span>{machine.room}</span></div><button className={s.textButton} onClick={() => setApp("machine")}>Switch things up <Icon name="arrow" size={15} /></button></section>
            <section className={s.rewardCard}><div className={s.cardHead}><span><Icon name="trophy" size={15} /> YES, YOU WIN STUFF.</span></div><div className={s.rewardIcons}><span>✦</span><span>⚑</span><span>↗</span></div><h3>Win the run.<br />Keep the spoils.</h3><p>Bank big to earn credits. Unlock phosphor colors and trophies. Share a receipt of your glorious exit.</p><button className={s.textButton} onClick={() => setApp("trophies")}>Open trophy cabinet <Icon name="arrow" size={15} /></button><small>IN-GAME REWARDS · NO CASH VALUE</small></section>
            <div className={s.stickyNote}><span>NOTE TO SELF ↙</span><p>“It&apos;s only a loss if you look at the receipt.”</p><small>— MARGIN CALL MAX, PROBABLY</small></div>
          </aside>
        </div>}

        {app === "trophies" && <><div className={s.statGrid}><Stat label="TROPHIES" value={`${profile.trophies.length} / ${TROPHIES.length}`} /><Stat label="RUNS FINISHED" value={profile.games} /><Stat label="WINS" value={profile.wins} /><Stat label="HIGH SCORE" value={fmt(profile.best)} /></div><div className={s.sectionLabel}><span>THE CABINET</span><small>+50 CR FOR EVERY NEW TROPHY</small></div><div className={s.trophyGrid}>{TROPHIES.map(t => { const earned = profile.trophies.includes(t.id); return <article key={t.id} className={`${s.trophyCard} ${earned ? s.earned : ""}`}><span className={s.trophySymbol}>{t.symbol}</span><span className={s.tag}>{earned ? "UNLOCKED" : "LOCKED"}</span><h3>{t.name}</h3><p>{t.description}</p></article>; })}</div><p className={s.footnote}>Your cabinet lives in this browser. Win solo by banking 1,000 points in Rug Runner or reaching the rocket in Moon Mission. In a ghost duel, beat your rival’s score.</p></>}

        {app === "shop" && <><div className={s.shopBanner}><Icon name="shop" size={42} /><div><h2>New look. Same questionable judgment.</h2><p>Finish runs to earn credits. Every color changes your entire OS.</p></div><span>PAYMENT ACCEPTED:<br /><b>YOUR IN-GAME CREDITS</b></span></div><div className={s.shopGrid}>{THEMES.map(t => { const owned = profile.owned.includes(t.id), equipped = profile.theme === t.id; return <article className={s.shopItem} key={t.id}><div className={s.themePreview} style={{ "--preview": t.color }}><div className={s.miniScreen}><span>TERMINL OS</span><b>&gt; hello_</b><div /><small>bad ideas look good on you.</small></div><span className={s.swatch} /></div><div className={s.shopCopy}><span className={s.tag}>DESKTOP THEME</span><h3>{t.name}</h3><p>{t.description}</p><button className={s.darkButton} disabled={!ready || equipped || (!owned && profile.credits < t.price)} onClick={() => { updateProfile(p => purchaseTheme(p, t.id)); setNotice(`${t.name} equipped. Looking irresponsibly good.`); beep(720); }}>{equipped ? "EQUIPPED ✓" : owned ? "EQUIP THEME" : `${t.price} CR · UNLOCK`} {!equipped && <Icon name="arrow" size={16} />}</button>{!owned && profile.credits < t.price && <small className={s.priceHint}>{t.price - profile.credits} more credits to go</small>}</div></article>; })}</div><p className={s.footnote}>Credits are earned by playing. They cannot be purchased, transferred, or redeemed for money or NFTs.</p></>}

        {app === "machine" && <><div className={s.settingsPanel}><div><span className={s.eyebrow}>OPERATOR PROFILE</span><h2>What should we put on the receipt?</h2><p>Your nickname appears on friend challenges. Keep it iconic.</p></div><label className={s.nameField}>CALLSIGN<input maxLength={20} value={profile.name} onChange={e => updateProfile(p => ({ ...p, name: e.target.value.replace(/[^a-zA-Z0-9 _-]/g, "") }))} onBlur={() => { if (!profileRef.current.name.trim()) updateProfile(p => ({ ...p, name: "ANON" })); }} placeholder="ANON" /><small>Letters, numbers, spaces, _ and - · 20 characters</small></label></div><div className={s.sectionLabel}><span>TAKE A GUEST MACHINE FOR A SPIN</span><small>FROM THE PUBLIC SHOWCASE</small></div><div className={s.machineGrid}>{machines.map((m, i) => <button key={m.slug} className={`${s.machineChoice} ${profile.machine % machines.length === i ? s.selectedMachine : ""}`} aria-pressed={profile.machine % machines.length === i} onClick={() => { updateProfile(p => ({ ...p, machine: i })); beep(460); }}><Image src={`/art/${m.slug}.webp`} alt={`${m.chassis} in ${m.room}`} width={320} height={320} /><div><b>{m.chassis}</b><span>{m.companion}</span><small>{profile.machine % machines.length === i ? "CURRENT STATION ✓" : "USE THIS STATION ↗"}</small></div></button>)}</div><div className={s.collectionBanner}><div><h3>The machine is art. The bad decisions are yours.</h3><p>These are public demo stations. Explore all 2,048 TERMINL artworks at the mint.</p></div><Link href="/" className={s.darkButton}>EXPLORE THE COLLECTION <Icon name="arrow" size={18} /></Link></div></>}

        {app !== "arcade" && run && !run.finished && <button className={s.resumeButton} onClick={() => setApp("arcade")}>↳ Resume {run.game === "moon" ? "Moon Mission" : "Rug Runner"}</button>}
        <footer className={s.footer}><span><i className={s.statusDot} /> TERMINL OS / BUILT FOR THE PLOT</span><span>FICTIONAL MONEY. VERY REAL COPING.</span><button onClick={() => setModal("help")}>READ_ME.TXT ↗</button></footer>
      </main>
    </div>
    <div className={s.toast} role="status" aria-live="polite">{notice && <span>{notice}</span>}</div>

    {modal === "rivals" && <Modal title="FIND_AN_OPPONENT.EXE" close={() => setModal(null)}><span className={s.eyebrow}>PRACTICE DUELS · BOT OPPONENTS</span><h2>Choose your emotional support rival.</h2><p>Race a degen’s ghost in the selected game. Same level, higher score wins.</p><div className={s.rivalList}>{BOTS.map(bot => <button key={bot.id} onClick={() => start("practice", bot.id)}><Image src={`/degens/${bot.portrait}.webp`} alt="" width={68} height={112} /><div><span className={s.tag}>{bot.difficulty}</span><h3>{bot.name}</h3><p>“{bot.quote}”</p></div><Icon name="arrow" /></button>)}</div></Modal>}
    {modal === "help" && <Modal title="READ_ME.TXT" close={() => setModal(null)}><span className={s.eyebrow}>THE ARCADE / THE ENTIRE MANUAL</span><h2>Two games. Pick your adventure.</h2><div className={s.helpBox}><b>MOON MISSION · SIDE-SCROLLING PLATFORMER</b><p>Move with arrows or A/D. Space, W, or ↑ jumps; release and press again in the air to double-jump. On mobile, hold the arrows and tap Jump. Collect coins, stomp enemies from above, cross collapsing bridges, and reach the rocket. Checkpoints save your place. Ten selectable worlds, three lives and 90 seconds per world, and a 1,000-point rocket bonus. Cleared worlds are saved on this browser.</p></div><h3 style={{marginTop:24}}>RUG RUNNER · CANDLE-DODGING ARCADE</h3><ol className={s.instructions}><li><b>Move between three lanes.</b> Use ← → or A / D. On mobile, tap the lane you want or use the left/right buttons.</li><li><b>Collect green candles.</b> They add free token allocations to your bag. Consecutive pickups build a multiplier up to ×5. Gold candles award three times more.</li><li><b>Dodge red candles.</b> A hit costs one life and 30% of your bag. Three hits wipe the bag out. Blue shields absorb a hit.</li><li><b>Watch the market.</b> Simulated buyers pump the token; sellers dump it. A whale warning gives you a chance to leave before a dev dump. Your exit value changes live.</li><li><b>Cash out or keep running.</b> The cash-out button unlocks after 5 seconds and banks your score immediately. Survive 45 seconds to bank automatically. Aim for 1,000 points solo, or beat your rival.</li></ol><div className={s.helpBox}><b>Yes, the curve actually changes your exit.</b><p>Pickups and simulated crowd trades move a simplified constant-product curve. Your displayed score is what selling your full bag would return, after price impact and a fictional 1% selling fee. This is an arcade model, not a copy of a live token protocol.</p></div><div className={s.helpBox}><b>Friends, ghosts, and spoils</b><p>Share your finished run as a link. A friend races your recorded ghost with the same course and crowd flow. This is asynchronous and unranked. Every finish earns 60 CR, a win adds 80 CR, and each new trophy adds 50 CR. The first daily finish each UTC day adds 100 CR, shared across both games.</p></div><p className={s.footnote}>Free to play. Fictional tokens and points. Credits unlock browser-local cosmetics; they cannot be redeemed for money or NFTs. No live multiplayer or global rankings. Guest stations do not prove NFT ownership.</p><button className={s.darkButton} onClick={() => setModal(null)}>GOT IT. LET ME RUN →</button></Modal>}
    {modal === "quit" && <Modal title="END_RUN.EXE" close={() => setModal(null)}><h2>Pull the plug?</h2><p>This unfinished run will be lost. Finish the game to keep your score and collect rewards. Rug Runner also lets you cash out early.</p><div className={s.buttonRow}><button className={s.darkButton} onClick={() => setModal(null)}>Keep playing</button><button className={s.outlineButton} onClick={() => { updateRun(null); setModal(null); }}>End run</button></div></Modal>}
    {modal === "share" && <Modal title="FRIENDLY_FIRE.LINK" close={() => setModal(null)}><span className={s.eyebrow}>YOUR SCORE IS THEIR PROBLEM NOW</span><h2>Bet they can&apos;t do better.</h2><p>You finished with <b>{fmt(run.summary.score)}</b>. Send this link to a friend. They race your ghost in {run.game === "moon" ? "Moon Mission, on the same level with the same enemies" : "Rug Runner, through the same candles and market conditions"}.</p><label className={s.shareField}>YOUR CHALLENGE LINK<textarea readOnly value={shareUrl} onFocus={e => e.target.select()} rows={3} /></label><button className={s.darkButton} onClick={copy}>COPY CHALLENGE LINK <Icon name="share" size={17} /></button><p className={s.footnote}>Asynchronous, unranked PvP. The link includes your callsign and recorded game inputs. Your friend can send their result link back; results do not sync automatically.</p></Modal>}
  </div>;
}

function Stat({ label, value }) { return <div><span>{label}</span><b>{value}</b></div>; }

function GameResult({ run, profile, share, download, leave, continueMoon }) {
  const result = run.summary;
  return <section className={s.gameWindow}><div className={s.windowBar}><span>{run.game === "moon" ? "MOON_MISSION.EXE" : "RUG_RUNNER.EXE"} / RUN COMPLETE</span><button onClick={leave} aria-label="Close results">×</button></div><div className={s.resultTop}><span className={s.tag}>{result.dead ? "RUGGED IN THE TRENCHES" : result.tie ? "DRAW" : result.win ? "BAG SUCCESSFULLY SECURED" : "MADE IT OUT"}</span><div className={s.resultSymbol}>{result.dead ? "×" : "↗"}</div><h2>{result.title}</h2><p>{run.game==="moon"?MOON_WORLDS[run.level??0].name:"$"+run.coin} · {profile.name} · {result.duration.toFixed(1)}s in the trenches</p><div className={s.resultScores}><div><span>POINTS BANKED</span><b>{fmt(result.score)}</b><small>{run.game === "moon" ? result.won ? "ROCKET REACHED" : result.dead ? "OUT OF LIVES" : "TIME RAN OUT" : result.banked ? "CASHED OUT EARLY" : result.dead ? "THREE HITS. ZERO BAGS." : "SURVIVED THE FULL RUN"}</small></div>{result.rival !== null && <div><span>{run.rivalName}</span><b>{fmt(result.rival)}</b><small>{result.tie ? "IT'S A DRAW" : result.win ? "YOU BEAT THEIR GHOST" : "RIVAL WINS THIS ONE"}</small></div>}</div><div className={s.runnerResultStats}><span>{result.coins} {run.game === "moon" ? "COINS COLLECTED" : "CANDLES COLLECTED"}</span><span>{run.game === "moon" ? `${result.stomps} ENEMIES STOMPED` : `${result.bestCombo} BEST STREAK`}</span></div></div><div className={s.resultRewards}><div><Icon name="bolt" size={28} /><div><b>+{result.reward} CR</b><span>60 finish{result.win ? " + 80 win" : ""}{result.dailyBonus ? " + 100 daily" : ""}{result.unlocked.length ? ` + ${result.unlocked.length * 50} trophies` : ""}</span></div></div><span>+{result.win ? 150 : 100} XP</span></div>{result.unlocked.length > 0 && <div className={s.unlocks}>{result.unlocked.map(id => { const t = TROPHIES.find(t => t.id === id); return <span key={id}>{t.symbol} {t.name} <small>UNLOCKED</small></span>; })}</div>}<div className={s.resultActions}>{run.game==="moon"&&<button className={s.accentButton} onClick={()=>continueMoon(result.won&&run.level<9?run.level+1:run.level??0)}>{result.won&&run.level<9?"NEXT WORLD →":"REPLAY WORLD ↻"}</button>}<button className={s.accentButton} onClick={share}>CHALLENGE A FRIEND <Icon name="swords" size={18} /></button><button className={s.outlineButton} onClick={download}>↓ SAVE RECEIPT</button><button className={s.textButton} onClick={leave}>Back to arcade <Icon name="arrow" size={16} /></button></div></section>;
}

function MoonCover({level=0}) {
  const ref = useRef(null);
  useEffect(() => { const ctx = ref.current.getContext("2d"); ctx.setTransform(2/3,0,0,2/3,0,0); drawMoon(ctx,{...newMoon("cover",level),x:380,y:331,tick:100},1080); }, [level]);
  return <canvas ref={ref} width={720} height={360} role="img" aria-label={`Moon Mission: ${MOON_WORLDS[level].name} preview`} />;
}
