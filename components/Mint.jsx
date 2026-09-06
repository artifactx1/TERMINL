import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import styles from "../styles/Terminl.module.css";
import {
  CHAIN, CONTRACT, buildAllowlistClaimTx, buildClaimTx, countdown, describeDrop, explorerTx,
  fetchDropFacts, formatEth, isTerminal, readClaimedBy, readStageClaimedBy, readableError,
  revertReason, simulateClaim, waitForReceipt,
} from "../lib/mint";
import { openWallet, walletDeepLink } from "../lib/wallet/open";
import { fetchPhases, windowStatus } from "../lib/phases";
import {
  describeStage, fetchAllowlist, ineligibleNote, liveStage, maxForStage, nextStage,
} from "../lib/allowlist";
import Phases, { Progress } from "./Phases";

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
 *
 * Two ways to mint, and the panel renders both through one control. The PUBLIC
 * phase is a claim condition on the contract, so anyone may take it on the
 * terms the chain states. An ALLOWLIST STAGE is not on chain at all: its terms
 * are sealed in a merkle leaf, so they and the proof come from the backend for
 * one wallet at a time (lib/allowlist). A live stage takes precedence — its
 * price and its per-wallet cap are the ones that apply, counted by a per-stage
 * counter that has nothing to do with the public phase's tally.
 *
 * The wallet itself comes from wagmi, connected through the same Reown AppKit
 * picker ArtifactX uses (lib/wallet). The reads stay on plain eth_call and the
 * claim stays hand-encoded — wagmi only carries the connection and the send.
 */

/* How many the picker will offer at once when the phase sets no per-wallet cap.
 * Not a rule — just a sane ceiling for one signature. */
const BATCH_CAP = 20;

/* Live counts move underneath the page: someone else takes the last one, the
 * phase opens, the clock runs out. Re-read on a slow loop so the panel is never
 * more than this far behind the chain. */
const POLL_MS = 20_000;

/* Not on any list, and nothing tried yet — the state a visitor without a wallet
 * is in, and the one a public-only drop stays in forever. */
const EMPTY_ALLOWLIST = { eligible: false, reason: null, stages: [], failed: false };

export default function Mint() {
  /* wagmi's `chainId` here is the WALLET's chain, not the app's — that is the
   * one the wrong-chain check has to compare against. Wallets do not ship
   * Robinhood Chain, and the connectors handle the add-then-switch dance
   * (4902) themselves, from the chain definition in lib/wallet/wagmi-config. */
  const { address: account, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [facts, setFacts] = useState(null);
  const [claimed, setClaimed] = useState(0n);
  const [quantity, setQuantity] = useState(1);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [mintedAt, setMintedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const busy = phase === "checking" || phase === "wallet" || phase === "pending";

  /* The facts about the drop, with or without a wallet — a visitor who has not
   * connected still gets the real price and the real count. Read through
   * /api/drop, which the CDN caches for a few seconds, so a crowd costs the RPC
   * almost nothing. */
  const refresh = useCallback(() => {
    fetchDropFacts()
      .then((f) => { setFacts(f); setNow(Date.now()); setError(null); })
      .catch((e) => setError(readableError(e)));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* Allowlist stage definitions, for the schedule. They change when the artist
   * edits them — rarely, never mid-stage — so once per visit, and again when a
   * backgrounded tab is looked at. */
  const [phases, setPhases] = useState(null);
  useEffect(() => {
    let on = true;
    const load = () => fetchPhases().then((p) => { if (on) setPhases(p); });
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { on = false; document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  /* Per-wallet count, re-read after a mint *confirms* — not when it is sent. */
  useEffect(() => {
    if (!account) { setClaimed(0n); return; }
    readClaimedBy(account).then(setClaimed).catch(() => {});
  }, [account, mintedAt]);

  /* What THIS wallet may claim from the allowlist, with the proofs. Fetched
   * once per connected wallet: stage terms are fixed by the published root, so
   * the only thing that moves is the clock, and that is derived locally. */
  const [allow, setAllow] = useState(EMPTY_ALLOWLIST);
  useEffect(() => {
    if (!account) { setAllow(EMPTY_ALLOWLIST); return undefined; }
    let on = true;
    fetchAllowlist(account).then((a) => { if (on) setAllow(a); });
    return () => { on = false; };
  }, [account]);

  /* Counted against chain time, corrected for however wrong this machine's
   * clock is — otherwise the countdown and the contract disagree. */
  const chainNow = now - (facts?.skewMs ?? 0);

  /* The state is decided HERE, on every tick, from cached facts and a corrected
   * clock — never read from the cache. A cached "not started" would be wrong the
   * moment the phase opened, and every visitor would then hammer the route
   * until the copy expired; a cached start timestamp is never wrong. So a
   * countdown reaching zero becomes a state change locally, and the next poll
   * merely picks up the counts. */
  const drop = useMemo(
    () => (facts
      ? describeDrop(facts.condition, facts.endsAt, BigInt(Math.floor(chainNow / 1000)), facts)
      : null),
    [facts, chainNow],
  );

  /* Chain time in seconds — the same value the contract compares against, and
   * the only clock a stage window may be judged by. */
  const nowSec = Math.floor(chainNow / 1000);

  /* The stage this wallet can mint from right now, and the next one it holds.
   * Derived every tick, like everything else here: a stage opening under a
   * visitor is a state change on this page, not a reason to re-fetch. */
  const openStage = useMemo(() => liveStage(allow.stages, nowSec), [allow.stages, nowSec]);

  /* A stage that is live according to the PUBLIC schedule — no wallet needed.
   * `openStage` above is this wallet's; this one is the drop's, and it is what
   * lets the panel tell a visitor who has not connected that there is an
   * allowlist mint happening at all. */
  const liveOnSchedule = useMemo(
    () => (phases?.stages || []).find(
      (s) => windowStatus(Number(s.startTime || 0), Number(s.endTime || 0), nowSec) === "live",
    ) || null,
    [phases, nowSec],
  );
  const soonStage = useMemo(() => nextStage(allow.stages, nowSec), [allow.stages, nowSec]);

  /* Units taken in THIS stage. Counted per stage on chain, so it must be read
   * per stage — a wallet holding both a GTD and an FCFS allocation spends them
   * independently, and neither shows up in the public phase's tally. */
  const [stageClaimed, setStageClaimed] = useState(0n);
  const openStageIndex = openStage?.stageIndex ?? null;
  useEffect(() => {
    if (!account || !openStageIndex) { setStageClaimed(0n); return undefined; }
    let on = true;
    readStageClaimedBy(openStageIndex, account)
      .then((v) => { if (on) setStageClaimed(v); })
      .catch(() => {});
    return () => { on = false; };
  }, [account, openStageIndex, mintedAt]);

  const stage = useMemo(
    () => (openStage && facts
      ? describeStage({
          stage: openStage,
          stageClaimed,
          minted: facts.minted,
          lazySupply: facts.lazySupply,
          dropEndsAt: facts.endsAt,
          now: nowSec,
        })
      : null),
    [openStage, stageClaimed, facts, nowSec],
  );

  /* Which set of terms the button spends. A live stage wins: claimAllowlist
   * never consults the public condition, so while a stage is open its price and
   * its cap are simply the ones that apply. */
  const active = useMemo(
    () => (stage?.open ? stage : (drop?.open ? { kind: "public", ...drop, claimed } : null)),
    [stage, drop, claimed],
  );

  /* Poll while there is anything left to change. A sold-out or ended drop is
   * terminal, so stop bothering the RPC once it gets there. A drop that opens
   * in more than ten minutes changes nothing until then, so poll it slowly. A
   * tab nobody is looking at does not poll at all, and catches up the moment
   * it is looked at again. */
  /* Something can still change if a public phase is configured, if this wallet
   * holds a stage, or if the schedule shows stages at all — that last one
   * matters for a stages-only drop seen by a visitor who has not connected,
   * where the condition is all zeros and would otherwise read as inert. */
  const shouldPoll = (!!drop?.configured || allow.stages.length > 0 || (phases?.stages?.length ?? 0) > 0)
    && !(drop && isTerminal(drop));
  const farOff = !!drop && !drop.started && Number(drop.startsAt) * 1000 - chainNow > 600_000;
  const pollMs = farOff ? POLL_MS * 3 : POLL_MS;
  useEffect(() => {
    if (!shouldPoll) return undefined;
    const tick = () => { if (document.visibilityState !== "hidden") refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const id = setInterval(tick, pollMs);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [shouldPoll, pollMs, refresh]);

  /* When the phase opens under a visitor, fetch the counts once, right then —
   * not on every render while the cache is stale. */
  const wasStarted = useRef(null);
  useEffect(() => {
    const started = drop ? drop.started : null;
    if (wasStarted.current === false && started === true) refresh();
    wasStarted.current = started;
  }, [drop, refresh]);

  /* One-second tick, only while something is actually counting down. */
  const ticking = (!!drop && drop.configured && (!drop.started || (drop.endsAt !== 0n && !drop.ended)))
    || !!soonStage
    || (!!stage && (!stage.started || (stage.endsAt !== 0n && !stage.ended)));
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const opensIn = drop && drop.configured && !drop.started ? countdown(drop.startsAt, chainNow) : null;
  const endsIn = drop && drop.endsAt !== 0n && !drop.ended ? countdown(drop.endsAt, chainNow) : null;

  /* A stage's own clock, which is not the drop's: a stage can close hours
   * before the drop does, and the number beside the button has to be the one
   * that will actually stop this wallet minting. */
  const stageOpensIn = soonStage ? countdown(Number(soonStage.params.startTime), chainNow) : null;
  const stageEndsIn = stage?.open && stage.endsAt !== 0n ? countdown(stage.endsAt, chainNow) : null;

  /* How many this wallet may still take in one go — against whichever terms
   * are live, since a stage's cap and the public phase's are separate counters
   * and only one of them is being spent. */
  const max = useMemo(() => {
    if (stage?.open) return maxForStage(stage, BATCH_CAP);
    if (!drop) return 1;
    const left = drop.capPerWallet === null
      ? BATCH_CAP
      : Number(drop.capPerWallet > claimed ? drop.capPerWallet - claimed : 0n);
    return Math.max(1, Math.min(left, Number(drop.remaining), BATCH_CAP));
  }, [stage, drop, claimed]);

  /* Supply drains and caps fill while the page is open. Without this the picker
   * keeps a number the contract will now reject. */
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), max));
  }, [max]);

  /* Opens the AppKit picker. The connected account then arrives through
   * useAccount — nothing here waits on it. */
  const connect = async () => {
    setError(null);
    try {
      await openWallet();
    } catch (e) { setError(readableError(e)); }
  };

  const switchChain = async () => {
    setError(null);
    try {
      await switchChainAsync({ chainId: CHAIN.id });
    } catch (e) { setError(readableError(e)); }
  };

  /* The calldata for whatever is live, built without touching the network so
   * it can be produced inside a tap handler.
   *
   * One or the other, never a blend: a stage claim carries its own proven price
   * and pays it from the leaf, while the public claim reads the price off the
   * chain. Building the wrong one for the live phase reverts. */
  const buildTx = useCallback(() => (
    active?.kind === "stage"
      ? buildAllowlistClaimTx({ account, stage: active.stage, quantity })
      : buildClaimTx({ account, drop, quantity })
  ), [active, account, drop, quantity]);

  /*
   * The pre-flight, run AHEAD of the tap rather than inside it.
   *
   * Simulating a claim before opening the wallet is what stops a doomed mint
   * costing gas, and it stays. What moved is when: on a phone, an `await`
   * between the tap and the wallet request is fatal. Waking a wallet app means
   * leaving the browser, and iOS only permits that while the user's tap is
   * still "active" — a few hundred milliseconds. An eth_call over cellular
   * spends that budget, the hand-off is silently refused, and the page sits on
   * "CONFIRM IN WALLET…" while nothing opens. The user is left tapping a
   * button that already worked.
   *
   * So the verdict is computed whenever the inputs change and kept in a ref.
   * A tap with a fresh verdict calls the wallet with nothing awaited in front
   * of it. Anything else — no verdict yet, or one that failed — falls back to
   * the old path, which is correct precisely because it does NOT need to reach
   * the wallet.
   */
  const canPreflight = !!(active && account && !(isConnected && chainId !== CHAIN.id));

  /* Everything the verdict depends on EXCEPT the quantity — the wallet, the
   * live phase and its price. Quantity is handled separately below, because a
   * verdict at one quantity says something about the others. */
  const shapeKey = canPreflight
    ? `${active.kind}:${active.stageIndex ?? "public"}:${account}:${String(active.price)}`
    : null;

  /* { shape, okUpTo } — the largest quantity known to pass for this shape.
   *
   * Every quantity-dependent check the contract makes is monotonic: the
   * per-wallet cap, the stage watermark, the lazy-minted ceiling, and the exact
   * msg.value all move one way with quantity. So a pass at 3 is a pass at 1,
   * and stepping DOWN never needs another call. Only stepping up does. */
  const preflight = useRef(null);
  const verdictCovers = (q) =>
    preflight.current?.shape === shapeKey && preflight.current.okUpTo >= q;

  useEffect(() => {
    if (!shapeKey) { preflight.current = null; return undefined; }

    const held = preflight.current;
    /* Already answered for this quantity — no call, no wait, no flicker. */
    if (held?.shape === shapeKey && held.okUpTo >= quantity) return undefined;

    /* A new shape has no verdict at all, and the commonest flow of the whole
     * page is: arrive, tap MINT. Debouncing THAT guarantees the first tap is
     * the slow one, so it runs immediately; only the stepper is debounced,
     * and briefly, since it is the only thing that fires in a burst. */
    const fresh = !held || held.shape !== shapeKey;
    if (fresh) preflight.current = { shape: shapeKey, okUpTo: 0 };

    let on = true;
    const q = quantity;
    const id = setTimeout(() => {
      simulateClaim(buildTx()).then(
        () => {
          if (!on || preflight.current?.shape !== shapeKey) return;
          preflight.current.okUpTo = Math.max(preflight.current.okUpTo, q);
        },
        () => {
          /* Deliberately not recorded as a failure. A revert at q says nothing
           * about q-1, and the tap's own simulation reports the reason
           * accurately — better to take the slow path than to cache a "no"
           * that might be wrong for the number they settle on. */
        },
      );
    }, fresh ? 0 : 200);

    return () => { on = false; clearTimeout(id); };
    // buildTx is derived from exactly the values these two are built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, quantity]);

  /* Everything after the wallet has taken the request. Split out so the tap
   * handler itself can stay synchronous up to the send. */
  /*
   * A mint in flight, as the CHAIN will know it.
   *
   * `run` rises on every attempt so a stale continuation cannot overwrite a
   * newer one, and `before` is the wallet's count for the live phase as it
   * stood the instant before sending — the number that going up means "this
   * landed", whatever the transport did or did not tell us.
   */
  const pending = useRef(null);
  const run = useRef(0);

  const follow = useCallback(async (sent, tx, id) => {
    try {
      const hash = await sent;
      /* The watcher below already saw this land on chain and moved on. The
       * response arriving afterwards is just late news. */
      if (run.current !== id) return;
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
      pending.current = null;
      refresh();
    } catch (e) {
      if (run.current !== id) return;
      setError(readableError(e));
      setPhase("idle");
      pending.current = null;
    }
  }, [refresh]);

  /* The wallet's on-chain count for the live phase, recorded as the baseline
   * for this attempt. If the read fails the baseline stays null and the
   * watcher simply never fires — the ordinary promise path still works, and
   * nothing is claimed that was not observed. */
  const readBaseline = useCallback(async (id) => {
    const p = pending.current;
    if (!p || p.id !== id || !account) return;
    try {
      const v = p.kind === "stage"
        ? await readStageClaimedBy(p.stageIndex, account)
        : await readClaimedBy(account);
      if (pending.current?.id === id) pending.current.before = v;
    } catch {
      /* Unknown baseline: the watcher stays out of it. */
    }
  }, [account]);

  const send = useCallback((tx) => sendTransactionAsync({
    account,
    chainId: CHAIN.id,
    to: tx.to,
    data: tx.data,
    ...(tx.value ? { value: BigInt(tx.value) } : {}),
  }), [account, sendTransactionAsync]);

  /* Deliberately NOT async. The fast path below must reach the wallet in the
   * same turn as the tap, and an async function that awaits first would give
   * that up even if nothing before the await did any work. */
  const mint = () => {
    setError(null);
    setTxHash(null);
    const tx = buildTx();

    /* The count this mint has to beat for the watcher below to call it landed.
     * Left null until the chain answers, and the watcher waits for it: the
     * number in React state can lag, and a baseline that is too LOW would
     * declare a mint that never happened. Missing a success is recoverable —
     * claiming a false one is not. */
    const id = (run.current += 1);
    pending.current = { id, before: null, kind: active?.kind, stageIndex: active?.stageIndex ?? null };

    if (verdictCovers(quantity)) {
      setPhase("wallet");
      follow(send(tx), tx, id);
      /* After the send, never before it — this is a network read, and in front
       * of the wallet call it would cost the tap's activation on iOS. */
      readBaseline(id);
      return;
    }

    /* No usable verdict. Simulate now — slower, and it will likely cost the
     * app-switch on a phone, but it is the branch where the answer is usually
     * "this would have reverted" and the wallet is never needed. */
    (async () => {
      try {
        setPhase("checking");
        await simulateClaim(tx);
        setPhase("wallet");
        const sent = send(tx);
        readBaseline(id);
        await follow(sent, tx, id);
      } catch (e) {
        setError(readableError(e));
        setPhase("idle");
      }
    })();
  };

  /*
   * Did it land while we were not looking?
   *
   * On a phone the mint is confirmed in another app. Safari suspends this page
   * while that happens, the WalletConnect relay socket goes with it, and the
   * response can be lost on the way back — so `await sent` never settles and
   * the button says CONFIRM IN WALLET for as long as the page is open, for a
   * mint that already succeeded. Reported from a real phone.
   *
   * The wallet's on-chain count for the live phase does not care about any of
   * that. If it has gone up since the moment before sending, the mint landed.
   * That is checked the instant the page is looked at again, which is exactly
   * when someone comes back from their wallet, and on a slow interval so a
   * desktop wallet that answers into a dropped socket recovers too.
   *
   * There is no transaction hash down this path — the response carrying it is
   * what went missing — so the success reads as MINTED without a receipt link
   * rather than inventing one.
   */
  useEffect(() => {
    if (phase !== "wallet" || !account) return undefined;
    let on = true;

    const check = async () => {
      const p = pending.current;
      /* before === null means the baseline read has not answered yet. Without
       * it there is nothing to compare against, so wait rather than guess. */
      if (!on || !p || p.before === null || run.current !== p.id) return;
      try {
        const now = p.kind === "stage"
          ? await readStageClaimedBy(p.stageIndex, account)
          : await readClaimedBy(account);
        if (!on || run.current !== p.id || now <= p.before) return;
        run.current += 1;          // the pending continuation is now stale
        pending.current = null;
        setPhase("done");
        setMintedAt(Date.now());
        refresh();
      } catch {
        /* A failed read means we still do not know. Say nothing and try again. */
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(check, 4000);
    return () => {
      on = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, account, refresh]);

  /*
   * The way out. A rejected request whose rejection never arrives leaves the
   * panel waiting on something that is never coming, and the watcher above
   * only rescues the case where the mint SUCCEEDED. After a while, offer the
   * button back rather than leaving someone stuck at a dead end.
   */
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    if (phase !== "wallet") { setWaitedLong(false); return undefined; }
    const id = setTimeout(() => setWaitedLong(true), 20_000);
    return () => clearTimeout(id);
  }, [phase]);

  const giveUp = () => {
    run.current += 1;
    pending.current = null;
    setPhase("idle");
    setError(null);
  };

  /* While the wallet holds the request, offer a way into it. Resolved when the
   * request goes out rather than on demand, so the button itself is a plain
   * link the tap can follow immediately. */
  const [walletLink, setWalletLink] = useState(null);
  useEffect(() => {
    if (phase !== "wallet") { setWalletLink(null); return undefined; }
    let on = true;
    walletDeepLink().then((link) => { if (on) setWalletLink(link); });
    return () => { on = false; };
  }, [phase]);

  /*
   * Is the real mint control on screen?
   *
   * The sticky bar exists to carry the button down the page, so it must appear
   * only once the button it duplicates has gone. Watching the control itself
   * means that is exact at any viewport, with no scroll maths and no guess at
   * where the fold is.
   */
  /* A callback ref, not useRef: a ref object does not tell a hook when it gets
   * filled, so the effect would have to run after EVERY render to notice — and
   * this component re-renders once a second for the countdown, which would mean
   * building and tearing down an observer every second for the life of the
   * page. This way it runs when the node actually changes, and no more. */
  const [ctaNode, setCtaNode] = useState(null);
  const [ctaSeen, setCtaSeen] = useState(true);
  useEffect(() => {
    if (!ctaNode || typeof IntersectionObserver === "undefined") {
      setCtaSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => setCtaSeen(e.isIntersecting), { threshold: 0 });
    io.observe(ctaNode);
    return () => io.disconnect();
  }, [ctaNode]);

  /* The bar is fixed, so it sits ON the page rather than in it. Without room
   * reserved underneath it covers the last line of the footer. */
  const barShown = !!active && !ctaSeen;

  /*
   * Hold the bar against the bottom of what the visitor can actually SEE.
   *
   * `position: fixed` resolves against the LAYOUT viewport, but what is on
   * screen is the VISUAL viewport, and on iOS Safari those come apart
   * constantly — a slight pinch-zoom, the toolbars expanding or collapsing, a
   * momentum scroll still settling. While they differ, `bottom: 0` paints
   * where the layout viewport ends, which is above the visible bottom: the bar
   * appears stranded in the middle of the screen, over the page, with the real
   * control still visible below it.
   *
   * Safari publishes the discrepancy, so it can simply be subtracted. On every
   * other browser visualViewport either matches the layout viewport or does
   * not exist, the offset is 0, and this does nothing.
   */
  const [barNode, setBarNode] = useState(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!barNode || !vv) return undefined;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const gap = document.documentElement.clientHeight - (vv.height + vv.offsetTop);
      barNode.style.transform = gap > 1 ? `translateY(${-gap}px)` : "";
    };
    /* These fire through a pinch and through every scroll frame, so the write
     * is coalesced to one per frame. */
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
    };
  }, [barNode]);
  useEffect(() => {
    if (!barShown || !barNode) return undefined;
    const previous = document.body.style.paddingBottom;
    /* Measured, not guessed: the bar is one row on a desktop and two on a
     * phone, and a fixed number is wrong on one of them. */
    document.body.style.paddingBottom = `${barNode.offsetHeight}px`;
    return () => { document.body.style.paddingBottom = previous; };
  }, [barShown, barNode]);

  /* ---- states that are not a mint button ---- */

  /* Progress is the DROP's progress, not one phase's. While a public condition
   * is configured its own counters are the familiar figures and stay; a
   * stages-only drop has an all-zero condition, so the contract-wide totals are
   * the only honest source. */
  /* The bar is the DROP's progress, never one phase's slice of it — the
   * question it answers is "how much of the collection is gone". */
  const progress = facts && facts.lazySupply > 0n
    ? { minted: facts.minted, supply: facts.lazySupply }
    : (drop?.configured ? drop : null);

  /* Why this wallet is being shown a closed door rather than a stage. Only ever
   * about the allowlist — the public phase explains itself below. */
  const listNote = allow.failed
    ? "the allowlist could not be checked — reload to try again"
    : account
      ? ineligibleNote(allow.reason)
      : (phases?.stages?.length ? "connect your wallet to check the allowlist" : null);

  /* Every closed/holding state still shows how far the drop got and what the
   * schedule is — "MINT NOT OPEN YET" beside a list of when it opens is the
   * answer to the question people actually have. */
  const shell = (headline, note) => (
    <div className={styles.mint}>
      <div className={styles.mintClosed}>{headline}</div>
      {note && <p className={styles.note}>{note}</p>}
      <Progress drop={progress} />
      <Phases drop={drop} phases={phases} chainNow={chainNow} />
    </div>
  );

  /* The same shell, but with the wallet button — for the states whose whole
   * point is that connecting is what resolves them. A closed sign whose fix is
   * one tap away should carry the tap. */
  const connectShell = (headline, note) => (
    <div className={styles.mint}>
      <div className={styles.stageBanner}>{headline}</div>
      {note && <p className={styles.note}>{note}</p>}
      <Progress drop={progress} />
      <button type="button" className={styles.cta} onClick={connect}>CONNECT WALLET</button>
      <Phases drop={drop} phases={phases} chainNow={chainNow} />
    </div>
  );

  if (!CONTRACT) return shell("MINT OPENS SOON", "2048 pieces · stored on Arweave, forever");
  if (!drop) return shell(error || "READING THE CHAIN…");

  /* Nothing is mintable by this wallet right now. A stage it holds is the most
   * useful thing to say — it outranks anything about the public phase, because
   * claimAllowlist never consults the public condition and a wallet on the list
   * does not care that the open phase has not started. */
  if (!active) {
    const stageName = (s) => (s?.name || `stage ${s?.stageIndex}`).toLowerCase();

    if (stage?.spent) {
      return shell(`YOU'VE MINTED YOUR ${String(stage.capPerWallet)}`, `${stageName(stage)} · your allocation is spent`);
    }
    if (stage?.soldOut) return shell("STAGE SOLD OUT", `${stageName(stage)} has nothing left`);
    if (stage?.nobodyMayMint) return shell("STAGE CLOSED", `${stageName(stage)} is live but claiming is closed`);
    if (soonStage) {
      return shell(
        stageOpensIn ? `YOUR STAGE OPENS IN ${stageOpensIn}` : "YOUR STAGE OPENS…",
        `${stageName(soonStage)} · you are on the list`,
      );
    }

    if (drop.ended) {
      /* Counters from whichever record actually has them: a stages-only drop's
       * condition is all zeros, and "0 of 0 minted" is worse than saying
       * nothing. */
      return shell("MINT CLOSED", progress ? `${String(progress.minted)} of ${String(progress.supply)} minted` : null);
    }

    /* An allowlist stage is running. Eligibility is per wallet and cannot be
     * known before one is connected, so say what IS true — the mint is open,
     * to a list — and offer the tap that answers it. Anything else reads as a
     * closed door directly above a row marked LIVE, which is the state that
     * confused people. */
    if (liveOnSchedule && !account) {
      return connectShell(
        `${(liveOnSchedule.name || `STAGE ${liveOnSchedule.stageIndex}`).toUpperCase()} IS LIVE — ALLOWLIST ONLY`,
        `${formatEth(BigInt(liveOnSchedule.pricePerToken || 0))} · connect to check if you're on the list`,
      );
    }

    /* Connected, and the answer is no. Worth stating plainly rather than as
     * "MINT NOT OPEN YET", which reads as a clock problem the visitor should
     * wait out. */
    if (liveOnSchedule && allow.reason === "not_allowlisted") {
      return shell(
        "ALLOWLIST ONLY RIGHT NOW",
        `this wallet is not on the list for ${stageName(liveOnSchedule)}${
          drop.configured && !drop.started && opensIn ? ` · public mint opens in ${opensIn}` : ""
        }`,
      );
    }

    /* The allowlist could not be reached. Never let that read as "not on the
     * list" — it is a question we failed to ask, not an answer. */
    if (liveOnSchedule && allow.failed) {
      return shell("COULD NOT CHECK THE ALLOWLIST", "reload to try again");
    }
    if (!drop.configured) return shell("MINT NOT OPEN YET", listNote || "the drop is deployed, the phase is not live");
    if (drop.soldOut) return shell("SOLD OUT", `all ${String(drop.supply)} gone`);
    if (drop.nobodyMayMint) return shell("MINT NOT OPEN YET", "the phase is live but claiming is closed");
    if (!drop.started) {
      return shell(
        opensIn ? `OPENS IN ${opensIn}` : "OPENING…",
        listNote || `${String(drop.supply)} pieces · ${formatEth(drop.price)} each`,
      );
    }
    /* Open on chain, closed to this wallet: it has taken its per-wallet cap. */
    return shell(`YOU'VE MINTED YOUR ${String(drop.capPerWallet)}`, listNote);
  }

  const wrongChain = isConnected && chainId !== CHAIN.id;
  const onStage = active.kind === "stage";
  const cap = active.capPerWallet;
  const total = active.price * BigInt(quantity);

  /* A stage's counters are the stage's. Its "minted" is the drop's, though —
   * the watermark it is bounded by is measured over everything ever minted, so
   * the public phase's tally would understate what is gone. */
  const shownMinted = onStage ? (facts?.minted ?? 0n) : drop.minted;

  const cta = {
    checking: "CHECKING…",
    wallet: "CONFIRM IN WALLET…",
    pending: "MINTING…",
  }[phase] || `MINT ${quantity} — ${formatEth(total)}`;

  return (
    <div className={styles.mint}>
      {onStage && (
        <div className={styles.stageBanner}>
          {active.name}{active.label !== active.name ? ` · ${active.label}` : ""} — YOU&rsquo;RE IN
        </div>
      )}
      <div className={styles.mintStats}>
        <div><b>{String(shownMinted)}</b><span>MINTED</span></div>
        {/* null = the drop's total could not be read, which is not the same as
            nothing left. Say nothing rather than a number that is wrong. */}
        <div><b>{active.remaining === null ? "—" : String(active.remaining)}</b><span>LEFT</span></div>
        <div><b>{formatEth(active.price)}</b><span>EACH</span></div>
      </div>
      <Progress drop={progress} />

      {/* The observer watches this WHOLE block, not just the mint branch. What
          it is really asking is "can the visitor act from here?", and for
          someone who has not connected the answer is the CONNECT button —
          which is exactly the person the bar is for. Watching only the mint
          branch left them with no bar at all. */}
      <div ref={setCtaNode}>
        {!account ? (
          <button type="button" className={styles.cta} onClick={connect}>CONNECT WALLET</button>
        ) : wrongChain ? (
          <button type="button" className={styles.cta} onClick={switchChain}>
            SWITCH TO {CHAIN.name.toUpperCase()}
          </button>
        ) : cap && active.claimed >= cap ? (
          <div className={styles.mintClosed}>YOU&rsquo;VE MINTED YOUR {String(cap)}</div>
        ) : (
          <>
            <div className={styles.qty}>
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={busy || quantity <= 1} aria-label="One fewer">−</button>
              <b>{quantity}</b>
              <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={busy || quantity >= max} aria-label="One more">+</button>
              {/* Stepping to a per-wallet cap of fifty one press at a time is
                  not a thing anyone should be asked to do. Hidden when the cap
                  is one, where it would be a button that does nothing. */}
              {max > 1 && (
                <button
                  type="button"
                  className={styles.qtyMax}
                  onClick={() => setQuantity(max)}
                  disabled={busy || quantity >= max}
                  aria-label={`Mint the maximum, ${max}`}
                >
                  MAX {max}
                </button>
              )}
            </div>
            <button type="button" className={styles.cta} onClick={mint} disabled={busy}>{cta}</button>
          </>
        )}
      </div>

      {/* The request is with the wallet, which on a phone is another app that
          may not have come forward on its own. A link the user presses is the
          one hand-off the OS always honours, since the press is a gesture.

          Same tab, no target: a wallet's own scheme (metamask://) is
          intercepted by the OS before any navigation happens, and the page is
          still here underneath when they come back, whereas opening a tab
          first adds a step iOS sometimes refuses outright. The link comes from
          the connected session, so that wallet is definitely installed. */}
      {phase === "wallet" && (
        walletLink ? (
          <a className={styles.mintPending} href={walletLink}>
            OPEN WALLET TO SIGN ↗
          </a>
        ) : (
          /* No deep link — an injected wallet, an in-wallet browser, or a
             session that carries no redirect. Still say what is being waited
             on, because the CTA going quiet is not an instruction. */
          <p className={styles.mintPending}>WAITING FOR YOU TO SIGN IN YOUR WALLET…</p>
        )
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
      {/* Confirmed by reading the chain rather than by the wallet's reply, so
          there is no hash to link. Still a mint, and said so. */}
      {phase === "done" && !txHash && <div className={styles.mintOk}>MINTED ✓</div>}
      {txHash && phase === "failed" && (
        <a className={styles.mintPending} href={explorerTx(txHash)} target="_blank" rel="noreferrer">
          TRANSACTION FAILED ↗
        </a>
      )}

      {/* Waiting on a wallet that may never answer — a rejection that got lost
          on the way back leaves this pending forever. Hand the button back. */}
      {phase === "wallet" && waitedLong && (
        <button type="button" className={styles.mintReset} onClick={giveUp}>
          NOTHING HAPPENED? TAP TO TRY AGAIN
        </button>
      )}

      {error && <p className={styles.mintErr}>{error}</p>}
      <p className={styles.note}>
        {cap ? `max ${String(cap)} per wallet · ` : ""}
        {onStage
          ? (stageEndsIn ? `stage ends in ${stageEndsIn} · ` : "")
          : (endsIn ? `ends in ${endsIn} · ` : "")}
        on {CHAIN.name} · art on Arweave, forever
      </p>
      <Phases drop={drop} phases={phases} chainNow={chainNow} />

      {/* The same handlers as the control above — not a second implementation
          of the mint, just a second place to reach it. In particular it calls
          the same `mint`, so the tap still lands on the wallet with nothing
          awaited in front of it. */}
      {/*
        * Rendered into <body>, not here.
        *
        * `position: fixed` is only viewport-relative while NOTHING in the
        * ancestor chain is a containing block for it, and a great many
        * ordinary properties are — transform, filter, backdrop-filter,
        * perspective, contain, will-change — as is `overflow` on iOS Safari in
        * its own way. The panel sits several wrappers deep inside a hero that
        * has a sticky column and a shell that hides overflow-x, and on iOS the
        * bar came out pinned to the middle of the screen, on top of the mint
        * stats, with the real button visible below it.
        *
        * Chasing which ancestor did it would fix today's chain and break on
        * the next wrapper anyone adds. A portal has no ancestor chain to
        * chase.
        */}
      {barShown && typeof document !== "undefined" && createPortal(
        <div className={styles.bar} ref={setBarNode}>
          {/* An inner track so the bar's CONTENT stops at the page's width on
              a wide monitor, while its background still runs edge to edge. */}
          <div className={styles.barInner}>
          <div className={styles.barFacts}>
            {onStage ? `${active.name} · ${formatEth(active.price)}` : `${formatEth(active.price)} each`}
            {active.remaining === null ? " · allowlist mint" : ` · ${String(active.remaining)} left`}
            {onStage && stageEndsIn ? ` · ends in ${stageEndsIn}` : ""}
            {!onStage && endsIn ? ` · ends in ${endsIn}` : ""}
          </div>

          <div className={styles.barRow}>
            {/* The bar carried a button that always minted one. Someone who
                scrolled past the panel had to scroll back to buy two, which is
                the opposite of what a bar following them down the page is for.
                Only shown when there is a choice to make. */}
            {account && !wrongChain && !(cap && active.claimed >= cap) && max > 1 && (
              <div className={styles.barQty}>
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={busy || quantity <= 1} aria-label="One fewer">−</button>
                <b>{quantity}</b>
                <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={busy || quantity >= max} aria-label="One more">+</button>
                <button type="button" className={styles.barMax} onClick={() => setQuantity(max)} disabled={busy || quantity >= max} aria-label={`Mint the maximum, ${max}`}>
                  MAX
                </button>
              </div>
            )}

            {!account ? (
              <button type="button" className={styles.barCta} onClick={connect}>CONNECT</button>
            ) : wrongChain ? (
              <button type="button" className={styles.barCta} onClick={switchChain}>SWITCH CHAIN</button>
            ) : cap && active.claimed >= cap ? (
              <button type="button" className={styles.barCta} disabled>MINTED ✓</button>
            ) : phase === "wallet" ? (
              /* The request is with the wallet. The bar used to show a greyed
                 out button reading CONFIRM IN WALLET and nothing else, which on
                 a phone is a dead end: the wallet is a different app, it may
                 not have come forward, and this is where the tap came from. */
              walletLink ? (
                <a className={styles.barCta} href={walletLink}>OPEN WALLET TO SIGN ↗</a>
              ) : (
                <button type="button" className={styles.barCta} disabled>SIGN IN YOUR WALLET…</button>
              )
            ) : (
              <button type="button" className={styles.barCta} onClick={mint} disabled={busy}>{cta}</button>
            )}
          </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
