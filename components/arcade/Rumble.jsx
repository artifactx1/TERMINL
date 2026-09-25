import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createFight, stepFight, botInput, INPUT, MOVES, CHARACTERS, STAGES, RUMBLE_RULES_VERSION } from "../../lib/arcade/rumble-sim.mjs";
import { FINISHERS, FINISH_WINDOW_TICKS } from "../../lib/arcade/rumble-finishers.mjs";
import { FINISHER_SPRITES } from "../../lib/arcade/rumble-finisher-sprite-data.mjs";
import { drawRumble } from "../../lib/arcade/rumble-render";
import { RUMBLE_SPRITES } from "../../lib/arcade/rumble-sprites.mjs";
import { RumbleAudio } from "../../lib/arcade/rumble-audio";
import { RumbleClient } from "../../lib/arcade/rumble-client";
import { RUMBLE_ROSTER as ROSTER } from "../../lib/arcade/rumble-roster.mjs";
import TouchControls from './TouchControls';
import {DEFAULT_KEYS,ACTIONS,CONTROL_VERSION,savedRumbleKeys,keyLabel,keyboardIdentity} from '../../lib/arcade/rumble-controls.mjs';
import {CIRCUIT_KEY,newCircuit,readCircuit,circuitOpponent,circuitStage,circuitInput,advanceCircuit} from '../../lib/arcade/rumble-circuit.mjs';
import s from "../../styles/Rumble.module.css";

const LEVELS=[{id:"dead-mall",name:"Dead Mall Exchange",sub:"Room to breathe. Nowhere to cash out.",rule:"Wide arena · Spacing and corner pressure",image:"/arcade/dead-mall-v1.webp"},{id:"laundromat",name:"Liquidation Laundromat",sub:"Your portfolio is on the spin cycle.",rule:"Telegraphed steam boundaries · Watch your space",image:"/arcade/laundromat-v1.webp"}];
const FRAME=1000/60;
function parseInvitation(value){try{const url=new URL(value,window.location.origin);const params=new URLSearchParams(url.hash.slice(1));const code=params.get("room"),token=params.get("token");return code&&token?{code,token}:null;}catch{return null;}}
function safePrefs(){try{return JSON.parse(localStorage.getItem("terminl:rumble-prefs"))||{};}catch{return {};}}
function initialEndpoint(){return process.env.NEXT_PUBLIC_ARCADE_WS_URL||(["localhost","127.0.0.1"].includes(window.location.hostname)?"ws://localhost:4010":"");}

export default function Rumble({assetLabEnabled=false}){
  const [mode,setMode]=useState("menu"),[character,setCharacter]=useState("max"),[opponent,setOpponent]=useState("diamond"),[stage,setStage]=useState("dead-mall");
  const [name,setName]=useState("ANON"),[invite,setInvite]=useState(""),[connection,setConnection]=useState("offline");
  const [room,setRoom]=useState(null),[view,setView]=useState(null),[joined,setJoined]=useState(null),[result,setResult]=useState(null);
  const [notice,setNotice]=useState(""),[settings,setSettings]=useState(false),[movesOpen,setMovesOpen]=useState(false);
  const [paused,setPaused]=useState(false),[training,setTraining]=useState(false),[lesson,setLesson]=useState(0);
  const [touchReset,setTouchReset]=useState(0);
  const [circuit,setCircuit]=useState(null),[circuitSave,setCircuitSave]=useState(null);
  const circuitFinished=useRef(false);
  const [prefs,setPrefs]=useState({music:.12,sfx:.45,shake:false,reducedMotion:false,quality:"high",keys:DEFAULT_KEYS,controlsVersion:CONTROL_VERSION});
  const [prefsReady,setPrefsReady]=useState(false);
  const [rtt,setRtt]=useState(0),[assetError,setAssetError]=useState(false),[resume,setResume]=useState(null);
  const canvas=useRef(null),arena=useRef(null),images=useRef({}),audio=useRef(null),client=useRef(null),game=useRef(null);
  const state=useRef({mode,paused,training,lesson,prefs});state.current={mode,paused,training,lesson,prefs,circuit,settings,movesOpen};
  const finisherPulse=useRef(0);
  const input=useRef(0),keyboard=useRef(0),touch=useRef(0),pad=useRef(0),keys=useRef(new Map());
  const metrics=useRef({frames:0,totalMs:0,maxMs:0}),lastUI=useRef(0),lessonStart=useRef(0),matchId=useRef(null);
  const roster=ROSTER.find(r=>r.id===character);
  const bind=bit=>keyLabel(prefs.keys,bit);

  useEffect(()=>{
    const saved=safePrefs()||{};setPrefs(p=>({...p,...saved,keys:savedRumbleKeys(saved),controlsVersion:CONTROL_VERSION,reducedMotion:saved.reducedMotion??window.matchMedia("(prefers-reduced-motion: reduce)").matches}));
    setPrefsReady(true);
    try{setName(JSON.parse(localStorage.getItem("terminl-os:v2"))?.name||"ANON");const stored=JSON.parse(sessionStorage.getItem("terminl:rumble-session"));if(stored)setResume(stored);}catch{}
    if(parseInvitation(window.location.href))setInvite(window.location.href);
    try{setCircuitSave(readCircuit(localStorage.getItem(CIRCUIT_KEY)));}catch{}
    let disposed=false;
    const assets=[...LEVELS,...Object.entries(RUMBLE_SPRITES).map(([id,sheet])=>({id,image:sheet.src})),...Object.entries(FINISHER_SPRITES).map(([id,sheet])=>({id:`finisher-${id}`,image:sheet.src}))];
    for(const asset of assets){const image=new window.Image();image.onload=()=>{if(!disposed)images.current[asset.id]=image;};image.onerror=()=>{if(!disposed)setAssetError(true);};image.src=asset.image;}
    audio.current=new RumbleAudio();
    return ()=>{disposed=true;images.current={};client.current?.dispose({leave:false});audio.current?.dispose();};
  },[]);
  useEffect(()=>{if(!prefsReady)return;audio.current?.setVolumes({music:prefs.music,sfx:prefs.sfx});try{localStorage.setItem("terminl:rumble-prefs",JSON.stringify(prefs));}catch{}},[prefs,prefsReady]);
  useEffect(()=>{audio.current?.setPaused(mode==="menu"||(mode==="practice"&&paused));},[mode,paused]);
  const resetInput=()=>{finisherPulse.current=0;input.current=0;keyboard.current=0;touch.current=0;pad.current=0;keys.current.clear();client.current?.setInput(0);setTouchReset(n=>n+1);};
  const updateInput=()=>{const value=keyboard.current|touch.current|pad.current;if(value!==input.current){input.current=value;client.current?.setInput(value);}};
  const updateInputRef=useRef(updateInput);updateInputRef.current=updateInput;
  useEffect(()=>{
    const key=e=>{
      if(e.type==='keyup'){keys.current.delete(keyboardIdentity(e));keyboard.current=[...keys.current.values()].reduce((n,bit)=>n|bit,0);updateInputRef.current();return;}
      if(state.current.mode==="menu"||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey)return;
      if(e.key==="Escape"&&e.type==="keydown"){resetInput();if(state.current.mode==="practice")setPaused(v=>!v);return;}
      if(state.current.settings||state.current.movesOpen||state.current.mode==='practice'&&state.current.paused)return;
      const mapped=state.current.prefs.keys[e.key]||state.current.prefs.keys[e.key.toLowerCase()];if(!mapped)return;
      e.preventDefault();keys.current.set(keyboardIdentity(e),mapped);
      keyboard.current=[...keys.current.values()].reduce((n,bit)=>n|bit,0);updateInputRef.current();
    };
    const blur=()=>{resetInput();if(state.current.mode==="practice")setPaused(true);};
    const hidden=()=>{if(document.hidden)blur();};
    window.addEventListener("keydown",key);window.addEventListener("keyup",key);window.addEventListener("blur",blur);window.addEventListener("gamepaddisconnected",blur);document.addEventListener("visibilitychange",hidden);
    return ()=>{window.removeEventListener("keydown",key);window.removeEventListener("keyup",key);window.removeEventListener("blur",blur);window.removeEventListener("gamepaddisconnected",blur);document.removeEventListener("visibilitychange",hidden);};
  },[]);
  useEffect(()=>{
    if(mode==="menu")return;
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous;};
  },[mode]);
  useEffect(()=>{
    if(!canvas.current||!arena.current)return;
    const el=canvas.current,container=arena.current;let disposed=false;
    const resize=()=>{if(disposed||!el.isConnected||!container.isConnected)return;const rect=container.getBoundingClientRect();const dpr=Math.min(2,devicePixelRatio||1);el.width=Math.round(rect.width*dpr);el.height=Math.round(rect.height*dpr);};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    return ()=>{disposed=true;observer.disconnect();};
  },[mode,room?.phase]);
  useEffect(()=>{
    if(mode==="menu")return;
    let raf,last=performance.now(),accumulator=0;
    const frame=now=>{
      const elapsed=Math.min(100,now-last);last=now;const current=state.current;
      const controller=navigator.getGamepads?.()?.find?.(p=>p?.connected);
      if(controller&&!current.settings&&!current.movesOpen&&!(current.mode==='practice'&&current.paused)){let value=0;const down=i=>controller.buttons[i]?.pressed;const x=controller.axes[0]||0,y=controller.axes[1]||0;if(x<-.3||down(14))value|=1;if(x>.3||down(15))value|=2;if(y>.4||down(13))value|=8;if(down(0)||down(12))value|=4;if(down(2))value|=16;if(down(3))value|=32;if(down(1))value|=64;if(down(4))value|=128;if(down(5))value|=256;if(down(6))value|=512;if(down(7))value|=1024;pad.current=value;updateInputRef.current();}
      else if(pad.current){pad.current=0;updateInputRef.current();}
      let fightInput=input.current;
      if(finisherPulse.current>0){fightInput=finisherPulse.current>=10||finisherPulse.current<=2?0:INPUT.SUPER;finisherPulse.current--;client.current?.setInput(fightInput);if(!finisherPulse.current)client.current?.setInput(input.current);}
      let draw;
      if(current.mode==="practice"&&game.current){
        if(!current.paused){accumulator+=elapsed;while(accumulator>=FRAME){game.current=stepFight(game.current,[fightInput,current.training&&current.lesson<2?0:current.circuit?circuitInput(game.current,current.circuit):botInput(game.current,1)]);accumulator-=FRAME;}}
        draw=game.current;
        if(current.training&&draw.phase==="fight"){
          if(current.lesson===0&&Math.abs(draw.players[0].x-lessonStart.current)>90)setLesson(1);
          if(current.lesson===1&&draw.players[1].hp<1000)setLesson(2);
          if(current.lesson===2&&draw.events.some(e=>e.type==="block"))setLesson(3);
        }
      }else draw=client.current?.predictedState();
      if(draw&&canvas.current){
        const started=performance.now(),el=canvas.current,ctx=el.getContext("2d");
        if(ctx){const scale=Math.min(el.width/1000,el.height/600);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#090e0b";ctx.fillRect(0,0,el.width,el.height);ctx.setTransform(scale,0,0,scale,(el.width-1000*scale)/2,(el.height-600*scale)/2);drawRumble(ctx,draw,{width:1000,height:600,images:images.current,reducedMotion:current.prefs.reducedMotion,quality:current.prefs.quality,shake:current.prefs.shake,effectTick:draw.effectTick??draw.tick});}
        const renderMs=performance.now()-started;metrics.current.frames++;metrics.current.totalMs+=renderMs;metrics.current.maxMs=Math.max(metrics.current.maxMs,renderMs);
        el.dataset.tick=String(draw.tick);el.dataset.phase=draw.phase;el.dataset.p0=String(Math.round(draw.players[0].x));el.dataset.hp=draw.players.map(p=>p.hp).join(",");
        el.dataset.input=String(input.current);el.dataset.action=draw.players[0].action?.id||'';el.dataset.grounded=String(draw.players[0].grounded);
        el.dataset.finisher=draw.finisher?.activated?draw.finisher.character:'';
        el.dataset.finisherFrame=String(draw.phase==='finisher'?draw.phaseTick:-1);
        el.dataset.fighterArt=draw.players.every(p=>images.current[p.character]?.naturalWidth)?'illustrated-sprites':'loading-fallback';
        // Audio follows authoritative events only; never predicted hit effects.
        audio.current?.update(current.mode==="online"?client.current.state:draw);
        if(now-lastUI.current>100){setView(draw);lastUI.current=now;}
      }
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);return ()=>cancelAnimationFrame(raf);
  },[mode]);
  const saveCircuit=next=>{setCircuitSave(next);try{localStorage.setItem(CIRCUIT_KEY,JSON.stringify(next));}catch{setNotice('Circuit progress will last for this visit.');}};
  useEffect(()=>{if(mode==='practice'&&circuit&&view?.phase==='finished'&&!circuitFinished.current){circuitFinished.current=true;saveCircuit(advanceCircuit(circuit,view.winner));}},[mode,circuit,view?.phase,view?.winner]);
  const practice=(teach=false,challenge=null)=>{
    setNotice("");
    client.current?.dispose();client.current=null;resetInput();setResult(null);setRoom(null);setJoined(null);setTraining(teach);setLesson(0);setPaused(false);
    setCircuit(challenge);circuitFinished.current=false;
    if(challenge){setCharacter(challenge.character);saveCircuit(challenge);}
    game.current=createFight({characters:[challenge?.character||character,challenge?circuitOpponent(challenge):opponent],stage:challenge?circuitStage(challenge):stage});lessonStart.current=game.current.players[0].x;
    setView(game.current);setMode("practice");audio.current?.seen.clear();audio.current?.setVolumes(prefs);audio.current?.setPaused(false);audio.current?.unlock();
  };
  const receive=message=>{
    if(message.type==="connection")setConnection(message.status);
    if(message.type==="joined"){setJoined(message);setResume(null);}
    if(message.type==="room"){
      if(matchId.current!==message.room.matchId){setResult(null);matchId.current=message.room.matchId;resetInput();audio.current?.seen.clear();}
      setRoom(message.room);
    }
    if(message.type==="result")setResult(message.result);
    if(message.type==="latency")setRtt(message.rtt);
    if(message.type==="error")setNotice(message.message||message.code);
    if(message.state)setView(message.state);
  };
  const online=(kind)=>{
    setNotice("");
    const url=initialEndpoint();if(!url){setNotice("Online rooms are not configured on this deployment. Practice is available.");return;}
    let action;
    if(kind==="resume"){if(!resume||resume.url!==url){setNotice("That saved room belongs to a different server.");return;}}
    else if(kind==="create")action={type:"create",name:name.trim()||"ANON",character,stage};
    else {const parsed=parseInvitation(invite);if(!parsed){setNotice("Paste the complete invitation link, including its scoped token.");return;}action={type:"join",...parsed,name:name.trim()||"ANON",character,spectator:kind==="watch"};}
    client.current?.dispose({leave:false});resetInput();setView(null);setRoom(null);setResult(null);setJoined(null);setMode("online");
    if(action)action={...action,game:"rekt-rumble",rulesVersion:RUMBLE_RULES_VERSION};
    const next=new RumbleClient(url,receive);client.current=next;if(kind==="resume")next.session=resume;next.connect(action);audio.current?.unlock();
  };
  const leave=()=>{client.current?.dispose();client.current=null;resetInput();game.current=null;setMode("menu");setRoom(null);setView(null);setJoined(null);setResult(null);setPaused(false);audio.current?.setVolumes({music:0,sfx:prefs.sfx});};
  const share=async()=>{if(!joined)return;const url=`${window.location.origin}/os/rumble#room=${joined.code}&token=${joined.token}`;setInvite(url);try{await navigator.clipboard.writeText(url);setNotice("Invitation copied. The other player needs the same running game server.");}catch{setNotice("Copy the invitation from the field below.");}};
  const fullscreen=()=>{const el=document.querySelector(`.${s.shell}`);if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else el?.requestFullscreen?.().catch(()=>setNotice("Fullscreen is unavailable in this browser."));};
  const finished=mode==="practice"?view?.phase==="finished":!!result||room?.phase==="finished";
  const outcome=mode==="online"?(result||room?.result):view;
  const winner=outcome?.winner;
  const playing=mode==="practice"||!!view;
  const slot=mode==="practice"?0:joined?.slot;
  const canReconnect=mode==='online'&&['disconnected','unavailable'].includes(connection)&&!!client.current?.canReconnect();
  const finishWindow=view?.phase==='finishWindow';
  const canFinish=finishWindow&&view.finisher.player===slot&&!paused&&!settings&&!movesOpen;
  const finisher=FINISHERS[view?.finisher?.character||character];
  const selectedMoves=Array.isArray(MOVES[character])?MOVES[character]:Object.values(MOVES[character]||{});
  return <div className={`${s.shell} ${mode!=="menu"?s.inGame:""}`}>
    <header className={s.header}><Link href="/os"><b>TERMINL</b><span>ARCADE</span></Link><span className={s.buildTag}>REKT RUMBLE / SOLO + ONLINE</span><div>{mode!=="menu"&&<button onClick={leave}>← LEAVE</button>}<button onClick={()=>{resetInput();setSettings(true);if(mode==="practice")setPaused(true);}}>SETTINGS</button><button onClick={fullscreen} aria-label="Toggle fullscreen">⛶</button></div></header>
    {notice&&<div className={s.notice} role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice("")}>×</button></div>}
    {mode==="menu"?<main className={s.menu}>
      <div className={s.titleRow}><div><span className={s.eyebrow}>ONE ON ONE. ALL YOUR BAD DECISIONS.</span><h1>REKT <em>RUMBLE</em><sup>01</sup></h1><p>The market took your money.<br />Take it out on someone your own size.</p></div><div className={s.rulesStamp}>{ROSTER.length} FIGHTERS<br />2 STAGES<br /><b>NO PAY TO WIN.</b></div></div>
      <section className={s.selectLayout} aria-label="Character selection"><div><div className={s.sectionLabel}><span>01 / PICK YOUR PROBLEM</span><span>ALL FIGHTERS ARE FREE</span></div><div className={s.roster}>{ROSTER.map((r,i)=><button key={r.id} aria-pressed={character===r.id} className={character===r.id?s.chosen:""} onClick={()=>setCharacter(r.id)}><span className={s.fighterIndex}>{String(i+1).padStart(2,"0")}</span><Image src={`/degens/${r.portrait}.webp`} alt={r.name} width={340} height={560} sizes="(max-width: 600px) 45vw, (max-width: 900px) 30vw, 230px" priority={i===0} /><div><small>{r.style}</small><h2>{r.name}</h2><p>{r.line}</p></div><span className={s.selectionMark}>{character===r.id?"SELECTED ↗":"SELECT +"}</span></button>)}</div><p className={s.characterTip}>{roster.tip}</p></div>
      <aside className={s.playPanel}><span className={s.eyebrow}>INSERT QUESTIONABLE JUDGMENT</span><h2>Let&apos;s settle<br />this properly.</h2><p>First to two rounds wins. 60 seconds per round. Same health. Different bad habits.</p><button className={s.primary} onClick={()=>practice(false,newCircuit(character))}>START SOLO CIRCUIT →</button>{circuitSave&&!circuitSave.complete&&<button className={s.secondary} onClick={()=>practice(false,circuitSave)}>CONTINUE CIRCUIT · {circuitSave.index+1}/6 →</button>}<p>Six fights. Increasing pressure. A mirror-match finale. Progress saves between fights.</p><button className={s.secondary} onClick={()=>practice(true)}>LEARN BY FIGHTING <span>↗</span></button><label>PRACTICE OPPONENT<select value={opponent} onChange={e=>setOpponent(e.target.value)}>{ROSTER.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button className={s.secondary} onClick={()=>practice(false)}>PRACTICE VS. BOT <span>→</span></button><div className={s.onlineDivider}>REAL ONLINE PvP / PRIVATE ROOMS</div><label>YOUR CALLSIGN<input value={name} maxLength={20} onChange={e=>setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g,""))} /></label><button className={s.primary} onClick={()=>online("create")}>CREATE A ROOM <span>+</span></button><label>FRIEND INVITATION<input placeholder="Paste the complete invitation link" value={invite} onChange={e=>setInvite(e.target.value)} /></label><div className={s.twoButtons}><button className={s.secondary} onClick={()=>online("join")}>JOIN FIGHT →</button><button className={s.secondary} onClick={()=>online("watch")}>SPECTATE</button></div>{resume&&<button className={s.textButton} onClick={()=>online("resume")}>↳ RECONNECT TO {resume.code}</button>}<small>Invite a friend to a private fight. Solo opponents are labeled bots.</small></aside></section>
      <section><div className={s.sectionLabel}><span>02 / CHOOSE THE SCENE</span><span>NEW ROUND. DIFFERENT BAD IDEA.</span></div><div className={s.stages}>{LEVELS.map(l=><button key={l.id} aria-pressed={stage===l.id} onClick={()=>setStage(l.id)} className={stage===l.id?s.activeStage:""}><Image src={l.image} alt={l.name} width={800} height={450} /><div><small>{l.rule}</small><h3>{l.name}</h3><p>{l.sub}</p></div><span>{stage===l.id?"✓":"+"}</span></button>)}</div></section>
      <footer className={s.menuFooter}><p>Six free fighters. Solo circuit, practice, and online fights.</p>{assetLabEnabled&&<Link href="/os/asset-lab">OPEN ASSET / ANIMATION LAB ↗</Link>}<Link href="/os">BACK TO THE ARCADE ↗</Link></footer>
    </main>:<main className={s.gameMain}>
      <div className={s.connectionBar}><b>{mode==="practice"?circuit?`SOLO CIRCUIT · FIGHT ${circuit.index+1}/6 · BOT`:training?"INTERACTIVE TRAINING · BOT":"PRACTICE · BOT OPPONENT":joined?.slot===-1?"LIVE SPECTATOR":"ONLINE · SERVER AUTHORITATIVE"}</b><span>{mode==="online"?`${connection.toUpperCase()} / ${rtt}ms / ${room?.region||"LOCAL"}`:circuit?"SIX-FIGHT SOLO RUN":"SOLO PLAY"}</span><button onClick={()=>{resetInput();setMovesOpen(true);if(mode==="practice")setPaused(true);}}>MOVE LIST / HELP</button></div>
      {!playing?<div className={s.lobby}>
        <span className={s.eyebrow}>PRIVATE FIGHT CLUB</span><h1>{room?"Your corner is ready.":connection==="unavailable"||connection==="disconnected"?"The room server is offline.":"Connecting to the arcade…"}</h1>
        {!room?<><p>Connecting to your fight. If the server is unavailable, you can play the solo circuit or practice.</p><button className={s.secondary} onClick={leave}>BACK TO FIGHTER SELECT</button></>:<><div className={s.roomCode}><span>ROOM</span><b>{room.code}</b><button onClick={share}>COPY INVITE ↗</button></div><input aria-label="Room invitation" readOnly value={joined?`${window.location.origin}/os/rumble#room=${joined.code}&token=${joined.token}`:""} onFocus={e=>e.target.select()} /><div className={s.lobbyPlayers}>{[0,1].map(i=>{const p=room.players[i];return <article key={i}>{p?<><Image src={`/degens/${ROSTER.find(r=>r.id===p.character)?.portrait||"margin-call-max"}.webp`} width={170} height={280} alt="" /><b>{p.name}</b><span>{p.connected===false?"RECONNECTING":p.ready?"READY ✓":"NOT READY"}</span></>:<><span className={s.emptyPlayer}>?</span><b>Waiting for a real player</b><span>No disguised bots. Invite a friend.</span></>}</article>;})}</div><p>{LEVELS.find(l=>l.id===room.stage)?.name} · {room.spectators||0} spectators</p>{joined?.slot>=0&&<button className={s.primary} onClick={()=>client.current?.send({type:"ready",ready:!room.players[joined.slot]?.ready})}>{room.players[joined.slot]?.ready?"CANCEL READY":"I'M READY →"}</button>}<small>Both players choose Ready. Disconnect grace: 15 seconds. You can decline by leaving.</small></>}
      </div>:<>
        <div className={s.hud}>{view?.players.map((p,i)=><div key={i} className={i===1?s.p2:""}><div><b>{room?.players[i]?.name||ROSTER.find(r=>r.id===p.character)?.name}</b><span>{view.wins[i]} / 2 ROUNDS</span></div><div className={s.health}><i style={{width:`${p.hp/10}%`}} /></div><div className={s.meter}><i style={{width:`${p.meter/10}%`}} /><span>{p.meter>=1000?`SUPER READY · ${bind(1024)}`:`METER ${Math.floor(p.meter/10)}%`}</span></div></div>)}<div className={s.clock}><strong>{Math.ceil((view?.roundTicks||3600)/60)}</strong><span>ROUND {view?.round||1}</span></div></div>
        <div className={s.arena} ref={arena}><canvas ref={canvas} aria-label={`REKT RUMBLE fighting arena. ${bind(1)} and ${bind(2)} move, ${bind(16)} punches, ${bind(32)} kicks, ${bind(128)} blocks. Full controls are in Move List.`} tabIndex={0} />
          <span className={s.rotateTip}>Rotate your phone for a bigger arena.</span>
          {assetError&&<span className={s.assetWarning}>Some artwork could not load · fallback artwork active</span>}
          {training&&lesson<3&&!paused&&<div className={s.lesson}><b>LESSON {lesson+1} / 3</b><h3>{["Find your range.","Land your first hit.","Now protect that face."][lesson]}</h3><p>{[`Slide the thumb pad left/right (or use ${bind(1)} / ${bind(2)}). Get within reach.`,`Tap PUNCH (${bind(16)}) or KICK (${bind(32)}). Down + KICK gives a low sweep.`,`Hold BLOCK (${bind(128)}). Down + BLOCK protects against low attacks.`][lesson]}</p></div>}
          {training&&lesson===3&&<div className={s.lesson}><b>BASICS COMPLETE ✓</b><p>Try GRAB ({bind(512)}) up close. Down + SPECIAL is your rising attack; toward your rival + SPECIAL lunges. SUPER ({bind(1024)}) needs 100% meter.</p><button onClick={()=>setTraining(false)}>KEEP FIGHTING →</button></div>}
          {paused&&mode==="practice"&&!settings&&!movesOpen&&<div className={s.gameOverlay}><h2>TAKE A BREATHER.</h2><p>Practice is paused. Online matches never pause for one player.</p><button className={s.primary} onClick={()=>{setPaused(false);audio.current?.unlock();}}>BACK TO IT →</button></div>}
          {mode==="online"&&connection!=="connected"&&<div className={s.reconnect}>{canReconnect?<>CONNECTION LOST · <button onClick={()=>client.current?.reconnect()}>RECONNECT NOW</button> · Match clock continues.</>:'CONNECTION LOST · Reconnecting. Match clock continues.'}</div>}
          {finishWindow&&!paused&&!settings&&!movesOpen&&<div className={s.finisherPrompt} role="status"><b>FINISH IT</b><span>{finisher.name.toUpperCase()} · {Math.ceil(Math.max(0,FINISH_WINDOW_TICKS-view.phaseTick)/60)}s</span>{canFinish?<><button className={s.primary} disabled={mode==='online'&&connection!=='connected'} onClick={()=>{audio.current?.unlock();finisherPulse.current=12;}}>FINISH THEM →</button><small>Press SUPER ({bind(INPUT.SUPER)}) · No meter required</small></>:<small>{ROSTER.find(r=>r.id===view.finisher.character)?.name} can deliver the final blow.</small>}</div>}
          {finished&&<div className={s.gameOverlay}><span className={s.eyebrow}>{mode==="online"?"SERVER-CONFIRMED RESULT":circuit?circuit.index===5&&winner===0?"CIRCUIT COMPLETE":"SOLO CIRCUIT":"PRACTICE COMPLETE"}</span><h2>{winner===null||winner===-1?"MUTUAL COPING.":slot===-1?`${room?.players[winner]?.name||"FIGHTER"} WINS`:winner===slot?"BAG SECURED.":"LIQUIDATED."}</h2><p>{(outcome?.wins||view?.wins)?.join(" — ")} · {mode==="online"?"Recorded by the room server. No cash or NFT rewards.":circuit?winner===0?circuit.index===5?"All six opponents defeated.":"Next opponent unlocked.":"Retry this fight to continue your circuit.":"Ready for another round?"}</p><button className={s.primary} onClick={()=>mode==="practice"?practice(false,circuit?(winner===0?(circuit.index===5?newCircuit(circuit.character):advanceCircuit(circuit,0)):circuit):null):client.current?.send({type:"rematch"})}>{mode==="practice"?circuit?winner===0?circuit.index===5?"PLAY CIRCUIT AGAIN →":"NEXT OPPONENT →":"RETRY FIGHT →":"RUN IT BACK →":room?.players[joined?.slot]?.rematch?"WAITING FOR OPPONENT…":"VOTE REMATCH →"}</button><button className={s.textButton} onClick={leave}>BACK TO FIGHTER SELECT</button></div>}
        </div>
        <div className={s.fightFooter}><p><b>{bind(1)} / {bind(2)} MOVE · {bind(4)} JUMP · {bind(8)} CROUCH</b><span className={s.combatKeys}>{bind(16)} PUNCH · {bind(32)} KICK · {bind(64)} SPECIAL</span><span className={s.combatKeys}>{bind(256)} DASH · {bind(512)} GRAB · {bind(1024)} SUPER · {bind(128)} BLOCK</span></p><span>{view?.events?.at(-1)?.text||"Missed specials are punishable. Grabs beat blocks."}</span></div>
        {slot!==-1&&<TouchControls resetKey={touchReset} meter={canFinish?1000:view?.players[slot||0]?.meter||0} feedback={view?.players[slot||0]?.action?MOVES[view.players[slot||0].character][view.players[slot||0].action.id]?.name:touch.current&1024&&(view?.players[slot||0]?.meter||0)<1000?'SUPER needs 100% meter · earn it by fighting':''} disabled={paused||settings||movesOpen||finished||view?.phase==='finisher'||finishWindow&&!canFinish||mode==='online'&&connection!=='connected'} onChange={value=>{touch.current=value;updateInputRef.current();}}/>}
      </>}
    </main>}
    {settings&&<Panel title="SYSTEM SETTINGS" close={()=>setSettings(false)}><p>Online matches keep running while this panel is open.</p>{[["music","MUSIC"],["sfx","SOUND EFFECTS"]].map(([key,label])=><label key={key}>{label}<input type="range" min="0" max="1" step=".05" value={prefs[key]} onChange={e=>{audio.current?.unlock();setPrefs(p=>({...p,[key]:Number(e.target.value)}));}} /></label>)}<button className={s.secondary} onClick={()=>setPrefs(p=>({...p,music:0,sfx:0}))}>MUTE ALL</button><label><input type="checkbox" checked={prefs.reducedMotion} onChange={e=>setPrefs(p=>({...p,reducedMotion:e.target.checked}))} /> REDUCED MOTION</label><label><input type="checkbox" checked={prefs.shake} onChange={e=>setPrefs(p=>({...p,shake:e.target.checked}))} /> CAMERA SHAKE</label><label>QUALITY<select value={prefs.quality} onChange={e=>setPrefs(p=>({...p,quality:e.target.value}))}><option value="high">High</option><option value="low">Low / mobile</option></select></label><h3>Keyboard controls</h3><KeyboardGuide keys={prefs.keys}/><p>Left hand moves; right hand fights; thumb blocks. Arrow keys also work with the default layout.</p><button className={s.secondary} onClick={()=>{resetInput();setPrefs(p=>({...p,keys:{...DEFAULT_KEYS},controlsVersion:CONTROL_VERSION}));}}>RESET KEYBOARD LAYOUT</button><p>To customize, focus a field and press a key. Duplicate assignments are replaced.</p><div className={s.keyGrid}>{ACTIONS.map(([bit,label])=><label key={bit}>{label}<input aria-label={`Key for ${label}`} readOnly value={bind(bit)} onKeyDown={e=>{if(["Tab","Escape","Meta","Control","Alt"].includes(e.key)||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopPropagation();const key=e.key.length===1?e.key.toLowerCase():e.key;setPrefs(p=>{const map=Object.fromEntries(Object.entries(p.keys).filter(([k,v])=>v!==bit&&k.toLowerCase()!==key.toLowerCase()));map[key]=bit;return {...p,keys:map,controlsVersion:CONTROL_VERSION};});}} /></label>)}</div><p>Controller: stick/D-pad move; A jump; X punch; Y kick; B special; LB block; RB dash; LT grab; RT super. Hardware validation pending.</p></Panel>}
    {movesOpen&&<Panel title="KNOW YOUR BAD HABITS" close={()=>setMovesOpen(false)}><KeyboardGuide keys={prefs.keys}/><p>{bind(1)} / {bind(2)} move, {bind(4)} jumps, and {bind(8)} crouches. Hold {bind(128)} to block. Crouch-block stops low attacks; standing block stops aerial attacks. {bind(512)} grabs nearby opponents and also escapes a grab during its short escape window.</p><p>Down + PUNCH / KICK gives low attacks; jumping changes them to aerial attacks. Down + SPECIAL gives a rising attack; toward your rival + SPECIAL lunges. {bind(256)} dashes; {bind(1024)} spends a full meter on your super. Missed kicks and specials leave you open.</p><article className={s.finisherHelp}><h3>FINISHER · {FINISHERS[character].name}</h3><p>{FINISHERS[character].description} Win the match by knockout, then press SUPER ({bind(INPUT.SUPER)}) or tap FINISH THEM within four seconds. No meter needed. Let the timer expire to take the win.</p></article><div className={s.moveTable}>{selectedMoves.map((move,i)=><article key={move.id||i}><h3>{move.name||move.id}</h3><p>{move.counterplay||move.description}</p><small>START {move.startup} · ACTIVE {move.active} · RECOVER {move.recovery} · DAMAGE {move.damage}</small></article>)}</div><p>Online: leaving or disconnecting does not pause the fight. Rejoin within 15 seconds. No ranked ladder or ownership advantages in this slice.</p></Panel>}
  </div>;
}

function Panel({title,close,children}){
  const ref=useRef(null);useEffect(()=>{const el=ref.current,prior=document.activeElement;el.showModal();return ()=>{el.close();prior?.focus();};},[]);
  return <dialog ref={ref} className={s.dialog} aria-label={title} onCancel={close}><header><b>{title}</b><button onClick={close} aria-label="Close panel">×</button></header><div>{children}</div></dialog>;
}

function KeyboardGuide({keys}){
  const key=bit=><span key={bit} className={bit===128?s.spaceKey:undefined}><kbd>{keyLabel(keys,bit)}</kbd><small>{ACTIONS.find(([value])=>value===bit)?.[1]}</small></span>;
  return <div className={s.keyboardGuide} aria-label="Keyboard layout"><div><b>MOVE</b><div className={s.keyCluster}><i/>{key(4)}<i/>{[1,8,2].map(key)}</div></div><div><b>FIGHT</b><div className={s.keyCluster}>{[256,512,1024,16,32,64,128].map(key)}</div></div></div>;
}
