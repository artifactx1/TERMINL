import { CONTRACT, requestMintRpc } from "../../lib/mint.js";
import { validateMintRpc } from "../../lib/mint-rpc-policy.mjs";

export const config = { api: { bodyParser: { sizeLimit: "8kb" } }, maxDuration: 30 };

// Bounded per-instance controls, in addition to provider/account limits. These
// are not a distributed quota. Do not turn this into a general JSON-RPC proxy.
const clients = new Map();
const pending = new Map();
const cache = new Map();
const MAX_PENDING = 64;
const MAX_CACHE = 2048;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: "Origin not allowed" });
    } catch { return res.status(403).json({ error: "Invalid origin" }); }
  }
  const call = validateMintRpc(req.body, CONTRACT);
  if (!call) return res.status(400).json({ error: "Unsupported mint request" });
  const now = Date.now();
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  let client = clients.get(ip);
  if (!client || now >= client.until) {
    client = { count: 0, until: now + 60_000 };
    if (clients.size >= 10_000) clients.delete(clients.keys().next().value);
    clients.set(ip, client);
  }
  if (++client.count > 120) {
    res.setHeader("Retry-After", "10");
    return res.status(429).json({ error: "Too many mint reads. Please wait a moment." });
  }
  const key = JSON.stringify([call.method, call.params]);
  const held = cache.get(key);
  const id = typeof req.body.id === "number" ? req.body.id : 1;
  if (held && now < held.until) return res.status(200).json({ jsonrpc: "2.0", id, result: held.result });
  if (!pending.has(key)) {
    if (pending.size >= MAX_PENDING) {
      res.setHeader("Retry-After", "1");
      return res.status(503).json({ error: "Mint reads are busy. Please retry." });
    }
    pending.set(key, requestMintRpc(call.method, call.params).then(result => {
      if (call.cacheMs) {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(key, { result, until: Date.now() + call.cacheMs });
      }
      return result;
    }).finally(() => pending.delete(key)));
  }
  try {
    const result = await pending.get(key);
    return res.status(200).json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    // Contract reverts must reach the caller with their original error data.
    if (error?.code !== undefined) return res.status(200).json({ jsonrpc: "2.0", id, error: {
      code: error.code, message: "Contract read rejected", ...(error.data ? { data: error.data } : {}),
    } });
    console.error(JSON.stringify({ event: "mint_rpc_unavailable", method: call.method }));
    return res.status(503).json({ error: "Chain service unavailable. Please retry." });
  }
}
