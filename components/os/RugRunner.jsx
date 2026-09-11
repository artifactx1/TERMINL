import { useEffect, useMemo, useRef, useState } from "react";
import { END_TICK, MIN_BANK_TICK, TICK_MS, newGame, stepGame, price, replayRun } from "../../lib/rug-run.mjs";
import s from "../../styles/OS.module.css";

const W = 540, H = 430;
const xFor = lane => 90 + lane * 180;
const number = n => Math.floor(n).toLocaleString("en-US");

function draw(ctx, game, sprite, ghost, accent, intro) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#060b08"; ctx.fillRect(0, 0, W, H);
  // A scrolling CRT trading floor; three unmistakable playable lanes.
  ctx.strokeStyle = "#14281a"; ctx.lineWidth = 1;
  for (let y = (game.tick * 2) % 38; y < H; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (const x of [0, 180, 360, 540]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.fillStyle = "#7dff5c05"; ctx.fillRect(game.lane * 180 + 1, 0, 178, H);
  ctx.fillStyle = "#19321e"; ctx.font = "10px monospace"; ctx.textAlign = "center";
  ["BUY THE DIP", "TRUST THE DEV", "EXIT LIQUIDITY"].forEach((text, i) => ctx.fillText(text, xFor(i), 22));
  const items = intro ? [
    { lane: 0, kind: "green", born: 0, hitAt: 80 }, { lane: 1, kind: "red", born: -15, hitAt: 75 },
    { lane: 2, kind: "gold", born: -25, hitAt: 60 }, { lane: 0, kind: "red", born: -45, hitAt: 60 },
  ] : game.items;
  for (const item of items) {
    const progress = intro ? (35 - item.born) / (item.hitAt - item.born) : (game.tick - item.born) / (item.hitAt - item.born);
    const x = xFor(item.lane), y = 44 + progress * (H - 125);
    const color = item.kind === "red" ? "#ff6a5e" : item.kind === "shield" ? "#8bddff" : item.kind === "gold" ? "#ffc65c" : accent;
    ctx.shadowBlur = 17; ctx.shadowColor = color; ctx.fillStyle = color;
    if (item.kind === "shield") {
      ctx.beginPath(); ctx.moveTo(x, y-20); ctx.lineTo(x+17,y-12); ctx.lineTo(x+13,y+12); ctx.lineTo(x,y+24);ctx.lineTo(x-13,y+12);ctx.lineTo(x-17,y-12);ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
      ctx.font="bold 17px monospace";ctx.fillText("S",x,y+6);
    } else {
      ctx.fillRect(x-2,y-28,4,58); ctx.fillRect(x-15,y-16,30,34);
      ctx.shadowBlur=0;ctx.fillStyle="#061003";ctx.font="bold 18px monospace";ctx.fillText(item.kind === "red" ? "×" : item.kind === "gold" ? "★" : "+",x,y+8);
    }
    ctx.shadowBlur=0;
  }
  if (ghost && ghost.tick > 0 && !ghost.ended) {
    ctx.globalAlpha=.22; ctx.fillStyle="#c2b5f2"; ctx.fillRect(xFor(ghost.lane)-24,H-100,48,66); ctx.globalAlpha=1;
    ctx.fillStyle="#c2b5f2";ctx.font="8px monospace";ctx.fillText("RIVAL",xFor(ghost.lane),H-110);
  }
  const x=xFor(game.lane), y=H-82;
  ctx.shadowBlur=17;ctx.shadowColor=accent;ctx.fillStyle="#7dff5c20";ctx.fillRect(x-34,y+58,68,7);ctx.shadowBlur=0;
  if (game.shield) { ctx.strokeStyle="#8bddff";ctx.lineWidth=2;ctx.strokeRect(x-36,y-18,72,85); }
  if (sprite?.complete && sprite.naturalWidth) ctx.drawImage(sprite,x-26,y-13,52,86);
  else { ctx.fillStyle=accent;ctx.fillRect(x-14,y,28,48);ctx.fillRect(x-20,y+48,15,16);ctx.fillRect(x+5,y+48,15,16); }
  ctx.fillStyle=accent;ctx.font="bold 8px monospace";ctx.fillText("YOU",x,H-7);
  if (game.pulse) {
    const red=game.pulse.kind === "red";
    if(red){ctx.fillStyle="#ff3a2e16";ctx.fillRect(0,0,W,H);}
    ctx.fillStyle=red?"#ff6a5e":game.pulse.kind==="shield"?"#8bddff":accent;
    ctx.font="bold 14px monospace";ctx.fillText(game.pulse.text,W/2,60);
  }
}

export default function RugRunner({ run, active, onComplete, leave, sound }) {
  const canvas=useRef(null), stage=useRef(null), game=useRef(newGame(run.seed));
  const moves=useRef([]), sprite=useRef(null), audio=useRef(null), complete=useRef(false);
  const callbacks=useRef({onComplete,sound}); callbacks.current={onComplete,sound};
  const [phase,setPhase]=useState("ready"), phaseRef=useRef(phase); phaseRef.current=phase;
  const [view,setView]=useState(game.current), [coin,setCoin]=useState(run.coin || "COPE");
  const [count,setCount]=useState(3);
  const ghost=useRef(run.rivalRecord ? newGame(run.seed) : null), ghostIndex=useRef(0);
  const rivalScore=useMemo(()=>run.rivalRecord ? replayRun(run.rivalRecord).lastBankValue : 1000,[run.rivalRecord]);
  const coinRef=useRef(coin);coinRef.current=coin;

  const finish=() => {
    if(complete.current)return;
    complete.current=true;
    callbacks.current.onComplete({seed:run.seed,moves:moves.current.filter(m=>m.tick<game.current.tick),endTick:game.current.tick},coinRef.current);
  };
  const finishRef=useRef(finish);finishRef.current=finish;
  const move=lane=>{
    if(phaseRef.current!=="running")return;
    const state=game.current, next=Math.max(0,Math.min(2,lane));
    if(next===state.lane)return;
    game.current={...state,lane:next};
    const action={tick:state.tick,lane:next};
    if(moves.current.at(-1)?.tick===state.tick)moves.current[moves.current.length-1]=action;
    else moves.current.push(action);
  };
  const moveRef=useRef(move);moveRef.current=move;

  useEffect(()=>{
    const image=new window.Image();image.src=`/degens/${run.character || "margin-call-max"}.webp`;sprite.current=image;
    const paint=()=>{const ctx=canvas.current?.getContext("2d");if(ctx){ctx.setTransform(2,0,0,2,0,0);draw(ctx,game.current,sprite.current,null,getComputedStyle(stage.current).getPropertyValue("--accent").trim(),true);}};
    image.onload=paint;paint();
    return ()=>{image.onload=null; audio.current?.close();};
  },[run.character]);

  useEffect(()=>{
    if(phase!=="countdown")return;
    if(count===0){setPhase("running");return;}
    const timer=setTimeout(()=>setCount(count-1),700);
    return ()=>clearTimeout(timer);
  },[phase,count]);

  useEffect(()=>{
    if(!active && (phase==="running" || phase==="countdown"))setPhase("paused");
  },[active,phase]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden && ["running","countdown"].includes(phaseRef.current))setPhase("paused");};
    const key=e=>{
      if(e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
      if(phaseRef.current!=="running")return;
      if(["ArrowLeft","ArrowRight","a","d","A","D","p","P"].includes(e.key))e.preventDefault();
      if(["ArrowLeft","a","A"].includes(e.key))moveRef.current(game.current.lane-1);
      if(["ArrowRight","d","D"].includes(e.key))moveRef.current(game.current.lane+1);
      if(["p","P"].includes(e.key))setPhase("paused");
    };
    document.addEventListener("visibilitychange",visibility);window.addEventListener("keydown",key);
    return ()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("keydown",key);};
  },[]);

  useEffect(()=>{
    if(phase!=="running")return;
    let frame,last=performance.now(),accumulator=0,renderTick=-1;
    const ctx=canvas.current.getContext("2d"), accent=getComputedStyle(stage.current).getPropertyValue("--accent").trim();
    ctx.setTransform(2,0,0,2,0,0);
    const tick=now=>{
      accumulator+=Math.min(now-last,150);last=now;
      while(accumulator>=TICK_MS && !game.current.ended){
        game.current=stepGame(game.current);accumulator-=TICK_MS;
        if(ghost.current && ghost.current.tick<run.rivalRecord.endTick && !ghost.current.ended){
          const m=run.rivalRecord.moves[ghostIndex.current];
          if(m?.tick===ghost.current.tick){ghost.current.lane=m.lane;ghostIndex.current++;}
          ghost.current=stepGame(ghost.current);
        }
        if(game.current.pulse?.tick===game.current.tick && callbacks.current.sound){
          try{
            const Context=window.AudioContext||window.webkitAudioContext;
            const a=audio.current||(audio.current=new Context());a.resume().catch(()=>{});
            const o=a.createOscillator(),g=a.createGain();o.type="square";o.frequency.value=game.current.pulse.kind==="red"?90:440+game.current.combo*40;
            g.gain.setValueAtTime(.025,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.09);
            o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.09);
          }catch{/* Optional audio. */}
        }
      }
      draw(ctx,{...game.current,tick:game.current.tick+accumulator/TICK_MS},sprite.current,ghost.current,accent,false);
      if(game.current.tick!==renderTick){setView(game.current);renderTick=game.current.tick;}
      if(game.current.ended){finishRef.current();return;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[phase,run.rivalRecord]);

  const time=Math.max(0,45-view.tick/20), multiplier=Math.min(5,1+Math.floor(view.combo/4));
  const chartPath=view.prices.map((p,i)=>`${i?"L":"M"}${i*200/Math.max(1,view.prices.length-1)},${43-(p-Math.min(...view.prices))/(Math.max(...view.prices)-Math.min(...view.prices)||.01)*33}`).join(" ");
  return <section ref={stage} className={`${s.gameWindow} ${s.runner}`}>
    <div className={s.windowBar}><span>RUG_RUNNER.EXE / ${coin} / {run.rivalName ? "GHOST DUEL" : "DAILY ARCADE"}</span><button onClick={leave}>End run ×</button></div>
    <div className={s.runnerTitle}><div><h2>RUG RUNNER<span>DON&apos;T BE THE EXIT LIQUIDITY.</span></h2></div><button className={s.pauseButton} disabled={phase==="ready"||phase==="countdown"} onClick={()=>setPhase(phase==="paused"?"running":"paused")}>{phase==="paused"?"▶ RESUME":"Ⅱ PAUSE"}</button></div>
    <div className={s.runnerHud}><div><span>YOUR CASH-OUT VALUE</span><b>{number(view.lastBankValue)}<small> PTS</small></b></div><div><span>COMBO</span><b className={s.combo}>×{multiplier}</b></div><div><span>TIME LEFT</span><b>{time.toFixed(1)}<small>s</small></b></div><div><span>LIVES</span><b className={s.lives} aria-label={`${view.hp} lives remaining`}>{"♥".repeat(view.hp)}<i>{"♡".repeat(3-view.hp)}</i></b></div></div>
    <div className={s.runnerField}>
      <canvas ref={canvas} width={W*2} height={H*2} data-tick={view.tick} data-lane={view.lane} aria-label="Three-lane arcade. Move left or right to collect green candles and avoid red candles." tabIndex={0} onPointerDown={e=>{const rect=e.currentTarget.getBoundingClientRect();move(Math.floor((e.clientX-rect.left)/rect.width*3));}} />
      {phase==="ready" && <div className={s.runnerOverlay}><span className={s.eyebrow}>45 SECONDS IN THE TRENCHES</span><h3>Grab green.<br />Dodge red.<br /><em>Bank before the rug.</em></h3><div className={s.runnerLegend}><span><i className={s.greenCandle} /> BUILD YOUR BAG</span><span><i className={s.redCandle} /> LOSE A LIFE</span><span><i className={s.shieldPickup} /> BLOCK A HIT</span></div><p>← → or A / D to move. On mobile, tap a lane.<br />Cash out anytime after 5 seconds. Lose all 3 lives and your bag goes to zero.</p><label className={s.coinInput}>YOUR MEME COIN <span>$<input value={coin} readOnly={!!run.rivalRecord} maxLength={8} aria-label="Meme coin ticker" onChange={e=>setCoin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} /></span></label><button className={s.accentButton} onClick={()=>{setCoin(coin.length>=2?coin:"COPE");setPhase("countdown");stage.current.scrollIntoView({block:"start",behavior:"smooth"});}}>LET&apos;S GET REKT →</button><small>{run.rivalName ? `BEAT ${run.rivalName.toUpperCase()}: ${number(rivalScore)} PTS` : "TARGET: BANK 1,000 POINTS FOR A WIN"}</small></div>}
      {phase==="countdown" && <div className={s.countdownOverlay}><b>{count}</b><span>{count===3?"FIND YOUR LANE":count===2?"GREEN GOOD. RED BAD.":"PROTECT YOUR BAG."}</span></div>}
      {phase==="paused" && <div className={s.runnerOverlay}><span className={s.eyebrow}>THE MARKET CAN WAIT. FOR ONCE.</span><h3>Touching grass?</h3><p>Your run is paused. Your bag is safe.</p><button className={s.accentButton} onClick={()=>setPhase("running")}>BACK TO THE TRENCHES →</button></div>}
      <div className={s.fieldStatus}><span>{view.shield ? "◈ SHIELD ACTIVE" : "◇ NO SHIELD"}</span><span>{run.rivalName ? `${run.rivalName}: ${number(rivalScore)} PTS TO BEAT` : `${view.coins} CANDLES COLLECTED`}</span></div>
    </div>
    <div className={s.runnerControls}><button aria-label="Move left" disabled={phase!=="running"} onClick={()=>move(view.lane-1)}>← <span>LEFT</span></button><button className={s.bankButton} disabled={phase!=="running" || view.tick<MIN_BANK_TICK} onClick={finish}>{view.tick<MIN_BANK_TICK ? `BANK OPENS IN ${Math.ceil((MIN_BANK_TICK-view.tick)/20)}s` : `CASH OUT · ${number(view.lastBankValue)} PTS`}<small>LOCK YOUR SCORE & END THE RUN</small></button><button aria-label="Move right" disabled={phase!=="running"} onClick={()=>move(view.lane+1)}><span>RIGHT</span> →</button></div>
    <div className={`${s.marketStrip} ${view.feed.includes("ALERT")?s.marketAlert:""}`}><div><span>${coin} / SIMULATED BONDING CURVE</span><b>{price(view.pool).toFixed(5)} <small>PTS / TOKEN</small></b></div><svg viewBox="0 0 200 50" role="img" aria-label="Simulated token price history"><path d={chartPath} fill="none" stroke={view.feed.includes("RUG ALERT")?"#ff6a5e":"#7dff5c"} strokeWidth="2" /></svg><p>{view.feed}</p></div>
    <div className={s.runnerTip}>Green candles award token allocations. Buyers pump the price; sellers dump it. Your cash-out quote includes the curve&apos;s price impact and 1% selling fee. All fictional.</div>
  </section>;
}
