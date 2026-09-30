# Beat the Bots: launch scope

Source: the user-provided TERMINL pre-mint growth specification. Build the complete
play → verified win → save with X, Farcaster or Discord → personal challenge → referred player loop.

## Product decisions

- Start with Wen Lambo and one named official rival on Pacific Coast Run. Fixed
  achievable qualification; leaderboard positions confer prestige, not allocation.
- Reuse the actual race simulation, renderer and controls. A server-issued run
  pins game version, track, rival seed, difficulty and target. The server replays
  bounded inputs and computes the result; browser-reported scores confer nothing.
- Play anonymously. Ask for an identity only after a win or an explicit Arcade Pass login.
  X and Discord OAuth use session-bound, single-use authorization, immutable user IDs and read-only identity permissions. Farcaster uses a session-bound nonce and server-verified SIWF message.
  No posting API, follow gates, wallet signatures or wallet connection in this flow.
- Save qualification durably before saying it is saved. Eligibility for the
  pre-mint pool is distinct from a guaranteed allocation or a minted NFT.
- Personal result pages, individual social cards, user-initiated X composer,
  clear rematch, and a basic leaderboard are launch features.
- Referrals count only after a new, distinct provider identity saves a verified win.
  Suspect claims enter review; clicks and registrations alone earn nothing.
- Arcade Pass leads a qualified player directly from saved identity to a manual public-address form.
  Campaign dates, threshold, capacity and address window are admin-controlled.
  When no address dates are configured, qualified players may submit immediately;
  setting either boundary schedules or freezes the form explicitly.
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

At least one identity provider must be available. Do not advertise access as
earnable while saving it is unavailable. Missing configuration should
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

For identity-only sign-in, set Railway `X_AUTH_MODE=oauth1`, `X_API_KEY` and
`X_API_KEY_SECRET`. The standard X OAuth 1.0a flow requests read access, signs
requests with HMAC-SHA1, binds the temporary request token to its initiating
session and consumes it once. X's authenticated `/oauth/access_token` response
supplies `user_id` and `screen_name`; the app uses the handle as its display name
without querying the separately permissioned `/2/users/me` endpoint. User access
tokens are discarded and revocation is attempted immediately. Temporary request
secrets expire after ten minutes. The same registered callback is used.
See [X's authentication API reference](https://docs.x.com/fundamentals/authentication/api-reference#post-oauthaccess_token).

Discord uses the standard authorization-code flow with the `identify` scope only.
Create a Discord developer application, register
`https://terminl.net/api/campaign/auth/callback`, and set Railway
`DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. The access token is used once to
read `/users/@me`, then revoked and never stored.

Farcaster uses the official SIWF relay and AuthKit. It needs no client secret or
paid identity vendor. The backend verifies the signed message, origin-bound
domain, single-use nonce and FID ownership. `FARCASTER_RPC_URL` may point to a
private Optimism mainnet RPC for reliability; otherwise the public endpoint is
used. Set `FARCASTER_AUTH_ENABLED=false` to disable the provider.

OAuth 2.0 remains available when `X_AUTH_MODE` is unset, using the Client ID and
Client Secret below. A 403 `app_access_level` from its profile lookup means the
provider rejected that endpoint; do not assume adding billing will resolve it.
Start and callback limits are separate so each completed sign-in consumes one
start attempt rather than two.

The campaign uses Node 22.13+ and SQLite on the existing `/data` volume. It must
remain a single writer. Take volume backups before schema or hosting changes.
Match journals and existing multiplayer are separate from `campaign.sqlite`.

Vercel requires `CAMPAIGN_API_URL`, `CAMPAIGN_SERVICE_TOKEN` and
`CAMPAIGN_SITE_ORIGIN`. The Railway service requires the same service token and
origin, plus `CAMPAIGN_ADMIN_TOKEN` and credentials for each enabled OAuth provider.
Use the production origin `https://terminl.net`. Do not give preview deployments
production credentials.

For OAuth 2.0, configure X as a confidential Web App with callback
`https://terminl.net/api/campaign/auth/callback`. The requested scopes are
`tweet.read users.read`, as required by X identity authentication. Only `/2/users/me`
is read. No write, follow, email, DM or offline scope is requested. The access
token is revoked after lookup and is never stored. Implementation reference:
[X OAuth/PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

`/admin/campaign` accepts the separate admin token, kept only in page memory.
Set campaign dates, difficulty, capacity and address window there. Activation
is refused only when no sign-in provider is available. The default is closed. Changes apply
to new attempts; issued attempts keep their recorded rules and expire after
twenty minutes. Qualification remains claimable after a completed verified win.

`/beat-the-bots`, `/arcade-pass`, `/challenge/[code]` and the race victory screen
make up the public flow. The homepage and arcade invitation only appear while
the campaign is open. Public identity labels require opt-in. Public cards omit private
identities and suspended/reviewed results.

Run backend validation with Node 22:

```sh
npx --yes --package=node@22 node --test scripts/campaign.test.mjs
```

The browser suite is explicitly localhost-only and requires a separate fixture
service with simulated X and Discord identity. It never posts to either service. Real production OAuth
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

Status: multi-provider implementation verified locally. Campaign/security tests
and the production Next.js build pass, including the complete browser fixture.
Discord remains hidden until its two Railway credentials are present. Real-provider
smoke tests are still required after deployment.
