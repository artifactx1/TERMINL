/**
 * Proves lib/mint.js encodes `claim` exactly as the ABI says it should.
 *
 * The mint encodes its calldata by hand to keep a wallet SDK out of the bundle.
 * That is only safe if it is checked against a real encoder, so this diffs it
 * against `cast calldata` across the cases that actually differ: free and
 * priced, single and batch, native and ERC-20.
 *
 *   node scripts/verify-calldata.mjs
 *
 * Requires foundry on PATH. Exits non-zero on any mismatch.
 */
import { execFileSync } from "child_process";
import { encodeClaim } from "../lib/mint.js";

const SIG = "claim(address,uint256,address,uint256,(bytes32[],uint256,uint256,address),bytes)";
const MAX = (1n << 256n) - 1n;
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO = "0x0000000000000000000000000000000000000000";

const CASES = [
  { name: "free mint, one",        receiver: "0x1111111111111111111111111111111111111111", quantity: 1n,  currency: NATIVE, pricePerToken: 0n },
  { name: "priced, one",           receiver: "0x2222222222222222222222222222222222222222", quantity: 1n,  currency: NATIVE, pricePerToken: 5_000_000_000_000_000n },
  { name: "priced, batch of ten",  receiver: "0x3333333333333333333333333333333333333333", quantity: 10n, currency: NATIVE, pricePerToken: 12_345_678_901_234_567n },
  { name: "erc20 currency",        receiver: "0x4444444444444444444444444444444444444444", quantity: 3n,  currency: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", pricePerToken: 1n },
  { name: "zero address receiver", receiver: ZERO,                                          quantity: 1n,  currency: NATIVE, pricePerToken: 0n },
];

/* The no-override sentinel lib/mint.js embeds: empty proof, MaxUint256 price. */
const proofArg = `([],0,${MAX},${ZERO})`;

let failed = 0;
for (const c of CASES) {
  const expected = execFileSync("cast", [
    "calldata", SIG,
    c.receiver, String(c.quantity), c.currency, String(c.pricePerToken), proofArg, "0x",
  ], { encoding: "utf8" }).trim().toLowerCase();

  const actual = encodeClaim(c).toLowerCase();

  if (actual === expected) {
    console.log(`  ok    ${c.name}  (${(actual.length - 2) / 2} bytes)`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${c.name}`);
    console.error(`    cast: ${expected}`);
    console.error(`    ours: ${actual}`);
  }
}

if (failed) {
  console.error(`\n${failed} of ${CASES.length} mismatched — do not ship this.`);
  process.exit(1);
}
console.log(`\nall ${CASES.length} cases match cast`);
