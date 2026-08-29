/**
 * Minting, without a wallet stack.
 *
 * This site is 84 kB and server-rendered, which is the whole reason it does not
 * live inside the ArtifactX marketplace. Pulling in thirdweb/wagmi/viem to send
 * one transaction would undo that, so the handful of calls the mint needs are
 * encoded here by hand.
 *
 * That is only defensible because the surface is tiny and fixed: four reads and
 * one write, all with statically known shapes. Every selector and the full
 * `claim` calldata layout below is verified byte-for-byte against `cast` in
 * scripts/verify-calldata.mjs — run it if you touch anything in this file.
 *
 * If an allowlist phase is ever added, stop hand-rolling and pull in viem. The
 * merkle proof makes the encoding genuinely dynamic and this approach stops
 * being worth it.
 */

/* Robinhood Chain (Arbitrum Orbit L2, gas in plain ETH — there is no native
 * token). The public RPCs below are the same ones ELEMENT's rpc-config falls
 * back to; both were verified live via eth_chainId. */
const CHAINS = {
  4663: {
    id: 4663,
    name: "Robinhood",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
  },
  46630: {
    id: 46630,
    name: "Robinhood Chain Testnet",
    rpc: "https://rpc.testnet.chain.robinhood.com",
    explorer: "https://explorer.testnet.chain.robinhood.com",
  },
};

export const CHAIN = CHAINS[Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 4663] || CHAINS[4663];

/** Unset until the drop is deployed. Everything downstream treats that as
 *  "not open yet" rather than rendering a button that cannot work. */
export const CONTRACT = (process.env.NEXT_PUBLIC_TERMINL_CONTRACT || "").trim() || null;

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || CHAIN.rpc;

/* thirdweb represents the chain's own currency with this sentinel rather than
 * the zero address. A condition priced in it is paid with tx value. */
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ZERO = "0x0000000000000000000000000000000000000000";
const MAX_UINT256 = (1n << 256n) - 1n;

/* Verified with `cast sig`. */
const SELECTOR = {
  claim: "0x84bb1e42", // claim(address,uint256,address,uint256,(bytes32[],uint256,uint256,address),bytes)
  claimCondition: "0xd637ed59",
  totalMinted: "0xa2309ff8",
  nextTokenIdToMint: "0x3b1475a7",
  supplyClaimedByWallet: "0x35b65e1f", // getSupplyClaimedByWallet(address)
};

const strip = (hex) => String(hex).replace(/^0x/, "");
const word = (hex) => strip(hex).padStart(64, "0");
const encUint = (v) => word(BigInt(v).toString(16));
const encAddr = (a) => word(String(a).toLowerCase());

const wordAt = (data, i) => `0x${strip(data).slice(i * 64, (i + 1) * 64)}`;
const uintAt = (data, i) => BigInt(wordAt(data, i));
const addrAt = (data, i) => `0x${strip(data).slice(i * 64 + 24, (i + 1) * 64)}`;

export const isNative = (currency) => {
  const c = String(currency || "").toLowerCase();
  return c === NATIVE || c === ZERO;
};

/**
 * claim(receiver, quantity, currency, pricePerToken, allowlistProof, data)
 *
 * `currency` and `pricePerToken` are checked against the active condition by
 * DropSinglePhase.verifyClaim and revert with "!PriceOrCurrency" if they do not
 * match — so they are read from the chain, never assumed.
 *
 * The allowlist proof is the no-override sentinel thirdweb's own SDK sends:
 * an empty proof, and MaxUint256 as the price. With merkleRoot == 0 the
 * override branch is not taken and these values are ignored, but matching the
 * SDK keeps behaviour identical if a phase is ever added.
 *
 * Layout — six head words, then the proof tuple (dynamic, because it contains
 * a bytes32[]), then the empty trailing bytes:
 *   0x00  receiver            0xc0  -> proof tuple      0x160 -> data
 *   the tuple itself is 4 head words + a zero-length array = 5 words = 0xa0
 */
export function encodeClaim({ receiver, quantity, currency, pricePerToken }) {
  const HEAD = 6 * 32;   // 0xc0
  const TUPLE = 5 * 32;  // 0xa0
  return SELECTOR.claim
    + encAddr(receiver)
    + encUint(quantity)
    + encAddr(currency)
    + encUint(pricePerToken)
    + encUint(HEAD)
    + encUint(HEAD + TUPLE)
    + encUint(4 * 32)      // tuple: offset to proof[], relative to tuple start
    + encUint(0)           // tuple: quantityLimitPerWallet
    + encUint(MAX_UINT256) // tuple: pricePerToken (no-override sentinel)
    + encAddr(ZERO)        // tuple: currency
    + encUint(0)           // proof.length
    + encUint(0);          // data.length
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);

/**
 * The active claim phase, plus how much of it is gone.
 *
 * DropSinglePhase stores one condition; its getter returns the struct fields in
 * order, ending with a dynamic `string metadata` we do not read. supplyClaimed
 * lives in the condition itself, so minted/remaining come from the same read
 * and cannot disagree with the price shown beside them.
 */
export async function readDrop() {
  if (!CONTRACT) return null;

  const [condition, nextId] = await Promise.all([
    call(CONTRACT, SELECTOR.claimCondition),
    call(CONTRACT, SELECTOR.nextTokenIdToMint).catch(() => null),
  ]);

  const startsAt = uintAt(condition, 0);
  const maxClaimable = uintAt(condition, 1);
  const claimed = uintAt(condition, 2);
  const perWallet = uintAt(condition, 3);
  const price = uintAt(condition, 5);
  const currency = addrAt(condition, 6);

  /* An unset phase reads as all zeros. maxClaimableSupply of 0 means nothing is
   * claimable, which is the deployed-but-not-configured state — distinct from
   * sold out, and worth showing differently. */
  const configured = maxClaimable > 0n;
  const lazyMinted = nextId === null ? null : uintAt(nextId, 0);

  return {
    configured,
    startsAt,
    open: configured && startsAt <= BigInt(Math.floor(Date.now() / 1000)),
    price,
    currency,
    native: isNative(currency),
    perWallet,
    minted: claimed,
    supply: maxClaimable,
    remaining: maxClaimable > claimed ? maxClaimable - claimed : 0n,
    soldOut: configured && claimed >= maxClaimable,
    lazyMinted,
  };
}

/** How many this address has already taken from the active phase. */
export async function readClaimedBy(address) {
  if (!CONTRACT || !address) return 0n;
  const data = SELECTOR.supplyClaimedByWallet + encAddr(address);
  return uintAt(await call(CONTRACT, data), 0);
}

export const explorerTx = (hash) => `${CHAIN.explorer}/tx/${hash}`;

/**
 * ETH, without lying about the amount.
 *
 * A free mint is "FREE", not "0 ETH". Everything else keeps enough decimals to
 * stay true — fixed precision would render a real price as 0.00.
 */
export function formatEth(wei) {
  const v = BigInt(wei);
  if (v === 0n) return "FREE";
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac} ETH` : `${whole} ETH`;
}
