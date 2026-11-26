/**
 * Job 12 step 5 (students split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-job12-step5-students.ts
 * (or npm run test:job12-step5-students).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5, §6 Job 12)
 * stops the OLD main_store students write after the dual-write soak:
 *  - writeStudentsFieldToCloud writes the new collection ONLY — the
 *    writeFieldsToCloud({ students }, updatedBy) main_store leg is gone.
 *  - main_store.students is NOT deleted — it stays as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmStudentsCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the students entry — removing the entry would
 *    stop students syncing entirely. Same reading as Job 1 step 5.)
 *  - Delete + restore still touch main_store students (prune on delete
 *    via writeStudentDeleteFieldsToCloud, union on restore), so the
 *    frozen copy can never resurrect a deleted student via the
 *    backfill or the portal fallback: main_store.students stays a
 *    subset of the collection.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue, portal rebuild preferring the collection.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * One deliberate difference from Job 1 step 5 (notices had no guard
 * inside its removed leg — the notices writer just dropped the line):
 * the students main_store leg ran FIRST on purpose, because the
 * public-shape degradation check (findDegradingStudentIds) lives
 * INSIDE writeFieldsToCloud and threw before anything was written.
 * Deleting the leg literally would have silently dropped that guard
 * from the students upsert path — and the plan (§6 Job 12) says the
 * degradation check and the tripwire "নতুন লেখায় এই দুই যাচাই রাখতেই
 * হবে" (must be kept in the new write). So the check is KEPT in the
 * writer, now run against the collection (the new source of truth)
 * via readStudentsFromCollection() before the collection write, with
 * the same error text — a public-shaped record still cannot
 * overwrite a fuller collection record. The students tripwire
 * (assertTripwire) lives in the delete writer, which is untouched.
 *
 * Context: students count is 173 in the new project ldsdmms (Job 12
 * merged 21 Nov 2026 23:27, PR #45). Dual-write ran ~5 days in the
 * new project — short of the plan's one week; the shortfall is
 * recorded, not hidden (Job 1 step 5 did the same for its soak).
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

const studentsWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStudentsFieldToCloud');
  assert.ok(start > -1, 'writeStudentsFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writeStudentsFieldToCloud still writes the new collection', () => {
  const body = studentsWriterBody();
  assert.ok(body.includes('writeStudentsToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
  assert.ok(body.includes('STUDENTS_CONFIRM_TIMEOUT_MS'), 'students timeout stays 90 seconds');
});

check('writeStudentsFieldToCloud no longer writes main_store students', () => {
  const body = studentsWriterBody();
  assert.ok(!body.includes('writeFieldsToCloud({ students }, updatedBy)'), 'the old main_store leg must be gone');
  assert.ok(!body.includes("writeFieldToCloud('students'"), 'no main_store write path may remain in the students writer');
});

check('no other main_store students upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("writeFieldToCloud('students'"), 'no writeFieldToCloud(students) call may remain anywhere');
});

console.log('--- Degradation guard kept (now against the collection) ---');

check('writer still runs findDegradingStudentIds BEFORE the collection write', () => {
  const body = studentsWriterBody();
  assert.ok(body.includes('findDegradingStudentIds'), 'the degradation guard must stay in the students writer');
  assert.ok(body.includes('readStudentsFromCollection'), 'the guard must compare against the collection (the new source of truth)');
  assert.ok(body.indexOf('findDegradingStudentIds') < body.indexOf('writeStudentsToCollection'), 'a degrading record must throw before any collection write');
  assert.ok(body.includes('Phase 1 choke point: students write rejected'), 'the refusal must keep the choke-point error text');
});

check('degradation check is the SAME findDegradingStudentIds from mainStoreWrite, not a copy', () => {
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(cc.includes('findDegradingStudentIds,'), 'cloudConfirm must import findDegradingStudentIds from mainStoreWrite');
  assert.ok(!cc.includes('function findDegradingStudentIds'), 'cloudConfirm must NOT define its own copy of findDegradingStudentIds');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes students through writeStudentsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const singleWriters: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'pushDiffToCloud singleWriters must exist');
  const body = src.slice(at, at + 1500);
  assert.ok(body.includes('students: writeStudentsFieldToCloud'), 'auto-sync must still carry students (now collection-only)');
});

check('queued-payload replay still routes students through writeStudentsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('students: writeStudentsFieldToCloud'), 'replay must still carry students (now collection-only)');
});

check('confirmStudentsCloudSync still uses writeStudentsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmStudentsCloudSync');
  assert.ok(at > -1, 'confirmStudentsCloudSync must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('writeStudentsFieldToCloud(list, confirmActorName())'), 'student save confirm must still call the students writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('student deletes still delete the collection docs AND prune main_store students', () => {
  const src = readSource('services/cloudConfirm.ts');
  const delAt = src.indexOf('export async function writeStudentDeleteFieldsToCloud');
  assert.ok(delAt > -1, 'writeStudentDeleteFieldsToCloud must exist');
  const delBody = src.slice(delAt, src.indexOf('\n}', delAt) + 2);
  assert.ok(delBody.includes('deriveStudentDeleteOp(students, trashBin)'), 'delete writer must still derive the deleted ids from trash entries');
  assert.ok(delBody.includes('writeDeleteFieldsToCloud'), 'delete writer must still flow through writeDeleteFieldsToCloud');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'students'"), 'delete writer must still handle the students field');
  assert.ok(body.includes('deleteStudentsFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted student)');
  assert.ok(body.includes('await setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('student deletes run the SAME assertTripwire BEFORE any students collection doc is deleted', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(src.includes('assertTripwire,'), 'cloudConfirm must import assertTripwire from mainStoreWrite');
  assert.ok(!src.includes('function assertTripwire'), 'cloudConfirm must NOT define its own copy of assertTripwire');
  assert.ok(body.indexOf('assertTripwire(') < body.indexOf('deleteStudentsFromCollection'), 'a refused shrink must delete nothing anywhere — tripwire first, collection delete after');
  const ms = readSource('services/mainStoreWrite.ts');
  assert.ok(ms.includes("'students'"), 'TRIPWIRE_FIELDS must still list students');
});

check('student restores still write the collection AND union main_store students', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'students'"), 'trash-op writer must still handle the students field');
  assert.ok(body.includes('writeStudentsToCollection'), 'restore must still write the record back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the record into main_store');
});

console.log('--- Read path untouched ---');

check('students feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startStudentsFeed'), 'startStudentsFeed must exist');
  assert.ok(src.includes('studentsFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillStudentsOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ students: docs }, { fromStudentsCollection: true })"), 'feed must still apply collection snapshots');
});

check('portal rebuild still prefers the collection, main_store as fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readStudentsFromCollection'), 'portal rebuild must read the new collection');
  assert.ok(body.includes("getDoc(doc(db, 'institution', 'main_store'))"), 'portal rebuild still reads main_store as the fallback');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteField"), 'the frozen students field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job12-step5-students'], 'tsx scripts/verify-job12-step5-students.ts', 'npm run test:job12-step5-students must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 12 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
