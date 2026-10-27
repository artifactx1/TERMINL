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

**PASS — October 27, 2026, 18:37 UTC.**

[GitHub Actions run 40561113946](https://github.com/artifactx1/TERMINL/actions/runs/40561113946)
tested rehearsal commit `b9bd44a26d80a8fa6400aae81bda52cbba0efc57`:

- Production-mode Next.js build: passed.
- Loopback-target and environment-isolation guard tests: 2 passed, 0 failed.
- Chromium desktop (1440 × 1000): all 13 scenarios passed.
- WebKit mobile viewport (390 × 844): all 13 scenarios passed.
- The runner verified that its network namespace contained only loopback.
- GitHub `main` remained at `5b9e6084ee8dcb5584327a73c2446299877da75b`.

The initial browser run passed eight scenarios before encountering incorrect
test-clock initialization in the late-configuration scenario. Installing the
clock before page navigation, as required by
[Playwright's clock documentation](https://playwright.dev/docs/clock), resolved
it. All cases then passed; no application runtime code needed changing.

The rehearsal's branch-only Vercel exclusion uses the documented
[`git.deploymentEnabled` setting](https://vercel.com/docs/project-configuration/git-configuration).
The workflow, test harness and results are committed on
`testing/isolated-mint-rehearsal-2026-10-27`; they are not merged into `main`.
These results improve UI confidence but do not change the audit's outstanding
contract-configuration, provider-capacity or real-wallet verification requirements.
