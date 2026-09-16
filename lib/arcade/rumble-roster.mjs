/** Public showcase references only. No unpublished collection metadata. */
export const RUMBLE_ROSTER=Object.freeze([
  {id:'max',name:'Margin Call Max',portrait:'margin-call-max',style:'HIGH COMMITMENT / GRAPPLER',line:'125× leverage. Zero chill.',tip:'Close the gap. Catch a guard with a throw. Miss, and you pay for it.'},
  {id:'diamond',name:'Diamond Hands Pepe',portrait:'diamond-hands-pepe',style:'PATIENT PRESSURE / BRUISER',line:'The only thing he sells is punches.',tip:'Own your space. Block the rush. Punish with the diamond uppercut.'},
  {id:'brian',name:'Buy-High Brian',portrait:'buy-high-brian',style:'ALL-IN DAMAGE / BRAWLER',line:'Your buy signal. Their sell signal.',tip:'Big swings and a charging Market Buy. Bait a miss, then spend their recovery on damage. Your own whiffs are expensive.'},
  {id:'mia',name:'MEV Mia',portrait:'mev-mia',style:'FAST FEET / PRESSURE',line:'Front-runs your next mistake.',tip:'The fastest fighter, with lighter hits. Check with Priority Tap, mix low attacks and throws, then dash out before a counter.'},
  {id:'bernie',name:'Bridge Burn Bernie',portrait:'bridge-burn-bernie',style:'LONG REACH / PUNISHER',line:'Brought a wrench to an exploit.',tip:'The wrench owns long range. Keep them at its tip. Slow wind-ups make panic swings dangerous when someone gets inside.'},
  {id:'chloe',name:'Cold Storage Chloe',portrait:'cold-storage-chloe',style:'ARMORED COUNTERS / DEFENSE',line:'Offline. Unbothered. Overcollateralized.',tip:'Walk patiently and make them commit. Vault Door absorbs one startup hit, but a throw beats your safe. Spend meter on a punish.'},
].map(Object.freeze));
export const rosterFor=id=>RUMBLE_ROSTER.find(f=>f.id===id)||null;
