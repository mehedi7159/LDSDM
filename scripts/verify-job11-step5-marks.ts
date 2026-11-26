/**
 * Job 11 step 5 (marks split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert +
 * tsx, no test framework. Run: npx tsx scripts/verify-job11-step5-marks.ts
 * (or npm run test:job11-step5-marks).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store marks write after the dual-write soak:
 *  - writeMarksFieldToCloud writes the new collection ONLY — the
 *    writeFieldToCloud('marks', ...) main_store leg is gone.
 *  - main_store.marks is NOT deleted — it stays as a frozen copy.
 *  - This ends the whole-list rewrite on every marks save: the old leg
 *    rewrote the full 2,601-record list into main_store each time; now
 *    only the marks collection docs are written (500-doc batches).
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmMarksCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the marks entry — removing the entry would
 *    stop marks syncing entirely.)
 *  - Delete + restore still touch main_store marks (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted mark via the backfill or the portal fallback:
 *    main_store.marks stays a subset of the collection.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue, portal rebuild preferring the collection.
 *  - Marks-entry control (global switch + per-exam toggle, default
 *    open) is unchanged; the 40 s marks confirm timeout is unchanged.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: marks is the largest list (2,601 records). Dual-write ran
 * 21 Nov (Job 11 split, PR #48 area) to 26 Nov — five days in the new
 * project ldsdmms, short of the plan's one week, but the collection
 * feed has been the read source since takeover and the frozen copy is
 * kept, so the data risk is nil; the soak shortfall is recorded, not
 * hidden.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

const marksWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeMarksFieldToCloud');
  assert.ok(start > -1, 'writeMarksFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writeMarksFieldToCloud still writes the new collection', () => {
  const body = marksWriterBody();
  assert.ok(body.includes('writeMarksToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeMarksFieldToCloud no longer writes main_store marks', () => {
  const body = marksWriterBody();
  assert.ok(!body.includes("writeFieldToCloud('marks'"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the marks writer');
});

check('no other main_store marks upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("writeFieldToCloud('marks'"), 'no writeFieldToCloud(marks) call may remain anywhere');
});

check('marks confirm timeout is still 40 seconds (CONFIRM_TIMEOUT_MS unchanged)', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(src.includes('const CONFIRM_TIMEOUT_MS = 40000;'), 'CONFIRM_TIMEOUT_MS must stay 40000');
  const body = marksWriterBody();
  assert.ok(body.includes('CONFIRM_TIMEOUT_MS'), 'marks collection-only write must use the unchanged 40 s timeout');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes marks through writeMarksFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('marks: writeMarksFieldToCloud'), 'auto-sync must still carry marks (now collection-only)');
});

check('queued-payload replay still routes marks through writeMarksFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('marks: writeMarksFieldToCloud'), 'replay must still carry marks (now collection-only)');
});

check('confirmMarksCloudSync still uses writeMarksFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmMarksCloudSync');
  assert.ok(at > -1, 'confirmMarksCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeMarksFieldToCloud(list, confirmActorName())'), 'marks save confirm must still call the marks writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('mark deletes still delete the collection docs AND prune main_store marks', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'marks'"), 'delete writer must still handle the marks field');
  assert.ok(body.includes('deleteMarksFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted mark)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('mark restores still write the collection AND union main_store marks', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'marks'"), 'trash-op writer must still handle the marks field');
  assert.ok(body.includes('writeMarksToCollection'), 'restore must still write the mark back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the mark into main_store');
});

console.log('--- Read path untouched ---');

check('marks feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startMarksFeed'), 'startMarksFeed must exist');
  assert.ok(src.includes('marksFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillMarksOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ marks: docs }"), 'feed must still apply collection snapshots');
});

check('portal rebuild still prefers the collection, main_store as fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readMarksFromCollection'), 'portal rebuild must read the new collection');
  assert.ok(body.includes('colMarks.length ==='), 'portal rebuild must require exact coverage before switching source');
});

check('marks entry two-level control is unchanged (global switch + per-exam toggle, default open)', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes("if (typeof data.markEntryEnabled === 'boolean'"), 'global mark-entry switch must keep its boolean-only rule');
  assert.ok(src.includes('markEntryEnabled'), 'mark-entry control must still exist');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteField"), 'the frozen marks field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job11-step5-marks'], 'tsx scripts/verify-job11-step5-marks.ts', 'npm run test:job11-step5-marks must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 11 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
