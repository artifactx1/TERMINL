/**
 * Minting, without a wallet stack.
 *
 * This site is 84 kB and server-rendered, which is the whole reason it does not
 * live inside the ArtifactX marketplace. Pulling in thirdweb/wagmi/viem to send
 * one transaction would undo that, so the handful of calls the mint needs are
 * encoded here by hand.
 *
 * That is only defensible because the surface is tiny and fixed: three reads and
 * one write, all with statically known shapes. Every selector and the full
 * `claim` calldata layout below is verified byte-for-byte against `cast` in
 * scripts/verify-calldata.mjs — run it if you touch anything in this file.
 *
 * Allowlist stages were added and the hand-rolling held. The worry recorded
 * here was that a merkle proof makes the encoding "genuinely dynamic" — it does
 * not: `MintParams` is seven static words inlined into the head, and the proof
 * is a bytes32[] whose members are already 32 bytes each, so `claimAllowlist`
 * encodes with FEWER moving parts than the public `claim` above (which nests a
 * dynamic tuple). Both are diffed against `cast calldata` in the verify script,
 * proof lengths 0 through 12 included. If a call ever needs a `bytes`, a
 * string, or a nested array, revisit that.
 *
 * The target is ArtifactXERC721Drop (nftcontracts/src/ArtifactXERC721Drop.sol),
 * a single-phase drop on thirdweb's DropSinglePhase with a contract-wide end
 * time. It reverts with *custom errors*, not require-strings — see REVERT.
 */

/* Robinhood Chain (Arbitrum Orbit L2, gas in plain ETH — there is no native
 * token). The public RPCs below are the same ones ELEMENT's rpc-config falls
 * back to; both were verified live via eth_chainId. */
const CHAINS = {
  4663: {
    id: 4663,
    name: "Robinhood",
    label: "ROBINHOOD CHAIN",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
  },
  46630: {
    id: 46630,
    name: "Robinhood Chain Testnet",
    label: "ROBINHOOD CHAIN TESTNET",
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

/* Verified with `cast sig`, and every one of them checked against the generated
 * ABI in ELEMENT's utils/thirdweb/artifactx-erc721drop-artifact.js. */
const SELECTOR = {
  claim: "0x84bb1e42", // claim(address,uint256,address,uint256,(bytes32[],uint256,uint256,address),bytes)
  claimCondition: "0xd637ed59",
  dropEndsAt: "0x788cc54e",
  supplyClaimedByWallet: "0x35b65e1f", // getSupplyClaimedByWallet(address)
  /* claimAllowlist(address,uint256,(uint256,address,uint256,uint256,uint64,uint64,uint32),bytes32[])
   * — the struct is spelled out because the selector is hashed from the
   * flattened member types, not from the struct's name. */
  claimAllowlist: "0x1ba84308",
  /* ERC721A's monotonic mint counter. A stage's supply bound is measured
   * against this, and in a stages-only drop — where the public condition is all
   * zeros — it is the only honest answer to "how many are gone". */
  nextTokenIdToClaim: "0xacd083f8",
  /* How many tokens exist to be minted at all. thirdweb keeps that in
   * `nextTokenIdToLazyMint`, which is INTERNAL — there is no getter, and asking
   * for one reverts. It is recoverable from the batch metadata, which is
   * public: batch ids are cumulative token-id boundaries, so the last one is
   * the lazy-minted total. Two calls, and the second depends on the first. */
  getBaseURICount: "0x63b45e2d",
  getBatchIdAtIndex: "0x2419f51b", // getBatchIdAtIndex(uint256)
  stageMintedByWallet: "0xdc7af7a8", // stageMintedByWallet(uint32,address)
};

const strip = (hex) => String(hex).replace(/^0x/, "");
const word = (hex) => strip(hex).padStart(64, "0");
const encUint = (v) => word(BigInt(v).toString(16));
const encAddr = (a) => word(String(a).toLowerCase());

const wordAt = (data, i) => `0x${strip(data).slice(i * 64, (i + 1) * 64)}`;
const uintAt = (data, i) => BigInt(wordAt(data, i));
const addrAt = (data, i) => `0x${strip(data).slice(i * 64 + 24, (i + 1) * 64)}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const isNative = (currency) => {
  const c = String(currency || "").toLowerCase();
  return c === NATIVE || c === ZERO;
};

/**
 * claim(receiver, quantity, currency, pricePerToken, allowlistProof, data)
 *
 * `currency` and `pricePerToken` are checked against the active condition by
 * DropSinglePhase.verifyClaim and revert with DropClaimInvalidTokenPrice if
 * they do not match — so they are read from the chain, never assumed.
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

/** The claim calldata plus the wei to send with it, in one place so the
 *  simulation, the send and the post-mortem replay can never disagree. */
export function buildClaimTx({ account, drop, quantity }) {
  const value = drop.native ? drop.price * BigInt(quantity) : 0n;
  return {
    from: account,
    to: CONTRACT,
    data: encodeClaim({
      receiver: account,
      quantity,
      currency: drop.currency,
      pricePerToken: drop.price,
    }),
    ...(value > 0n ? { value: `0x${value.toString(16)}` } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * Allowlist stages
 * ------------------------------------------------------------------ */

/**
 * claimAllowlist(receiver, quantity, params, proof)
 *
 * Nothing about a stage lives on chain: the price, the window, the per-wallet
 * cap and the stage's supply bound are all sealed inside the merkle leaf, and
 * the contract re-derives that leaf from what is passed in —
 * `keccak256(abi.encode(block.chainid, address(this), msg.sender, params))`.
 * So every field here is a *proven term*: change one and the proof stops
 * verifying. They are copied from the backend's response untouched, never
 * reconstructed, never rounded, never re-ordered.
 *
 * The eligible wallet is msg.sender — that is what the leaf binds. `receiver`
 * may differ, and here never does.
 *
 * Layout — MintParams is seven STATIC words, so it is inlined into the head
 * rather than pointed at; only the proof is dynamic:
 *   0x00 receiver   0x20 quantity   0x40..0x100 params (7)   0x120 -> proof
 *   0x140 proof.length, then one word per node
 */
export function encodeClaimAllowlist({ receiver, quantity, params, proof }) {
  const HEAD = 10 * 32; // 0x140 — 2 args + 7 inlined params + 1 offset
  const nodes = proof || [];
  for (const node of nodes) {
    /* A short or malformed node would pad into a *valid-looking* word and
     * produce a proof that fails on chain with no clue why. Refuse it here,
     * where the message can say so. */
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(node))) {
      throw new Error("Malformed allowlist proof from the server.");
    }
  }
  return SELECTOR.claimAllowlist
    + encAddr(receiver)
    + encUint(quantity)
    + encUint(params.pricePerToken)      // params, in the contract's struct order
    + encAddr(params.currency)
    + encUint(params.maxMintableByWallet)
    + encUint(params.maxSupplyForStage)
    + encUint(params.startTime)
    + encUint(params.endTime)
    + encUint(params.stageIndex)
    + encUint(HEAD)
    + encUint(nodes.length)
    + nodes.map((node) => word(node)).join("");
}

/**
 * The stage claim's calldata and its wei, built together for the same reason
 * buildClaimTx does it: the simulation, the send and the post-mortem replay
 * must be the same bytes.
 *
 * _collectPriceOnClaim wants EXACTLY quantity × price for a native stage and
 * exactly zero for an ERC-20 one — and zero for a free stage either way, since
 * a price of 0 short-circuits to `require(msg.value == 0)`.
 */
export function buildAllowlistClaimTx({ account, stage, quantity }) {
  const { params } = stage;
  const value = isNative(params.currency) ? BigInt(params.pricePerToken) * BigInt(quantity) : 0n;
  return {
    from: account,
    to: CONTRACT,
    data: encodeClaimAllowlist({ receiver: account, quantity, params, proof: stage.proof }),
    ...(value > 0n ? { value: `0x${value.toString(16)}` } : {}),
  };
}

/**
 * The endpoints a read may go to, in order.
 *
 * In the browser: the public one above, only. On the server — which in
 * practice means /api/drop — a plain `RPC_URL` is preferred when set, with the
 * public endpoint as the fallback. That variable is deliberately NOT prefixed
 * NEXT_PUBLIC_, so Next never inlines it into the client bundle: it can carry
 * a keyed endpoint (Alchemy) without the key ever shipping to a visitor. The
 * CDN cache in front of the route keeps that endpoint's call volume to a
 * trickle regardless of how many are watching, and the fallback means a
 * throttled or failing provider degrades to the public one rather than to an
 * error page.
 */
const endpoints = () => {
  const keyed = typeof window === "undefined" ? (process.env.RPC_URL || "").trim() : "";
  return keyed && keyed !== RPC_URL ? [keyed, RPC_URL] : [RPC_URL];
};

/** Which endpoint answered the last server-side read — surfaced by the route
 *  as a header so a load test can see the fallback working. */
export let lastRpcSource = "public";

/* A provider problem — throttled, down, unreachable — is worth retrying on
 * the next endpoint. A revert is an answer, not a problem, and must not be. */
class RpcTransportError extends Error {}

async function post(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new RpcTransportError(e?.message || "network");
  }
  if (!res.ok) throw new RpcTransportError(`RPC ${res.status}`);
  return res.json();
}

function unwrap(json) {
  if (json.error) {
    const err = new Error(json.error.message || "RPC error");
    // The revert selector rides on `data`, and it is the only thing that can
    // tell a sold-out race apart from a price change. Never drop it.
    err.code = json.error.code;
    err.data = json.error.data;
    throw err;
  }
  return json.result;
}

/** Try each endpoint in turn on transport failure; pass reverts straight up. */
async function withFallback(fn) {
  const urls = endpoints();
  let lastError;
  for (let i = 0; i < urls.length; i += 1) {
    try {
      const out = await fn(urls[i]);
      lastRpcSource = i === 0 && urls.length > 1 ? "keyed" : "public";
      return out;
    } catch (e) {
      if (!(e instanceof RpcTransportError)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

async function rpc(method, params) {
  return withFallback(async (url) => unwrap(await post(url, { jsonrpc: "2.0", id: 1, method, params })));
}

/**
 * Several reads in one round trip. JSON-RPC batches are one HTTP request
 * carrying an array; both Robinhood's public node and Alchemy accept them.
 * The provider still meters each call, but latency — and the function time
 * the route pays for — drops to a single round trip.
 */
async function rpcBatch(calls) {
  return withFallback(async (url) => {
    const body = calls.map(([method, params], i) => ({ jsonrpc: "2.0", id: i + 1, method, params }));
    const json = await post(url, body);
    if (!Array.isArray(json)) throw new RpcTransportError("batch unsupported");
    const byId = new Map(json.map((r) => [r.id, r]));
    return calls.map((_, i) => unwrap(byId.get(i + 1) || { error: { message: "missing batch reply" } }));
  });
}

const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);

/**
 * The facts about the drop, read in one round trip: the active condition,
 * when the drop closes, and what time the chain thinks it is.
 *
 * DropSinglePhase stores one condition; `claimCondition` is a public struct, so
 * its generated getter returns the members flattened — startTimestamp is the
 * first word, not an offset. supplyClaimed lives in the condition itself, so
 * minted/remaining come from the same read and cannot disagree with the price
 * shown beside them.
 *
 * dropEndsAt is ArtifactX's own addition on top of DropSinglePhase. The claim
 * path reverts DropEnded() past it, so a page that does not read it shows a
 * live MINT button for a drop that can only revert.
 *
 * Facts only — nothing time-dependent is decided here. Whether the phase has
 * opened or closed is derived by whoever renders, against a clock corrected to
 * chain time (see describeDrop). That is what lets the facts be cached and
 * shared: a cached "started: false" would be wrong the second the phase opened,
 * a cached start timestamp never is.
 */
/**
 * How many tokens have been lazy-minted — the hard ceiling every phase sits
 * under, and the drop's real total.
 *
 * Derived rather than read: `nextTokenIdToLazyMint` is internal on thirdweb's
 * LazyMint, so calling it reverts. `batchIds` are cumulative token-id
 * boundaries and their getters are public, so the last batch id is the total.
 *
 * Returns 0n for "not known", which callers must treat as unknown rather than
 * as an empty drop — a failed read here must never render as SOLD OUT. This is
 * the one read allowed to fail quietly: it is a nicety on top of facts that all
 * came from the same batch, and the pre-flight simulation still catches a
 * quantity the contract will not mint.
 */
async function readLazySupply(batchCount) {
  if (batchCount <= 0n) return 0n;
  try {
    const last = SELECTOR.getBatchIdAtIndex + encUint(batchCount - 1n);
    return uintAt(await call(CONTRACT, last), 0);
  } catch {
    return 0n;
  }
}

export async function readDropFacts() {
  if (!CONTRACT) return null;

  const [condition, endsAtRaw, mintedRaw, batchCountRaw, block] = await rpcBatch([
    ["eth_call", [{ to: CONTRACT, data: SELECTOR.claimCondition }, "latest"]],
    ["eth_call", [{ to: CONTRACT, data: SELECTOR.dropEndsAt }, "latest"]],
    ["eth_call", [{ to: CONTRACT, data: SELECTOR.nextTokenIdToClaim }, "latest"]],
    ["eth_call", [{ to: CONTRACT, data: SELECTOR.getBaseURICount }, "latest"]],
    ["eth_getBlockByNumber", ["latest", false]],
  ]);

  return {
    condition: decodeCondition(condition),
    endsAt: uintAt(endsAtRaw, 0),
    /* Contract-wide totals, which the public condition's own counters are not:
     * `claimed` counts the public phase alone, while these count every route in
     * — public claims, stage claims and adminMint reserves alike. A stage's
     * supply bound is measured against `minted`, and in a stages-only drop
     * (where the condition is all zeros) these are the only figures that can
     * honestly answer "how many are gone". */
    minted: uintAt(mintedRaw, 0),
    lazySupply: await readLazySupply(uintAt(batchCountRaw, 0)),
    /* Chain time, not the visitor's clock. A machine running ten minutes fast
     * would otherwise show a live MINT button on a drop the contract has
     * already closed — the simulation catches it, but only after the click. */
    chainNow: BigInt(block.timestamp),
  };
}

/** Facts plus the derived state, as of chain time now — for scripts and the
 *  server. The panel derives on every tick instead (see fetchDrop). */
export async function readDrop() {
  const facts = await readDropFacts();
  if (!facts) return null;
  return {
    ...describeDrop(facts.condition, facts.endsAt, facts.chainNow),
    chainNow: facts.chainNow,
    skewMs: Date.now() - Number(facts.chainNow) * 1000,
  };
}

/** The eight members of the getter's return, by position. Checked against
 *  `cast abi-encode` in scripts/verify-calldata.mjs. */
export function decodeCondition(data) {
  return {
    startsAt: uintAt(data, 0),
    maxClaimable: uintAt(data, 1),
    claimed: uintAt(data, 2),
    perWallet: uintAt(data, 3),
    // 4 is merkleRoot — unused while the drop is public-only.
    price: uintAt(data, 5),
    currency: addrAt(data, 6),
    // 7 is the offset to `string metadata`, which nothing here shows.
  };
}

/**
 * Everything the page decides from a condition, derived in one place so the
 * states cannot contradict each other. Pure — tested without an RPC.
 *
 * `now` is unix *seconds* and must be chain time, not local time: it is
 * compared against the same values `verifyClaim` compares to block.timestamp.
 */
export function describeDrop({ startsAt, maxClaimable, claimed, perWallet, price, currency }, endsAt, now) {
  /* An unset phase reads as all zeros. maxClaimableSupply of 0 means nothing is
   * claimable, which is the deployed-but-not-configured state — distinct from
   * sold out, and worth showing differently. */
  const configured = maxClaimable > 0n;

  /* verifyClaim rejects `claimLimit == 0` outright, so a zero per-wallet cap is
   * a phase nobody can mint from, not an unlimited one. thirdweb spells
   * unlimited as MaxUint256; anything absurdly large means the same thing. */
  const perWalletUnlimited = perWallet >= 1_000_000n;
  const capPerWallet = perWalletUnlimited ? null : perWallet;

  const soldOut = configured && claimed >= maxClaimable;
  const started = configured && startsAt <= now;
  const ended = endsAt !== 0n && now > endsAt;
  const nobodyMayMint = configured && perWallet === 0n;

  return {
    configured,
    startsAt,
    endsAt,
    started,
    ended,
    /* Every reason a claim could be refused, in one flag. A phase with a
     * per-wallet cap of zero is live and unmintable, so it belongs here too. */
    open: configured && started && !ended && !soldOut && !nobodyMayMint,
    price,
    currency,
    native: isNative(currency),
    perWallet,
    capPerWallet,
    /* A cap of zero is a live phase with the door bolted. Say so rather than
     * offering a button whose only outcome is DropClaimExceedLimit. */
    nobodyMayMint,
    minted: claimed,
    supply: maxClaimable,
    remaining: maxClaimable > claimed ? maxClaimable - claimed : 0n,
    soldOut,
  };
}

/* Bigints do not survive JSON. The route serialises with these and the panel
 * revives with them, so the two never disagree about which fields are which. */
const BIG_FIELDS = ["startsAt", "maxClaimable", "claimed", "perWallet", "price"];

export function serializeDropFacts(facts) {
  if (!facts) return null;
  const condition = { ...facts.condition };
  for (const k of BIG_FIELDS) condition[k] = String(condition[k]);
  return {
    condition,
    endsAt: String(facts.endsAt),
    minted: String(facts.minted),
    lazySupply: String(facts.lazySupply),
    chainNow: String(facts.chainNow),
  };
}

export function reviveDropFacts(json, ageMs = 0) {
  if (!json) return null;
  const condition = { ...json.condition };
  for (const k of BIG_FIELDS) condition[k] = BigInt(condition[k]);
  return {
    condition,
    endsAt: BigInt(json.endsAt),
    /* Absent from a cached copy written before stages existed. */
    minted: BigInt(json.minted ?? 0),
    lazySupply: BigInt(json.lazySupply ?? 0),
    chainNow: BigInt(json.chainNow),
    /* The chain timestamp was true when the route read it, which was `ageMs`
     * ago if the CDN served a cached copy. Fold that in, or a five-second cache
     * would show up as a five-second clock error in the countdown. */
    skewMs: Date.now() - (Number(json.chainNow) * 1000 + ageMs),
  };
}

/**
 * What the panel calls. Goes through /api/drop so the CDN absorbs the crowd,
 * and falls back to reading the chain directly if the route is unreachable —
 * a broken cache must not read as a closed mint.
 */
export async function fetchDropFacts() {
  if (!CONTRACT) return null;
  try {
    const res = await fetch("/api/drop", { cache: "no-store" });
    if (!res.ok) throw new Error(`drop route ${res.status}`);
    const age = Number(res.headers.get("age") || 0);
    return reviveDropFacts(await res.json(), Number.isFinite(age) ? age * 1000 : 0);
  } catch {
    const facts = await readDropFacts();
    return facts && { ...facts, skewMs: Date.now() - Number(facts.chainNow) * 1000 };
  }
}

/** Nothing about a sold-out or closed drop changes again. */
export const isTerminal = (drop) => !!drop && (drop.soldOut || drop.ended);

/** How many this address has already taken from the active phase. */
export async function readClaimedBy(address) {
  if (!CONTRACT || !address) return 0n;
  const data = SELECTOR.supplyClaimedByWallet + encAddr(address);
  return uintAt(await call(CONTRACT, data), 0);
}

/**
 * How many this address has already taken IN ONE STAGE.
 *
 * Counted per stage on chain, and unrelated to the public phase's per-wallet
 * tally — a wallet holding both a GTD and an FCFS allocation spends them
 * independently, and neither touches getSupplyClaimedByWallet.
 */
export async function readStageClaimedBy(stageIndex, address) {
  if (!CONTRACT || !address || !stageIndex) return 0n;
  const data = SELECTOR.stageMintedByWallet + encUint(stageIndex) + encAddr(address);
  return uintAt(await call(CONTRACT, data), 0);
}

/* ------------------------------------------------------------------ *
 * Reverts
 * ------------------------------------------------------------------ */

/**
 * ArtifactXERC721Drop reverts with custom errors — a bare 4-byte selector, no
 * string. Matching on `/!MaxSupply/` (thirdweb's older require-strings) never
 * fires against this contract and leaves the user reading a JSON-RPC envelope,
 * so the selectors are mapped by hand.
 *
 * Selectors from `cast sig`; the error list is the generated ABI's.
 */
const ERRORS = [
  ["DropClaimInvalidTokenPrice(address,uint256,address,uint256)", "0xf13474e9", "The price changed on-chain. Reload and try again."],
  ["DropClaimExceedLimit(uint256,uint256)",                       "0x9e7762db", "That is more than this wallet may mint."],
  ["DropClaimExceedMaxSupply(uint256,uint256)",                   "0xfe381cc9", "That would go past the supply left."],
  ["DropExceedMaxSupply()",                                       "0x0656a73e", "That would go past the supply left."],
  ["DropClaimNotStarted(uint256,uint256)",                        "0x4562091e", "The mint has not started yet."],
  ["DropEnded()",                                                 "0xbf72230c", "The drop has ended."],
  ["DropNoActiveCondition()",                                     "0xf40f1cc0", "No mint phase is live."],
  ["MintZeroQuantity()",                                          "0xb562e8dd", "Pick at least one."],
  ["MintToZeroAddress()",                                         "0x2e076300", "Connect a wallet first."],

  /* Allowlist stages. Every one of these is reachable from claimAllowlist and
   * from nothing else, so the wording can name the stage rather than the drop.
   * Note StageNotStarted/StageEnded carry a uint64, not a uint256 — the struct
   * stores the window in uint64 and the selector is hashed from that. */
  ["AllowlistNotConfigured()",                                    "0xbc7b8026", "The allowlist is not published on-chain yet."],
  ["InvalidAllowlistProof()",                                     "0xed4161b8", "This wallet is not on the list for that stage."],
  ["StageIndexZero()",                                            "0x2c759cba", "That stage is not valid."],
  ["StageNotStarted(uint64)",                                     "0xfb847e1b", "That stage has not opened yet."],
  ["StageEnded(uint64)",                                          "0xd5bdb6c9", "That stage has closed."],
  ["StageWalletLimitExceeded(uint256,uint256)",                   "0x13774cdc", "That is more than this wallet may mint in that stage."],
  ["StageSupplyExceeded(uint256,uint256)",                        "0x9cb633cb", "That would go past what the stage has left."],
  ["NotEnoughLazyMinted(uint256,uint256)",                        "0xe64cab88", "That would go past the supply left."],
  ["ZeroQuantity()",                                              "0xf4f5b733", "Pick at least one."],
  ["ZeroAddress()",                                               "0xd92e233d", "Connect a wallet first."],
];

const REVERT = Object.fromEntries(ERRORS.map(([, selector, message]) => [selector, message]));

/** Every hand-written selector in this file, with the signature it claims to
 *  be — scripts/verify-calldata.mjs re-derives each one with `cast sig`. */
export const SIGNATURES = Object.fromEntries([
  ...ERRORS.map(([signature, selector]) => [selector, signature]),
  [SELECTOR.claimCondition, "claimCondition()"],
  [SELECTOR.dropEndsAt, "dropEndsAt()"],
  [SELECTOR.supplyClaimedByWallet, "getSupplyClaimedByWallet(address)"],
  [SELECTOR.claimAllowlist, "claimAllowlist(address,uint256,(uint256,address,uint256,uint256,uint64,uint64,uint32),bytes32[])"],
  [SELECTOR.nextTokenIdToClaim, "nextTokenIdToClaim()"],
  [SELECTOR.getBaseURICount, "getBaseURICount()"],
  [SELECTOR.getBatchIdAtIndex, "getBatchIdAtIndex(uint256)"],
  [SELECTOR.stageMintedByWallet, "stageMintedByWallet(uint32,address)"],
]);

const ERROR_STRING = "0x08c379a0"; // Error(string)
const PANIC = "0x4e487b71";        // Panic(uint256)

/** Wallets bury the revert payload at a different depth in every provider. */
function revertData(e) {
  const seen = new Set();
  const walk = (node, depth) => {
    if (!node || depth > 6 || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    for (const key of ["data", "originalError", "error", "info", "cause"]) {
      const child = node[key];
      if (typeof child === "string" && /^0x[0-9a-fA-F]*$/.test(child) && child.length >= 10) return child;
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  if (typeof e === "string" && /^0x[0-9a-fA-F]{8,}$/.test(e)) return e;
  return walk(e, 0);
}

/** Decode ABI-encoded revert data into something a person can act on. */
export function decodeRevert(data) {
  if (!data || data.length < 10) return null;
  const selector = data.slice(0, 10).toLowerCase();
  if (REVERT[selector]) return REVERT[selector];
  if (selector === ERROR_STRING) {
    try {
      const payload = strip(data).slice(8);            // the encoded (string) args
      const at = Number(BigInt(`0x${payload.slice(0, 64)}`)) * 2;
      const length = Number(BigInt(`0x${payload.slice(at, at + 64)}`)) * 2;
      const bytes = payload.slice(at + 64, at + 64 + length);
      const text = bytes.replace(/../g, (h) => String.fromCharCode(parseInt(h, 16)));
      return text.trim() || null;
    } catch {
      return null;
    }
  }
  if (selector === PANIC) return "The contract hit an internal error.";
  return null;
}

/**
 * Wallet errors are objects with a code, a nested reason and — for a revert —
 * ABI-encoded data several levels down. Surface the part a person can act on,
 * not the JSON-RPC envelope.
 */
export function readableError(e) {
  if (e?.code === 4001 || /user rejected|user denied/i.test(e?.message || "")) {
    return "You rejected the request.";
  }
  const data = revertData(e);
  const decoded = decodeRevert(data);
  if (decoded) return decoded;

  const raw = e?.data?.message || e?.error?.message || e?.message || "";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH for the mint plus gas.";

  /* A revert we do not have a selector for. Name it — an unknown error code is
   * something a person can paste to us; "[object Object]" is not. */
  if (data) return `The contract rejected it (${data.slice(0, 10)}).`;

  return raw ? (raw.length > 160 ? `${raw.slice(0, 157)}…` : raw) : "Something went wrong.";
}

/* ------------------------------------------------------------------ *
 * Sending
 * ------------------------------------------------------------------ */

/**
 * Run the claim as an eth_call first.
 *
 * ArtifactXERC721Drop deliberately mirrors its end-time check into verifyClaim
 * "so dApp simulations match runtime behavior" — this is that simulation. It
 * costs one RPC round trip and means a doomed mint never reaches the wallet
 * prompt: the user is told the drop sold out instead of paying gas to find out.
 *
 * Throws with the decoded reason; returns nothing on success.
 */
export async function simulateClaim(tx) {
  try {
    await rpc("eth_call", [tx, "latest"]);
  } catch (e) {
    const decoded = decodeRevert(revertData(e));
    const error = new Error(decoded || readableError(e));
    error.simulated = true;
    throw error;
  }
}

/**
 * Wait for the transaction to actually land.
 *
 * A hash is a receipt for the *submission*, not the mint — a claim that reverts
 * on-chain still returns one. Showing "MINTED ✓" at that point is a lie the
 * user only discovers when the token never appears, so nothing is called a
 * success until status is 0x1.
 */
export async function waitForReceipt(hash, { timeoutMs = 180_000 } = {}) {
  /* Robinhood blocks land in a second or two, so most receipts arrive on the
   * first or second look. Backing off after that keeps a slow mempool from
   * costing a call every two seconds for three minutes — per minter, at the
   * moment every minter is doing the same thing. */
  const STEPS = [1_500, 2_000, 3_000, 4_000, 5_000];
  const deadline = Date.now() + timeoutMs;
  for (let n = 0; ; n += 1) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]).catch(() => null);
    if (receipt) {
      return { mined: true, success: BigInt(receipt.status ?? "0x0") === 1n, receipt };
    }
    if (Date.now() >= deadline) return { mined: false, success: false, receipt: null };
    await sleep(STEPS[Math.min(n, STEPS.length - 1)]);
  }
}

/**
 * Why a mined transaction failed.
 *
 * Receipts carry no reason, so the call is replayed against the block it landed
 * in and the revert selector decoded from that. Best effort — if the replay
 * does not reproduce (state moved on), the caller falls back to a plain
 * "it failed" rather than inventing a cause.
 */
export async function revertReason(tx, blockNumber) {
  try {
    await rpc("eth_call", [tx, blockNumber || "latest"]);
    return null;
  } catch (e) {
    return decodeRevert(revertData(e));
  }
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

/**
 * A countdown, in the units that matter at that distance. Returns null once the
 * moment has passed so callers can switch state rather than render "0s".
 *
 * `from` is milliseconds on the same clock as `unixSeconds` — callers holding a
 * drop pass `Date.now() - drop.skewMs` so this counts toward chain time.
 */
export function countdown(unixSeconds, from = Date.now()) {
  const left = Number(BigInt(unixSeconds)) - Math.floor(from / 1000);
  if (!Number.isFinite(left) || left <= 0) return null;
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
