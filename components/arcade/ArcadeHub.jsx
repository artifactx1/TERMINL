import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {drawVehicleArt,preloadVehicleArt} from '../../lib/arcade/race-exotics.js';
import {drawCampaign} from '../../lib/moon-campaign-draw.js';
import {newCampaignLevel} from '../../lib/moon-campaign.mjs';
import s from '../../styles/ArcadeHub.module.css';

function GameArt({game}){
  const canvas=useRef(null);
  useEffect(()=>{let disposed=false;const draw=()=>{if(disposed||!canvas.current)return;const c=canvas.current.getContext('2d');c.clearRect(0,0,800,450);if(game==='race')drawVehicleArt(c,'inferno',{x:400,y:423,width:740,height:310,view:'garage'});else drawCampaign(c,{...newCampaignLevel(7),x:450},800);};
    if(game==='race')preloadVehicleArt().then(draw);else draw();return()=>{disposed=true;};},[game]);
  return <canvas ref={canvas} width={800} height={450} aria-label={game==='race'?'Inferno X supercar':'Moon Mission sky-island level'}/>;
}
export default function ArcadeHub(){return <div className={s.shell}>
  <header className={s.header}><Link className={s.brand} href='/os'>▣ TERMINL <span>ARCADE</span></Link><nav aria-label='Arcade navigation'><a href='#games'>THE GAMES</a><Link href='/'>THE COLLECTION ↗</Link></nav></header>
  <main>
    <section className={s.intro}><div><span className={s.eyebrow}><i/> FREE TO PLAY. READY WHEN YOU ARE.</span><h1>Good games.<br/><em>Bad decisions.</em></h1></div><p>Take the coast.<br/>{' '}Settle the score.<br/><span>One more round is always a good idea.</span></p></section>
    <section id='games' className={s.featured} aria-label='Flagship games'>
      <article className={`${s.card} ${s.race}`}><Link href='/os/lambo' className={s.artLink} aria-label='Play Wen Lambo'><div className={s.raceArt}><span className={s.artTag}>01 / RACING</span><GameArt game='race'/><span className={s.artCaption}>PACIFIC COAST. FULL SEND.</span></div></Link><div className={s.cardBody}><div className={s.cardTop}><h2>WEN LAMBO</h2><span>SOLO + ONLINE</span></div><p>Five supercars. One Bike Tyson. Race six California courses, chase a changing rival, or invite a friend to the cup.</p><div className={s.cardBottom}><span>6 COURSES · 6 RIDES<br/>QUICK RACE / SIX-COURSE CUP</span><Link href='/os/lambo'>START YOUR ENGINE ↗</Link></div></div></article>
      <article className={`${s.card} ${s.fight}`}><Link href='/os/rumble' className={s.artLink} aria-label='Play Rekt Rumble'><div className={s.fightArt}><span className={s.artTag}>02 / FIGHTING</span><Image src='/degens/margin-call-max.webp' alt='' width={340} height={560} sizes='(max-width: 700px) 45vw, 300px' className={s.fighterLeft}/><b className={s.versus}>VS</b><Image src='/degens/cold-storage-chloe.webp' alt='' width={340} height={560} sizes='(max-width: 700px) 45vw, 300px' className={s.fighterRight}/><span className={s.artCaption}>THE MARKET TOOK ENOUGH.</span></div></Link><div className={s.cardBody}><div className={s.cardTop}><h2>REKT RUMBLE</h2><span>SOLO + ONLINE</span></div><p>Pick your fighter and learn their bad habits. Work through the solo circuit or settle it with a friend, one round at a time.</p><div className={s.cardBottom}><span>6 FIGHTERS · 2 ARENAS<br/>SOLO CIRCUIT / PRIVATE FIGHTS</span><Link href='/os/rumble'>STEP INTO THE RING ↗</Link></div></div></article>
    </section>
    <section className={s.adventure} aria-label='Solo adventure'><Link href='/os/moon' className={s.moonArt} aria-label='Play Moon Mission'><GameArt game='moon'/></Link><div><span className={s.eyebrow}>A LITTLE FURTHER FROM HOME / SOLO ADVENTURE</span><h2>MOON MISSION</h2><p>Ten levels. Ten different problems. Double-jump from neon rooftops to lunar ruins, then take on the Warden. Your next checkpoint is waiting.</p><div className={s.adventureBottom}><span>10-LEVEL CAMPAIGN<br/>SAVED PROGRESS · FINAL BOSS</span><Link href='/os/moon'>GO TO THE MOON ↗</Link></div></div></section>
    <div className={s.playNote}><span>PLAY FIRST.</span><p>No wallet. No checkout. Choose a game and get straight into it.</p><span>KEYBOARD · TOUCH · CONTROLLER</span></div>
  </main><footer className={s.footer}><Link href='/os'>TERMINL ARCADE</Link><span>BUILT FOR ONE MORE GO.</span><Link href='/'>MEET THE COLLECTION ↗</Link></footer>
  </div>;}
