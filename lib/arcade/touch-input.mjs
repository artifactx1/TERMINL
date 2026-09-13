/** Touch adapters emit the existing authoritative input masks, never game state. */
export function directionMask(x, y, racing = false) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  if (racing) return x < -.18 ? 1 : x > .18 ? 2 : 0;
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
