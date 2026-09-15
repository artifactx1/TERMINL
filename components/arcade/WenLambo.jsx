import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {createRace,stepRace,raceBotInput,TRACKS,VEHICLES,CUP_TRACKS,RACE_RULES_VERSION} from '../../lib/arcade/race-sim.mjs';
import {drawRace} from '../../lib/arcade/race-render';
import {drawRearCar,preloadRaceArt} from '../../lib/arcade/race-perspective';
import {RaceAudio} from '../../lib/arcade/race-audio';
import {RumbleClient} from '../../lib/arcade/rumble-client';
import TouchControls from './TouchControls';
import {raceTouchSteeringInput} from '../../lib/arcade/touch-input.mjs';
import {rivalTelemetry} from '../../lib/arcade/race-telemetry.mjs';
import s from '../../styles/Racing.module.css';

const KEYS={ArrowLeft:1,a:1,ArrowRight:2,d:2,ArrowUp:4,w:4,ArrowDown:8,s:8,' ':16,Shift:32,r:64};
const FRAME=1000/60;
const seconds=ticks=>ticks===null?'DNF':`${(ticks/60).toFixed(2)}s`;
function invitation(value){try{const u=new URL(value,location.origin),p=new URLSearchParams(u.hash.slice(1));return p.get('room')&&p.get('token')?{code:p.get('room'),token:p.get('token')}:null;}catch{return null;}}
function endpoint(){return process.env.NEXT_PUBLIC_ARCADE_WS_URL||(['localhost','127.0.0.1'].includes(location.hostname)?'ws://localhost:4010':'');}

export default function WenLambo(){
  const [mode,setMode]=useState('menu'),[vehicle,setVehicle]=useState('comet'),[track,setTrack]=useState('night-market');
  const [name,setName]=useState('ANON'),[invite,setInvite]=useState(''),[view,setView]=useState(null),[room,setRoom]=useState(null),[seat,setSeat]=useState(null),[result,setResult]=useState(null);
  const [connection,setConnection]=useState('offline'),[rtt,setRtt]=useState(0),[notice,setNotice]=useState(''),[paused,setPaused]=useState(false),[tutorial,setTutorial]=useState(false),[lesson,setLesson]=useState(0),[settings,setSettings]=useState(false),[resume,setResume]=useState(null);
  const [prefs,setPrefs]=useState({music:.12,sfx:.4,reducedMotion:false,quality:'high'});
  const [touchReset,setTouchReset]=useState(0);
  const [mapOpen,setMapOpen]=useState(false),compact=useRef(true);
  const canvas=useRef(null),arena=useRef(null),shell=useRef(null),game=useRef(null),client=useRef(null),audio=useRef(null),input=useRef(0),keyboard=useRef(0),touch=useRef(0),pad=useRef(0),match=useRef(null);
  const current=useRef(null);current.current={mode,paused,prefs,tutorial,lesson,mapOpen,settings};
  const held=useRef(new Set());
  const touchAxis=useRef(0),padAxis=useRef(0),wheelState=useRef({steer:0,speed:0});
  const applyInput=()=>{const steering=raceTouchSteeringInput(touchAxis.current||padAxis.current,wheelState.current.steer,wheelState.current.speed,!!((touch.current|pad.current)&16));const next=keyboard.current|(touch.current&~3)|steering|pad.current;if(next!==input.current){input.current=next;client.current?.setInput(next);}};
  const neutral=()=>{keyboard.current=0;touch.current=0;touchAxis.current=0;padAxis.current=0;pad.current=0;input.current=0;held.current.clear();client.current?.setInput(0);setTouchReset(n=>n+1);};
  useEffect(()=>{
    try{const stored=JSON.parse(localStorage.getItem('terminl:race-prefs'));if(stored)setPrefs(p=>({...p,...stored}));else setPrefs(p=>({...p,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));setName(JSON.parse(localStorage.getItem('terminl-os:v2'))?.name||'ANON');setResume(JSON.parse(sessionStorage.getItem('terminl:race-session')));}catch{}
    if(invitation(location.href))setInvite(location.href);audio.current=new RaceAudio();
    const key=e=>{
      if(current.current.mode==='menu'||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.ctrlKey||e.metaKey)return;
      if(e.target?.closest?.('[data-testid="mobile-rival"]')&&[' ','Enter'].includes(e.key))return;
      if(e.key==='Escape'&&e.type==='keydown'){neutral();if(current.current.mode==='practice')setPaused(p=>!p);return;}
      if(current.current.settings||current.current.mode==='practice'&&current.current.paused)return;
      const bit=KEYS[e.key]||KEYS[e.key.toLowerCase()];if(!bit)return;e.preventDefault();
      if(e.type==='keydown')held.current.add(e.key);else held.current.delete(e.key);
      keyboard.current=[...held.current].reduce((n,k)=>n|(KEYS[k]||KEYS[k.toLowerCase()]||0),0);applyInput();
    };
    const blur=()=>{neutral();if(current.current.mode==='practice')setPaused(true);};
    const hidden=()=>{if(document.hidden)blur();};
    window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur);window.addEventListener('gamepaddisconnected',blur);document.addEventListener('visibilitychange',hidden);
    return ()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);window.removeEventListener('gamepaddisconnected',blur);document.removeEventListener('visibilitychange',hidden);client.current?.dispose({leave:false});audio.current?.dispose();};
  },[]);
  useEffect(()=>{audio.current?.setVolumes(prefs);try{localStorage.setItem('terminl:race-prefs',JSON.stringify(prefs));}catch{}},[prefs]);
  useEffect(()=>{audio.current?.setPaused(mode==='menu'||mode==='practice'&&paused);},[mode,paused]);
  const playing=mode==='practice'||!!view;
  useEffect(()=>{
    const query=matchMedia('(any-pointer: coarse), (max-width: 900px)');
    const update=()=>{compact.current=query.matches;setMapOpen(false);};
    update();query.addEventListener('change',update);window.addEventListener('resize',update);
    return()=>{query.removeEventListener('change',update);window.removeEventListener('resize',update);};
  },[]);
  useEffect(()=>{setMapOpen(false);},[mode,view?.track,paused,settings]);
  useEffect(()=>{if(!mapOpen)return;const timer=setTimeout(()=>setMapOpen(false),4000);return()=>clearTimeout(timer);},[mapOpen]);
  useEffect(()=>{
    if(!playing)return;const element=canvas.current,container=arena.current;if(!element||!container)return;let disposed=false;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const resize=()=>{if(disposed||!container.isConnected)return;const r=container.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);element.width=Math.round(r.width*dpr);element.height=Math.round(r.height*dpr);};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    return ()=>{disposed=true;observer.disconnect();document.body.style.overflow=previous;};
  },[playing]);
  useEffect(()=>{
    if(mode==='menu')return;let raf,last=performance.now(),accumulator=0,lastUI=0;
    const frame=now=>{
      const elapsed=Math.min(100,now-last);last=now;const o=current.current;
      const controller=navigator.getGamepads?.()?.find?.(p=>p?.connected);
      if(controller&&!o.settings&&!(o.mode==='practice'&&o.paused)){const down=i=>controller.buttons[i]?.pressed,x=controller.axes[0]||0;padAxis.current=Math.abs(x)>.18?Math.sign(x)*Math.pow((Math.min(1,Math.abs(x))-.18)/.82,1.5):0;pad.current=(down(14)?1:0)|(down(15)?2:0)|(down(7)||down(0)?4:0)|(down(6)||down(1)?8:0)|(down(2)?16:0)|(down(5)?32:0)|(down(3)?64:0);applyInput();}
      let state;
      if(o.mode==='practice'&&game.current){if(!o.paused){accumulator+=elapsed;while(accumulator>=FRAME){wheelState.current=game.current.players[0];applyInput();game.current=stepRace(game.current,[input.current,raceBotInput(game.current,1)]);accumulator-=FRAME;}}state=game.current;}
      else {state=client.current?.predictedState();if(state){wheelState.current=state.players[Math.max(0,client.current?.slot??0)];applyInput();}}
      const el=canvas.current;if(state&&el){
        const showMap=!compact.current||o.mapOpen;
        const ctx=el.getContext('2d');if(ctx)drawRace(ctx,state,{width:el.width,height:el.height,slot:Math.max(0,client.current?.slot??0),reducedMotion:o.prefs.reducedMotion,quality:o.prefs.quality,showMap});
        el.dataset.mapVisible=String(showMap);
        el.dataset.tick=String(state.tick);el.dataset.phase=state.phase;el.dataset.track=state.track;el.dataset.passed=String(state.players[0].passed);el.dataset.gear=String(state.players[0].gear||1);el.dataset.steer=String(state.players[0].steer);el.dataset.speed=String(state.players[0].speed);
        el.dataset.input=String(input.current);el.dataset.boost=String(state.players[0].boost);el.dataset.boosting=String(state.players[0].boosting);
        audio.current?.update(o.mode==='online'?client.current.state:state,Math.max(0,client.current?.slot??0));
        if(o.tutorial){const p=state.players[0];if(o.lesson===0&&p.speed>2)setLesson(1);if(o.lesson===1&&p.passed>=2)setLesson(2);if(o.lesson===2&&state.events.some(e=>e.type==='drift'&&e.player===0))setLesson(3);}
        if(now-lastUI>100){setView(state);lastUI=now;}
      }
      raf=requestAnimationFrame(frame);
    };raf=requestAnimationFrame(frame);return ()=>cancelAnimationFrame(raf);
  },[mode]);
  const practice=(teach,cup=!teach)=>{
    client.current?.dispose();client.current=null;neutral();setNotice('');setRoom(null);setSeat(null);setResult(null);setPaused(false);setTutorial(teach);setLesson(0);
    game.current=createRace({vehicles:[vehicle,vehicle==='comet'?'spectre':'comet'],track,cup});setView(game.current);setMode('practice');audio.current?.setPaused(false);audio.current?.unlock();
  };
  const receive=message=>{
    if(message.type==='connection')setConnection(message.status);
    if(message.type==='joined'){setSeat(message);setResume(null);}
    if(message.type==='room'){if(match.current!==message.room.matchId){match.current=message.room.matchId;neutral();setResult(null);}setRoom(message.room);}
    if(message.state)setView(message.state);if(message.type==='result')setResult(message.result);if(message.type==='latency')setRtt(message.rtt);if(message.type==='error')setNotice(message.message||message.code);
  };
  const online=kind=>{
    const url=endpoint();if(!url){setNotice('Online racing needs the configured Railway server. Practice works now.');return;}
    let action;if(kind==='resume'){if(!resume||resume.url!==url){setNotice('That saved race belongs to a different server.');return;}}
    else if(kind==='create')action={type:'create',game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,name:name.trim()||'ANON',character:vehicle,stage:track};
    else{const parsed=invitation(invite);if(!parsed){setNotice('Paste the complete race invitation, including its token.');return;}action={type:'join',game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,...parsed,name:name.trim()||'ANON',character:vehicle,spectator:kind==='watch'};}
    client.current?.dispose({leave:false});neutral();setNotice('');setRoom(null);setSeat(null);setResult(null);setView(null);setPaused(false);setTutorial(false);setMode('online');
    const next=new RumbleClient(url,receive,{game:'wen-lambo',step:stepRace,phase:'racing',rulesVersion:RACE_RULES_VERSION});client.current=next;if(kind==='resume')next.session=resume;next.connect(action);audio.current?.unlock();
  };
  const leave=()=>{client.current?.dispose();client.current=null;game.current=null;neutral();setMode('menu');setRoom(null);setView(null);setSeat(null);setResult(null);setNotice('');setPaused(false);setTutorial(false);};
  const inviteURL=seat?`${location.origin}/os/lambo#room=${seat.code}&token=${seat.token}`:'';
  const me=view?.players[Math.max(0,seat?.slot??0)],done=mode==='practice'?view?.phase==='finished':!!result||room?.phase==='finished',outcome=mode==='practice'?view:result||room?.result;
  const standings=mode==='online'?(client.current?.state||view):view;
  const standing=standings?.players[Math.max(0,seat?.slot??0)];
  const rival=standings?rivalTelemetry(standings,Math.max(0,seat?.slot??0)):null;
  return <div ref={shell} className={`${s.shell} ${playing?s.inRace:''}`}>
    <header className={s.header}><Link href='/os'>▣ TERMINL <span>ARCADE</span></Link><span className={s.preview}>WEN LAMBO / EXOTICS UPDATE</span><div>{mode!=='menu'&&<button onClick={leave}>← LEAVE</button>}<button onClick={()=>{neutral();setSettings(true);if(mode==='practice')setPaused(true);}}>SETTINGS</button><button aria-label='Toggle fullscreen' onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else shell.current?.requestFullscreen?.().catch(()=>setNotice('Fullscreen is unavailable.'));}}>⛶</button></div></header>
    {notice&&<div className={s.notice} role='status'>{notice}<button aria-label='Dismiss notice' onClick={()=>setNotice('')}>×</button></div>}
    {mode==='menu'?<main className={s.menu}>
      <div className={s.hero}><div><span className={s.eyebrow}>PACIFIC COAST. QUESTIONABLE DECISIONS.</span><h1>WEN<br/><em>LAMBO</em><sup>02</sup></h1><p>Finally rich.<br/>Still can&apos;t drive.</p></div><div className={s.heroCar}><VehiclePreview vehicle={vehicle} large/><span>DIAMOND HANDS. HEAVY RIGHT FOOT.</span></div></div>
      <div className={s.garage}><section><div className={s.sectionTitle}><b>01 / YOUR GETAWAY</b><span>EVERY CAR IS FREE</span></div><div className={s.cars}>{Object.values(VEHICLES).map(v=><button key={v.id} aria-pressed={vehicle===v.id} onClick={()=>setVehicle(v.id)}><VehiclePreview vehicle={v.id}/><small>{v.tag}</small><h2>{v.name}</h2><p>{v.description}</p><small className={s.driverLabel}>DRIVER / {v.driver}</small><span className={s.selected}>{vehicle===v.id?'SELECTED ↗':'SELECT +'}</span></button>)}</div></section>
      <aside className={s.playPanel}><span className={s.eyebrow}>THE AFTER-HOURS CUP</span><h2>California.<br/>Full send.</h2><p>Six distinct courses. Three laps each. Drift through turns, release to bank boost, then spend it on the straight.</p><button className={s.primary} onClick={()=>practice(true)}>LEARN TO DRIVE ↗</button><button className={s.secondary} onClick={()=>practice(false,false)}>QUICK RACE →</button><button className={s.secondary} onClick={()=>practice(false)}>SIX-COURSE CUP →</button><div className={s.divider}>REAL ONLINE PvP / 2-DRIVER CUP</div><label>YOUR CALLSIGN<input maxLength={20} value={name} onChange={e=>setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g,''))}/></label><button className={s.primary} onClick={()=>online('create')}>CREATE RACE +</button><label>RACE INVITATION<input value={invite} onChange={e=>setInvite(e.target.value)} placeholder='Paste a full race invitation'/></label><div className={s.two}><button className={s.secondary} onClick={()=>online('join')}>JOIN RACE →</button><button className={s.secondary} onClick={()=>online('watch')}>SPECTATE</button></div>{resume&&<button onClick={()=>online('resume')}>RECONNECT TO {resume.code}</button>}<small>Real players online; clearly labeled bots in practice. No cash, tokens, or NFT prizes.</small></aside></div>
      <section><div className={s.sectionTitle}><b>02 / CHOOSE THE OPENING TRACK</b><span>6 COURSES / QUICK RACE OR GRAND TOUR</span></div><div className={s.tracks}>{CUP_TRACKS.map(id=>TRACKS[id]).map(t=><button key={t.id} aria-pressed={track===t.id} onClick={()=>setTrack(t.id)}><TrackPreview track={t.id}/><div><small>{t.laps} LAPS / {t.tag||(t.theme==='city'?'WIDE SWEEPERS + HAIRPIN':'TECHNICAL CHICANES')}</small><h2>{t.name}</h2><p>{t.subtitle}</p></div></button>)}</div></section>
      <footer className={s.footer}><p>Pepe, Mia, Chloe and Max in the cockpit. Five free cars. Skill-earned boost. All performance classes free. No real car brand affiliation.</p><Link href='/os'>BACK TO THE ARCADE ↗</Link></footer>
    </main>:!playing?<main className={s.lobby}><span className={s.eyebrow}>GRID ASSEMBLY / {connection.toUpperCase()}</span><h1>{room?'Your rival is one link away.':'Connecting to the race server…'}</h1>{room?<><p>{TRACKS[room.stage]?.name} first · six-course cup · {room.spectators} spectators</p><div className={s.lobbyCars}>{room.players.map((p,i)=><article key={i}>{p?<><VehiclePreview vehicle={p.character}/><h2>{p.name}</h2><p>{p.connected?p.ready?'READY ✓':'NOT READY':'RECONNECTING'}</p></>:<><h2>OPEN GRID SLOT</h2><p>Invite another real driver.</p></>}</article>)}</div><label>Room invitation<input readOnly value={inviteURL} onFocus={e=>e.target.select()}/></label><button onClick={async()=>{try{await navigator.clipboard.writeText(inviteURL);setNotice('Race invitation copied.');}catch{setNotice('Select and copy the invitation above.');}}}>COPY INVITATION ↗</button>{seat?.slot>=0&&<button className={s.primary} onClick={()=>client.current?.send({type:'ready',ready:!room.players[seat.slot]?.ready})}>{room.players[seat.slot]?.ready?'CANCEL READY':"I'M READY →"}</button>}<p>Both drivers ready up. Leaving an active cup forfeits it. Reconnect grace: 15 seconds.</p></>:<><p>The server must include the latest WEN LAMBO update. You can still race in practice.</p><button className={s.primary} onClick={leave}>BACK TO GARAGE</button></>}</main>:<main className={s.raceMain}>
      <div className={s.raceBar}><b>{mode==='practice'?'PRACTICE / BOT RIVAL':seat?.slot===-1?'LIVE SPECTATOR':'ONLINE / SERVER AUTHORITATIVE'}</b><span>{TRACKS[view?.track]?.name} · RACE {(view?.trackIndex||0)+1}/{view?.tracks.length}</span><span>{mode==='online'?`${connection.toUpperCase()} · ${rtt}ms`:'NO MATCH REWARDS'}</span></div>
      <div className={s.hud}><div data-testid='race-position' className={s.position}><small>{seat?.slot===-1?'DRIVER 1':'YOUR POSITION'}</small><strong>{standing?.place===1?'1st':standing?.place===2?'2nd':'—'}<i>/2</i></strong></div><div><small>LAP</small><strong>{Math.min((me?.lap||0)+1,3)}<i>/3</i></strong></div><div><small>RACE TIME</small><b>{((view?.raceTicks||0)/60).toFixed(1)}s</b></div><div className={s.boost}><small>BOOST</small><div><i style={{width:`${me?.boost||0}%`}}/></div><span>{me?.drifting?`DRIFT BANK +${Math.floor(me.driftCharge)}`:`${Math.floor(me?.boost||0)}% · RELEASE DRIFT TO BANK`}</span></div><div><small>SPEED</small><strong>{me?.gear===-1?'R ':''}{Math.round((me?.speed||0)*42)}<i>km/h*</i></strong></div>{rival&&<button className={s.mobileRival} data-testid='mobile-rival' aria-label={`${mapOpen?'Hide':'Show'} track map. ${rival.label}. ${rival.direction}. Map closes after four seconds.`} aria-pressed={mapOpen} onClick={()=>setMapOpen(open=>!open)}><small><span aria-hidden='true' style={{display:'inline-block',transform:`rotate(${rival.bearing}rad)`}}>↑</span> RIVAL · {mapOpen?'CLOSE':'MAP'}</small><b>{rival.label.replace('RIVAL ','')}</b></button>}</div>
      <div className={s.arena} ref={arena}><canvas ref={canvas} tabIndex={0} aria-label='WEN LAMBO race. Up accelerates, left and right steer, down brakes and reverses, space drifts, Shift boosts, R recovers.'/>
        {rival&&<div className={s.rivalTracker} data-testid='rival-tracker'><b>{rival.label}</b><span>{rival.direction} · COURSE DISTANCE*</span></div>}
        {view?.phase==='countdown'&&<div className={s.countdown}><span>{TRACKS[view.track].name}</span><strong>{Math.max(1,3-Math.floor(view.phaseTick/60))}</strong><p>TOUCH STEERING PAD OR HOLD ↑ TO LAUNCH</p></div>}
        {tutorial&&!paused&&view?.phase==='racing'&&<div className={s.lesson}><b>{lesson<3?`DRIVING SCHOOL ${lesson+1}/3`:'LICENSE QUESTIONABLY ACQUIRED ✓'}</b><p>{['Small thumb movements steer gently; push to the rim for a sharp turn. Auto-gas launches on touch. Keyboard: ↑ or W for gas, ← → steer.','Follow the road through the next checkpoint. Hold BRAKE / REV (↓) for tight turns; keep holding it at a stop to reverse.','Hold DRIFT (SPACE) while steering through a turn. Release it to bank drift boost.','Now hold BOOST (SHIFT) on a straight to spend boost. Keep racing or try the six-course cup.'][lesson]}</p>{lesson===3&&<button onClick={()=>setTutorial(false)}>KEEP RACING →</button>}</div>}
        {me?.wrongWay&&view?.phase==='racing'&&<div className={s.warning}>WRONG WAY · Turn around or press R to recover</div>}
        {me?.offRoad&&!me?.wrongWay&&view?.phase==='racing'&&<div className={s.warning}>OFF ROAD · Hold BRAKE to reverse, or tap RECOVER</div>}
        {connection!=='connected'&&mode==='online'&&<div className={s.connection}>CONNECTION LOST · Reconnecting · Cup clock continues</div>}
        {paused&&mode==='practice'&&!settings&&<div className={s.overlay}><h2>PIT STOP.</h2><p>Practice is paused.</p><button className={s.primary} onClick={()=>{setPaused(false);audio.current?.unlock();}}>BACK ON TRACK →</button></div>}
        {(view?.phase==='raceOver'||done)&&<div className={s.overlay}><span className={s.eyebrow}>{done?mode==='online'?'SERVER-CONFIRMED CUP RESULT':'PRACTICE CUP COMPLETE':'CHEQUERED FLAG'}</span><h2>{done?outcome?.winner===null?'DEAD HEAT.':seat?.slot===-1?'CUP COMPLETE.':outcome?.winner===(seat?.slot??0)?'BAG SECURED.':'NEXT CUP IS YOURS.':'ONE RACE DOWN.'}</h2><div className={s.scoreboard}>{view?.players.map((p,i)=><div key={i}><b>{room?.players[i]?.name||(i?'PRACTICE BOT':name)}</b><span>{p.points} PTS</span><small>{seconds(view.raceResults.at(-1)?.times[i]??null)}</small></div>)}</div>{done?<><p>{mode==='online'?'Recorded by the server. No financial prizes.':'Practice results stay local.'}</p>{seat?.slot!==-1&&<button className={s.primary} onClick={()=>mode==='practice'?practice(false):client.current?.send({type:'rematch'})}>{mode==='practice'?'RACE ANOTHER CUP →':room?.players[seat?.slot]?.rematch?'WAITING FOR RIVAL…':'VOTE REMATCH →'}</button>}<button onClick={leave}>BACK TO GARAGE</button></>:<p>{view.trackIndex+1<view.tracks.length?`NEXT: ${TRACKS[view.tracks[view.trackIndex+1]].name}`:'FINAL STANDINGS INCOMING'} · {Math.max(0,8-Math.floor(view.phaseTick/60))}s<br/>1st: 10 pts · 2nd: 6 pts · DNF: 0 · Equal finish: 8 each<br/>Cup ties: lower combined race time wins.</p>}</div>}
      </div>
      <div className={s.controls}><p>↑ GAS · ← → STEER · ↓ BRAKE / REVERSE · SPACE DRIFT · SHIFT BOOST · R RECOVER · ESC PAUSE PRACTICE <small>*Arcade speed display</small></p></div>
      {seat?.slot!==-1&&<TouchControls racing onSteer={value=>{touchAxis.current=value;}} resetKey={touchReset} feedback={me?.gear===-1?'REVERSE · steer and hold BRAKE / REV':me?.boosting?'BOOSTING · release to save charge':touch.current&32?me?.offRoad?'BOOST needs tarmac':me?.boost<1?'BOOST empty · drift and release to refill':'':''} disabled={paused||settings||done||view?.phase==='raceOver'||mode==='online'&&connection!=='connected'} onChange={value=>{touch.current=value;applyInput();}}/>}
    </main>}
    {settings&&<Settings prefs={prefs} setPrefs={setPrefs} close={()=>setSettings(false)}/>}
  </div>;
}

function VehiclePreview({vehicle,large=false}){
  const ref=useRef(null);useEffect(()=>{let disposed=false;const paint=()=>{if(disposed||!ref.current)return;const c=ref.current.getContext('2d');c.clearRect(0,0,500,250);drawRearCar(c,vehicle,{x:250,y:240,width:large?370:350,steer:1,tick:0});};paint();preloadRaceArt().then(paint);return ()=>{disposed=true;};},[vehicle,large]);
  return <canvas ref={ref} width={500} height={250} aria-label={`${VEHICLES[vehicle]?.name} arcade roadster with ${VEHICLES[vehicle]?.driver}`}/>;
}
function TrackPreview({track}){const ref=useRef(null);useEffect(()=>{let disposed=false;const state=createRace({track}),paint=()=>{if(!disposed&&ref.current)drawRace(ref.current.getContext('2d'),state,{width:700,height:380,reducedMotion:true,quality:'low'});};paint();preloadRaceArt().then(paint);return()=>{disposed=true;};},[track]);return <canvas ref={ref} width={700} height={380} aria-label={`${TRACKS[track].name} route preview`}/>;}
function Settings({prefs,setPrefs,close}){
  const ref=useRef(null);useEffect(()=>{const el=ref.current,prior=document.activeElement;el.showModal();return ()=>{el.close();prior?.focus();};},[]);
  return <dialog ref={ref} className={s.dialog} onCancel={close} aria-label='Racing settings'><header><h2>PIT SETTINGS</h2><button onClick={close} aria-label='Close settings'>×</button></header><p>Online races do not pause while settings are open.</p>{[['music','Music'],['sfx','Engine & effects']].map(([key,label])=><label key={key}>{label}<input type='range' min='0' max='1' step='.05' value={prefs[key]} onChange={e=>setPrefs(p=>({...p,[key]:Number(e.target.value)}))}/></label>)}<button onClick={()=>setPrefs(p=>({...p,music:0,sfx:0}))}>MUTE ALL</button><label><input type='checkbox' checked={prefs.reducedMotion} onChange={e=>setPrefs(p=>({...p,reducedMotion:e.target.checked}))}/> Reduced motion / no speed zoom or particles</label><label>Quality<select value={prefs.quality} onChange={e=>setPrefs(p=>({...p,quality:e.target.value}))}><option value='high'>High</option><option value='low'>Low</option></select></label><p>Controller: left stick steers; RT/A gas; LT/B brake/reverse; X drift; RB boost; Y recover. Hardware validation pending.</p><p>Recovery costs boost and returns behind your last valid gate. Three laps; every checkpoint must be crossed in order. Race timeout: 120s; finish grace: 30s. Cup tie: lower total race time; equal totals draw. DNF counts as 120s for tie-breaking.</p></dialog>;
}
