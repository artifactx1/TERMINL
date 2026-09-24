import Head from 'next/head';
import dynamic from 'next/dynamic';

const RugOrBond = dynamic(() => import('../../components/arcade/RugOrBond'), {
  ssr: false, loading: () => <p style={{ padding: 40, color: 'var(--terminl-accent)', fontFamily: 'var(--terminl-font)' }}>Opening the trading desk…</p>,
});

export default function RugOrBondPage() {
  return <><Head><title>RUG OR BOND — TERMINL Arcade</title><meta name="description" content="A memecoin trading simulator. Buy tokens with fake SOL, ride the bonding curve, and sell before the dev dumps." /><meta name="robots" content="noindex" /></Head><RugOrBond /></>;
}
