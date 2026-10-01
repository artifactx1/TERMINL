# Beat the Bots: launch scope

Source: the user-provided TERMINL pre-mint growth specification. Build the complete
play → verified Barry Cup or Rekt Rumble circuit → save an FCFS WL spot with X, Farcaster or Discord → personal challenge → referred player loop.

## Product decisions

- Two routes; clearing either earns the account's one **FCFS WL spot** (the
  contract allows one per user). Clearing the other route is recorded as a clear
  and scores points:
  - **Barry Cup** (Wen Lambo): beat BarryBot on points across all six courses.
    One race win is not enough. 1st scores 10, 2nd 6, ties on points go to the
    lower combined time (the cup's own rules).
  - **Rekt Rumble circuit**: win all six circuit fights in one official run,
    mirror finale included. A lost fight is retried; the circuit keeps progress
    while fights keep arriving (30 minutes idle, 3 hours total).
- FCFS, not GTD: a spot lets the holder mint during the WL phase while supply
  lasts and never reserves an NFT. Spots are unlimited by default; an optional admin
  limit (shared by both routes, 0 = none) waitlists saves beyond it. The original
  2048 default was the collection size and is reset to unlimited on upgrade.
- Spots from the retired single-race challenge became honored `sprint` spots.
- Replays must give bit-identical results in every browser engine and on the server.
  Wen Lambo v7 uses `lib/arcade/det-math.mjs` instead of `Math.sin/cos/atan2/hypot`,
  which V8 and JavaScriptCore compute differently (v6 runs from iPhones failed to verify).
  Rekt Rumble uses only exact arithmetic. `npm run test:race:engines` compares a full
  cup in V8 and macOS's JavaScriptCore; run it after any race-sim change.
- Official Rekt Rumble fights use a dedicated rival (`lib/arcade/rumble-rival.mjs`)
  that guards the right height, punishes recovery and breaks throws, tightening
  over the six fights. Spam that cleared the practice bot loses every fight.
  Practice keeps the original bot; runs issued before the rival keep theirs.
- Reuse the actual simulations, renderers and controls. A server-issued run pins
  game version, route, bot seed and settings. The browser submits each finished
  race or fight as one segment, in order; the server replays it from the stored
  state of the previous segment. Browser-reported scores confer nothing.
  Rumble attempts each get a bot timing seed derived from the run seed, so
  winning inputs cannot be replayed against another fight.
- **GTD**: when the leaderboard closes at `gtdEndsAt` (end of the marketing
  period), the top `gtdSlots` (default 100) by points become the fixed GTD list;
  ties go to whoever reached their total first. The snapshot is taken before any
  request after the close is handled. Holders submit a mint address until
  `gtdAddressEndsAt`; admin exports the list with addresses.
- Arcade points rank the public leaderboard and decide GTD; they never change FCFS: 10 per
  race win, +50 for the cup, 10 per fight win, +50 for clearing the circuit,
  10 for a legacy sprint win. Points accrue to signed-in accounts; official runs
  played before sign-in on the same browser are added when the player signs in.
  Runs flagged for repeated winning inputs score nothing.
- Play anonymously. Ask for an identity only after a completed route or an explicit Arcade Pass login.
  X and Discord OAuth use session-bound, single-use authorization, immutable user IDs and read-only identity permissions. Farcaster uses a session-bound nonce and server-verified SIWF message.
  No posting API, follow gates, wallet signatures or wallet connection in this flow.
- The Arcade Pass is the account page: status, held spots per route, points,
  leaderboard rank, recent official runs and the mint address (one address covers
  every spot). `/leaderboard` is public; names appear only for players who opt in.
- Referrals count only after a new, distinct provider identity saves its first
  confirmed spot. Suspect claims enter review; clicks and registrations earn nothing.
- Campaign dates, enabled routes, capacity and address window are admin-controlled.
  When no address dates are configured, players with a confirmed spot may submit
  immediately; setting either boundary schedules or freezes the form explicitly.
- Admin changes and address edits are audited. Funnel counters use real events.
  No invented player counts, percentiles, urgency or guarantees.

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
Set campaign dates, enabled routes, Barry's car and pace, optional spot limit and address window there. Activation
is refused only when no sign-in provider is available. The default is closed. Changes apply
to new attempts; issued attempts keep their recorded rules and expire after
twenty minutes. A completed route remains claimable after the campaign closes. A review decision applies to every spot an account holds.

`/beat-the-bots`, `/leaderboard`, `/arcade-pass`, `/challenge/[code]` and the
Wen Lambo and Rekt Rumble result screens make up the public flow. The homepage and arcade invitation only appear while
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

The admin dashboard exports a CSV of addresses with confirmed spots (with spot count
and routes) from active accounts and valid runs. Export is audited and labeled draft until the submission window
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

The test fixture binds to localhost, creates a temporary database, uses a
simulated identity provider and runs its clock 20x fast so a whole cup passes
the real-time check in seconds. Never deploy it. Restart it between runs. The
browser test drives a full Barry Cup and a full Rekt Rumble circuit through
controller inputs, saves both spots, and checks the pass, address form,
challenge card, leaderboard and admin dashboard.

Deploying this change migrates `campaign.sqlite` in place on first start: new
run columns, a `spots` table (existing qualifications copied in as `sprint`) and
legacy points. It is additive; the old `qualifications` table is left unused.
Back up the volume first. Deploy the Railway service and Vercel together: the
new pages need the new endpoints, and the old race-only client cannot start
runs on the new service.

Status: Barry Cup and Rekt Rumble routes verified locally: campaign tests
(including real replay verification through the service), arcade regression
tests, the production build and the complete browser fixture pass.
Real-provider smoke tests are still required after deployment.
