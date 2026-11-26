/**
 * Job 12 (students split) — self-check (21 Nov 2026, base 411f914).
 *
 * Follows the scripts/verify-job7-promotion-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job12-students-split.ts
 * (or npm run test:job12-students-split).
 *
 * Covers the Job 12 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 12,
 * §5 steps 1–3, plus step 5 done 26 Nov 2026 — stopping the old
 * main_store write; see scripts/verify-job12-step5-students.ts):
 *  - New path is institutions/inst_madrasah_primary/students/{id},
 *    built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Collection-only write (step 5, 26 Nov 2026, supersedes the
 *    dual-write below): writeStudentsFieldToCloud writes the new
 *    collection ONLY; the old main_store write is stopped, the
 *    frozen copy stays. The degradation guard (findDegradingStudentIds)
 *    is kept in the writer, now checked against the collection.
 *  - Deletes (trash) + restores also reach the new collection, so a
 *    trashed student can never be resurrected by the students feed
 *    and a restored student stays visible.
 *  - Read-switch: an onSnapshot feed on the new collection is the
 *    source once it has delivered docs covering every confirmed
 *    main_store record; main_store is the fallback until then (empty
 *    collection snapshot triggers backfill, not a wipe). A genuinely
 *    empty collection (was non-empty before) still applies as empty.
 *    AFTER takeover, EVERY non-empty snapshot applies (a record added
 *    on another device appears without a reload, a record deleted
 *    there disappears too) — Job 3/5 only applied at takeover.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection
 *    with 'students') is idempotent by id, skips id-less records,
 *    writes in 500-doc batches with setDoc merge, copies records
 *    as-is (demo records included — applyRemoteData filters them on
 *    read). Counts match on RAW numbers: main_store array length =
 *    new collection doc count (no filtering before counting).
 *  - applyRemoteData's students cleanup (trash-filter, demo-record
 *    filter, hydrateStudentLifecycle) is unchanged on both sources.
 *  - Auto-sync guard waits for the students feed before sync starts
 *    (hasLoadedStudentsCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Public portal: rebuildPublicPortalFromCloud reads students from
 *    the new collection when non-empty, main_store stays the fallback;
 *    buildPublicPortalData OUTPUT is unchanged (same pickList).
 *  - Student-ID generation still counts TRASH ids when suggesting the
 *    next ID (a trashed student's ID is never reused) — the addStudent
 *    call site still passes the trash studentIds.
 *  - No rules change, no main_store delete, no other field touched.
 *  - No student DATA cleanup (roll, duplicates) — that is priority
 *    #12, a separate job; this job moves records as-is.
 *
 * Firestore-touching code lives in React/services modules, so the feed,
 * dual-write wiring and guard are covered by source-order assertions
 * (the repo's established grep-proof style) plus real unit checks on
 * the pure parts (collection path, backfill plan, raw counts).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const migrationSplit: any = await import('../services/migrationSplit').catch(() => ({}));

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

// Minimal student fixtures (only the fields the checks need).
const S1: any = { id: 'std-1', studentId: '2026001', nameBn: 'আবদুল্লাহ', nameEn: 'Abdullah', classLevel: 'Class 3', roll: 1 };
const S2: any = { id: 'std-2', studentId: '2026002', nameBn: 'ফাতিমা', nameEn: 'Fatima', classLevel: 'Class 4', roll: 2 };
const S3: any = { id: 'std-3', studentId: '2026003', nameBn: 'মিম', nameEn: 'Mim', classLevel: 'Class 10', roll: 0 };
const DEMO: any = { id: 'demo-std-9', studentId: '2026999', nameBn: 'ডেমো', classLevel: 'Play' };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('students collection ref points at institutions/inst_madrasah_primary/students', () => {
  assert.strictEqual(typeof cloudConfirm.studentsCollectionRef, 'function', 'studentsCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.studentsCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/students', 'collection path must be institutions/inst_madrasah_primary/students');
});

check('students collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function studentsCollectionRef');
  assert.ok(start > -1, 'studentsCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

check('readStudentsFromCollection + writeStudentsToCollection + deleteStudentsFromCollection exist', () => {
  assert.strictEqual(typeof cloudConfirm.readStudentsFromCollection, 'function', 'readStudentsFromCollection must be exported');
  assert.strictEqual(typeof cloudConfirm.writeStudentsToCollection, 'function', 'writeStudentsToCollection must be exported');
  assert.strictEqual(typeof cloudConfirm.deleteStudentsFromCollection, 'function', 'deleteStudentsFromCollection must be exported');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every id once, in order', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([S1, S2, S3]).docs.map((d: any) => d.id), ['std-1', 'std-2', 'std-3']);
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([S1, S2, S1, { ...S2, roll: 5 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['std-1', 'std-2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([S1, { studentId: '2026999' } as any, S2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['std-1', 'std-2']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan copies demo records as-is (they are filtered on read, not before counting)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([S1, DEMO, S2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['std-1', 'demo-std-9', 'std-2']);
  assert.strictEqual(plan.skipped, 0, 'demo records are real docs in the raw count');
});

check('backfill plan of an empty list is empty', () => {
  const plan = migrationSplit.scheduleBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[S1, S2, S3], [S1, DEMO], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([S1, S2, S3]);
  assert.strictEqual(plan.docs.length, 3, 'three distinct records become three docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check("migrateFieldToCollection covers 'students', batched setDoc merge by id", () => {
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
  assert.ok(body.includes('studentsCollectionRef'), 'backfill must write the students collection for this field');
  assert.ok(body.includes("'students'"), "backfill must handle the 'students' field");
});

console.log('--- Collection-only write, step 5 (source checks) ---');

check('writeStudentsFieldToCloud writes the new collection ONLY (step 5 stopped the main_store leg)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStudentsFieldToCloud');
  assert.ok(start > -1, 'writeStudentsFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeStudentsToCollection'), 'must write the new collection');
  assert.ok(!body.includes('writeFieldsToCloud({ students }, updatedBy)'), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
  assert.ok(body.includes('withTimeout'), 'collection-only write must stay inside the confirm timeout');
  assert.ok(body.includes('STUDENTS_CONFIRM_TIMEOUT_MS'), 'students timeout stays 90 seconds');
});

check('degradation check runs BEFORE the collection write, against the collection', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStudentsFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('findDegradingStudentIds'), 'writer must still run the degradation check');
  assert.ok(body.includes('readStudentsFromCollection'), 'check must compare against the current collection list');
  assert.ok(body.indexOf('findDegradingStudentIds') < body.indexOf('writeStudentsToCollection'), 'a degrading record must throw before any collection write');
});

check('collection-only write asserts ids via the shared choke point', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStudentsFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'collection-only write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn('students')"), 'collection-only write must key records with the shared fieldKeyFn');
});

console.log('--- Tripwire + degradation checks kept (same functions, not copies) ---');

check('degradation check is the SAME findDegradingStudentIds from mainStoreWrite, run by the students writer against the collection', () => {
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(cc.includes('findDegradingStudentIds,'), 'cloudConfirm must import findDegradingStudentIds from mainStoreWrite');
  assert.ok(!cc.includes('function findDegradingStudentIds'), 'cloudConfirm must NOT define its own copy of findDegradingStudentIds');
  const start = cc.indexOf('export async function writeStudentsFieldToCloud');
  assert.ok(start > -1, 'writeStudentsFieldToCloud must exist');
  const body = cc.slice(start, cc.indexOf('\n}', start) + 2);
  assert.ok(body.includes('readStudentsFromCollection'), 'the writer must read the current collection list for the check');
  assert.ok(body.includes('findDegradingStudentIds(existing'), 'the check must compare incoming records against the current collection list');
});

check('students stays a TRIPWIRE_FIELD (same list, same function)', () => {
  const ms = readSource('services/mainStoreWrite.ts');
  assert.ok(ms.includes("'students'"), 'TRIPWIRE_FIELDS must still list students');
  assert.ok(ms.includes('export function assertTripwire'), 'assertTripwire must still exist in mainStoreWrite');
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(cc.includes('assertTripwire,'), 'cloudConfirm must import assertTripwire from mainStoreWrite');
  assert.ok(!cc.includes('function assertTripwire'), 'cloudConfirm must NOT define its own copy of assertTripwire');
});

check('student deletes run the SAME assertTripwire BEFORE any students collection doc is deleted', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'students'"), 'delete writer must handle the students field');
  assert.ok(body.includes('deleteStudentsFromCollection'), 'delete writer must delete the new-collection docs');
  assert.ok(body.indexOf('assertTripwire(') < body.indexOf('deleteStudentsFromCollection'), 'a refused shrink must delete nothing anywhere — tripwire first, collection delete after');
});

check('student deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('deleteStudentsFromCollection(removal.ids)'), 'delete writer must delete the students collection docs by id');
});

check('student restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'students'"), 'trash-op writer must handle the students field');
  assert.ok(body.includes('writeStudentsToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a students onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('studentsCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startStudentsFeed'), 'a students feed starter must exist');
  const at = src.indexOf('const startStudentsFeed');
  assert.ok(at > -1, 'startStudentsFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'students feed must use onSnapshot');
  assert.ok(body.includes('studentsCollectionRef()'), 'students feed must listen on the new collection');
});

check('students feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startStudentsFeed()'), 'main feed must start the students feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopStudentsFeed'), 'feed switch must also stop the students feed');
  const pubAt = src.indexOf('const startPublicFeed = () => {');
  assert.ok(pubAt > -1, 'startPublicFeed must exist');
  const pubBody = src.slice(pubAt, src.indexOf('const hasLocalAppSession', pubAt));
  assert.ok(!pubBody.includes('startStudentsFeed()'), 'public (anonymous) feed must NOT start the students feed');
});

check('applyRemoteData students branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('studentsFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromStudentsCollection'), 'applyRemoteData must know when data comes from a students feed');
  assert.ok(src.includes('backfillStudentsOnce'), 'a students backfill helper must exist');
  const at = src.indexOf('if (data.students && Array.isArray(data.students))');
  assert.ok(at > -1, 'students branch must exist in applyRemoteData');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('!studentsFromCollectionRef.current'), 'main_store students must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromStudentsCollection'), 'collection-feed snapshots must always apply');
});

check('students cleanup is unchanged on both sources (trash filter, demo filter, hydrateStudentLifecycle)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.students && Array.isArray(data.students))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('!trashedIds.has(String(s.id))'), 'trash filter must stay');
  assert.ok(body.includes("!s.id?.startsWith('demo-std-') && s.id !== 'st-1' && s.id !== 'st-2'"), 'demo-record filter must stay');
  assert.ok(body.includes('.map(hydrateStudentLifecycle)'), 'hydrateStudentLifecycle must stay');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startStudentsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillStudentsOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('studentsFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startStudentsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (studentsFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ students: [] }'), 'genuinely empty must clear the list');
});

check('post-takeover snapshots keep applying: every non-empty snapshot applies once the collection is the source', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startStudentsFeed');
  assert.ok(at > -1, 'startStudentsFeed must exist');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  // After takeover the handler applies the snapshot directly, without
  // re-gating on completeness — a record added later on another device
  // appears without a reload, and a record deleted there disappears.
  assert.ok(body.includes('if (studentsFromCollectionRef.current)'), 'feed must have a post-takeover branch');
  const takeAt = body.indexOf('if (studentsFromCollectionRef.current)');
  const takeBody = body.slice(takeAt, takeAt + 1200);
  assert.ok(takeBody.includes('applyRemoteData({ students: docs }, { fromStudentsCollection: true })'), 'post-takeover non-empty snapshots must apply');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillStudentsOnce = async (source?:');
  assert.ok(at > -1, 'backfillStudentsOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['students']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledStudentsIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes("migrateFieldToCollection('students', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('first takeover needs the collection to cover every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startStudentsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'first takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'first takeover must be gated on completeness');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.students && Array.isArray(data.students))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionStudentsRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillStudentsOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the students feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedStudentsCollectionRef'), 'a students-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 12: never auto-sync until the students collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 12 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 700);
  assert.ok(effectBody.includes('if (!hasLoadedStudentsCollectionRef.current) return;'), 'auto-sync effect must return early until the students feed settles');
  // A feed error also settles, so a dead listener can never block sync forever.
  const feedAt = src.indexOf('const startStudentsFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markStudentsFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('fire-time re-validation also waits for the students feed', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('Fire-time re-validation (belt & braces)');
  assert.ok(at > -1, 'fire-time re-validation must exist');
  const body = src.slice(at, at + 400);
  assert.ok(body.includes('!hasLoadedStudentsCollectionRef.current'), 'fire-time check must include the students feed');
});

check('login verdict and manual force-push are NOT gated on the students feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedStudentsCollectionRef'), 'manual force-push must not wait for the students feed');
});

console.log('--- Public portal (rebuild source changes, output unchanged) ---');

check('portal rebuild reads students from the new collection when non-empty, main_store stays the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readStudentsFromCollection'), 'portal rebuild must read the new students collection');
  assert.ok(body.includes("getDoc(doc(db, 'institution', 'main_store'))"), 'portal rebuild still reads main_store as the fallback');
  // Merged state: the portal setDoc combines EVERY split collection's
  // override in one call (Job 6 pattern — two setDocs would let the
  // second overwrite the first), so the students overlay is checked
  // inside the buildPublicPortalData argument, not as a standalone
  // '{ ...data, notices, students }' call.
  const portalCall = body.slice(body.indexOf('buildPublicPortalData('));
  assert.ok(portalCall.includes('students'), 'portal rebuild must overlay the collection students');
});

check('buildPublicPortalData output is unchanged (same keys, same pickList)', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(src.includes('students: pickList(source.students, PUBLIC_STUDENT_FIELDS)'), 'portal students output must be unchanged');
  assert.ok(src.includes("derivedFrom: 'institution/main_store'"), 'portal meta must be unchanged');
});

check('publicPortal.ts itself is untouched by this job (no rendering change)', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('studentsCollectionRef'), 'publicPortal must not read Firestore directly — AppContext overlays the source');
});

console.log('--- Student-ID generation still counts TRASH ids ---');

check('addStudent still passes trashed studentIds to the ID builder (no reuse of a trashed ID)', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes("trashBin.filter(t => t.type === 'student').map(t => t.data?.studentId)"), 'addStudent must still feed trashed studentIds into buildCreateStudentPayload');
  assert.ok(src.includes('buildCreateStudentPayload(student,'), 'addStudent must still use buildCreateStudentPayload');
});

console.log('--- Old upsert write stopped, collection write kept (source checks) ---');

check('pushDiffToCloud still writes students through the collection-only writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('students: writeStudentsFieldToCloud'), 'auto-sync must still carry students through writeStudentsFieldToCloud');
});

check('no Firestore rules change and no main_store delete in this job', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  const appSrc = readSource('context/AppContext.tsx');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
});

check('no student data values are cleaned, repaired or invented here (no roll/duplicate fix)', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const at = appSrc.indexOf('if (data.students && Array.isArray(data.students))');
  assert.ok(at > -1, 'students branch must exist in applyRemoteData');
  const body = appSrc.slice(at, appSrc.indexOf('\n    }', at) + 6);
  assert.ok(!body.includes('roll:'), 'the read path must not repair rolls — that is priority #12, a separate job');
  assert.ok(!body.includes('roll ='), 'the read path must not invent rolls');
  assert.ok(!body.includes('studentId'), 'the read path must not dedupe or rewrite studentIds');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job12-students-split'], 'tsx scripts/verify-job12-students-split.ts', 'npm run test:job12-students-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 12 students-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
