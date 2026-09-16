import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createFight, MOVES, moveFor } from "../../lib/arcade/rumble-sim.mjs";
import { drawRumble, ANIMATION_CLIPS, RIG_ANCHORS } from "../../lib/arcade/rumble-render";
import { RUMBLE_SPRITES } from "../../lib/arcade/rumble-sprites.mjs";
import { RumbleAudio, SOUND_CUES } from "../../lib/arcade/rumble-audio";
import { RUMBLE_ROSTER } from "../../lib/arcade/rumble-roster.mjs";
import manifest from "../../data/arcade-assets.json";
import s from "../../styles/Rumble.module.css";

export default function AssetLab(){
  const canvas=useRef(null),audio=useRef(null),images=useRef({}),options=useRef(null);
  const [character,setCharacter]=useState("max"),[clip,setClip]=useState("idle"),[move,setMove]=useState("heavy"),[stage,setStage]=useState("dead-mall"),[debug,setDebug]=useState(true),[playing,setPlaying]=useState(true),[timing,setTiming]=useState(0),[load,setLoad]=useState("Loading stage plates…");
  options.current={character,clip,move,stage,debug,playing};
  useEffect(()=>{
    let disposed=false,raf,tick=0,last=performance.now(),sum=0,count=0;audio.current=new RumbleAudio();audio.current.setVolumes({music:0,sfx:.4});
    const assets=[...["dead-mall","laundromat"].map(id=>({id,src:`/arcade/${id}-v1.webp`})),...Object.entries(RUMBLE_SPRITES).map(([id,sheet])=>({id,src:sheet.src}))];
    for(const asset of assets){const image=new window.Image();image.onload=()=>{if(disposed)return;images.current[asset.id]=image;setLoad(`${Object.keys(images.current).length} / ${assets.length} stage and fighter images loaded`);};image.onerror=()=>{if(!disposed)setLoad("Asset failure: "+asset.id);};image.src=asset.src;}
    const frame=now=>{
      const o=options.current;if(o.playing)tick+=(now-last)/(1000/60);last=now;
      const state=createFight({characters:[o.character,o.character==="max"?"diamond":"max"],stage:o.stage});state.phase="fight";state.tick=Math.floor(tick);state.players[0].x=400;state.players[1].x=680;state.players[0].previewClip=o.clip;
      if(["anticipation","active","recovery"].includes(o.clip)){const m=moveFor(o.character,o.move);state.players[0].action={id:o.move,frame:o.clip==="anticipation"?Math.max(0,m.startup-3):o.clip==="active"?m.startup+1:m.startup+m.active+5,hit:false};}
      const ctx=canvas.current?.getContext("2d");if(ctx){const start=performance.now();drawRumble(ctx,state,{width:1000,height:600,images:images.current,debug:o.debug,quality:"high",reducedMotion:false});sum+=performance.now()-start;if(++count===120){setTiming(sum/count);sum=0;count=0;}}
      raf=requestAnimationFrame(frame);
    };raf=requestAnimationFrame(frame);
    return ()=>{disposed=true;cancelAnimationFrame(raf);audio.current?.dispose();images.current={};};
  },[]);
  const clips=Array.isArray(ANIMATION_CLIPS)?ANIMATION_CLIPS:Object.keys(ANIMATION_CLIPS);
  return <div className={s.shell}><header className={s.header}><Link href="/os/rumble">← REKT RUMBLE</Link><span className={s.buildTag}>ASSET LAB / DEVELOPMENT REVIEW</span></header><main className={s.lab}><span className={s.eyebrow}>THE PARTS BEHIND THE BAD DECISIONS</span><h1>Animation & asset lab.</h1><p>Illustrated combat poses, authored simulation hitboxes, original stage plates and synthesized sound. Each fighter uses the detailed companion sprite sheet; the canvas rig is a loading fallback.</p><div><label>FIGHTER<select value={character} onChange={e=>setCharacter(e.target.value)}>{RUMBLE_ROSTER.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>CLIP<select value={clip} onChange={e=>setClip(e.target.value)}>{clips.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>MOVE<select value={move} onChange={e=>setMove(e.target.value)}>{Object.keys(MOVES[character]).map(m=><option key={m} value={m}>{MOVES[character][m].name}</option>)}</select></label><label>STAGE<select value={stage} onChange={e=>setStage(e.target.value)}><option value="dead-mall">Dead Mall Exchange</option><option value="laundromat">Liquidation Laundromat</option></select></label><button onClick={()=>setPlaying(v=>!v)}>{playing?"PAUSE ANIMATION":"PLAY ANIMATION"}</button><label><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)} /> HITBOXES + ANCHORS</label></div><canvas ref={canvas} width={1000} height={600} aria-label="Live articulated animation preview with collision boxes and attachment anchors" /><p>{load} · mean Canvas render cost over 120 frames: {timing.toFixed(2)} ms on this browser. This is not a device-independent FPS claim.</p><h2>Sound audition</h2><p>Click to unlock audio. All cues are original synthesis; no external samples.</p><div>{SOUND_CUES.map(c=><button key={c} onClick={async()=>{await audio.current?.unlock();audio.current?.audition(c);}}>{c}</button>)}</div><h2>Versioned manifest / v{manifest.version}</h2><div className={s.labInfo}>{manifest.assets.map(a=><article key={a.id}><h3>{a.id}</h3><p>{a.role}<br />{a.source}<br />{a.review}<br />Decoded budget: {(a.decodedBudgetBytes/1048576).toFixed(2)} MiB</p><p>{a.provenance}</p></article>)}</div><p>Release validator intentionally rejects unapproved assets. Full collection validation emits aggregate counts only; unpublished NFT metadata is never bundled.</p></main></div>;
}
