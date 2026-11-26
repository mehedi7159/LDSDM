/**
 * Job 6 step 5 (remarks split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert + tsx,
 * no test framework. Run: npx tsx scripts/verify-job6-step5-remarks.ts
 * (or npm run test:job6-step5-remarks).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store remarks write after the dual-write soak:
 *  - writeRemarksFieldToCloud writes the new collection ONLY — the
 *    writeFieldsToCloud({ remarks }, ...) main_store leg is gone.
 *  - main_store.remarks is NOT deleted — it stays as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmRemarksCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the remarks entry — removing the entry would
 *    stop remarks syncing entirely.)
 *  - Delete + restore still touch main_store remarks (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted remark via the backfill or the portal fallback:
 *    main_store.remarks stays a subset of the collection.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue, portal rebuild preferring the collection.
 *  - No rules change, no main_store delete, no other field touched.
 *  - RemarkRecord has NO id field — the doc id stays studentId__examId
 *    (fieldKeyFn('remarks')); that rule is unchanged by this step.
 *
 * Context: Job 6 dual-write merged 21 Nov 2026 19:32 +0600 (PR #40,
 * commit 2f99445); this step lands 26 Nov — about 5 days of dual-write,
 * short of the plan's one week. The shortfall is recorded, not hidden
 * (same honesty as the Job 1 step-5 header); the remarks feed, takeover
 * gate and backfill have held since the split with no reported loss.
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

const remarksWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeRemarksFieldToCloud');
  assert.ok(start > -1, 'writeRemarksFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writeRemarksFieldToCloud still writes the new collection', () => {
  const body = remarksWriterBody();
  assert.ok(body.includes('writeRemarksToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeRemarksFieldToCloud no longer writes main_store remarks', () => {
  const body = remarksWriterBody();
  assert.ok(!body.includes('writeFieldsToCloud({ remarks }'), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the remarks writer');
});

check('no other main_store remarks upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('writeFieldsToCloud({ remarks }'), 'no writeFieldsToCloud({ remarks }) call may remain anywhere');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes remarks through writeRemarksFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('remarks: writeRemarksFieldToCloud'), 'auto-sync must still carry remarks (now collection-only)');
});

check('queued-payload replay still routes remarks through writeRemarksFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('remarks: writeRemarksFieldToCloud'), 'replay must still carry remarks (now collection-only)');
});

check('confirmRemarksCloudSync still uses writeRemarksFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmRemarksCloudSync');
  assert.ok(at > -1, 'confirmRemarksCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeRemarksFieldToCloud(list, confirmActorName())'), 'remark save confirm must still call the remarks writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('remark deletes still delete the collection docs AND prune main_store remarks', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'remarks'"), 'delete writer must still handle the remarks field');
  assert.ok(body.includes('deleteRemarksFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted remark)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('remark restores still write the collection AND union main_store remarks', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'remarks'"), 'trash-op writer must still handle the remarks field');
  assert.ok(body.includes('writeRemarksToCollection'), 'restore must still write the remark back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the remark into main_store');
});

console.log('--- Read path untouched ---');

check('remarks feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startRemarksFeed'), 'startRemarksFeed must exist');
  assert.ok(src.includes('remarksFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillRemarksOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ remarks: docs }, { fromRemarksCollection: true })"), 'feed must still apply collection snapshots');
});

check('portal rebuild still prefers the collection, main_store as fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readRemarksFromCollection'), 'portal rebuild must read the new collection');
  assert.ok(body.includes('colRemarks.length > 0'), 'portal rebuild must use the collection when it has docs');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen remarks field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job6-step5-remarks'], 'tsx scripts/verify-job6-step5-remarks.ts', 'npm run test:job6-step5-remarks must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 6 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
