/**
 * Job 2 step 5 (schedule split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert +
 * tsx, no test framework. Run: npx tsx scripts/verify-job2-step5-schedule.ts
 * (or npm run test:job2-step5-schedule).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store schedule write after the dual-write soak:
 *  - writeScheduleFieldsToCloud writes the new collections ONLY — the
 *    writeFieldsToCloud({ classRoutines, syllabusItems, calendarEvents })
 *    main_store leg is gone (all three fields went in one call).
 *  - main_store.classRoutines / syllabusItems / calendarEvents are NOT
 *    deleted — they stay as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmScheduleCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the schedule entry — removing the entry would
 *    stop schedule syncing entirely.)
 *  - Delete + restore still touch main_store schedule (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted routine via the backfill or a schedule feed:
 *    main_store schedule stays a subset of the collections.
 *  - Read path untouched: collection feeds + takeover gate, backfill,
 *    straggler rescue. Public portal reads none of these three fields,
 *    so its rebuild needs no change.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: dual-write ran 10 days in the old project (10–20 Nov, meets
 * the plan's one week) and ~6 days in the new project ldsdmms since the
 * 20 Nov migration; the schedule collections have been the read source
 * since the Job 2 takeover gate, so the data risk of stopping the old
 * leg is nil.
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

const FIELDS = ['classRoutines', 'syllabusItems', 'calendarEvents'] as const;

const scheduleWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeScheduleFieldsToCloud');
  assert.ok(start > -1, 'writeScheduleFieldsToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store schedule leg stopped ---');

check('writeScheduleFieldsToCloud still writes the new collections', () => {
  const body = scheduleWriterBody();
  assert.ok(body.includes('writeScheduleRecordsToCollection'), 'must still write the new collections');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeScheduleFieldsToCloud no longer writes main_store schedule', () => {
  const body = scheduleWriterBody();
  assert.ok(!body.includes('writeFieldsToCloud({ classRoutines'), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the schedule writer');
});

check('no other main_store schedule upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('writeFieldsToCloud({ classRoutines'), 'no writeFieldsToCloud(classRoutines...) call may remain anywhere');
  for (const field of FIELDS) {
    assert.ok(!src.includes(`writeFieldToCloud('${field}'`), `no writeFieldToCloud(${field}) call may remain anywhere`);
  }
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes schedule through writeScheduleFieldsToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('writeScheduleFieldsToCloud(rDelta, sDelta, cDelta, actor)'), 'auto-sync must still carry schedule (now collection-only)');
});

check('queued-payload replay still routes schedule through writeScheduleFieldsToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  for (const field of FIELDS) {
    assert.ok(body.includes(`${field}: (recs, actor) => writeScheduleFieldsToCloud`), `replay must still carry ${field} (now collection-only)`);
  }
});

check('confirmScheduleCloudSync still uses writeScheduleFieldsToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmScheduleCloudSync');
  assert.ok(at > -1, 'confirmScheduleCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeScheduleFieldsToCloud('), 'schedule save confirm must still call the schedule writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('schedule deletes still delete the collection docs AND prune main_store schedule', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`removal.field === '${field}'`), `delete writer must still handle the ${field} field`);
  }
  assert.ok(body.includes('deleteScheduleRecordsFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted record)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('schedule restores still write the collections AND union main_store schedule', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`field === '${field}'`), `trash-op writer must still handle the ${field} field`);
  }
  assert.ok(body.includes('writeScheduleRecordsToCollection'), 'restore must still write the record back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the record into main_store');
});

console.log('--- Read path untouched ---');

check('schedule feeds, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startScheduleFeeds'), 'startScheduleFeeds must exist');
  assert.ok(src.includes('scheduleFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillScheduleOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ [field]: docs }"), 'feed must still apply collection snapshots');
});

check('public portal still reads none of the three schedule fields', () => {
  const src = readSource('services/publicPortal.ts');
  for (const field of FIELDS) {
    assert.ok(!src.includes(field), `publicPortal must not read ${field}`);
  }
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen schedule fields must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job2-step5-schedule'], 'tsx scripts/verify-job2-step5-schedule.ts', 'npm run test:job2-step5-schedule must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 2 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
