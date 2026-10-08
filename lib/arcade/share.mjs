export const SITE_ORIGIN = 'https://terminl.net';
export const ARCADE_OG_VERSION = 'glorp-2026-10';

export const ARCADE_SHARES = Object.freeze({
  arcade: {
    path: '/os',
    title: 'TERMINL Arcade — Your bags can wait.',
    description: 'Drive the Lambo. Fight your group chat. Kickflip the food court. Free TERMINL games—no mint or wallet required.',
    eyebrow: 'FREE GAMES / BAD DECISIONS',
    headline: 'YOUR BAGS\nCAN WAIT.',
    accent: '#b4f58c',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'wen-lambo': {
    path: '/os/lambo',
    title: 'WEN LAMBO — TERMINL Arcade',
    description: 'Six California courses, five supercars and one bloke on a bike. Race solo or bring a friend. Free to play.',
    eyebrow: '01 / RACING',
    headline: 'WEN\nLAMBO',
    accent: '#ffb33c',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'rekt-rumble': {
    path: '/os/rumble',
    title: 'REKT RUMBLE — TERMINL Arcade',
    description: 'Pick a degen, learn their finisher and settle the group chat. Solo circuit or private fights. Free to play.',
    eyebrow: '02 / FIGHTING',
    headline: 'REKT\nRUMBLE',
    accent: '#ff725e',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'mall-rat': {
    path: '/os/mall-rat',
    title: 'MALL RAT — TERMINL Arcade',
    description: 'Kickflip the food court, hit the mega ramp and leave seventeen districts asking who raised you. Free to play.',
    eyebrow: '03 / SKATE ATTACK',
    headline: 'MALL\nRAT',
    accent: '#d8f27c',
    scene: '/arcade/after-hours/mall-rat-preview.png',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'rug-exe': {
    path: '/os/rug-exe',
    title: 'RUG.EXE — TERMINL Arcade',
    description: 'The dev vanished. The bots did not. Fight through eight levels of scheduled maintenance in this free retro shooter.',
    eyebrow: '04 / FIRST-PERSON SHOOTER',
    headline: 'RUG.EXE',
    accent: '#8dff9a',
    scene: '/arcade/after-hours/rug-exe-preview.png',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'moon-mission': {
    path: '/os/moon',
    title: 'MOON MISSION — TERMINL Arcade',
    description: 'The token never reached the moon, so you are walking. Ten levels, double jumps and one very annoyed Warden. Free to play.',
    eyebrow: '05 / SOLO ADVENTURE',
    headline: 'MOON\nMISSION',
    accent: '#7fd8ff',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'rug-or-bond': {
    path: '/os/rug-or-bond',
    title: 'RUG OR BOND — TERMINL Arcade',
    description: 'Buy tokens with fake SOL, ride the bonding curve and sell before the dev dumps. A free memecoin trading simulator.',
    eyebrow: 'ARCADE LABS / TRADING SIM',
    headline: 'RUG OR\nBOND',
    accent: '#ffd466',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'beat-the-bots': {
    path: '/beat-the-bots',
    title: 'Beat the Bots for FCFS WL — TERMINL Arcade',
    description: 'Beat BarryBot across a six-race cup or clear the six-fight Rekt Rumble circuit to earn an FCFS WL spot. No wallet required.',
    eyebrow: 'OFFICIAL BOT CHALLENGE / FCFS WL',
    headline: 'BEAT\nBARRYBOT.',
    accent: '#a9f47a',
    scene: '/arcade/california-neon-v1.png',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'arcade-pass': {
    path: '/arcade-pass',
    title: 'Your Arcade Pass — TERMINL',
    description: 'Sign in to see your FCFS WL spots, arcade points and leaderboard rank, and finish your WL setup. No wallet connection required.',
    eyebrow: 'WL SPOTS / POINTS / WL SETUP',
    headline: 'ARCADE\nPASS',
    accent: '#a9f47a',
    figures: ['/degens/diamond-hands-glorp-share.png'],
  },
  'arcade-leaderboard': {
    path: '/leaderboard',
    title: 'Arcade Leaderboard — TERMINL',
    description: 'Server-verified arcade points from the Barry Cup and the Rekt Rumble circuit. See who is beating the bots.',
    eyebrow: 'VERIFIED POINTS / BEAT THE BOTS',
    headline: 'ARCADE\nLEADERBOARD',
    accent: '#a9f47a',
    figures: ['/degens/diamond-hands-glorp-share.png'],
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
