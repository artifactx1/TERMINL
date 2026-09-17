const MAX_BYTES = 32 * 1024;
const MAX_BATCH = 20;
const MAX_PER_MINUTE = 120;
const CONTENT_TYPES = new Set(['application/csp-report', 'application/reports+json', 'application/json']);
const DIRECTIVES = new Set(['default-src', 'base-uri', 'object-src', 'frame-ancestors', 'form-action',
  'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'font-src', 'media-src', 'worker-src', 'child-src', 'connect-src', 'frame-src', 'manifest-src']);
const ROUTES = new Set(['/', '/os', '/os/moon', '/os/lambo', '/os/rumble', '/os/rug-or-bond', '/os/asset-lab']);

function urlSummary(value, document = false) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  if (['inline', 'eval', 'wasm-eval', 'data', 'blob'].includes(value)) return value;
  try {
    const url = new URL(value);
    if (!['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol)) {
      return ['data:', 'blob:', 'chrome-extension:', 'moz-extension:', 'safari-extension:'].includes(url.protocol) ? url.protocol : null;
    }
    if (url.origin.length > 256) return null;
    // Never retain credentials, queries, fragments, RPC keys or wallet paths.
    return document ? url.origin + (ROUTES.has(url.pathname) ? url.pathname : '/[redacted]') : url.origin;
  } catch { return null; }
}

function normalize(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const directive = body.effectiveDirective ?? body['effective-directive'] ?? body['violated-directive'];
  const document = urlSummary(body.documentURL ?? body['document-uri'], true);
  if (!DIRECTIVES.has(directive) || !document || !/^https?:\/\//.test(document)) return null;
  const disposition = body.disposition;
  return {
    event: 'csp_violation',
    disposition: ['report', 'enforce'].includes(disposition) ? disposition : 'unknown',
    directive,
    document,
    blocked: urlSummary(body.blockedURL ?? body['blocked-uri']),
    source: urlSummary(body.sourceFile ?? body['source-file']),
  };
}

// Public, unauthenticated browser telemetry. Logs are observations, not trusted
// evidence. This fixed budget bounds logging per process, not globally at the edge.
export function createCspReportHandler({ log = entry => console.info(JSON.stringify(entry)), now = Date.now } = {}) {
  let windowStart = 0, count = 0;
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!CONTENT_TYPES.has(type)) return res.status(415).end();
    let payload = req.body;
    if (typeof payload === 'string') {
      if (Buffer.byteLength(payload) > MAX_BYTES) return res.status(413).end();
      try { payload = JSON.parse(payload); } catch { return res.status(400).end(); }
    }
    let reports;
    if (Array.isArray(payload)) {
      if (payload.length > MAX_BATCH) return res.status(413).end();
      // Reporting API batches may also contain unrelated browser report types.
      reports = payload.filter(item => item?.type === 'csp-violation').map(item => normalize(item.body)).filter(Boolean);
    } else {
      const report = normalize(payload?.['csp-report']);
      if (!report) return res.status(400).end();
      reports = [report];
    }
    const time = now();
    if (time - windowStart >= 60_000) { windowStart = time; count = 0; }
    if (count + reports.length > MAX_PER_MINUTE) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((windowStart + 60_000 - time) / 1000))));
      return res.status(429).end();
    }
    count += reports.length;
    for (const report of reports) log(report);
    return res.status(204).end();
  };
}
