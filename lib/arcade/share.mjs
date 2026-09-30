export const SITE_ORIGIN = 'https://terminl.net';
export const ARCADE_OG_VERSION = 'arcade-2026-09';

export const ARCADE_SHARES = Object.freeze({
  arcade: {
    path: '/os',
    title: 'TERMINL Arcade — Your bags can wait.',
    description: 'Drive the Lambo. Fight your group chat. Kickflip the food court. Free TERMINL games—no mint or wallet required.',
    eyebrow: 'FREE GAMES / BAD DECISIONS',
    headline: 'YOUR BAGS\nCAN WAIT.',
    accent: '#b4f58c',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/arcade/og/inferno.png'],
  },
  'wen-lambo': {
    path: '/os/lambo',
    title: 'WEN LAMBO — TERMINL Arcade',
    description: 'Six California courses, five supercars and one bloke on a bike. Race solo or bring a friend. Free to play.',
    eyebrow: '01 / RACING',
    headline: 'WEN\nLAMBO',
    accent: '#ffb33c',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/arcade/og/inferno.png'],
  },
  'rekt-rumble': {
    path: '/os/rumble',
    title: 'REKT RUMBLE — TERMINL Arcade',
    description: 'Pick a degen, learn their finisher and settle the group chat. Solo circuit or private fights. Free to play.',
    eyebrow: '02 / FIGHTING',
    headline: 'REKT\nRUMBLE',
    accent: '#ff725e',
    figures: ['/arcade/og/margin-call-max.png', '/arcade/og/cold-storage-chloe.png'],
  },
  'mall-rat': {
    path: '/os/mall-rat',
    title: 'MALL RAT — TERMINL Arcade',
    description: 'Kickflip the food court, hit the mega ramp and leave seventeen districts asking who raised you. Free to play.',
    eyebrow: '03 / SKATE ATTACK',
    headline: 'MALL\nRAT',
    accent: '#d8f27c',
    scene: '/arcade/after-hours/mall-rat-preview.png',
  },
  'rug-exe': {
    path: '/os/rug-exe',
    title: 'RUG.EXE — TERMINL Arcade',
    description: 'The dev vanished. The bots did not. Fight through eight levels of scheduled maintenance in this free retro shooter.',
    eyebrow: '04 / FIRST-PERSON SHOOTER',
    headline: 'RUG.EXE',
    accent: '#8dff9a',
    scene: '/arcade/after-hours/rug-exe-preview.png',
  },
  'moon-mission': {
    path: '/os/moon',
    title: 'MOON MISSION — TERMINL Arcade',
    description: 'The token never reached the moon, so you are walking. Ten levels, double jumps and one very annoyed Warden. Free to play.',
    eyebrow: '05 / SOLO ADVENTURE',
    headline: 'MOON\nMISSION',
    accent: '#7fd8ff',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/arcade/og/cold-storage-chloe.png'],
  },
  'rug-or-bond': {
    path: '/os/rug-or-bond',
    title: 'RUG OR BOND — TERMINL Arcade',
    description: 'Buy tokens with fake SOL, ride the bonding curve and sell before the dev dumps. A free memecoin trading simulator.',
    eyebrow: 'ARCADE LABS / TRADING SIM',
    headline: 'RUG OR\nBOND',
    accent: '#ffd466',
    figures: ['/arcade/og/buy-high-brian.png'],
  },
  'beat-the-bots': {
    path: '/beat-the-bots',
    title: 'Beat BarryBot — TERMINL Arcade',
    description: 'The bots usually take your allocation. Make one lose a race for a change. Play first—no wallet required.',
    eyebrow: 'OFFICIAL BOT CHALLENGE',
    headline: 'BEAT\nBARRYBOT.',
    accent: '#a9f47a',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/degens/diamond-hands-pepe-share.png'],
  },
  'arcade-pass': {
    path: '/arcade-pass',
    title: 'Your Arcade Pass — TERMINL',
    description: 'Save a verified bot win, recover your qualification and finish your WL setup. No wallet connection required.',
    eyebrow: 'VERIFIED WINS / WL SETUP',
    headline: 'ARCADE\nPASS',
    accent: '#a9f47a',
    figures: ['/degens/diamond-hands-pepe-share.png'],
  },
});

export function arcadeShare(id) {
  return ARCADE_SHARES[id] || ARCADE_SHARES.arcade;
}

export function canonicalArcadeUrl(path) {
  return new URL(path || '/os', SITE_ORIGIN).toString();
}

export function arcadeShareImage(id) {
  return `${SITE_ORIGIN}/api/arcade-card/${id}?v=${ARCADE_OG_VERSION}`;
}
