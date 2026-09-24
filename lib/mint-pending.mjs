// Persist only a submitted transaction, never wallet credentials. A reload
// resumes receipt checking instead of inviting a duplicate mint.
const key = (chain, contract, account) => `terminl:pending:${chain}:${contract?.toLowerCase()}:${account?.toLowerCase()}`;
export function savePendingMint(chain, contract, tx, hash) {
  try { sessionStorage.setItem(key(chain, contract, tx.from), JSON.stringify({ tx, hash })); } catch {}
}
export function forgetPendingMint(chain, contract, account) {
  try { sessionStorage.removeItem(key(chain, contract, account)); } catch {}
}
export function loadPendingMint(chain, contract, account) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key(chain, contract, account)));
    if (!/^0x[0-9a-f]{64}$/i.test(saved?.hash)
      || saved.tx?.to?.toLowerCase() !== contract?.toLowerCase()
      || saved.tx?.from?.toLowerCase() !== account?.toLowerCase()
      || !/^0x(?:[0-9a-f]{2})+$/i.test(saved.tx?.data)) return null;
    return saved;
  } catch { return null; }
}
