// Observation only. Do not change this to an enforcing header without wallet QA.
function origin(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol) ? url.origin : null;
  } catch { return null; }
}

function cspHeaders(env = process.env) {
  const walletConnect = ['rpc', 'relay', 'pulse', 'keys', 'notify', 'echo', 'push']
    .flatMap(service => ['com', 'org'].map(tld => `https://${service}.walletconnect.${tld}`));
  const connect = [
    "'self'", ...walletConnect,
    'wss://relay.walletconnect.com', 'wss://relay.walletconnect.org',
    'https://api.web3modal.com', 'https://api.web3modal.org',
    'https://cca-lite.coinbase.com', 'https://rpc.wallet.coinbase.com',
    'https://www.walletlink.org', 'wss://www.walletlink.org',
    'https://rpc.mainnet.chain.robinhood.com', 'https://rpc.testnet.chain.robinhood.com',
    origin(env.NEXT_PUBLIC_RPC_URL), origin(env.NEXT_PUBLIC_ARCADE_WS_URL),
  ].filter(Boolean);
  // The arcade health check uses HTTPS at the same host as its WebSocket.
  const arcade = origin(env.NEXT_PUBLIC_ARCADE_WS_URL);
  if (arcade) connect.push(arcade.replace(/^ws/, 'http'));
  const development = env.NODE_ENV === 'development';
  if (development) connect.push('ws://localhost:*', 'ws://127.0.0.1:*', 'http://localhost:*', 'http://127.0.0.1:*');
  const directives = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    // Static Next pages use inline bootstrap scripts; nonce/hash hardening is
    // separate work. Avoid an inline-script report on every ordinary page load.
    'script-src': ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Wallet icons come from third-party HTTPS hosts chosen by the wallet catalog.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'https://fonts.reown.com'],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'connect-src': [...new Set(connect)],
    'frame-src': ["'self'", 'https://verify.walletconnect.com', 'https://verify.walletconnect.org',
      'https://secure.walletconnect.com', 'https://secure.walletconnect.org',
      'https://keys.coinbase.com', 'https://account.base.app'],
    'report-uri': ['/api/csp-report'],
    'report-to': ['csp'],
  };
  return [
    { key: 'Content-Security-Policy-Report-Only', value: Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ') },
    // Relative to the response origin: previews report to their own collector.
    { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
  ];
}

module.exports = { cspHeaders };
