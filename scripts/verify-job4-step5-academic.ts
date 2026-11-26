/**
 * Job 4 step 5 (academic split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job4-step5-academic.ts
 * (or npm run test:job4-step5-academic).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store academic write after the dual-write soak:
 *  - The six write*FieldToCloud writers (subjects, exams,
 *    examSubjectAssignments, classSubjectAssignments,
 *    teacherSubjectAssignments, classTeacherAssignments) write their
 *    new collections ONLY — the writeFieldsToCloud({ <field> }, ...)
 *    main_store leg is gone from each.
 *  - main_store.subjects / .exams / the four assignment fields are NOT
 *    deleted — they stay as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and the six
 *    confirm*CloudSync functions. (The plan's "pushDiffToCloud থেকে
 *    field বাদ" means the old main_store leg, NOT the field entry —
 *    removing the entry would stop academic syncing entirely.)
 *  - Delete + restore still touch main_store (prune on delete, union
 *    on restore), so the frozen copy can never resurrect a deleted
 *    subject/exam/assignment via the backfill or the portal fallback:
 *    main_store stays a subset of the collections.
 *  - Tripwire untouched: subjects + exams stay TRIPWIRE_FIELDS and the
 *    delete writer still runs the SAME assertTripwire BEFORE deleting
 *    any new-collection doc; the tripwire counts still come from the
 *    confirmed main_store list (lastConfirmedRef).
 *  - Read path untouched: academic feeds + joint takeover gate,
 *    backfill, straggler rescue, portal rebuild preferring the
 *    collections. BlankMarksheetView untouched (it already reads
 *    examSubjectAssignments from the new collection via context).
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: Job 4 steps 1–3 went live 21 Nov 2026 (PRs #42–#48 era,
 * main 105f70c) and the academic feeds have been the live read source
 * since; dual-write has run ~5 days in the new project ldsdmms
 * (21–26 Nov) on top of the old-project soak. The soak shortfall
 * against the plan's one week is recorded, not hidden — same
 * disclosure as Job 1 step 5.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mainStoreWrite: any = await import('../services/mainStoreWrite').catch(() => ({}));

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

const FIELDS = ['subjects', 'exams', 'examSubjectAssignments', 'classSubjectAssignments', 'teacherSubjectAssignments', 'classTeacherAssignments'] as const;
const FIELD_WRITER: Record<string, string> = {
  subjects: 'writeSubjectsFieldToCloud',
  exams: 'writeExamsFieldToCloud',
  examSubjectAssignments: 'writeExamSubjectAssignmentsFieldToCloud',
  classSubjectAssignments: 'writeClassSubjectAssignmentsFieldToCloud',
  teacherSubjectAssignments: 'writeTeacherSubjectAssignmentsFieldToCloud',
  classTeacherAssignments: 'writeClassTeacherAssignmentsFieldToCloud',
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
    assert.ok(body.includes('writeAcademicRecordsToCollection'), 'must still write the new collection');
    assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
    assert.ok(body.includes(`fieldKeyFn('${field}')`), 'must still key records with the shared fieldKeyFn');
    assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
  });

  check(`${FIELD_WRITER[field]} no longer writes main_store ${field}`, () => {
    const body = writerBody(FIELD_WRITER[field]);
    assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the writer');
    assert.ok(!body.includes(`writeFieldsToCloud({ ${field}`), 'the old main_store leg must be gone');
  });
}

check('no old main_store academic upsert remains anywhere in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  for (const field of FIELDS) {
    assert.ok(!src.includes(`writeFieldsToCloud({ ${field}`), `no writeFieldsToCloud({ ${field}...) call may remain anywhere`);
  }
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes all six fields through the writers', () => {
  const src = readSource('context/AppContext.tsx');
  for (const field of FIELDS) {
    assert.ok(src.includes(`${field}: ${FIELD_WRITER[field]}`), `auto-sync must still carry ${field} (now collection-only)`);
  }
});

check('queued-payload replay still routes all six fields through the writers', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  for (const field of FIELDS) {
    assert.ok(body.includes(`${field}: ${FIELD_WRITER[field]}`), `replay must still carry ${field} (now collection-only)`);
  }
});

check('the six confirm*CloudSync functions still use the writers', () => {
  const src = readSource('context/AppContext.tsx');
  const CONFIRM_FN: Record<string, string> = {
    subjects: 'confirmSubjectsCloudSync',
    exams: 'confirmExamsCloudSync',
    examSubjectAssignments: 'confirmExamSubjectAssignmentsCloudSync',
    classSubjectAssignments: 'confirmClassSubjectAssignmentsCloudSync',
    teacherSubjectAssignments: 'confirmTeacherSubjectAssignmentsCloudSync',
    classTeacherAssignments: 'confirmClassTeacherAssignmentsCloudSync',
  };
  for (const field of FIELDS) {
    const at = src.indexOf(`const ${CONFIRM_FN[field]}`);
    assert.ok(at > -1, `${CONFIRM_FN[field]} must exist`);
    const body = src.slice(at, at + 900);
    assert.ok(body.includes(`${FIELD_WRITER[field]}(list, confirmActorName())`), `${CONFIRM_FN[field]} must still call ${FIELD_WRITER[field]}`);
  }
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('academic deletes still delete the collection docs AND prune main_store', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`removal.field === '${field}'`), `delete writer must still handle the ${field} field`);
  }
  assert.ok(body.includes('deleteAcademicRecordsFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted record)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('academic restores still write the collection AND union main_store', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`field === '${field}'`), `trash-op writer must still handle the ${field} field`);
  }
  assert.ok(body.includes('writeAcademicRecordsToCollection'), 'restore must still write the record back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the record into main_store');
});

console.log('--- Tripwire untouched (subjects + exams) ---');

check('subjects and exams are still TRIPWIRE_FIELDS', () => {
  assert.ok(Array.isArray(mainStoreWrite.TRIPWIRE_FIELDS), 'TRIPWIRE_FIELDS must be exported from mainStoreWrite');
  assert.ok(mainStoreWrite.TRIPWIRE_FIELDS.includes('subjects'), 'subjects must stay tripwire-protected');
  assert.ok(mainStoreWrite.TRIPWIRE_FIELDS.includes('exams'), 'exams must stay tripwire-protected');
  assert.strictEqual(typeof mainStoreWrite.assertTripwire, 'function', 'assertTripwire must be exported from mainStoreWrite');
});

check('delete writer runs the SAME assertTripwire BEFORE deleting any new-collection doc', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertTripwire('), 'delete writer must call assertTripwire');
  assert.ok(!body.includes('function assertTripwire'), 'tripwire must be reused, not copied into cloudConfirm');
  const tripwireAt = body.indexOf('assertTripwire(');
  const firstCollectionDeleteAt = Math.min(
    ...['deleteAcademicRecordsFromCollection', 'deleteNoticesFromCollection', 'deleteScheduleRecordsFromCollection']
      .map((fn) => body.indexOf(fn)).filter((i) => i > -1)
  );
  assert.ok(firstCollectionDeleteAt > -1, 'delete writer must still delete new-collection docs');
  assert.ok(tripwireAt < firstCollectionDeleteAt, 'tripwire must run BEFORE any new-collection doc is deleted — a refused shrink must delete nothing anywhere');
});

check('tripwire counts still come from the confirmed main_store list (lastConfirmedRef)', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('lastConfirmedRef.current[field]'), 'backfill/takeover must still compare against the confirmed main_store list');
  assert.ok(src.includes('lastConfirmedRef.current'), 'lastConfirmedRef must still be the confirmed-list source');
});

console.log('--- Read path untouched ---');

check('academic feeds, joint takeover gate, backfill and straggler rescue are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startAcademicFeeds'), 'startAcademicFeeds must exist');
  assert.ok(src.includes('academicFromCollectionRef'), 'joint collection-source flag must exist');
  assert.ok(src.includes('tryAcademicTakeover'), 'joint takeover check must exist');
  assert.ok(src.includes('backfillAcademicOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes('applyRemoteData({ [field]: docs }'), 'feed snapshots must still apply their field');
});

check('portal rebuild still prefers the collections, main_store as fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readAcademicFieldFromCollection'), 'portal rebuild must read the new academic collections');
  for (const field of ['subjects', 'exams', 'examSubjectAssignments']) {
    assert.ok(body.includes(`'${field}'`), `portal rebuild must overlay the ${field} field from its new collection`);
  }
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen academic fields must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job4-step5-academic'], 'tsx scripts/verify-job4-step5-academic.ts', 'npm run test:job4-step5-academic must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 4 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
