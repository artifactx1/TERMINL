/** Touch adapters emit the existing authoritative input masks, never game state. */
export function raceSteeringTarget(x) {
  if (!Number.isFinite(x) || Math.abs(x) <= .28) return 0;
  const travel = Math.min(1, (Math.abs(x) - .28) / .72);
  return Math.sign(x) * Math.pow(travel, 1.7);
}

/** Feather the existing left/right inputs around a target wheel angle.
 * Read actual/predicted wheel travel each simulation/render step: holding a small
 * thumb correction must never accumulate into full lock. No protocol changes.
 */
export function raceTouchSteeringInput(target, currentSteer, speed, drifting = false) {
  if (!Number.isFinite(target) || target === 0) return 0;
  // Drifting deliberately retains the continuous directional input required by
  // the existing drift-charge rules; feathering must not bank/reset every frame.
  if (drifting) return target < 0 ? 1 : 2;
  const pace = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0) / 5.6);
  // Keep the precision zone; reserve the outer throw for deliberate sharp turns.
  // Full lock is available at parking/reverse speeds, 70% at racing speed.
  const rim = Math.max(0, (Math.abs(target) - .45) / .55);
  const limit = .75 - .39 * pace + rim * (.25 + .09 * pace);
  const desired = Math.max(-1, Math.min(1, target)) * limit;
  const actual = Number.isFinite(currentSteer) ? currentSteer : 0;
  if (desired > 0) return actual < desired ? 2 : 0;
  return actual > desired ? 1 : 0;
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
