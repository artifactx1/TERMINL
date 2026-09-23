/** The largest selectable claim under the active phase's wallet and supply limits. */
export function maxMintQuantity(active) {
  if (!active?.open) return 1;

  // Use the raw on-chain/proven cap, including large "unlimited" values.
  // The display's capPerWallet may hide those values, but they still bind claims.
  const walletLeft = active.perWallet > active.claimed
    ? active.perWallet - active.claimed
    : 0n;
  const bounds = [walletLeft, active.remaining, BigInt(Number.MAX_SAFE_INTEGER)]
    .filter((value) => value !== null);
  const maximum = bounds.reduce((a, b) => a < b ? a : b);

  // Closed/exhausted states hide the mint controls; keep the picker at one.
  return Math.max(1, Number(maximum));
}
