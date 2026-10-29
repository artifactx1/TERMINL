import Head from 'next/head';
import Link from 'next/link';
import CampaignShell from './CampaignShell';
import s from '../../styles/Campaign.module.css';

export default function EnrollmentClosed(){
  return <CampaignShell><Head>
    <title>Allowlist enrollment closed — TERMINL</title>
    <meta name='description' content='TERMINL allowlist applications and arcade qualification have closed. Check your existing mint eligibility.'/>
    <meta property='og:title' content='Allowlist enrollment closed — TERMINL'/>
    <meta property='og:description' content='Check your existing mint eligibility on TERMINL.net.'/>
  </Head>
    <section className={s.card}>
      <span className={s.eyebrow}>TERMINL / ALLOWLIST</span>
      <h1 className={s.title}>The entry window has closed.</h1>
      <p>Allowlist applications and game qualification have ended. You can check your existing mint eligibility below.</p>
      <div className={s.actions}><Link className={s.primary} href='/#allowlist-checker'>CHECK WL STATUS →</Link><Link className={s.secondary} href='/os'>PLAY THE FREE ARCADE →</Link></div>
      <p className={s.fine}>Playing now does not earn a new allowlist spot.</p>
    </section>
  </CampaignShell>;
}
