import Image from 'next/image';
import Link from 'next/link';
import CampaignInvite from './CampaignInvite';
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
  <header className={s.header}><Link className={s.brand} href='/os'><b>TERMINL</b><span>ARCADE</span></Link><nav aria-label='Arcade navigation'><a href='#games'>THE GAMES</a><Link href='/'>THE COLLECTION ↗</Link></nav></header>
  <main>
    <CampaignInvite />
    <section className={s.intro}><div><span className={s.eyebrow}><i/> FREE TO PLAY. EVEN FOR YOU.</span><h1>Your bags<br/><em>can wait.</em></h1></div><p>The chart will still be red.<br/>{' '}Go enjoy something.<br/><span>Free games. No wallet required.</span></p></section>
    <section id='games' className={s.featured} aria-label='Flagship games'>
      <article className={`${s.card} ${s.race}`}><Link href='/os/lambo' className={s.artLink} aria-label='Play Wen Lambo'><div className={s.raceArt}><span className={s.artTag}>01 / RACING</span><GameArt game='race'/><span className={s.artCaption}>THE LAMBO IS FINALLY IN BUDGET.</span></div></Link><div className={s.cardBody}><div className={s.cardTop}><h2>WEN LAMBO</h2><span>SOLO + ONLINE</span></div><p>You said “wen Lambo” in 2021. Here. Five supercars, six California courses, and one bloke on a bike who might beat you. Race solo or bring a friend.</p><div className={s.cardBottom}><span>6 COURSES · 6 RIDES<br/>QUICK RACE / SIX-COURSE CUP</span><Link href='/os/lambo'>START YOUR ENGINE ↗</Link></div></div></article>
      <article className={`${s.card} ${s.fight}`}><Link href='/os/rumble' className={s.artLink} aria-label='Play Rekt Rumble'><div className={s.fightArt}><span className={s.artTag}>02 / FIGHTING</span><Image src='/degens/margin-call-max.webp' alt='' width={340} height={560} sizes='(max-width: 700px) 45vw, 300px' className={s.fighterLeft}/><b className={s.versus}>VS</b><Image src='/degens/cold-storage-chloe.webp' alt='' width={340} height={560} sizes='(max-width: 700px) 45vw, 300px' className={s.fighterRight}/><span className={s.artCaption}>HE SAID “EASY 100X.”</span></div></Link><div className={s.cardBody}><div className={s.cardTop}><h2>REKT RUMBLE</h2><span>SOLO + ONLINE</span></div><p>Your friend called it a blue chip. It has four holders now. Pick a degen, learn their finisher, and have a productive conversation. Solo circuit or private fights.</p><div className={s.cardBottom}><span>6 FIGHTERS · 2 ARENAS<br/>SOLO CIRCUIT / PRIVATE FIGHTS</span><Link href='/os/rumble'>STEP INTO THE RING ↗</Link></div></div></article>
    </section>
    <section className={`${s.featured} ${s.afterHours}`} aria-label='After-hours games'>
      {[{id:'mall-rat',name:'MALL RAT',tag:'03 / SKATE ATTACK',line:'SECURITY HAS HAD A LONG NIGHT.',description:'Max found a hobby with a lower injury rate than his trading. Kickflip the food court, hit the mega ramp and leave seventeen districts asking who raised you.',detail:'4 DEGENS · 17 DISTRICTS',action:'BREAK IN ↗'},{id:'rug-exe',name:'RUG.EXE',tag:'04 / FIRST-PERSON SHOOTER',line:'SUPPORT HAS DISABLED REPLIES.',description:'The dev vanished. The bots didn’t. Take eight weapons through eight levels of what the team insists is “scheduled maintenance.” Find the exit before they find the liquidity.',detail:'8 LEVELS · 8 WEAPONS · SECRETS',action:'ENTER THE PROTOCOL ↗'}].map(game=><article key={game.id} className={s.card}><Link href={`/os/${game.id}`} className={s.artLink} aria-label={`Play ${game.name}`}><div className={s.newGameArt}><Image src={`/arcade/after-hours/${game.id}-preview.png`} alt={`${game.name} gameplay`} fill sizes='(max-width: 700px) 100vw, 50vw'/><span className={s.artTag}>{game.tag}</span><span className={s.artCaption}>{game.line}</span></div></Link><div className={s.cardBody}><div className={s.cardTop}><h2>{game.name}</h2><span>SOLO / 3D</span></div><p>{game.description}</p><div className={s.cardBottom}><span>{game.detail}<br/>LOCAL RECORDS / SAVED PROGRESS</span><Link href={`/os/${game.id}`}>{game.action}</Link></div></div></article>)}
    </section>
    <section className={s.adventure} aria-label='Solo adventure'><Link href='/os/moon' className={s.moonArt} aria-label='Play Moon Mission'><GameArt game='moon'/></Link><div><span className={s.eyebrow}>SOMEONE HAS TO ACTUALLY GO / SOLO ADVENTURE</span><h2>MOON MISSION</h2><p>The token never got there, so you’re walking. Ten levels of double jumps, saws and increasingly unreasonable real estate. The Warden would like a word about your landing.</p><div className={s.adventureBottom}><span>10-LEVEL CAMPAIGN<br/>SAVED PROGRESS · FINAL BOSS</span><Link href='/os/moon'>GO TO THE MOON ↗</Link></div></div></section>
    <div className={s.playNote}><span>KEEP YOUR WALLET SHUT.</span><p>No mint needed. Pick a game. You can lose to your friends for free.</p><span>KEYBOARD · TOUCH · CONTROLLER</span></div>
  </main><footer className={s.footer}><Link href='/os'>TERMINL ARCADE</Link><span>YOU WERE LEAVING THREE ROUNDS AGO.</span><Link href='/'>MEET THE COLLECTION ↗</Link></footer>
  </div>;}
