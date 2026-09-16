/** Touch adapters emit button masks and a proportional steering target, never game state. */
export function raceSteeringTarget(x) {
  if (!Number.isFinite(x) || Math.abs(x) <= .12) return 0;
  const travel = Math.min(1, (Math.abs(x) - .12) / .88);
  return Math.sign(x) * Math.pow(travel, 1.5);
}

export function directionMask(x, y, racing = false) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  if (racing) return raceSteeringTarget(x) < 0 ? 1 : raceSteeringTarget(x) > 0 ? 2 : 0;
  if (Math.hypot(x, y) < .22) return 0;
  const threshold = Math.max(.2, Math.max(Math.abs(x), Math.abs(y)) * .45);
  return (x < -threshold ? 1 : x > threshold ? 2 : 0)
    | (y < -threshold ? 4 : y > threshold ? 8 : 0);
}

export function touchMask(sources, { racing = false, autoGas = false, engaged = false } = {}) {
  let mask = [...sources.values()].reduce((value, bit) => value | bit, 0);
  if (racing) {
    if (autoGas && engaged) mask |= 4;
    // A thumb on BOOST is also a pedal press; mobile should not need three fingers.
    if (mask & 32) mask |= 4;
    // Braking must override automatic AND manually held gas so reverse always works.
    if (mask & 8) mask &= ~(4 | 32);
  }
  return mask;
}
