import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createFight, stepFight, botInput, INPUT, MOVES, CHARACTERS, STAGES } from "../../lib/arcade/rumble-sim.mjs";
import { drawRumble } from "../../lib/arcade/rumble-render";
import { RumbleAudio } from "../../lib/arcade/rumble-audio";
import { RumbleClient } from "../../lib/arcade/rumble-client";
import s from "../../styles/Rumble.module.css";

const ROSTER=[{id:"max",name:"Margin Call Max",portrait:"margin-call-max",style:"HIGH COMMITMENT / GRAPPLER",line:"125× leverage. Zero chill.",tip:"Close the gap. Catch a guard with a throw. Miss, and you pay for it."},{id:"diamond",name:"Diamond Hands Pepe",portrait:"diamond-hands-pepe",style:"PATIENT PRESSURE / BRUISER",line:"The only thing he sells is punches.",tip:"Own your space. Block the rush. Punish with the diamond uppercut."}];
const LEVELS=[{id:"dead-mall",name:"Dead Mall Exchange",sub:"Room to breathe. Nowhere to cash out.",rule:"Wide arena · Spacing and corner pressure",image:"/arcade/dead-mall-v1.webp"},{id:"laundromat",name:"Liquidation Laundromat",sub:"Your portfolio is on the spin cycle.",rule:"Telegraphed steam boundaries · Watch your space",image:"/arcade/laundromat-v1.webp"}];
const DEFAULT_KEYS={ArrowLeft:1,ArrowRight:2,ArrowUp:4,ArrowDown:8,j:16,k:32,l:64,Shift:128,q:256,e:512,r:1024};
const ACTIONS=[[1,"Left"],[2,"Right"],[4,"Jump"],[8,"Crouch"],[16,"Light"],[32,"Heavy"],[64,"Special"],[128,"Guard"],[256,"Dash"],[512,"Throw"],[1024,"Super"]];
const FRAME=1000/60;
function parseInvitation(value){try{const url=new URL(value,window.location.origin);const params=new URLSearchParams(url.hash.slice(1));const code=params.get("room"),token=params.get("token");return code&&token?{code,token}:null;}catch{return null;}}
function safePrefs(){try{return JSON.parse(localStorage.getItem("terminl:rumble-prefs"))||{};}catch{return {};}}
function initialEndpoint(){return process.env.NEXT_PUBLIC_ARCADE_WS_URL||(["localhost","127.0.0.1"].includes(window.location.hostname)?"ws://localhost:4010":"");}

export default function Rumble(){
  const [mode,setMode]=useState("menu"),[character,setCharacter]=useState("max"),[stage,setStage]=useState("dead-mall");
  const [name,setName]=useState("ANON"),[invite,setInvite]=useState(""),[connection,setConnection]=useState("offline");
  const [room,setRoom]=useState(null),[view,setView]=useState(null),[joined,setJoined]=useState(null),[result,setResult]=useState(null);
  const [notice,setNotice]=useState(""),[settings,setSettings]=useState(false),[movesOpen,setMovesOpen]=useState(false);
  const [paused,setPaused]=useState(false),[training,setTraining]=useState(false),[lesson,setLesson]=useState(0);
  const [prefs,setPrefs]=useState({music:.12,sfx:.45,shake:false,reducedMotion:false,quality:"high",keys:DEFAULT_KEYS});
  const [rtt,setRtt]=useState(0),[assetError,setAssetError]=useState(false),[resume,setResume]=useState(null);
  const canvas=useRef(null),arena=useRef(null),images=useRef({}),audio=useRef(null),client=useRef(null),game=useRef(null);
  const state=useRef({mode,paused,training,lesson,prefs});state.current={mode,paused,training,lesson,prefs};
  const input=useRef(0),keyboard=useRef(0),touch=useRef(0),pad=useRef(0),keys=useRef(new Set());
  const metrics=useRef({frames:0,totalMs:0,maxMs:0}),lastUI=useRef(0),lessonStart=useRef(0),matchId=useRef(null);
  const roster=ROSTER.find(r=>r.id===character);

  useEffect(()=>{
    const saved=safePrefs();setPrefs(p=>({...p,...saved,keys:saved.keys||DEFAULT_KEYS,reducedMotion:saved.reducedMotion??window.matchMedia("(prefers-reduced-motion: reduce)").matches}));
    try{setName(JSON.parse(localStorage.getItem("terminl-os:v2"))?.name||"ANON");const stored=JSON.parse(sessionStorage.getItem("terminl:rumble-session"));if(stored)setResume(stored);}catch{}
    if(parseInvitation(window.location.href))setInvite(window.location.href);
    let disposed=false;
    for(const level of LEVELS){const image=new window.Image();image.onload=()=>{if(!disposed)images.current[level.id]=image;};image.onerror=()=>{if(!disposed)setAssetError(true);};image.src=level.image;}
    audio.current=new RumbleAudio();
    return ()=>{disposed=true;client.current?.dispose({leave:false});audio.current?.dispose();};
  },[]);
  useEffect(()=>{audio.current?.setVolumes({music:prefs.music,sfx:prefs.sfx});try{localStorage.setItem("terminl:rumble-prefs",JSON.stringify(prefs));}catch{}},[prefs]);
  useEffect(()=>{audio.current?.setPaused(mode==="menu"||(mode==="practice"&&paused));},[mode,paused]);
  const resetInput=()=>{input.current=0;keyboard.current=0;touch.current=0;pad.current=0;keys.current.clear();client.current?.setInput(0);};
  const updateInput=()=>{const value=keyboard.current|touch.current|pad.current;if(value!==input.current){input.current=value;client.current?.setInput(value);}};
  const updateInputRef=useRef(updateInput);updateInputRef.current=updateInput;
  useEffect(()=>{
    const key=e=>{
      if(state.current.mode==="menu"||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey)return;
      if(e.key==="Escape"&&e.type==="keydown"){resetInput();if(state.current.mode==="practice")setPaused(v=>!v);return;}
      const mapped=state.current.prefs.keys[e.key]||state.current.prefs.keys[e.key.toLowerCase()];if(!mapped)return;
      e.preventDefault();if(e.type==="keydown")keys.current.add(e.key);else keys.current.delete(e.key);
      keyboard.current=[...keys.current].reduce((n,k)=>n|(state.current.prefs.keys[k]||state.current.prefs.keys[k.toLowerCase()]||0),0);updateInputRef.current();
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
      if(controller){let value=0;const down=i=>controller.buttons[i]?.pressed;const x=controller.axes[0]||0,y=controller.axes[1]||0;if(x<-.3||down(14))value|=1;if(x>.3||down(15))value|=2;if(y>.4||down(13))value|=8;if(down(0)||down(12))value|=4;if(down(2))value|=16;if(down(3))value|=32;if(down(1))value|=64;if(down(4))value|=128;if(down(5))value|=256;if(down(6))value|=512;if(down(7))value|=1024;pad.current=value;updateInputRef.current();}
      let draw;
      if(current.mode==="practice"&&game.current){
        if(!current.paused){accumulator+=elapsed;while(accumulator>=FRAME){game.current=stepFight(game.current,[input.current,current.training&&current.lesson<2?0:botInput(game.current,1)]);accumulator-=FRAME;}}
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
        // Audio follows authoritative events only; never predicted hit effects.
        audio.current?.update(current.mode==="online"?client.current.state:draw);
        if(now-lastUI.current>100){setView(draw);lastUI.current=now;}
      }
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);return ()=>cancelAnimationFrame(raf);
  },[mode]);
  const practice=(teach=false)=>{
    setNotice("");
    client.current?.dispose();client.current=null;resetInput();setResult(null);setRoom(null);setJoined(null);setTraining(teach);setLesson(0);setPaused(false);
    game.current=createFight({characters:[character,character==="max"?"diamond":"max"],stage});lessonStart.current=game.current.players[0].x;
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
    const next=new RumbleClient(url,receive);client.current=next;if(kind==="resume")next.session=resume;next.connect(action);audio.current?.unlock();
  };
  const leave=()=>{client.current?.dispose();client.current=null;resetInput();game.current=null;setMode("menu");setRoom(null);setView(null);setJoined(null);setResult(null);setPaused(false);audio.current?.setVolumes({music:0,sfx:prefs.sfx});};
  const share=async()=>{if(!joined)return;const url=`${window.location.origin}/os/rumble#room=${joined.code}&token=${joined.token}`;setInvite(url);try{await navigator.clipboard.writeText(url);setNotice("Invitation copied. The other player needs the same running game server.");}catch{setNotice("Copy the invitation from the field below.");}};
  const fullscreen=()=>{const el=document.querySelector(`.${s.shell}`);if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else el?.requestFullscreen?.().catch(()=>setNotice("Fullscreen is unavailable in this browser."));};
  const control=bit=>({onPointerDown:e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.current|=bit;updateInputRef.current();},onPointerUp:()=>{touch.current&=~bit;updateInputRef.current();},onPointerCancel:()=>{touch.current&=~bit;updateInputRef.current();},onLostPointerCapture:()=>{touch.current&=~bit;updateInputRef.current();}});
  const finished=mode==="practice"?view?.phase==="finished":!!result||room?.phase==="finished";
  const outcome=mode==="online"?(result||room?.result):view;
  const winner=outcome?.winner;
  const playing=mode==="practice"||!!view;
  const slot=mode==="practice"?0:joined?.slot;
  const selectedMoves=Array.isArray(MOVES[character])?MOVES[character]:Object.values(MOVES[character]||{});
  return <div className={`${s.shell} ${mode!=="menu"?s.inGame:""}`}>
    <header className={s.header}><Link href="/os">▣ TERMINL <span>ARCADE</span></Link><span className={s.buildTag}>LAB BUILD / NOT A RELEASE</span><div>{mode!=="menu"&&<button onClick={leave}>← LEAVE</button>}<button onClick={()=>{resetInput();setSettings(true);if(mode==="practice")setPaused(true);}}>SETTINGS</button><button onClick={fullscreen} aria-label="Toggle fullscreen">⛶</button></div></header>
    {notice&&<div className={s.notice} role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice("")}>×</button></div>}
    {mode==="menu"?<main className={s.menu}>
      <div className={s.titleRow}><div><span className={s.eyebrow}>ONE ON ONE. ALL YOUR BAD DECISIONS.</span><h1>REKT <em>RUMBLE</em><sup>01</sup></h1><p>The market took your money.<br />Take it out on someone your own size.</p></div><div className={s.rulesStamp}>2 FIGHTERS<br />2 STAGES<br /><b>NO PAY TO WIN.</b></div></div>
      <section className={s.selectLayout} aria-label="Character selection"><div><div className={s.sectionLabel}><span>01 / PICK YOUR PROBLEM</span><span>ALL FIGHTERS ARE FREE</span></div><div className={s.roster}>{ROSTER.map(r=><button key={r.id} aria-pressed={character===r.id} className={character===r.id?s.chosen:""} onClick={()=>setCharacter(r.id)}><span className={s.fighterIndex}>{r.id==="max"?"01":"02"}</span><Image src={`/degens/${r.portrait}.webp`} alt={r.name} width={340} height={560} priority /><div><small>{r.style}</small><h2>{r.name}</h2><p>{r.line}</p></div><span className={s.selectionMark}>{character===r.id?"SELECTED ↗":"SELECT +"}</span></button>)}</div><p className={s.characterTip}>{roster.tip}</p></div>
      <aside className={s.playPanel}><span className={s.eyebrow}>INSERT QUESTIONABLE JUDGMENT</span><h2>Let&apos;s settle<br />this properly.</h2><p>First to two rounds wins. 60 seconds per round. Same health. Different bad habits.</p><button className={s.primary} onClick={()=>practice(true)}>LEARN BY FIGHTING <span>↗</span></button><button className={s.secondary} onClick={()=>practice(false)}>PRACTICE VS. BOT <span>→</span></button><div className={s.onlineDivider}>REAL ONLINE PvP / PRIVATE ROOMS</div><label>YOUR CALLSIGN<input value={name} maxLength={20} onChange={e=>setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g,""))} /></label><button className={s.primary} onClick={()=>online("create")}>CREATE A ROOM <span>+</span></button><label>FRIEND INVITATION<input placeholder="Paste the complete invitation link" value={invite} onChange={e=>setInvite(e.target.value)} /></label><div className={s.twoButtons}><button className={s.secondary} onClick={()=>online("join")}>JOIN FIGHT →</button><button className={s.secondary} onClick={()=>online("watch")}>SPECTATE</button></div>{resume&&<button className={s.textButton} onClick={()=>online("resume")}>↳ RECONNECT TO {resume.code}</button>}<small>Private rooms require the separate multiplayer service. Bots are labeled practice only.</small></aside></section>
      <section><div className={s.sectionLabel}><span>02 / CHOOSE THE SCENE</span><span>NEW ROUND. DIFFERENT BAD IDEA.</span></div><div className={s.stages}>{LEVELS.map(l=><button key={l.id} aria-pressed={stage===l.id} onClick={()=>setStage(l.id)} className={stage===l.id?s.activeStage:""}><Image src={l.image} alt={l.name} width={800} height={450} /><div><small>{l.rule}</small><h3>{l.name}</h3><p>{l.sub}</p></div><span>{stage===l.id?"✓":"+"}</span></button>)}</div></section>
      <footer className={s.menuFooter}><p>Original collection-inspired game adaptations. Artwork and combat balance are in development review.</p><Link href="/os/asset-lab">OPEN ASSET / ANIMATION LAB ↗</Link><Link href="/os">BACK TO THE ARCADE ↗</Link></footer>
    </main>:<main className={s.gameMain}>
      <div className={s.connectionBar}><b>{mode==="practice"?training?"INTERACTIVE TRAINING · BOT":"PRACTICE · BOT OPPONENT":joined?.slot===-1?"LIVE SPECTATOR":"ONLINE · SERVER AUTHORITATIVE"}</b><span>{mode==="online"?`${connection.toUpperCase()} / ${rtt}ms / ${room?.region||"LOCAL"}`:"OFFLINE · NO MATCH REWARDS"}</span><button onClick={()=>{resetInput();setMovesOpen(true);if(mode==="practice")setPaused(true);}}>MOVE LIST / HELP</button></div>
      {!playing?<div className={s.lobby}>
        <span className={s.eyebrow}>PRIVATE FIGHT CLUB</span><h1>{room?"Your corner is ready.":connection==="unavailable"||connection==="disconnected"?"The room server is offline.":"Connecting to the arcade…"}</h1>
        {!room?<><p>Run <code>npm run arcade:server</code> in a second terminal. No wallet needed.</p><button className={s.secondary} onClick={leave}>BACK TO FIGHTER SELECT</button></>:<><div className={s.roomCode}><span>ROOM</span><b>{room.code}</b><button onClick={share}>COPY INVITE ↗</button></div><input aria-label="Room invitation" readOnly value={joined?`${window.location.origin}/os/rumble#room=${joined.code}&token=${joined.token}`:""} onFocus={e=>e.target.select()} /><div className={s.lobbyPlayers}>{[0,1].map(i=>{const p=room.players[i];return <article key={i}>{p?<><Image src={`/degens/${ROSTER.find(r=>r.id===p.character)?.portrait||"margin-call-max"}.webp`} width={170} height={280} alt="" /><b>{p.name}</b><span>{p.connected===false?"RECONNECTING":p.ready?"READY ✓":"NOT READY"}</span></>:<><span className={s.emptyPlayer}>?</span><b>Waiting for a real player</b><span>No disguised bots. Invite a friend.</span></>}</article>;})}</div><p>{LEVELS.find(l=>l.id===room.stage)?.name} · {room.spectators||0} spectators</p>{joined?.slot>=0&&<button className={s.primary} onClick={()=>client.current?.send({type:"ready",ready:!room.players[joined.slot]?.ready})}>{room.players[joined.slot]?.ready?"CANCEL READY":"I'M READY →"}</button>}<small>Both players choose Ready. Disconnect grace: 15 seconds. You can decline by leaving.</small></>}
      </div>:<>
        <div className={s.hud}>{view?.players.map((p,i)=><div key={i} className={i===1?s.p2:""}><div><b>{room?.players[i]?.name||ROSTER.find(r=>r.id===p.character)?.name}</b><span>{view.wins[i]} / 2 ROUNDS</span></div><div className={s.health}><i style={{width:`${p.hp/10}%`}} /></div><div className={s.meter}><i style={{width:`${p.meter/10}%`}} /><span>{p.meter>=1000?"SUPER READY · R":`METER ${Math.floor(p.meter/10)}%`}</span></div></div>)}<div className={s.clock}><strong>{Math.ceil((view?.roundTicks||3600)/60)}</strong><span>ROUND {view?.round||1}</span></div></div>
        <div className={s.arena} ref={arena}><canvas ref={canvas} aria-label="REKT RUMBLE fighting arena. Use arrow keys and J for light attacks; Shift guards. Full controls are in Move List." tabIndex={0} />
          <span className={s.rotateTip}>Rotate your phone for a bigger arena.</span>
          {assetError&&<span className={s.assetWarning}>Backdrop unavailable · authored fallback scene</span>}
          {training&&lesson<3&&!paused&&<div className={s.lesson}><b>LESSON {lesson+1} / 3</b><h3>{["Find your range.","Land your first hit.","Now protect that face."][lesson]}</h3><p>{["Use ← → to move. Get close enough to threaten a hit.","Move within reach, then tap J for a light attack. Try ↓ + K for a sweep.","Hold Shift near the opponent. Block a hit. Low attacks need ↓ + Shift."][lesson]}</p></div>}
          {training&&lesson===3&&<div className={s.lesson}><b>BASICS COMPLETE ✓</b><p>Now try a throw with E, specials with L, and an R super when the meter fills.</p><button onClick={()=>setTraining(false)}>KEEP FIGHTING →</button></div>}
          {paused&&mode==="practice"&&!settings&&!movesOpen&&<div className={s.gameOverlay}><h2>TAKE A BREATHER.</h2><p>Practice is paused. Online matches never pause for one player.</p><button className={s.primary} onClick={()=>{setPaused(false);audio.current?.unlock();}}>BACK TO IT →</button></div>}
          {mode==="online"&&connection!=="connected"&&<div className={s.reconnect}>CONNECTION LOST · Reconnecting. Match clock continues.</div>}
          {finished&&<div className={s.gameOverlay}><span className={s.eyebrow}>{mode==="online"?"SERVER-CONFIRMED RESULT":"PRACTICE COMPLETE"}</span><h2>{winner===null||winner===-1?"MUTUAL COPING.":slot===-1?`${room?.players[winner]?.name||"FIGHTER"} WINS`:winner===slot?"BAG SECURED.":"LIQUIDATED."}</h2><p>{(outcome?.wins||view?.wins)?.join(" — ")} · {mode==="online"?"Recorded by the room server. No cash or NFT rewards.":"Practice does not affect online records."}</p><button className={s.primary} onClick={()=>mode==="practice"?practice(false):client.current?.send({type:"rematch"})}>{mode==="practice"?"RUN IT BACK →":room?.players[joined?.slot]?.rematch?"WAITING FOR OPPONENT…":"VOTE REMATCH →"}</button><button className={s.textButton} onClick={leave}>BACK TO THE ARCADE LAB</button></div>}
        </div>
        <div className={s.fightFooter}><p><b>← → MOVE</b> · ↑ JUMP · ↓ CROUCH · J LIGHT · K HEAVY · L SPECIAL · SHIFT GUARD · Q DASH · E THROW · R SUPER</p><span>{view?.events?.at(-1)?.text||"Missed specials are punishable. Guards lose to throws."}</span></div>
        {slot!==-1&&<div className={s.touchControls} aria-label="Touch fighting controls"><div>{[[1,"←"],[8,"↓"],[4,"↑"],[2,"→"]].map(([bit,label])=><button aria-label={ACTIONS.find(a=>a[0]===bit)[1]} key={bit} {...control(bit)}>{label}</button>)}</div><div>{[[16,"LIGHT"],[32,"HEAVY"],[64,"SPECIAL"],[128,"GUARD"],[256,"DASH"],[512,"THROW"],[1024,"SUPER"]].map(([bit,label])=><button aria-label={label} key={bit} {...control(bit)}>{label}</button>)}</div></div>}
      </>}
    </main>}
    {settings&&<Panel title="SYSTEM SETTINGS" close={()=>setSettings(false)}><p>Online matches keep running while this panel is open.</p>{[["music","MUSIC"],["sfx","SOUND EFFECTS"]].map(([key,label])=><label key={key}>{label}<input type="range" min="0" max="1" step=".05" value={prefs[key]} onChange={e=>{audio.current?.unlock();setPrefs(p=>({...p,[key]:Number(e.target.value)}));}} /></label>)}<button className={s.secondary} onClick={()=>setPrefs(p=>({...p,music:0,sfx:0}))}>MUTE ALL</button><label><input type="checkbox" checked={prefs.reducedMotion} onChange={e=>setPrefs(p=>({...p,reducedMotion:e.target.checked}))} /> REDUCED MOTION</label><label><input type="checkbox" checked={prefs.shake} onChange={e=>setPrefs(p=>({...p,shake:e.target.checked}))} /> CAMERA SHAKE</label><label>QUALITY<select value={prefs.quality} onChange={e=>setPrefs(p=>({...p,quality:e.target.value}))}><option value="high">High</option><option value="low">Low / mobile</option></select></label><h3>Keyboard mapping</h3><p>Focus a field and press a key. Duplicate assignments are replaced.</p><div className={s.keyGrid}>{ACTIONS.map(([bit,label])=><label key={bit}>{label}<input aria-label={`Key for ${label}`} readOnly value={Object.keys(prefs.keys).find(k=>prefs.keys[k]===bit)||"—"} onKeyDown={e=>{e.preventDefault();e.stopPropagation();if(["Tab","Escape","Meta","Control","Alt"].includes(e.key))return;setPrefs(p=>{const map=Object.fromEntries(Object.entries(p.keys).filter(([k,v])=>v!==bit&&k!==e.key));map[e.key]=bit;return {...p,keys:map};});}} /></label>)}</div><p>Controller: stick/D-pad move; A jump; X light; Y heavy; B special; LB guard; RB dash; LT throw; RT super. Hardware validation pending.</p></Panel>}
    {movesOpen&&<Panel title="KNOW YOUR BAD HABITS" close={()=>setMovesOpen(false)}><p>Arrows move. J light, K heavy, L special. Hold Shift to guard. Crouch-guard stops lows; standing guard stops aerial attacks. E throws nearby guards; E also escapes a throw during its short escape window.</p><p>↓ + J/K gives crouching attacks; airborne J/K gives aerial attacks. Direction + L selects a special. Q dashes; R spends a full meter. Missed heavy attacks and specials leave you open.</p><div className={s.moveTable}>{selectedMoves.map((move,i)=><article key={move.id||i}><h3>{move.name||move.id}</h3><p>{move.counterplay||move.description}</p><small>START {move.startup} · ACTIVE {move.active} · RECOVER {move.recovery} · DAMAGE {move.damage}</small></article>)}</div><p>Online: leaving or disconnecting does not pause the fight. Rejoin within 15 seconds. No ranked ladder or ownership advantages in this slice.</p></Panel>}
  </div>;
}

function Panel({title,close,children}){
  const ref=useRef(null);useEffect(()=>{const el=ref.current,prior=document.activeElement;el.showModal();return ()=>{el.close();prior?.focus();};},[]);
  return <dialog ref={ref} className={s.dialog} aria-label={title} onCancel={close}><header><b>{title}</b><button onClick={close} aria-label="Close panel">×</button></header><div>{children}</div></dialog>;
}
