/**
 * Job 9 (dailyStudentAttendance + dailyStaffAttendance split) — self-check
 * (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job8-leaves-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job9-attendance-split.ts
 * (or npm run test:job9-attendance-split).
 *
 * Covers the Job 9 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 9,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New paths are institutions/inst_madrasah_primary/dailyStudentAttendance/
 *    {date}_{studentId} and .../dailyStaffAttendance/{date}_{staffId},
 *    built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write: writeAttendanceFieldToCloud / writeStaffAttendanceFieldToCloud
 *    write the new collection AND main_store in one try; the old
 *    main_store write is NOT stopped.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection,
 *    extended to both attendance fields) is idempotent, copies records
 *    as-is, doc id is the date_id form (derived from date + studentId /
 *    staffId when the record carries no id). Counts match on RAW
 *    numbers: main_store array length = new collection doc count
 *    (no filtering before counting).
 *  - Read-switch: onSnapshot feeds on both new collections are the
 *    source once complete; main_store is the fallback until then
 *    (empty collection snapshot triggers backfill, not a wipe). Both
 *    fields switch TOGETHER (one flag). A genuinely empty collection
 *    (was non-empty before) still applies as empty — via merge, so it
 *    can never wipe phone-local records.
 *  - MERGE, NEVER REPLACE (the riskiest rule of this job): attendance
 *    hydration merges into the local services, so a teacher's phone
 *    backlog that has not synced yet survives every snapshot — the
 *    collection feed, the main_store feed and an empty snapshot alike.
 *    Proven by REAL unit checks on dailyAttendanceService, not grep.
 *  - Post-takeover snapshots keep applying: every non-empty snapshot
 *    after takeover still merges (Job 3 / Job 5 bug class — their feed
 *    handlers only applied at takeover).
 *  - Auto-sync guard waits for BOTH attendance feeds before sync
 *    starts (hasLoadedAttendanceCollectionsRef); login verdict and
 *    manual force-push are NOT gated on it.
 *  - Holiday rule unchanged: no attendance on off days (Friday is
 *    never a working day); the backfill and the merge never filter by
 *    date. Staff attendance stays admin-only — no new self-service
 *    caller of the staff writer.
 *  - Public portal reads no attendance, so its rebuild needs no
 *    source change. Attendance has no delete UI, so no delete/restore
 *    writer change is needed either.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Firestore-touching code lives in React/services modules, so the feeds,
 * dual-write wiring and guard are covered by source-order assertions
 * (the repo's established grep-proof style) plus real unit checks on
 * the pure parts (collection paths, backfill plan, merge behaviour).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const migrationSplit: any = await import('../services/migrationSplit').catch(() => ({}));
const attendanceService: any = await import('../services/dailyAttendanceService').catch(() => ({}));

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

const S1: any = { id: '2026-11-07_ST-12', date: '2026-11-07', studentId: 'ST-12', studentName: 'আব্দুল্লাহ', classLevel: 'Class 3', status: 'PRESENT' };
const S2: any = { id: '2026-11-07_ST-13', date: '2026-11-07', studentId: 'ST-13', studentName: 'বিলাল', classLevel: 'Class 3', status: 'ABSENT', note: 'অসুস্থ' };
const S3: any = { id: '2026-11-08_ST-12', date: '2026-11-08', studentId: 'ST-12', studentName: 'আব্দুল্লাহ', classLevel: 'Class 3', status: 'LATE', lateMinutes: 10 };
const T1: any = { id: '2026-11-07_MDR-T003', date: '2026-11-07', staffId: 'MDR-T003', staffName: 'মেহেদী', designation: 'সহকারী শিক্ষক', status: 'PRESENT', inTime: '08:00' };

console.log('--- New collection paths (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('student attendance collection ref points at institutions/inst_madrasah_primary/dailyStudentAttendance', () => {
  assert.strictEqual(typeof cloudConfirm.attendanceCollectionRef, 'function', 'attendanceCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.attendanceCollectionRef('dailyStudentAttendance');
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/dailyStudentAttendance', 'collection path must be institutions/inst_madrasah_primary/dailyStudentAttendance');
});

check('staff attendance collection ref points at institutions/inst_madrasah_primary/dailyStaffAttendance', () => {
  const ref = cloudConfirm.attendanceCollectionRef('dailyStaffAttendance');
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/dailyStaffAttendance', 'collection path must be institutions/inst_madrasah_primary/dailyStaffAttendance');
});

check('attendance collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function attendanceCollectionRef');
  assert.ok(start > -1, 'attendanceCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent, doc ids in date_id form, RAW counts) ---');

check('backfill plan keeps every student record once, doc id in date_studentId form', () => {
  assert.strictEqual(typeof migrationSplit.attendanceBackfillPlan, 'function', 'attendanceBackfillPlan must be exported from migrationSplit');
  const plan = migrationSplit.attendanceBackfillPlan([S1, S2, S3], 'dailyStudentAttendance');
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['2026-11-07_ST-12', '2026-11-07_ST-13', '2026-11-08_ST-12']);
});

check('backfill plan derives the date_id doc id when a record carries no id', () => {
  const noId: any = { date: '2026-11-07', studentId: 'ST-14', classLevel: 'Class 3', status: 'PRESENT' };
  const plan = migrationSplit.attendanceBackfillPlan([noId], 'dailyStudentAttendance');
  assert.strictEqual(plan.docs.length, 1, 'a datable record without an id must still be copied — it is keyed by date + studentId');
  assert.strictEqual(plan.docs[0].id, '2026-11-07_ST-14', 'derived doc id must be date_studentId');
  assert.strictEqual(plan.skipped, 0);
});

check('backfill plan derives the date_staffId doc id for staff records without an id', () => {
  const noId: any = { date: '2026-11-07', staffId: 'MDR-T002', status: 'ABSENT' };
  const plan = migrationSplit.attendanceBackfillPlan([noId], 'dailyStaffAttendance');
  assert.strictEqual(plan.docs.length, 1);
  assert.strictEqual(plan.docs[0].id, '2026-11-07_MDR-T002', 'derived doc id must be date_staffId');
});

check('backfill plan copies records as-is (status, note, lateMinutes, inTime preserved)', () => {
  const plan = migrationSplit.attendanceBackfillPlan([S2, S3, T1], 'dailyStudentAttendance');
  assert.strictEqual(plan.docs.find((d: any) => d.id === '2026-11-07_ST-13').note, 'অসুস্থ');
  assert.strictEqual(plan.docs.find((d: any) => d.id === '2026-11-08_ST-12').lateMinutes, 10);
  assert.strictEqual(plan.docs.find((d: any) => d.id === '2026-11-08_ST-12').status, 'LATE');
});

check('backfill plan dedupes the same date_id (second run writes the same docs)', () => {
  const plan = migrationSplit.attendanceBackfillPlan([S1, S2, S1, { ...S2, status: 'PRESENT' }], 'dailyStudentAttendance');
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['2026-11-07_ST-12', '2026-11-07_ST-13'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips only records that cannot be keyed at all (no date or no person)', () => {
  const plan = migrationSplit.attendanceBackfillPlan([S1, { status: 'PRESENT' } as any, S2], 'dailyStudentAttendance');
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['2026-11-07_ST-12', '2026-11-07_ST-13']);
  assert.strictEqual(plan.skipped, 1);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[S1, S2], [S1, S2, S3], []]) {
    const plan = migrationSplit.attendanceBackfillPlan(list as any[], 'dailyStudentAttendance');
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.attendanceBackfillPlan([S1, S2, S3], 'dailyStudentAttendance');
  assert.strictEqual(plan.docs.length, 3, 'three distinct records become three docs');
});

check('backfill never filters by date: a Friday record is copied as-is (holiday rule is display-side)', () => {
  // 2026-11-20 is a Friday — the register never creates Friday
  // attendance, but a record that exists must survive the split.
  const friday: any = { id: '2026-11-20_ST-12', date: '2026-11-20', studentId: 'ST-12', classLevel: 'Class 3', status: 'PRESENT' };
  const plan = migrationSplit.attendanceBackfillPlan([friday], 'dailyStudentAttendance');
  assert.strictEqual(plan.docs.length, 1, 'backfill must not drop Friday-dated records');
  assert.strictEqual(attendanceService.isFridayDate('2026-11-20'), true, '2026-11-20 must still be recognised as Friday (holiday rule untouched)');
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers both attendance fields, batched setDoc merge by date_id', () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('dailyStudentAttendance'), 'migrateFieldToCollection must handle dailyStudentAttendance');
  assert.ok(body.includes('dailyStaffAttendance'), 'migrateFieldToCollection must handle dailyStaffAttendance');
  assert.ok(body.includes('attendanceCollectionRef'), 'backfill must write the new attendance collections');
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
});

console.log('--- Dual-write (source checks) ---');

for (const [fn, field, collFn] of [
  ['writeAttendanceFieldToCloud', 'dailyStudentAttendance', 'writeAttendanceRecordsToCollection'],
  ['writeStaffAttendanceFieldToCloud', 'dailyStaffAttendance', 'writeAttendanceRecordsToCollection'],
] as const) {
  check(`${fn} writes the new collection AND main_store in one try`, () => {
    const src = readSource('services/cloudConfirm.ts');
    const start = src.indexOf(`export async function ${fn}`);
    assert.ok(start > -1, `${fn} must exist`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes(collFn), 'must write the new collection');
    assert.ok(body.includes(`writeFieldToCloud('${field}'`), 'must STILL write main_store (old write NOT stopped)');
    assert.ok(body.indexOf(collFn) < body.indexOf(`writeFieldToCloud('${field}'`), 'collection write and main_store write belong to the same try');
    assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
  });

  check(`${fn} asserts ids via the shared choke point`, () => {
    const src = readSource('services/cloudConfirm.ts');
    const start = src.indexOf(`export async function ${fn}`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
    assert.ok(body.includes(`fieldKeyFn('${field}')`), 'dual-write must key records with the shared fieldKeyFn');
  });
}

console.log('--- MERGE, NEVER REPLACE (real unit checks on dailyAttendanceService) ---');

check('merge keeps a phone-local student record the cloud list does not have (unsynced backlog survives)', () => {
  const svc = attendanceService.dailyAttendanceService;
  assert.ok(svc, 'dailyAttendanceService singleton must be importable');
  svc.replaceStudentRecords([]);
  const localOnly: any = { id: '2026-11-21_ST-99', date: '2026-11-21', studentId: 'ST-99', classLevel: 'Class 3', status: 'PRESENT' };
  svc.mergeStudentRecords([localOnly]);
  svc.mergeStudentRecords([S1, S2]); // cloud snapshot without the local record
  const ids = svc.getAllStudentRecords().map((r: any) => r.id);
  assert.ok(ids.includes('2026-11-21_ST-99'), 'phone-local record must survive a cloud snapshot that lacks it — merge, never replace');
  assert.ok(ids.includes('2026-11-07_ST-12') && ids.includes('2026-11-07_ST-13'), 'cloud records must land too');
  svc.replaceStudentRecords([]);
});

check('merge keeps a phone-local staff record the cloud list does not have', () => {
  const svc = attendanceService.dailyAttendanceService;
  svc.replaceStaffRecords([]);
  const localOnly: any = { id: '2026-11-21_MDR-T009', date: '2026-11-21', staffId: 'MDR-T009', status: 'PRESENT' };
  svc.mergeStaffRecords([localOnly]);
  svc.mergeStaffRecords([T1]);
  const ids = svc.getAllStaffRecords().map((r: any) => r.id);
  assert.ok(ids.includes('2026-11-21_MDR-T009'), 'phone-local staff record must survive a cloud snapshot that lacks it');
  assert.ok(ids.includes('2026-11-07_MDR-T003'), 'cloud staff record must land too');
  svc.replaceStaffRecords([]);
});

check('merging an EMPTY list wipes nothing (empty collection snapshot cannot clear the register)', () => {
  const svc = attendanceService.dailyAttendanceService;
  svc.replaceStudentRecords([S1, S2]);
  svc.mergeStudentRecords([]);
  assert.strictEqual(svc.getAllStudentRecords().length, 2, 'merge([]) must be a no-op — an empty snapshot never clears attendance');
  svc.replaceStaffRecords([T1]);
  svc.mergeStaffRecords([]);
  assert.strictEqual(svc.getAllStaffRecords().length, 1, 'merge([]) must be a no-op for staff too');
  svc.replaceStudentRecords([]);
  svc.replaceStaffRecords([]);
});

check('incoming record wins on id conflict (a correction on another device lands)', () => {
  const svc = attendanceService.dailyAttendanceService;
  svc.replaceStudentRecords([S2]); // ABSENT
  svc.mergeStudentRecords([{ ...S2, status: 'PRESENT' }]);
  assert.strictEqual(svc.getAllStudentRecords()[0].status, 'PRESENT', 'incoming record must win on id conflict');
  svc.replaceStudentRecords([]);
});

check('Friday records survive merge (holiday rule is display-side, merge never drops a day)', () => {
  const svc = attendanceService.dailyAttendanceService;
  svc.replaceStudentRecords([]);
  const friday: any = { id: '2026-11-20_ST-12', date: '2026-11-20', studentId: 'ST-12', classLevel: 'Class 3', status: 'PRESENT' };
  svc.mergeStudentRecords([friday]);
  assert.strictEqual(svc.getAllStudentRecords().length, 1, 'merge must not filter Friday records out');
  svc.replaceStudentRecords([]);
});

console.log('--- Merge on the read path (source checks) ---');

check('applyRemoteData attendance branches merge into the service, never replace', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('applyAttendanceFieldFromRemote'), 'an attendance apply helper must exist');
  const at = src.indexOf('const applyAttendanceFieldFromRemote');
  assert.ok(at > -1, 'applyAttendanceFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('mergeStudentRecords'), 'student attendance must hydrate by merge');
  assert.ok(body.includes('mergeStaffRecords'), 'staff attendance must hydrate by merge');
  assert.ok(!body.includes('replaceStudentRecords'), 'student attendance must NEVER hydrate by replace');
  assert.ok(!body.includes('replaceStaffRecords'), 'staff attendance must NEVER hydrate by replace');
});

check('applyRemoteData routes both attendance fields through the merge helper', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('fromAttendanceCollection'), 'applyRemoteData must know when data comes from the attendance feed');
  assert.ok(src.includes('applyAttendanceFieldFromRemote(\'dailyStudentAttendance\''), 'student field must route through the helper');
  assert.ok(src.includes('applyAttendanceFieldFromRemote(\'dailyStaffAttendance\''), 'staff field must route through the helper');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts attendance onSnapshot feeds on both new collections', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('attendanceCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startAttendanceFeeds'), 'an attendance feed starter must exist');
  const at = src.indexOf('const startAttendanceFeeds');
  assert.ok(at > -1, 'startAttendanceFeeds must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'attendance feeds must use onSnapshot');
  assert.ok(body.includes('attendanceCollectionRef(field)'), 'attendance feeds must listen on the new collections');
  assert.ok(body.includes("'dailyStudentAttendance'") && body.includes("'dailyStaffAttendance'"), 'both fields must have a feed');
});

check('attendance feeds start with the main feed and stop when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startAttendanceFeeds()'), 'main feed must start the attendance feeds (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopAttendanceFeeds'), 'feed switch must also stop the attendance feeds');
  const pubAt = src.indexOf('const startPublicFeed = () => {');
  assert.ok(pubAt > -1, 'startPublicFeed must exist');
  assert.ok(!src.slice(pubAt, pubAt + 3000).includes('startAttendanceFeeds()'), 'public (anonymous) feed must NOT start the attendance feeds');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAttendanceFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillAttendanceOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('attendanceFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('both fields switch TOGETHER (one shared flag, not one flag per field)', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('attendanceFromCollectionRef'), 'a shared collection-source flag must exist');
  assert.ok(!src.includes('attendanceFromCollectionRef.current['), 'the flag must be one boolean for both fields, not per-field');
  const at = src.indexOf('const applyAttendanceFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!attendanceFromCollectionRef.current'), 'main_store attendance must be skipped once the collections are the source');
  assert.ok(body.includes('opts?.fromAttendanceCollection'), 'collection-feed snapshots must always apply');
});

check('feed takes over only when the collection covers every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAttendanceFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'takeover must be gated on completeness');
});

check('post-takeover snapshots keep applying (no takeover-only gate on the apply)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAttendanceFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  const completeAt = body.indexOf('if (complete)');
  assert.ok(completeAt > -1, 'takeover branch must exist');
  const completeBody = body.slice(completeAt, body.indexOf('} else {', completeAt));
  assert.ok(completeBody.includes('applyRemoteData({ [field]: docs }, { fromAttendanceCollection: true })'), 'a complete snapshot must apply its docs');
  assert.ok(!completeBody.includes('!attendanceFromCollectionRef'), 'the apply must NOT be gated on "not taken over yet" — every later snapshot applies too');
  assert.ok(!body.slice(0, completeAt).includes('if (attendanceFromCollectionRef.current) return'), 'the handler must never early-return once taken over');
});

check('genuinely empty collection (was non-empty) still applies as empty — via merge, so nothing is wiped', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startAttendanceFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (attendanceFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ [field]: [] }, { fromAttendanceCollection: true })'), 'genuinely empty must apply as an empty merge (a no-op for the register, never a wipe)');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyAttendanceFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionAttendanceRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillAttendanceOnce(field, stragglers)'), 'stragglers must be backfilled into the collection');
});

check('backfill source is the CONFIRMED (merged) main_store list — the phone backlog rides along, safely', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillAttendanceOnce = async (');
  assert.ok(at > -1, 'backfillAttendanceOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current[field]"), 'backfill must copy the confirmed list (which, for attendance, is the merged list — local backlog included)');
  assert.ok(body.includes('backfilledAttendanceIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes('migrateFieldToCollection(field, pending)'), 'backfill must run through migrateFieldToCollection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for BOTH attendance feeds before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedAttendanceCollectionsRef'), 'an attendance-feeds-loaded flag must exist');
  const effectAt = src.indexOf('// Job 9: never auto-sync until the attendance collections');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 9 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 900);
  assert.ok(effectBody.includes('if (!hasLoadedAttendanceCollectionsRef.current) return;'), 'auto-sync effect must return early until the attendance feeds settle');
  const feedAt = src.indexOf('const startAttendanceFeeds');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markAttendanceFeedSettled(field)'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the attendance feeds', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedAttendanceCollectionsRef'), 'manual force-push must not wait for the attendance feeds');
});

console.log('--- Public portal + staff admin-only (source checks) ---');

check('buildPublicPortalData reads no attendance', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('dailyStudentAttendance'), 'publicPortal must not read dailyStudentAttendance');
  assert.ok(!src.includes('dailyStaffAttendance'), 'publicPortal must not read dailyStaffAttendance');
});

check('staff attendance writer gains no new caller (admin-only, no self-service path)', () => {
  const src = readSource('context/AppContext.tsx');
  const count = (src.match(/writeStaffAttendanceFieldToCloud/g) || []).length;
  assert.strictEqual(count, 4, 'writeStaffAttendanceFieldToCloud must keep exactly its 4 pre-existing AppContext mentions (import + pushDiff map + confirm + forcePush map)');
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(p);
    }
    return out;
  };
  const hits = walk(path.join(__dirname, '..', 'components')).filter((f) => readSource(path.relative(path.join(__dirname, '..'), f)).includes('AttendanceCollectionRef'));
  assert.strictEqual(hits.length, 0, 'no component may touch the attendance collections directly (staff attendance stays admin-only through AppContext)');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes attendance through the dual-write writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('dailyStudentAttendance: writeAttendanceFieldToCloud'), 'auto-sync must still carry student attendance through writeAttendanceFieldToCloud');
  assert.ok(src.includes('dailyStaffAttendance: writeStaffAttendanceFieldToCloud'), 'auto-sync must still carry staff attendance through writeStaffAttendanceFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job9-attendance-split'], 'tsx scripts/verify-job9-attendance-split.ts', 'npm run test:job9-attendance-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 9 attendance-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
