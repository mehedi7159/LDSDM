/**
 * Job 8 step 5 (staffLeaves split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job8-step5-leaves.ts
 * (or npm run test:job8-step5-leaves).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store staffLeaves write after the dual-write soak:
 *  - writeStaffLeavesFieldToCloud writes the new collection ONLY — the
 *    writeFieldToCloud('staffLeaves', ...) main_store leg is gone.
 *  - main_store.staffLeaves is NOT deleted — it stays as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmLeavesCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the staffLeaves entry — removing the entry would
 *    stop leave syncing entirely.)
 *  - Delete + restore still touch main_store staffLeaves (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted leave via the backfill or the leaves feed:
 *    main_store.staffLeaves stays a subset of the collection.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue. Public portal reads no staffLeaves, so its
 *    rebuild needs no source change.
 *  - Leave rules do NOT change: applications stay PENDING, admin-given
 *    leave stays APPROVED, REJECTED stays in the list (only reports
 *    ignore it). No rules change, no main_store delete, no other
 *    field touched.
 *
 * Context: dual-write went live 21 Nov 2026 (PR #42, a196828) and ran
 * 5 days to 26 Nov — short of the plan's one week. The soak shortfall
 * is recorded, not hidden (same honesty as Job 1 step 5, which also
 * shipped short in the new project).
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

const leavesWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStaffLeavesFieldToCloud');
  assert.ok(start > -1, 'writeStaffLeavesFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writeStaffLeavesFieldToCloud still writes the new collection', () => {
  const body = leavesWriterBody();
  assert.ok(body.includes('writeStaffLeavesToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeStaffLeavesFieldToCloud no longer writes main_store staffLeaves', () => {
  const body = leavesWriterBody();
  assert.ok(!body.includes("writeFieldToCloud('staffLeaves'"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the leaves writer');
});

check('no other main_store staffLeaves upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("writeFieldToCloud('staffLeaves'"), 'no writeFieldToCloud(staffLeaves) call may remain anywhere');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes staffLeaves through writeStaffLeavesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const pushDiffToCloud');
  assert.ok(at > -1, 'pushDiffToCloud must exist');
  const body = src.slice(at, at + 9000);
  assert.ok(body.includes('staffLeaves: writeStaffLeavesFieldToCloud'), 'auto-sync must still carry staffLeaves (now collection-only)');
});

check('queued-payload replay still routes staffLeaves through writeStaffLeavesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const retryPendingCloudConfirms');
  assert.ok(at > -1, 'retryPendingCloudConfirms must exist');
  const body = src.slice(at, at + 9000);
  assert.ok(body.includes('staffLeaves: writeStaffLeavesFieldToCloud'), 'replay must still carry staffLeaves (now collection-only)');
});

check('confirmLeavesCloudSync still uses writeStaffLeavesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmLeavesCloudSync');
  assert.ok(at > -1, 'confirmLeavesCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeStaffLeavesFieldToCloud(list, confirmActorName())'), 'leave save confirm must still call the leaves writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('leave deletes still delete the collection docs AND prune main_store staffLeaves', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'staffLeaves'"), 'delete writer must still handle the staffLeaves field');
  assert.ok(body.includes('deleteStaffLeavesFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted leave)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('leave restores still write the collection AND union main_store staffLeaves', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'staffLeaves'"), 'trash-op writer must still handle the staffLeaves field');
  assert.ok(body.includes('writeStaffLeavesToCollection'), 'restore must still write the leave back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the leave into main_store');
});

console.log('--- Read path untouched ---');

check('leaves feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startLeavesFeed'), 'startLeavesFeed must exist');
  assert.ok(src.includes('leavesFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillLeavesOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ staffLeaves: docs }, { fromStaffLeavesCollection: true })"), 'feed must still apply collection snapshots');
});

check('public portal still reads no staffLeaves', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('staffLeaves'), 'publicPortal must not read staffLeaves');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteField"), 'the frozen staffLeaves field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job8-step5-leaves'], 'tsx scripts/verify-job8-step5-leaves.ts', 'npm run test:job8-step5-leaves must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 8 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
