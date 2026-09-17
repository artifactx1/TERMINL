# Report-only Content Security Policy

The site sends `Content-Security-Policy-Report-Only`, never an enforcing CSP.
Browsers can still run/load resources that violate this candidate policy. The
policy is in `lib/security/csp.cjs`, installed by `next.config.js`.

`Reporting-Endpoints: csp="/api/csp-report"` and `report-to csp` send modern
browser reports to the same deployment. `report-uri /api/csp-report` supports
older implementations. Production HTTPS is needed for reliable Reporting API
delivery; browsers may batch, delay or drop reports.

The initial sources cover the installed Reown/WalletConnect and Coinbase SDKs,
Robinhood RPCs, plus the origins of `NEXT_PUBLIC_RPC_URL` and
`NEXT_PUBLIC_ARCADE_WS_URL` at build time. Only origins enter the header, never
RPC key paths or credentials. The arcade's corresponding HTTP(S) health-check
origin is also included. ArtifactX allowlist calls happen server-side through
the site's own API, so that backend does not need a browser CSP exception.

HTTPS wallet icons are allowed. Inline scripts/styles are temporarily allowed
for static Next.js bootstrapping and wallet UI; this is a compatibility baseline,
not a completed strict XSS policy. A future enforcing policy needs a separate
decision about script nonces/hashes. Development also allows eval and local
connections for Next HMR and the local arcade server.

## Reviewing reports

1. Open the deployment's **server/runtime logs**, filtered to `/api/csp-report`
   or `csp_violation`. Each accepted violation is one JSON log entry, for example:

   ```json
   {"event":"csp_violation","disposition":"report","directive":"connect-src","document":"https://terminl.net/os/rumble","blocked":"wss://example.com","source":"https://terminl.net"}
   ```

2. Exercise the supported wallet choices, mobile deep links, reconnects and mint
   transactions, then online racing/fighting. Review unexpected origins against
   SDK documentation and observed requests before editing the source list.
3. Treat reports as untrusted input. They can be forged or caused by extensions.
   Do not automatically add reported domains to the policy.
4. Keep report-only mode until those flows have been tested. An empty log is not
   proof of compatibility: a browser might not have delivered reports. There is
   no automatic switch to enforcement and no fixed seven-day countdown.

The collector logs only the directive, disposition, document origin/known route,
and blocked/source origins (or markers such as `inline`). It drops URL credentials,
query strings, fragments, arbitrary paths, script samples, referrers, full policy,
user agent, cookies and IP addresses. Hosting access logs have their own retention
and privacy behavior outside this handler.

The endpoint accepts legacy CSP objects and Reporting API batches, limits bodies
to 32 KiB and batches to 20, and emits at most 120 reports per minute per running
instance. Excess reports get `429` with `Retry-After`. This is a logging budget,
not a distributed rate limiter. Reports are stored in **hosting logs only**;
retention follows the hosting plan, with no database or public report viewer.
Export relevant logs before they expire if reviewing over a longer interval.

## Verification

Run `npm run test:csp` for sanitization, both report formats, invalid input,
logging limits and report-only header checks. `npm run test:csp:browser` uses
`CSP_TEST_URL` (default `http://localhost:4000`) to check real response headers,
the live collector, and a browser-generated violation that still executes.

References: [MDN report-only CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only),
[Reporting API endpoint resolution](https://www.w3.org/TR/reporting-1/#process-header),
[Reown CSP guidance](https://docs.reown.com/advanced/security/content-security-policy).
