/**
 * Proves lib/mint.js speaks the ABI exactly as the contract does.
 *
 * The mint encodes and decodes by hand to keep a wallet SDK out of the bundle.
 * That is only safe if every hand-written byte is checked against a real
 * encoder, so this covers all three kinds:
 *
 *   1. `claim` calldata, diffed against `cast calldata` across the cases that
 *      actually differ — free and priced, single and batch, native and ERC-20.
 *   2. the claim-condition decoder, run over conditions encoded by
 *      `cast abi-encode` — a one-word shift there reads as a free phase.
 *   3. every selector: the three getters, and each custom error, re-derived
 *      with `cast sig`. A wrong error selector fails silently, showing a
 *      JSON-RPC envelope where "sold out" belongs.
 *
 *   node scripts/verify-calldata.mjs
 *
 * Requires foundry on PATH. Exits non-zero on any mismatch.
 */
import { execFileSync } from "child_process";
import { SIGNATURES, decodeCondition, encodeClaim } from "../lib/mint.js";

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

/* readDrop reads the claim condition by word index. `claimCondition` is a public
 * struct, so its getter returns the members *flattened* — a struct return would
 * put an offset in word 0 and shift every field by one, which reads as a phase
 * that opened in 1970 and costs 32 wei. Encode real conditions with cast and
 * assert the decoder gets each member back. */
const CONDITION_SIG = "f(uint256,uint256,uint256,uint256,bytes32,uint256,address,string)";
const ROOT = `0x${"00".repeat(32)}`;

const CONDITIONS = [
  { name: "unset phase",  startsAt: 0n, maxClaimable: 0n, claimed: 0n,     perWallet: 0n,   price: 0n,                    currency: ZERO,   metadata: "" },
  { name: "live, priced", startsAt: 1_788_000_000n, maxClaimable: 2048n, claimed: 391n, perWallet: 20n, price: 5_000_000_000_000_000n, currency: NATIVE, metadata: "ipfs://phase" },
  { name: "unlimited cap", startsAt: 1n, maxClaimable: 2048n, claimed: 2048n, perWallet: MAX, price: 1n, currency: NATIVE, metadata: "" },
];

console.log("");
let decodeFailures = 0;
for (const c of CONDITIONS) {
  const encoded = execFileSync("cast", [
    "abi-encode", CONDITION_SIG,
    String(c.startsAt), String(c.maxClaimable), String(c.claimed), String(c.perWallet),
    ROOT, String(c.price), c.currency, c.metadata,
  ], { encoding: "utf8" }).trim();

  const got = decodeCondition(encoded);
  const bad = ["startsAt", "maxClaimable", "claimed", "perWallet", "price"]
    .filter((k) => got[k] !== c[k])
    .concat(got.currency.toLowerCase() === c.currency.toLowerCase() ? [] : ["currency"]);

  if (bad.length === 0) {
    console.log(`  ok    condition: ${c.name}`);
  } else {
    decodeFailures += 1;
    console.error(`  FAIL  condition: ${c.name} — wrong: ${bad.join(", ")}`);
    console.error(`    cast: ${JSON.stringify(c, (k, v) => (typeof v === "bigint" ? String(v) : v))}`);
    console.error(`    ours: ${JSON.stringify(got, (k, v) => (typeof v === "bigint" ? String(v) : v))}`);
  }
}
failed += decodeFailures;

/* The read selectors and the custom-error selectors are hand-written constants
 * too, and a wrong one fails silently — a mistyped error selector just means the
 * user reads a JSON-RPC envelope instead of "sold out". Re-derive every one. */
console.log("");
let checked = CASES.length + CONDITIONS.length;
for (const [selector, signature] of Object.entries(SIGNATURES)) {
  checked += 1;
  const expected = execFileSync("cast", ["sig", signature], { encoding: "utf8" }).trim().toLowerCase();
  if (selector.toLowerCase() === expected) {
    console.log(`  ok    ${signature}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${signature}`);
    console.error(`    cast: ${expected}`);
    console.error(`    ours: ${selector}`);
  }
}

if (failed) {
  console.error(`\n${failed} of ${checked} mismatched — do not ship this.`);
  process.exit(1);
}
console.log(`\nall ${checked} checks match cast`);
