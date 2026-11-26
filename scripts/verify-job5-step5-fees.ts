/**
 * Job 5 step 5 (feeTypes + feeStructures split) — self-check (26 Nov 2026,
 * base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert +
 * tsx, no test framework. Run: npx tsx scripts/verify-job5-step5-fees.ts
 * (or npm run test:job5-step5-fees).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5, §6 Job 5)
 * stops the OLD main_store fees writes after the dual-write soak:
 *  - writeFeeTypesFieldToCloud writes the new collection ONLY — the
 *    writeFieldToCloud('feeTypes', ...) main_store leg is gone.
 *  - writeFeeStructuresFieldToCloud writes the new collection ONLY —
 *    the inline main_store block (getDoc main_store + setDoc merge
 *    with mergeRecordsByKey by classLevel) is gone. Doc id stays
 *    classLevel, and the classLevel assert still refuses a structure
 *    without a classLevel.
 *  - main_store.feeTypes / main_store.feeStructures are NOT deleted —
 *    they stay as a frozen copy.
 *  - The collection writes stay wired everywhere they were:
 *    pushDiffToCloud auto-sync, the queued-payload replay, and
 *    confirmFeeTypesCloudSync / confirmFeeStructuresCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the fees entries — removing an entry would
 *    stop fees syncing entirely.)
 *  - Delete + restore still touch main_store fees (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted fee record via the backfill or a fallback:
 *    main_store fees stay a subset of the collections.
 *  - Read path untouched: joint fees feeds + takeover gate, backfill,
 *    straggler rescue, feeTypes hydrates only when non-empty.
 *  - Fee rules do not change — only the storage location moves
 *    (the approved 2 Nov fee chart stays exactly as it is).
 *  - No rules change, no main_store delete, no other field touched.
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

const writerBody = (fnName: string) => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf(`export async function ${fnName}`);
  assert.ok(start > -1, `${fnName} must exist`);
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert legs stopped ---');

check('writeFeeTypesFieldToCloud still writes the new collection', () => {
  const body = writerBody('writeFeeTypesFieldToCloud');
  assert.ok(body.includes("writeFeeRecordsToCollection('feeTypes'"), 'must still write the new feeTypes collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeFeeTypesFieldToCloud no longer writes main_store feeTypes', () => {
  const body = writerBody('writeFeeTypesFieldToCloud');
  assert.ok(!body.includes("writeFieldToCloud('feeTypes'"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the feeTypes writer');
});

check('no other main_store feeTypes upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("writeFieldToCloud('feeTypes'"), 'no writeFieldToCloud(feeTypes) call may remain anywhere');
});

check('writeFeeStructuresFieldToCloud still writes the new collection, doc id = classLevel', () => {
  const body = writerBody('writeFeeStructuresFieldToCloud');
  assert.ok(body.includes("writeFeeRecordsToCollection('feeStructures'"), 'must still write the new feeStructures collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes("'classLevel'"), 'must still assert by classLevel');
  assert.ok(body.includes('if (structures.length === 0) return;'), 'empty structure list must still short-circuit before any write');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeFeeStructuresFieldToCloud no longer writes main_store feeStructures', () => {
  const body = writerBody('writeFeeStructuresFieldToCloud');
  assert.ok(!body.includes('feeStructures: mergeRecordsByKey'), 'the inline main_store merge block must be gone');
  assert.ok(!body.includes("doc(db, 'institution', 'main_store')"), 'the inline main_store read must be gone');
  assert.ok(!body.includes('getDoc(ref)'), 'no main_store getDoc may remain in the feeStructures writer');
});

check('a structure without classLevel is still refused (assert kept)', () => {
  const body = writerBody('writeFeeStructuresFieldToCloud');
  assert.ok(body.includes("(r) => (r.classLevel ? String(r.classLevel) : '')"), 'classLevel key fn must still map a missing classLevel to empty');
  assert.ok(body.includes("assertUpsertRecords('feeStructures'"), 'the classLevel assert call must still be present');
});

console.log('--- Collection writes stay wired everywhere ---');

check('pushDiffToCloud still routes fees through the fee writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('feeStructures: writeFeeStructuresFieldToCloud'), 'auto-sync must still carry fee structures (now collection-only)');
  assert.ok(src.includes('feeTypes: writeFeeTypesFieldToCloud'), 'auto-sync must still carry fee types (now collection-only)');
});

check('queued-payload replay still routes fees through the fee writers', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('feeStructures: writeFeeStructuresFieldToCloud'), 'replay must still carry fee structures (now collection-only)');
  assert.ok(body.includes('feeTypes: writeFeeTypesFieldToCloud'), 'replay must still carry fee types (now collection-only)');
});

check('confirmFeeStructuresCloudSync / confirmFeeTypesCloudSync still use the fee writers', () => {
  const src = readSource('context/AppContext.tsx');
  const atS = src.indexOf('const confirmFeeStructuresCloudSync');
  assert.ok(atS > -1, 'confirmFeeStructuresCloudSync must exist');
  assert.ok(src.slice(atS, atS + 900).includes('writeFeeStructuresFieldToCloud(list, confirmActorName())'), 'structures save confirm must still call the feeStructures writer');
  const atT = src.indexOf('const confirmFeeTypesCloudSync');
  assert.ok(atT > -1, 'confirmFeeTypesCloudSync must exist');
  assert.ok(src.slice(atT, atT + 900).includes('writeFeeTypesFieldToCloud(list, confirmActorName())'), 'types save confirm must still call the feeTypes writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('fee deletes still delete the collection docs AND prune main_store fees', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'feeTypes'"), 'delete writer must still handle the feeTypes field');
  assert.ok(body.includes("removal.field === 'feeStructures'"), 'delete writer must still handle the feeStructures field');
  assert.ok(body.includes('deleteFeeRecordsFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted fee record)');
});

check('fee restores still write the collection AND union main_store fees', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'feeTypes'"), 'trash-op writer must still handle the feeTypes field');
  assert.ok(body.includes("field === 'feeStructures'"), 'trash-op writer must still handle the feeStructures field');
  assert.ok(body.includes('writeFeeRecordsToCollection'), 'restore must still write the fee record back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the fee record into main_store');
});

console.log('--- Read path untouched ---');

check('fees feeds, joint takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startFeesFeeds'), 'startFeesFeeds must exist');
  assert.ok(src.includes('feesFromCollectionRef'), 'joint collection-source flag must exist');
  assert.ok(src.includes('backfillFeesOnce'), 'backfill must still exist');
  assert.ok(src.includes('tryFeesTakeover'), 'joint takeover helper must exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen fees fields must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job5-step5-fees'], 'tsx scripts/verify-job5-step5-fees.ts', 'npm run test:job5-step5-fees must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 5 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
