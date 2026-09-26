# Beat the Bots: launch scope

Source: the user-provided TERMINL pre-mint growth specification. Build the complete
play → verified win → save with X → personal challenge → referred player loop.

## Product decisions

- Start with Wen Lambo and one named official rival on Pacific Coast Run. Fixed
  achievable qualification; leaderboard positions confer prestige, not allocation.
- Reuse the actual race simulation, renderer and controls. A server-issued run
  pins game version, track, rival seed, difficulty and target. The server replays
  bounded inputs and computes the result; browser-reported scores confer nothing.
- Play anonymously. Ask for X only after a win or an explicit Arcade Pass login.
  X OAuth uses PKCE/state, immutable user IDs and read-only identity permissions.
  No posting API, follow gates, wallet signatures or wallet connection in this flow.
- Save qualification durably before saying it is saved. Eligibility for the
  pre-mint pool is distinct from a guaranteed allocation or a minted NFT.
- Personal result pages, individual social cards, user-initiated X composer,
  clear rematch, and a basic leaderboard are launch features.
- Referrals count only after a new, distinct X identity saves a verified win.
  Suspect claims enter review; clicks and registrations alone earn nothing.
- Arcade Pass includes saved result and a later manual public-address form.
  Campaign dates, threshold, capacity and address window are admin-controlled.
- Admin changes and address edits are audited. Funnel counters use real events.
  No invented player counts, percentiles, urgency, rankings or guarantees.
- Defer XP economies, invite tiers, daily chores, creator campaigns and additional
  games until actual replay, qualification, save and referral rates justify them.

## Infrastructure

The existing Railway arcade service has one writer and a persistent volume.
Use a separate transactional campaign store there; keep match journals and rooms
intact. Next.js serves same-origin campaign endpoints and pages. The browser
never receives service credentials or OAuth secrets. Public profile display is
opt-in; anonymous result names remain anonymous otherwise.

X OAuth app configuration is an external launch dependency. Do not advertise
access as earnable while saving it is unavailable. Missing configuration should
leave the existing free arcade usable, without fabricated authentication.

## Release evidence required

- Real input-driven win and loss; tampered, stale, premature, oversized, duplicate
  and cross-session submissions rejected or handled idempotently.
- OAuth state/PKCE/cookie binding, uniqueness, cancellation and token disposal.
- Qualification survives restart; referral self-credit and repeat credit blocked.
- Privacy-safe leaderboard/share pages and valid individual OG images.
- Address validation, uniqueness, deadlines and edit audit; no wallet requests.
- Authenticated admin settings, audit log and funnel counts.
- Desktop/mobile complete flow; build/lint; multiplayer and mint regression checks.
- Deployed health, storage and public flow checked before campaign activation.

## Operations

The campaign uses Node 22.13+ and SQLite on the existing `/data` volume. It must
remain a single writer. Take volume backups before schema or hosting changes.
Match journals and existing multiplayer are separate from `campaign.sqlite`.

Vercel requires `CAMPAIGN_API_URL`, `CAMPAIGN_SERVICE_TOKEN` and
`CAMPAIGN_SITE_ORIGIN`. The Railway service requires the same service token and
origin, plus `CAMPAIGN_ADMIN_TOKEN`, `X_CLIENT_ID` and `X_CLIENT_SECRET`.
Use the production origin `https://terminl.net`. Do not give preview deployments
production credentials.

Configure X as an OAuth 2.0 confidential Web App with callback
`https://terminl.net/api/campaign/auth/callback`. The requested scopes are
`tweet.read users.read`, as required by X identity authentication. Only `/2/users/me`
is read. No write, follow, email, DM or offline scope is requested. The access
token is revoked after lookup and is never stored. Implementation reference:
[X OAuth/PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

`/admin/campaign` accepts the separate admin token, kept only in page memory.
Set campaign dates, difficulty, capacity and address window there. Activation
is refused while X credentials are missing. The default is closed. Changes apply
to new attempts; issued attempts keep their recorded rules and expire after
twenty minutes. Qualification remains claimable after a completed verified win.

`/beat-the-bots`, `/arcade-pass`, `/challenge/[code]` and the race victory screen
make up the public flow. The homepage and arcade invitation only appear while
the campaign is open. Public X handles require opt-in. Public cards omit private
identities and suspended/reviewed results.

Run backend validation with Node 22:

```sh
npx --yes --package=node@22 node --test scripts/campaign.test.mjs
```

The browser suite is explicitly localhost-only and requires a separate fixture
service with simulated X identity. It never posts on X. Real production OAuth
must also be checked after the app is configured; fixture success is not evidence
that the external app settings are correct.

The admin dashboard exports a CSV of addresses belonging to active, qualified,
valid runs. Export is audited and labeled draft until the submission window
freezes. Publishing a contract allowlist remains a separate mint operation.

For a reproducible isolated browser check, use three terminals:

```sh
npx --yes --package=node@22 node scripts/campaign-browser-service.mjs
```

```sh
CAMPAIGN_API_URL=http://127.0.0.1:4025 CAMPAIGN_SERVICE_TOKEN=local-campaign-test CAMPAIGN_SITE_ORIGIN=http://127.0.0.1:4005 TERMINL_NEXT_DIST_DIR=.next/campaign-dev npm run dev -- -p 4005
```

```sh
node scripts/campaign-browser.mjs
```

The test fixture binds to localhost, creates a temporary database, and uses a
simulated identity provider. Never deploy it. The browser test drives the real
game through controller inputs, tests real-time replay verification, and checks
the mobile result, pass, address form, challenge card and admin dashboard.

Status: implementation verified locally. Mint regression: 13/13. Arcade
regression: 136/136. Production qualification stays closed pending X app setup
and a real-provider OAuth smoke test.
