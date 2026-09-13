# Staked racing — design only, not enabled

User preference (2026-09-13): racers each stake their own crypto; winner takes the pot. No sponsor-funded substitute. Jurisdictions and chain/token choices deferred. This document does not enable deposits, approve a jurisdiction, or claim the game is money-ready.

## Proposed first mode: Duel

Two verified players, the same vehicle class, one mutually chosen course, three laps. Both explicitly accept the stake, payout, rules version, latency limits and disconnect policy before signing anything. Start with a testnet-only rehearsal using valueless tokens. No house bots, NFT performance advantages, or stakes in practice. Any platform fee must be separately agreed and disclosed; do not assume one.

Player experience: create challenge → rival accepts exact terms → both fund an audited escrow → confirmations → server reserves the match → both ready → race → provisional result → dispute window → final settlement. No hidden approvals, unlimited token approvals, or automatic repeat bets/rematches.

## Settlement boundary

The chain cannot see this Canvas race. The current authority's result is an off-chain assertion, not a trustless proof. A deterministic replay proves reproducibility of recorded inputs, not that the operator or racers were honest. Never pay based on a browser message, reported winner, or minimap position.

A future signed settlement should bind chain ID, escrow address, unique match ID, player wallets, stake/token, track and vehicle class, rules/content hash, confirmed input-log hash, result, expiry and nonce. The escrow must prevent cross-chain replay, duplicate settlement, unauthorized signers and withdrawals, and support explicit refund/dispute paths. A finalizable signed result needs independent verification and a documented operator-trust model. Separate the game host from the settlement signer; signer compromise must not expose all pots. Use narrowly scoped keys, limits and monitored emergency pause controls. Contract and backend security audits are launch gates, not optional polish.

## Outcomes to agree before money is accepted

| Event | Proposed treatment, subject to review |
| --- | --- |
| Only one deposit arrives / acceptance expires | Refund the funded player after timeout |
| Both deposits confirmed, server cannot start | Refund both; never leave a locked pot |
| Completed clean race | Provisional winner, review window, then settle once |
| Exact draw or both DNF | Refund both; no automatic replay with the same money |
| Player disconnect | Apply published grace/forfeit rules only if infrastructure is healthy; unresolved outage goes to dispute/refund |
| Server crash, ambiguous replay, mismatched rules or lost journal | No automatic winner payout; freeze adjudication with a bounded resolution/refund policy |
| Suspicious automation, collusion or manipulated latency | Flag for review; clear pre-agreed evidence and appeal rules |
| Rematch | New match ID and fresh explicit financial consent |

Do not reuse today's casual 15-second automatic forfeit as an unquestioned money-settlement instruction. Also distinguish a confirmed normal finish from a forced forfeit: today's replay hash verifies the simulation state, while the external forfeit decision is stored in the journal.

## Required before a real-money launch

- Location/age eligibility and specialist legal review. A skill-based race or crypto payment does not automatically exempt a product from gambling, contest, financial-services or consumer-protection rules.
- Wallet ownership verification, account security, sanctions screening, and any required KYC/AML, tax/reporting, responsible-play and self-exclusion controls.
- Bot/collusion detection, replay integrity, authenticated identities, comparable matchmaking latency, packet-loss/lag-switch testing, abuse limits and a support/dispute process. Input-only authority prevents forged positions, not automated driving.
- Production TLS/origins, persistent single-writer journal, crash-safe match reservation, chain confirmation/reorg handling, reconciliation jobs, idempotent settlement and backup/restore drills. A local JSON journal and casual room code alone are not a payment ledger.
- Audited escrow, controlled signer, stake/exposure caps, incident runbook, independent load/security testing, and operational monitoring. Financial features must remain fail-closed if any dependency is unavailable.

## Primary-source context

The UK Gambling Commission's [virtual currencies and esports position paper](https://assets.ctfassets.net/j16ev64qyf6l/4A644HIpG1g2ymq11HdPOT/ca6272c45f1b2874d09eabe39515a527/Virtual-currencies-eSports-and-social-casino-gaming.pdf) explains that prize-game classification depends on how outcomes and participation are arranged. Its [digital-currency guidance](https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/page/digital-and-virtual-currencies) also addresses AML and social-responsibility obligations. These are examples, not a ruling about this project or every country.

FinCEN's [convertible virtual-currency business-model guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models) addresses when money-transmission rules can apply; applicability depends on the actual business model. Counsel must evaluate the chosen architecture and markets. Sources checked 2026-09-13.

## Current implementation

Free practice and free online cups only. Results remain `rewards:false`. No contracts, wallet payment prompts, custody, entry fees, transfers or payout claims were added. Deploy and validate the current racing authority first; then scope the testnet Duel prototype separately.
