/**
 * Job 2 (schedule split: classRoutines + syllabusItems + calendarEvents)
 * — self-check (21 Nov 2026, base commit 0b7c9dd).
 *
 * Follows the scripts/verify-job1-notices-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job2-schedule-split.ts
 * (or npm run test:job2-schedule-split).
 *
 * Covers the Job 2 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 2,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New paths are institutions/inst_madrasah_primary/<field>/{id} for
 *    classRoutines, syllabusItems and calendarEvents, built from
 *    CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write: writeScheduleFieldsToCloud writes each of the three
 *    fields to its new collection AND to main_store in one try; the old
 *    main_store write is NOT stopped.
 *  - Deletes + restores of schedule records also reach the new
 *    collections, so a deleted routine can never be resurrected by a
 *    schedule feed.
 *  - Read-switch: onSnapshot feeds on the three new collections are the
 *    source once they have delivered docs; main_store is the fallback
 *    until then (empty collection snapshot triggers backfill, not a
 *    wipe). A genuinely empty collection (was non-empty before) still
 *    applies as empty.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection) is
 *    idempotent by id, skips id-less records, writes in 500-doc batches
 *    with setDoc merge. Counts match on RAW numbers: main_store array
 *    length = new collection doc count (no filtering before counting).
 *  - Auto-sync guard waits for the three schedule feeds before sync
 *    starts (hasLoadedScheduleCollectionsRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Public portal reads none of these three fields, so its rebuild
 *    needs no source change.
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
const R1 = { id: 'r1', classId: 'c6', day: 'Sat', period: 1 };
const R2 = { id: 'r2', classId: 'c6', day: 'Sun', period: 2 };
const S1 = { id: 's1', classId: 'c6', subjectId: 'sub1', topic: 'ভগ্নাংশ' };
const C1 = { id: 'e1', title: 'বার্ষিক পরীক্ষা', date: '2026-12-01' };

console.log('--- New collection paths (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

for (const field of FIELDS) {
  check(`${field} collection ref points at institutions/inst_madrasah_primary/${field}`, () => {
    const fnName = `${field}CollectionRef`;
    assert.strictEqual(typeof cloudConfirm[fnName], 'function', `${fnName} must be exported from cloudConfirm`);
    const ref = cloudConfirm[fnName]();
    assert.strictEqual(ref.path, `institutions/inst_madrasah_primary/${field}`, `collection path must be institutions/inst_madrasah_primary/${field}`);
  });
}

check('schedule collection refs are built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function scheduleCollectionRef');
  assert.ok(start > -1, 'scheduleCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every id once, in order (per field)', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([R1, R2]).docs.map((d: any) => d.id), ['r1', 'r2']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([S1]).docs.map((d: any) => d.id), ['s1']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([C1]).docs.map((d: any) => d.id), ['e1']);
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([R1, R2, R1, { ...R2, period: 3 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['r1', 'r2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([R1, { classId: 'c6' } as any, R2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['r1', 'r2']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan of an empty list is empty (calendar has 0 events today)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  // The plan (§5 step 2) counts BEFORE filtering: every record in the
  // main_store array becomes one doc. With distinct ids, docs ==
  // input length exactly; duplicates/id-less records are the only
  // counted exception (skipped), never silently dropped.
  for (const list of [[R1, R2], [S1], [C1], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([R1, R2, S1 as any, C1 as any]);
  assert.strictEqual(plan.docs.length, 4, 'four distinct records become four docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers all three fields, batched setDoc merge by id', () => {
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
  assert.ok(body.includes('scheduleCollectionRef'), 'backfill must write the new collections');
});

console.log('--- Dual-write (source checks) ---');

check('writeScheduleFieldsToCloud writes the new collections AND main_store in one try', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeScheduleFieldsToCloud');
  assert.ok(start > -1, 'writeScheduleFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeScheduleRecordsToCollection'), 'must write the new collections');
  assert.ok(body.includes('writeFieldsToCloud({ classRoutines: routines, syllabusItems, calendarEvents }'), 'must STILL write main_store (old write NOT stopped)');
  assert.ok(body.indexOf('writeScheduleRecordsToCollection') < body.indexOf('writeFieldsToCloud({ classRoutines'), 'collection write and main_store write belong to the same try');
  assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
});

check('dual-write asserts ids via the shared choke point, per field', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeScheduleFieldsToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn(field)"), 'dual-write must key records with the shared fieldKeyFn');
});

check('schedule deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`removal.field === '${field}'`), `delete writer must handle the ${field} field`);
  }
  assert.ok(body.includes('deleteScheduleRecordsFromCollection'), 'delete writer must delete the new-collection docs');
});

check('schedule restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`field === '${field}'`), `trash-op writer must handle the ${field} field`);
  }
  assert.ok(body.includes('writeScheduleRecordsToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts schedule onSnapshot feeds on the three new collections', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('scheduleCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startScheduleFeeds'), 'a schedule feeds starter must exist');
  const at = src.indexOf('const startScheduleFeeds');
  assert.ok(at > -1, 'startScheduleFeeds must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'schedule feeds must use onSnapshot');
  assert.ok(body.includes('scheduleCollectionRef(field)'), 'schedule feeds must listen on the new collections');
});

check('schedule feeds start with the main feed and stop when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startScheduleFeeds()'), 'main feed must start the schedule feeds (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopScheduleFeeds'), 'feed switch must also stop the schedule feeds');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startScheduleFeeds()'), 'public (anonymous) feed must NOT start the schedule feeds');
});

check('applyRemoteData schedule branches are gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('scheduleFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromScheduleCollection'), 'applyRemoteData must know when data comes from a schedule feed');
  assert.ok(src.includes('applyScheduleFieldFromRemote'), 'a per-field schedule apply helper must exist');
  const at = src.indexOf('const applyScheduleFieldFromRemote');
  assert.ok(at > -1, 'applyScheduleFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!scheduleFromCollectionRef.current[field]'), 'main_store schedule must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromScheduleCollection === field'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startScheduleFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillScheduleOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('scheduleFromCollectionRef.current[field] = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startScheduleFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (scheduleFromCollectionRef.current[field])'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ [field]: [] }'), 'genuinely empty must clear the list');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillScheduleOnce = async (field:');
  assert.ok(at > -1, 'backfillScheduleOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('lastConfirmedRef.current[field]'), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledScheduleIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes('migrateFieldToCollection(field, pending)'), 'backfill must run through migrateFieldToCollection');
});

check('feed takes over only when the collection covers every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startScheduleFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'takeover must be gated on completeness');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyScheduleFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionScheduleRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillScheduleOnce(field, stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the three schedule feeds before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedScheduleCollectionsRef'), 'a schedule-feeds-loaded flag must exist');
  const at = src.indexOf('hasLoadedScheduleCollectionsRef');
  assert.ok(at > -1, 'hasLoadedScheduleCollectionsRef must exist');
  // The debounced auto-sync effect gates on it (both at entry and at fire time).
  const effectAt = src.indexOf('// Job 2: never auto-sync until the schedule collections');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 2 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedScheduleCollectionsRef.current) return;'), 'auto-sync effect must return early until the schedule feeds settle');
  // A feed error also settles, so a dead listener can never block sync forever.
  const feedAt = src.indexOf('const startScheduleFeeds');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markScheduleFeedSettled(field)'), 'feed snapshot and feed error must both mark the field settled');
});

check('login verdict and manual force-push are NOT gated on the schedule feeds', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedScheduleCollectionsRef'), 'manual force-push must not wait for the schedule feeds');
});

console.log('--- Public portal (source checks) ---');

check('buildPublicPortalData reads none of the three schedule fields', () => {
  const src = readSource('services/publicPortal.ts');
  for (const field of FIELDS) {
    assert.ok(!src.includes(field), `publicPortal must not read ${field}`);
  }
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes schedule through the dual-write writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('writeScheduleFieldsToCloud(rDelta, sDelta, cDelta, actor)'), 'auto-sync must still carry schedule through writeScheduleFieldsToCloud');
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
  assert.strictEqual(pkg.scripts['test:job2-schedule-split'], 'tsx scripts/verify-job2-schedule-split.ts', 'npm run test:job2-schedule-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 2 schedule-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
