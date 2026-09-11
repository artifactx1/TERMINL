import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Single-writer, fsync-before-ack journal. No currency or reward ledger. */
export async function openJournal(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = join(directory, 'matches.jsonl');
  const results = new Map();
  const active = new Map();
  let contents = '';
  try { contents = await readFile(filename, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // A crash can leave only the final write incomplete. Do not discard earlier corruption.
  const lines = contents.split('\n');
  let validBytes = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (i === lines.length - 1) break;
    let entry;
    try { entry = JSON.parse(line); } catch (error) { if (i === lines.length - 1) break; throw error; }
    if (!entry.id || !['start', 'result'].includes(entry.kind)) throw new Error('Invalid match journal entry');
    if (entry.kind === 'start') active.set(entry.id, entry);
    else { results.set(entry.id, entry); active.delete(entry.id); }
    validBytes += Buffer.byteLength(line + '\n');
  }
  const file = await open(filename, 'a+', 0o600);
  if (Buffer.byteLength(contents) !== validBytes) await file.truncate(validBytes);
  let queue = Promise.resolve();
  let failure = null;
  const schedule = (operation) => {
    const task = queue.then(() => { if (failure) throw failure; return operation(); });
    // Preserve a fatal state without leaving an unobserved rejected queue promise.
    queue = task.then(() => undefined, (error) => { failure ||= error; });
    return task;
  };
  const append = (entry) => {
    return schedule(async () => { await file.write(JSON.stringify(entry) + '\n'); await file.sync(); });
  };
  const finish = async (entry) => {
    if (results.has(entry.id)) return results.get(entry.id);
    // Serialize the lookup as well as the disk write to deduplicate concurrent finishes.
    return schedule(async () => {
      if (results.has(entry.id)) return results.get(entry.id);
      const result = { ...entry, kind: 'result' };
      await file.write(JSON.stringify(result) + '\n'); await file.sync();
      results.set(result.id, result); active.delete(result.id);
      return result;
    });
  };
  for (const match of active.values()) {
    await finish({ id: match.id, room: match.room, endedAt: Date.now(), status: 'aborted', reason: 'service_restart', winner: null, rewards: false, participants: match.participants });
  }
  return {
    results, active,
    async start(entry) { const record = { ...entry, kind: 'start' }; await append(record); active.set(record.id, record); },
    finish,
    async close() { try { await queue; if (failure) throw failure; } finally { await file.close(); } },
  };
}
