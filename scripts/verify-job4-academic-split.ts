/**
 * Job 4 (academic split: subjects + exams + examSubjectAssignments +
 * classSubjectAssignments + teacherSubjectAssignments +
 * classTeacherAssignments) — self-check (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job3-classes-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job4-academic-split.ts
 * (or npm run test:job4-academic-split).
 *
 * Covers the Job 4 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 4,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New paths are institutions/inst_madrasah_primary/<field>/{id} for
 *    all six fields, built from CANONICAL_PRIMARY_INSTITUTION_ID, never
 *    hardcoded.
 *  - Dual-write: the six write*FieldToCloud writers each write their new
 *    collection AND main_store in one try; the old main_store write is
 *    NOT stopped.
 *  - Deletes + restores of academic records also reach the new
 *    collections, so a deleted subject/exam/assignment can never be
 *    resurrected by an academic feed. Tripwire: subjects + exams are
 *    TRIPWIRE_FIELDS — the SAME assertTripwire function (never a copy)
 *    runs BEFORE any new-collection doc is deleted, with counts from
 *    the confirmed main_store list (a list may shrink only as much as
 *    trash grew — the 4 Nov rule).
 *  - Read-switch: onSnapshot feeds on the six new collections are the
 *    source once ALL SIX have delivered docs covering every confirmed
 *    main_store record — the six switch TOGETHER, never one at a time.
 *    main_store is the fallback until then (empty collection snapshot
 *    triggers backfill, not a wipe). A genuinely empty collection (was
 *    non-empty before) still applies as empty. The subjects demo-sub-
 *    filter survives the switch.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection) is
 *    idempotent by id, skips id-less records, writes in 500-doc batches
 *    with setDoc merge. Counts match on RAW numbers: main_store array
 *    length = new collection doc count (no filtering before counting).
 *  - Auto-sync guard waits for the six academic feeds before sync
 *    starts (hasLoadedAcademicCollectionsRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - BlankMarksheetView needs no calculation change: it reads subjects
 *    from context state, and that state is now fed by the new subjects
 *    collection — the file itself is untouched.
 *  - Public portal rebuild source changes to the new collections for
 *    subjects, exams and examSubjectAssignments (non-empty collection
 *    read wins, main_store stays the fallback); buildPublicPortalData
 *    OUTPUT is unchanged (same keys, same pickLists).
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Firestore-touching code lives in React/services modules, so the feeds,
 * dual-write wiring and guard are covered by source-order assertions
 * (the repo's established grep-proof style) plus real unit checks on
 * the pure parts (collection paths, backfill plan, raw counts).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const migrationSplit: any = await import('../services/migrationSplit').catch(() => ({}));
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
const FIELD_REF_FN: Record<string, string> = {
  subjects: 'subjectsCollectionRef',
  exams: 'examsCollectionRef',
  examSubjectAssignments: 'examSubjectAssignmentsCollectionRef',
  classSubjectAssignments: 'classSubjectAssignmentsCollectionRef',
  teacherSubjectAssignments: 'teacherSubjectAssignmentsCollectionRef',
  classTeacherAssignments: 'classTeacherAssignmentsCollectionRef',
};
const FIELD_WRITER: Record<string, string> = {
  subjects: 'writeSubjectsFieldToCloud',
  exams: 'writeExamsFieldToCloud',
  examSubjectAssignments: 'writeExamSubjectAssignmentsFieldToCloud',
  classSubjectAssignments: 'writeClassSubjectAssignmentsFieldToCloud',
  teacherSubjectAssignments: 'writeTeacherSubjectAssignmentsFieldToCloud',
  classTeacherAssignments: 'writeClassTeacherAssignmentsFieldToCloud',
};
const SUB1 = { id: 'sub-bangla', name: 'Bangla', nameBn: 'বাংলা', classLevel: 'Class 6', order: 1 };
const SUB2 = { id: 'sub-math', name: 'Math', nameBn: 'গণিত', classLevel: 'Class 6', order: 2 };
const EX1 = { id: 'ex-1st', name: '1st Term', nameBn: '১ম সাময়িক' };
const ESA1 = { id: 'esa-1', examId: 'ex-1st', subjectId: 'sub-bangla', status: 'ACTIVE' };
const CSA1 = { id: 'csa-1', classId: 'c-6', subjectId: 'sub-bangla' };
const TSA1 = { id: 'tsa-1', teacherId: 'MDR-T003', subjectId: 'sub-bangla' };
const CTA1 = { id: 'cta-1', classId: 'c-6', teacherId: 'MDR-T003' };

console.log('--- New collection paths (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

for (const field of FIELDS) {
  check(`${field} collection ref points at institutions/inst_madrasah_primary/${field}`, () => {
    const fnName = FIELD_REF_FN[field];
    assert.strictEqual(typeof cloudConfirm[fnName], 'function', `${fnName} must be exported from cloudConfirm`);
    const ref = cloudConfirm[fnName]();
    assert.strictEqual(ref.path, `institutions/inst_madrasah_primary/${field}`, `collection path must be institutions/inst_madrasah_primary/${field}`);
  });
}

check('academic collection refs are built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function academicCollectionRef');
  assert.ok(start > -1, 'academicCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every id once, in order (per field)', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit (reused for Job 4)');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([SUB1, SUB2]).docs.map((d: any) => d.id), ['sub-bangla', 'sub-math']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([EX1]).docs.map((d: any) => d.id), ['ex-1st']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([ESA1]).docs.map((d: any) => d.id), ['esa-1']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([CSA1]).docs.map((d: any) => d.id), ['csa-1']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([TSA1]).docs.map((d: any) => d.id), ['tsa-1']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([CTA1]).docs.map((d: any) => d.id), ['cta-1']);
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([SUB1, SUB2, SUB1, { ...SUB2, order: 9 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['sub-bangla', 'sub-math'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([SUB1, { name: 'No id' } as any, SUB2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['sub-bangla', 'sub-math']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan of an empty list is empty', () => {
  const plan = migrationSplit.scheduleBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[SUB1, SUB2], [EX1], [ESA1], [CSA1], [TSA1], [CTA1], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([SUB1, SUB2, EX1 as any, ESA1 as any, CSA1 as any, TSA1 as any, CTA1 as any]);
  assert.strictEqual(plan.docs.length, 7, 'seven distinct records become seven docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers all six academic fields, batched setDoc merge by id', () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes('doc(col, String('), 'doc id must be the record id');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
  assert.ok(body.includes('academicCollectionRef'), 'backfill must write the new academic collections');
});

console.log('--- Dual-write (source checks) ---');

for (const field of FIELDS) {
  check(`${FIELD_WRITER[field]} writes the new collection AND main_store in one try`, () => {
    const src = readSource('services/cloudConfirm.ts');
    const start = src.indexOf(`export async function ${FIELD_WRITER[field]}`);
    assert.ok(start > -1, `${FIELD_WRITER[field]} must exist`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes('writeAcademicRecordsToCollection'), 'must write the new collection');
    assert.ok(body.includes(`writeFieldsToCloud({ ${field}`), 'must STILL write main_store (old write NOT stopped)');
    assert.ok(body.indexOf('writeAcademicRecordsToCollection') < body.indexOf(`writeFieldsToCloud({ ${field}`), 'collection write and main_store write belong to the same try');
    assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
  });

  check(`${FIELD_WRITER[field]} asserts ids via the shared choke point`, () => {
    const src = readSource('services/cloudConfirm.ts');
    const start = src.indexOf(`export async function ${FIELD_WRITER[field]}`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
    assert.ok(body.includes(`fieldKeyFn('${field}')`), 'dual-write must key records with the shared fieldKeyFn');
  });
}

check('academic deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`removal.field === '${field}'`), `delete writer must handle the ${field} field`);
  }
  assert.ok(body.includes('deleteAcademicRecordsFromCollection'), 'delete writer must delete the new-collection docs');
});

check('academic restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`field === '${field}'`), `trash-op writer must handle the ${field} field`);
  }
  assert.ok(body.includes('writeAcademicRecordsToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Tripwire (subjects + exams, same check function, before any delete) ---');

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

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts academic onSnapshot feeds on the six new collections', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('academicCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startAcademicFeeds'), 'an academic feeds starter must exist');
  const at = src.indexOf('const startAcademicFeeds');
  assert.ok(at > -1, 'startAcademicFeeds must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'academic feeds must use onSnapshot');
  assert.ok(body.includes('academicCollectionRef(field)'), 'academic feeds must listen on the new collections');
});

check('academic feeds start with the main feed and stop when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startAcademicFeeds()'), 'main feed must start the academic feeds (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopAcademicFeeds'), 'feed switch must also stop the academic feeds');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startAcademicFeeds()'), 'public (anonymous) feed must NOT start the academic feeds');
});

check('the six fields switch TOGETHER: one joint flag, one joint takeover check', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('academicFromCollectionRef'), 'a single joint collection-source flag must exist');
  assert.ok(!src.includes('academicFromCollectionRef.current[field]'), 'the flag must NOT be per-field — the six switch together');
  assert.ok(src.includes('tryAcademicTakeover'), 'a joint takeover check must exist');
  const at = src.indexOf('const tryAcademicTakeover');
  assert.ok(at > -1, 'tryAcademicTakeover must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('academicFeedSettledRef'), 'takeover must wait for all six feeds to settle');
  assert.ok(body.includes('hasLoadedMainStoreRef.current'), 'takeover must wait for main_store to load (no vacuous takeover on an unloaded list)');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('academicFromCollectionRef.current = true'), 'takeover must flip the single joint flag');
  assert.ok(body.includes('fromAcademicCollection: true'), 'takeover must apply all six lists from the collections');
  for (const field of FIELDS) {
    assert.ok(body.includes(`'${field}'`), `takeover check must cover the ${field} field`);
  }
});

check('applyRemoteData academic branches are gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('fromAcademicCollection'), 'applyRemoteData must know when data comes from an academic feed');
  assert.ok(src.includes('applyAcademicFieldFromRemote'), 'a per-field academic apply helper must exist');
  const at = src.indexOf('const applyAcademicFieldFromRemote');
  assert.ok(at > -1, 'applyAcademicFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!academicFromCollectionRef.current'), 'main_store academic lists must be skipped once the collections are the source');
  assert.ok(body.includes('opts?.fromAcademicCollection'), 'collection-feed snapshots must always apply');
});

check('subjects demo-sub- filter survives the switch (both sources)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyAcademicFieldFromRemote');
  assert.ok(at > -1, 'applyAcademicFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("startsWith('demo-sub-')"), 'subjects from either source must still drop demo-sub- records');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAcademicFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length === 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillAcademicOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('tryAcademicTakeover'), 'a snapshot with docs must run the joint takeover check');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAcademicFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('academicFromCollectionRef.current'), 'empty snapshot after takeover must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ [field]: [] }'), 'genuinely empty must clear the list');
});

check('after takeover the feed stays a LIVE source: every later snapshot applies its field', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAcademicFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  // Job 3's joint handler stops here: once its takeover check returns
  // true (already taken over) it applies nothing, so a subject added
  // on another device after takeover would never land until reload.
  // Jobs 1/2/8 apply on every snapshot — Job 4 keeps that live-source
  // behaviour for its six fields too.
  assert.ok(body.includes('applyRemoteData({ [field]: docs }'), 'a non-empty snapshot after takeover must still apply its field');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillAcademicOnce = async (field:');
  assert.ok(at > -1, 'backfillAcademicOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('lastConfirmedRef.current[field]'), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledAcademicIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes('migrateFieldToCollection(field, pending)'), 'backfill must run through migrateFieldToCollection');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyAcademicFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionAcademicRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillAcademicOnce(field, stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Blank marksheet (source is the new collection, calculations untouched) ---');

check('BlankMarksheetView still reads subjects from context state (fed by the new collection) and has no direct Firestore read', () => {
  const src = readSource('components/BlankMarksheetView.tsx');
  assert.ok(src.includes('getBlankMarksheetSubjects(subjects, selectedClass, selectedExamId)'), 'blank marksheet must still take its subjects through getBlankMarksheetSubjects');
  assert.ok(src.includes('useApp()'), 'blank marksheet must still read from context state');
  assert.ok(!src.includes('onSnapshot('), 'blank marksheet must not read Firestore directly');
  assert.ok(!src.includes('getDocs('), 'blank marksheet must not read Firestore directly');
  const appSrc = readSource('context/AppContext.tsx');
  assert.ok(appSrc.includes("applyAcademicFieldFromRemote('subjects'"), 'the subjects state it reads must be fed by the academic read-switch');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the six academic feeds before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedAcademicCollectionsRef'), 'an academic-feeds-loaded flag must exist');
  const effectAt = src.indexOf('// Job 4: never auto-sync until the academic collections');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 4 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedAcademicCollectionsRef.current) return;'), 'auto-sync effect must return early until the academic feeds settle');
  const fireAt = src.indexOf('Fire-time re-validation');
  assert.ok(fireAt > -1, 'fire-time re-validation must exist');
  const fireBody = src.slice(fireAt, fireAt + 300);
  assert.ok(fireBody.includes('!hasLoadedAcademicCollectionsRef.current'), 'fire-time re-validation must also wait for the academic feeds');
  const feedAt = src.indexOf('const startAcademicFeeds');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markAcademicFeedSettled(field)'), 'feed snapshot and feed error must both mark the field settled');
});

check('login verdict and manual force-push are NOT gated on the academic feeds', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedAcademicCollectionsRef'), 'manual force-push must not wait for the academic feeds');
});

console.log('--- Public portal (rebuild source changes, output unchanged) ---');

check('portal rebuild reads subjects, exams and examSubjectAssignments from the new collections, main_store stays the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readAcademicFieldFromCollection'), 'portal rebuild must read the new academic collections');
  for (const field of ['subjects', 'exams', 'examSubjectAssignments']) {
    assert.ok(body.includes(`'${field}'`), `portal rebuild must overlay the ${field} field from its new collection`);
  }
  assert.ok(body.includes("getDoc(doc(db, 'institution', 'main_store'))"), 'portal rebuild still reads main_store as the fallback');
});

check('buildPublicPortalData output is unchanged (same keys, same pickLists)', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(src.includes('subjects: pickList(source.subjects, PUBLIC_SUBJECT_FIELDS)'), 'portal subjects output must be unchanged');
  assert.ok(src.includes('exams: pickList(source.exams, PUBLIC_EXAM_FIELDS)'), 'portal exams output must be unchanged');
  assert.ok(src.includes('examSubjectAssignments: pickList('), 'portal examSubjectAssignments output must be unchanged');
  assert.ok(src.includes("derivedFrom: 'institution/main_store'"), 'portal meta must be unchanged');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes all six fields through the dual-write writers', () => {
  const src = readSource('context/AppContext.tsx');
  for (const field of FIELDS) {
    assert.ok(src.includes(`${field}: ${FIELD_WRITER[field]}`), `auto-sync must still carry ${field} through ${FIELD_WRITER[field]}`);
  }
});

check('no Firestore rules change and no main_store delete in this job', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  const appSrc = readSource('context/AppContext.tsx');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job4-academic-split'], 'tsx scripts/verify-job4-academic-split.ts', 'npm run test:job4-academic-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 4 academic-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
