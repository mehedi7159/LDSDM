/**
 * Job 3 step 5 (classes split: classes + sections + academicYears)
 * — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job3-step5-classes.ts
 * (or npm run test:job3-step5-classes).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store classes/sections/academicYears writes after the
 * dual-write soak:
 *  - writeClassesFieldToCloud, writeSectionsFieldToCloud and
 *    writeAcademicYearsFieldToCloud each write their new collection
 *    ONLY — the writeFieldsToCloud({ ... }) main_store leg is gone.
 *  - main_store.classes / .sections / .academicYears are NOT deleted
 *    — they stay as a frozen copy.
 *  - The collection writes stay wired everywhere they were:
 *    pushDiffToCloud auto-sync, the queued-payload replay, and
 *    confirmClassesCloudSync / confirmSectionsCloudSync /
 *    confirmAcademicYearsCloudSync. (The plan's "pushDiffToCloud
 *    থেকে field বাদ" means the old main_store leg, NOT the field
 *    entry — removing the entry would stop classes syncing entirely.)
 *  - Delete + restore still touch main_store (prune on delete, union
 *    on restore), so the frozen copy can never resurrect a deleted
 *    class/section/year via the backfill or the portal fallback:
 *    main_store stays a subset of the collections.
 *  - Read path untouched: joint classes feeds + takeover gate,
 *    backfill, straggler rescue, portal rebuild still reading
 *    main_store.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: classes/sections/academicYears are small reference lists
 * (read from many places, written rarely — only when a class, section
 * or academic year is added/renamed). Dual-write ran from the Job 3
 * push (21 Nov) to this step-5 push (26 Nov), meeting the plan's one
 * week. The read side already comes from the new collections, so
 * only the write legs change.
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

const FIELDS = ['classes', 'sections', 'academicYears'] as const;
const FIELD_WRITER: Record<string, string> = {
  classes: 'writeClassesFieldToCloud',
  sections: 'writeSectionsFieldToCloud',
  academicYears: 'writeAcademicYearsFieldToCloud',
};
// Exact old main_store leg text in each writer (before step 5).
const FIELD_LEG: Record<string, string> = {
  classes: 'writeFieldsToCloud({ classes }, updatedBy)',
  sections: 'writeFieldsToCloud({ sections }, updatedBy)',
  academicYears: 'writeFieldsToCloud({ academicYears: years }, updatedBy)',
};

const writerBody = (writer: string) => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf(`export async function ${writer}`);
  assert.ok(start > -1, `${writer} must exist`);
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert legs stopped ---');

for (const field of FIELDS) {
  check(`${FIELD_WRITER[field]} still writes the new collection`, () => {
    const body = writerBody(FIELD_WRITER[field]);
    assert.ok(body.includes('writeClassesRecordsToCollection'), 'must still write the new collection');
    assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
    assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
  });

  check(`${FIELD_WRITER[field]} no longer writes main_store ${field}`, () => {
    const body = writerBody(FIELD_WRITER[field]);
    assert.ok(!body.includes(FIELD_LEG[field]), 'the old main_store leg must be gone');
    assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the writer');
  });
}

check('no other main_store classes/sections/academicYears upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  for (const field of FIELDS) {
    assert.ok(!src.includes(FIELD_LEG[field]), `no ${FIELD_LEG[field]} call may remain anywhere`);
  }
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes classes/sections/academicYears through the writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('classes: writeClassesFieldToCloud'), 'auto-sync must still carry classes (now collection-only)');
  assert.ok(src.includes('sections: writeSectionsFieldToCloud'), 'auto-sync must still carry sections (now collection-only)');
  assert.ok(src.includes('academicYears: writeAcademicYearsFieldToCloud'), 'auto-sync must still carry academicYears (now collection-only)');
});

check('queued-payload replay still routes classes/sections/academicYears through the writers', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('classes: writeClassesFieldToCloud'), 'replay must still carry classes (now collection-only)');
  assert.ok(body.includes('sections: writeSectionsFieldToCloud'), 'replay must still carry sections (now collection-only)');
  assert.ok(body.includes('academicYears: writeAcademicYearsFieldToCloud'), 'replay must still carry academicYears (now collection-only)');
});

check('confirmClassesCloudSync still uses writeClassesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmClassesCloudSync');
  assert.ok(at > -1, 'confirmClassesCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeClassesFieldToCloud(list, confirmActorName())'), 'class save confirm must still call the classes writer');
});

check('confirmAcademicYearsCloudSync still uses writeAcademicYearsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmAcademicYearsCloudSync');
  assert.ok(at > -1, 'confirmAcademicYearsCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeAcademicYearsFieldToCloud(list, confirmActorName())'), 'academic-year save confirm must still call the academicYears writer');
});

check('confirmSectionsCloudSync still uses writeSectionsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmSectionsCloudSync');
  assert.ok(at > -1, 'confirmSectionsCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeSectionsFieldToCloud(list, confirmActorName())'), 'section save confirm must still call the sections writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('class/section/year deletes still delete the collection docs AND prune main_store', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`removal.field === '${field}'`), `delete writer must still handle the ${field} field`);
  }
  assert.ok(body.includes('deleteClassesRecordsFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted record)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('class/section/year restores still write the collection AND union main_store', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`field === '${field}'`), `trash-op writer must still handle the ${field} field`);
  }
  assert.ok(body.includes('writeClassesRecordsToCollection'), 'restore must still write the record back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the record into main_store');
});

console.log('--- Read path untouched ---');

check('classes feeds, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startClassesFeeds'), 'startClassesFeeds must exist');
  assert.ok(src.includes('classesFromCollectionRef'), 'joint collection-source flag must exist');
  assert.ok(src.includes('tryClassesTakeover'), 'joint takeover check must exist');
  assert.ok(src.includes('backfillClassesOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
});

check('portal rebuild still reads main_store (no new-collection read)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(!body.includes('readClassesFieldFromCollection'), 'portal rebuild must NOT read the new collections (main_store stays the portal source)');
  assert.ok(body.includes("getDoc(doc(db, 'institution', 'main_store'))"), 'portal rebuild still reads main_store');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen classes/sections/academicYears fields must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job3-step5-classes'], 'tsx scripts/verify-job3-step5-classes.ts', 'npm run test:job3-step5-classes must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 3 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
