/** Finisher timing is shared by the authority, presentation and controls. */
export const FINISH_WINDOW_TICKS = 240;
export const FINISHER_IMPACT_TICK = 60;
export const FINISHER_DURATION_TICKS = 210;
export const FINISHERS = Object.freeze(Object.fromEntries([
  ['max', 'Margin Call', 'A rising uppercut sends the opponent skyward.', '#ffba69', 'launch'],
  ['diamond', 'Diamond Standard', 'A diamond-powered punch blasts the opponent across the arena.', '#77eac7', 'crystal'],
  ['brian', 'All In', 'An explosive shoulder charge ends in a full-body knockdown.', '#ffc65c', 'charge'],
  ['mia', 'Front Run', 'A burst of afterimages leads into a spinning knockout kick.', '#ff86c2', 'glitch'],
  ['bernie', 'Bridge Closed', 'A wrench slam sends a shockwave through the floor.', '#ff7557', 'shockwave'],
  ['chloe', 'Cold Shutdown', 'An ice blast freezes the opponent in place before a dramatic knockout.', '#77baff', 'freeze'],
].map(([id,name,description,color,effect]) => [id,Object.freeze({id,name,description,color,effect})])));
