const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HEX = /^0x(?:[0-9a-f]{2})*$/i;
const BLOCK = /^(latest|0x[0-9a-f]{1,16})$/i;

/** Allow only the reads this mint uses. Never relay signing, sends, logs,
 * arbitrary contracts, batches, state overrides, or user-supplied gas limits. */
export function validateMintRpc(body, contract) {
  if (!body || Array.isArray(body) || body.jsonrpc !== "2.0" || !Array.isArray(body.params)) return null;
  const { method, params } = body;
  if (method === "eth_getTransactionReceipt") {
    return params.length === 1 && /^0x[0-9a-f]{64}$/i.test(params[0])
      ? { method, params, cacheMs: 1_000 } : null;
  }
  if (method !== "eth_call" || params.length !== 2 || !BLOCK.test(params[1])) return null;
  const tx = params[0];
  if (!tx || typeof tx !== "object" || !contract || String(tx.to).toLowerCase() !== contract.toLowerCase()) return null;
  if (Object.keys(tx).some(k => !["to", "from", "data", "value"].includes(k))) return null;
  if (typeof tx.data !== "string" || !HEX.test(tx.data) || tx.data.length > 4_610) return null;
  const selector = tx.data.slice(0, 10).toLowerCase();
  const readLength = { "0x35b65e1f": 74, "0xdc7af7a8": 138 }[selector];
  if (readLength) {
    if (tx.data.length !== readLength || tx.value || tx.from) return null;
    // Coalesce simultaneous reads, but never reuse a completed pre-mint count
    // for the post-receipt refresh; fast chains can confirm within one second.
    return { method, params, cacheMs: 0 };
  }
  if (!["0x84bb1e42", "0x1ba84308"].includes(selector) || !ADDRESS.test(tx.from)) return null;
  // receiver must be the connected caller; quantity is bounded by the collection.
  if (tx.data.length < 650 || tx.data.slice(34, 74).toLowerCase() !== tx.from.slice(2).toLowerCase()) return null;
  const quantity = BigInt(`0x${tx.data.slice(74, 138)}`);
  if (quantity < 1n || quantity > 2048n) return null;
  if (tx.value !== undefined && !/^0x[0-9a-f]{1,64}$/i.test(tx.value)) return null;
  return { method, params, cacheMs: 0 };
}
