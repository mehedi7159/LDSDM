/**
 * verify-rc-trash-resurrection.ts — scripted proof for the RC fix
 * to the trashed-teacher resurrection (13 Nov 2026 live audit, §M
 * + new problem 6).
 *
 * Live failure: a teacher permanently deleted from the bin (three
 * copies) came back in the Staff Hub with a new code (EMP-tch_mw);
 * one trash attempt also did not stick at first (bin gained the
 * items while the Hub still showed 3).
 *
 * Root cause, traced to the sync layer:
 *  (a) A restore that fails its cloud confirm queues a trashOp
 *      payload whose upserts carry the teacher+login records.
 *      pruneQueueAgainstRemoteData NEVER handled trashOp items, so
 *      the queued restore survived forever: mergeQueuedIntoList
 *      re-applied it over every snapshot, and
 *      retryPendingCloudConfirms replayed it to cloud on every
 *      mount / visibility change / online event.
 *  (b) clearPendingPayloadsForField('trashBin') — run on every
 *      successful trash-op confirm, including permanent delete —
 *      KEPT a queued trashOp that still carried upserts; it only
 *      emptied removeTrashIds.
 *  (c) The tombstone was the only suppression: while the record sat
 *      in trashBin, applyRemoteData/diffRecords filtered it out.
 *      Permanently deleting the bin item removed the tombstone while
 *      the stale queued restore survived — so the next snapshot /
 *      retry resurrected the record, and the auto-sync diff then
 *      legitimised it back to cloud as a "new" record.
 *  (d) writeTrashOpToCloud unioned upserts without checking cloud
 *      trash — a replay landing after a re-trash resurrected the
 *      record even at the writer.
 *
 * Rule under test:
 *  - pruneQueueAgainstRemoteData voids trashOp upserts for records
 *    that are (again) in the remote trashBin, and drops the entry
 *    when nothing is left to do; a pending restore for a record
 *    that is NOT trashed is left alone (Sadia protection).
 *  - voidQueuedRestoreUpsertsForKeys cancels queued restore upserts
 *    by record key; the retry voids them for locally-trashed
 *    records before replaying, and permanent-delete / empty-trash
 *    void them for the deleted records.
 *  - writeTrashOpToCloud skips upsert records whose id is in the
 *    cloud trashBin (other than the entry this same call removes).
 *
 * Run: npx tsx scripts/verify-rc-trash-resurrection.ts
 * (or npm run test:rc-trash-resurrection)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- in-memory localStorage (payloadQueue reads it directly) ----
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const resetQueue = () => store.clear();

const {
  queuePendingPayload,
  readPendingPayloads,
  pruneQueueAgainstRemoteData,
  mergeQueuedIntoList,
} = await import('../services/payloadQueue');
// New in this fix — dynamic import so pre-fix code fails these
// checks (instead of failing the whole script at load time).
let voidQueued: ((keys: string[]) => boolean) | null = null;
let stripFn: ((item: any, keys: Set<string>) => any) | null = null;
try {
  ({ voidQueuedRestoreUpsertsForKeys: voidQueued, stripTrashOpUpsertsForKeys: stripFn } =
    await import('../services/payloadQueue'));
} catch {
  voidQueued = null;
  stripFn = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`✗ ${name}  <-- ${e?.message || e}`);
  }
}
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

const teacher = { id: 'tch_mw1', name: 'Test Teacher', employeeCode: 'MDR-T004', email: 'test.teacher.audit@example.com' };
const user = { id: 'tch_mw1', name: 'Test Teacher', email: 'test.teacher.audit@example.com' };
const queueFailedRestore = () => {
  resetQueue();
  queuePendingPayload({ op: 'trashOp', removeTrashIds: ['bt1'], upserts: { teachers: [teacher], users: [user] } });
  return readPendingPayloads();
};

// (0) MECHANISM: a queued restore upsert re-appears over a snapshot
// that does NOT contain the record (this is how it resurrects).
check('(0) queued restore upsert merges over an empty snapshot', () => {
  queueFailedRestore();
  const merged = mergeQueuedIntoList([], 'teachers');
  assert(merged.length === 1 && (merged[0] as any).id === 'tch_mw1',
    `expected the trashed teacher back over an empty snapshot, got ${JSON.stringify(merged)}`);
});

// (1) prune voids the restore upsert once the record is trashed again.
check('(1) prune voids a queued restore for a re-trashed record', () => {
  queueFailedRestore();
  const remote = { teachers: [], users: [], trashBin: [{ id: 'bt2', type: 'teacher', data: teacher }] };
  const changed = pruneQueueAgainstRemoteData(remote);
  assert(changed === true, 'expected prune to report a change');
  const items = readPendingPayloads();
  assert(items.length === 1, `expected the trashOp entry to survive (removals pending), got ${items.length}`);
  assert(!items[0].upserts?.teachers?.length && !items[0].upserts?.users?.length,
    `expected both upserts voided, got ${JSON.stringify(items[0].upserts)}`);
  assert((items[0].removeTrashIds || []).includes('bt1'), 'expected the trash removal to survive');
  // And the snapshot no longer resurrects it:
  assert(mergeQueuedIntoList([], 'teachers').length === 0, 'expected no resurrection after prune');
});

// (2) prune leaves a legit pending restore alone (Sadia protection).
check('(2) prune keeps a pending restore for a record that is NOT trashed', () => {
  queueFailedRestore();
  const changed = pruneQueueAgainstRemoteData({ teachers: [], users: [], trashBin: [] });
  assert(changed === false, 'expected prune to report no change');
  const items = readPendingPayloads();
  assert(items.length === 1 && (items[0].upserts?.teachers || []).length === 1,
    `expected the restore upsert intact, got ${JSON.stringify(items[0]?.upserts)}`);
});

// (3) voidQueuedRestoreUpsertsForKeys cancels by record key.
check('(3) void by key cancels the queued restore upserts', () => {
  assert(voidQueued !== null, 'voidQueuedRestoreUpsertsForKeys is missing (pre-fix code)');
  queueFailedRestore();
  const changed = voidQueued!(['tch_mw1']);
  assert(changed === true, 'expected the queue to change');
  const items = readPendingPayloads();
  assert(items.length === 1, 'expected the entry to survive for its trash removal');
  assert(!items[0].upserts?.teachers?.length && !items[0].upserts?.users?.length,
    `expected both upserts voided, got ${JSON.stringify(items[0].upserts)}`);
  assert((items[0].removeTrashIds || []).includes('bt1'), 'expected the trash removal to survive');
});
check('(3b) void by an unrelated key leaves the queue alone', () => {
  assert(voidQueued !== null, 'voidQueuedRestoreUpsertsForKeys is missing (pre-fix code)');
  queueFailedRestore();
  const changed = voidQueued!(['someone-else']);
  assert(changed === false, 'expected no change');
  assert(readPendingPayloads().length === 1, 'expected the entry to survive');
});
check('(3c) an entry with nothing left to do is dropped', () => {
  assert(voidQueued !== null, 'voidQueuedRestoreUpsertsForKeys is missing (pre-fix code)');
  resetQueue();
  queuePendingPayload({ op: 'trashOp', removeTrashIds: [], upserts: { teachers: [teacher] } });
  const changed = voidQueued!(['tch_mw1']);
  assert(changed === true, 'expected the queue to change');
  assert(readPendingPayloads().length === 0, 'expected the emptied entry to be dropped');
});

// (4) A queued 'delete' op still prunes as before (regression).
check('(4) delete-op pruning unchanged', () => {
  resetQueue();
  queuePendingPayload({ op: 'delete', removals: [{ field: 'teachers', ids: ['tch_mw1'] }], trashEntries: [] });
  const changed = pruneQueueAgainstRemoteData({ teachers: [], trashBin: [] });
  assert(changed === true, 'expected the delete op to prune once its removals landed');
  assert(readPendingPayloads().length === 0, 'expected the queue to be empty');
});

// (5) Wiring: the retry voids locally-trashed restores before replay,
// permanent-delete and empty-trash void for the deleted records.
check('(5) retry voids trashed restores before replay', () => {
  const ctx = readSource('context/AppContext.tsx');
  assert(ctx.includes('voidQueuedRestoreUpsertsForKeys(Array.from(trashedNow))'),
    'retryPendingCloudConfirms does not void locally-trashed restore upserts');
  assert(ctx.includes('trashBinRef.current'), 'retry guard has no trashBinRef read');
});
check('(5b) permanent delete voids the deleted record', () => {
  const ctx = readSource('context/AppContext.tsx');
  assert(ctx.includes('if (item?.data?.id) voidQueuedRestoreUpsertsForKeys([String(item.data.id)])'),
    'permanentlyDeleteTrashItem does not void the queued restore');
});
check('(5c) empty trash voids every deleted record', () => {
  const ctx = readSource('context/AppContext.tsx');
  assert(ctx.includes('voidQueuedRestoreUpsertsForKeys(dataIds)'),
    'emptyTrash does not void the queued restores');
});

// (6) Writer guard: writeTrashOpToCloud skips upserts trashed in cloud.
check('(6) trash-op writer honours the cloud tombstone', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert(src.includes('trashedDataIds'), 'no tombstone set in writeTrashOpToCloud');
  assert(src.includes('liveRecords'), 'upserts are not filtered against the tombstone');
  assert(src.includes('for (const [field] of writtenFields)'),
    'tripwire still iterates the unfiltered upsert fields');
});

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
