// Read-only launch audit. Exit 2 means contract configuration still blocks mint.
import nextEnv from '@next/env';
import { createPublicClient, http, parseAbi } from 'viem';
nextEnv.loadEnvConfig(process.cwd(), false);
const mint = await import('../lib/mint.js');
const { allowlistBase } = await import('../lib/phases.js');
const client = createPublicClient({ transport: http(process.env.RPC_URL || mint.RPC_URL, { retryCount: 0, timeout: 8_000 }) });
const abi = parseAbi([
  'function name() view returns (string)',
  'function owner() view returns (address)',
  'function contractURI() view returns (string)',
  'function allowlistMerkleRoot() view returns (bytes32)',
]);
try {
  const [chainId, facts, name, owner, contractURI, root, phases] = await Promise.all([
    client.getChainId(), mint.readDropFacts(),
    ...['name', 'owner', 'contractURI', 'allowlistMerkleRoot'].map(functionName => client.readContract({ address: mint.CONTRACT, abi, functionName })),
    fetch(`${allowlistBase()}/drop-allowlist/${mint.CONTRACT.toLowerCase()}`, { signal: AbortSignal.timeout(10_000) }).then(async r => {
      if (!r.ok) throw Error('Allowlist backend unavailable');
      return r.json();
    }),
  ]);
  const blockers = [];
  if (chainId !== 4663) blockers.push('RPC is not Robinhood mainnet (4663).');
  if (facts.lazySupply !== 2048n) blockers.push(`Expected 2048 prepared tokens; contract reports ${facts.lazySupply}.`);
  if (!contractURI) blockers.push('Collection metadata URI is missing.');
  const publicConfigured = facts.condition.maxClaimable > 0n && facts.condition.perWallet > 0n;
  const publishedStages = phases.published && phases.stages?.length > 0;
  if (!publicConfigured && !publishedStages) blockers.push('No public mint condition or published allowlist stages.');
  if (publishedStages && phases.root?.toLowerCase() !== root.toLowerCase()) blockers.push('Backend allowlist root does not match the on-chain root.');
  if (facts.endsAt > 0n && facts.chainNow > facts.endsAt) blockers.push('The contract-wide mint window has ended.');
  if (publicConfigured && facts.condition.price > 0n && !mint.isNative(facts.condition.currency)) blockers.push('Paid ERC-20 mint requires an approval flow that this site does not implement.');
  if (phases.stages?.some(s => BigInt(s.pricePerToken || 0) > 0n && !mint.isNative(s.currency))) blockers.push('An allowlist stage requires ERC-20 approval, unsupported by this site.');
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), chainId, contract: mint.CONTRACT, name, owner, contractURI,
    preparedSupply: String(facts.lazySupply), minted: String(facts.minted), publicCondition: facts.condition,
    allowlist: { published: phases.published, root, stages: phases.stages || [] },
    configurationReady: blockers.length === 0, blockers,
    remainingVerification: ['Confirm owner-approved dates, price and per-wallet limits.', 'Confirm paid Alchemy throughput and shared account headroom.', 'Verify a real wallet mint and mobile WalletConnect handoff with the final phase/proof configuration.'],
  }, (_, v) => typeof v === 'bigint' ? String(v) : v, 2));
  if (blockers.length) process.exitCode = 2;
} catch (error) {
  // viem errors can contain the keyed URL. Do not print the raw error.
  console.error('Launch audit could not complete: check RPC and backend availability. Error type:', error.name);
  process.exitCode = 1;
}
