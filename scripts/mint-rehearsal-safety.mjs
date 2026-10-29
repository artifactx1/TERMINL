import assert from 'node:assert/strict';

export function localTestUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, 'http:', 'Rehearsals require a local HTTP server');
  assert.ok(['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname), 'Rehearsals cannot target a public site');
  assert.ok(url.port && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Use a bare loopback URL with an explicit port');
  return url.origin;
}

export function rehearsalEnv(source, base, upstream) {
  localTestUrl(base);
  localTestUrl(upstream);
  // Deliberately exclude credentials and inherited production configuration.
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'CI', 'PLAYWRIGHT_BROWSERS_PATH'].filter(k => source[k]).map(k => [k, source[k]]));
  return { ...env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    TERMINL_NEXT_DIST_DIR: '.next-rehearsal', MINT_TEST_URL: base,
    NEXT_PUBLIC_CHAIN_ID: '4663',
    NEXT_PUBLIC_TERMINL_CONTRACT: '0x00000000000000000000000000000000f1c70000',
    NEXT_PUBLIC_REOWN_PROJECT_ID: '', NEXT_PUBLIC_RPC_URL: upstream,
    RPC_URL: upstream, ALLOWLIST_API_URL: upstream, CAMPAIGN_API_URL: upstream,
    NEXT_PUBLIC_SITE_URL: base, NEXT_PUBLIC_ARCADE_WS_URL: '',
  };
}
