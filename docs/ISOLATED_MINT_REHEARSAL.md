# Isolated mint rehearsal

The live site remains available. This branch tests production source commit
`5b9e6084ee8dcb5584327a73c2446299877da75b` in an ephemeral GitHub Actions runner.
It does not deploy a website, modify production settings or submit transactions.
Vercel Git deployments are disabled for this exact test branch in `vercel.json`.

## Isolation

After installing locked dependencies and browsers, the runner builds and starts
Next.js inside a Linux network namespace containing only loopback. The harness
refuses to start if any other network interface exists or private environment
files are present. Only an explicit environment allowlist reaches child
processes; the contract is a dummy address and all service URLs point to local
fixtures. No repository secrets are supplied. The fake wallet returns a dummy
transaction hash without signing or broadcasting. Browser targets must be local.

## Coverage

Chromium desktop and WebKit at a mobile viewport exercise the actual mint page:
public mint, last token, allowlist mint, GTD at 0.004 ETH and FCFS at 0.005 ETH,
rejected wallet request, simulation
revert, failed receipt, configuration refresh, allowlist outage/recovery, wrong
chain, delayed confirmation and reload during a pending transaction. Duplicate
clicks must not create duplicate transaction requests. Optional services are
unavailable during the rehearsal.

This checks UI behavior with controlled fixtures. It does **not** certify a real
iPhone, wallet application, WalletConnect relay, the deployed Merkle tree,
production RPC availability, Vercel WAF or production capacity. Reown is disabled
in this isolated environment, so these runs cover the injected-wallet path.
Displayed prices and fake-wallet transaction values are compared for both paid
phases. These fixtures do not validate the deployed contract's mint economics.

## Before launch

1. Run this workflow and resolve any reproducible failures. Record its exact run
   and source commit; a fixture failure is not automatically an application bug.
2. Once the final allowlist and phases are published, use a few read-only calls
   to compare on-chain roots, times, supply, prices and proof validity. Simulate
   claims with `eth_call`; never sign or broadcast them. Visitors can remain on
   the live site while these low-volume checks run.
3. For real mobile wallet/WalletConnect testing, use an access-protected preview
   with a separate test contract and allowlist. Vercel account access is currently
   unavailable to the agent. Do not connect test configuration to the live domain.

The previous successful real drop is useful evidence. No repeat paid mainnet
mint is required by this rehearsal. Load tests belong in isolated environments;
their results must not be described as proven production capacity.

## Results

Pending execution. See the branch's `Isolated mint rehearsal` Actions run.
