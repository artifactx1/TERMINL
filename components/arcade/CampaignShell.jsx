import Link from 'next/link';
import s from '../../styles/Campaign.module.css';
export default function CampaignShell({children}){return <div className={s.shell}>
  <header className={s.header}><Link href='/'><b>TERMINL</b></Link><nav><Link href='/os'>ARCADE</Link><Link href='/beat-the-bots'>BEAT THE BOTS</Link><Link href='/arcade-pass'>MY PASS</Link></nav></header>
  <main className={s.main}>{children}</main><footer className={s.footer}><span>PLAY FIRST. KEEP YOUR WALLET SHUT.</span><Link href='/arcade-privacy'>PRIVACY / ACCESS RULES</Link></footer>
</div>;}
