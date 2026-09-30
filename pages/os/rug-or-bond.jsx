import dynamic from 'next/dynamic';
import ArcadeMeta from '../../components/arcade/ArcadeMeta';

const RugOrBond = dynamic(() => import('../../components/arcade/RugOrBond'), {
  ssr: false, loading: () => <p style={{ padding: 40, color: 'var(--terminl-accent)', fontFamily: 'var(--terminl-font)' }}>Opening the trading desk…</p>,
});

export default function RugOrBondPage() {
  return <><ArcadeMeta card='rug-or-bond' noindex/><RugOrBond /></>;
}
