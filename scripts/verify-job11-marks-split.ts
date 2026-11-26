/**
 * Job 11 (marks split: 2,601 records — the biggest) — self-check
 * (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job2-schedule-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job11-marks-split.ts
 * (or npm run test:job11-marks-split).
 *
 * Covers the Job 11 spec (LDSDM-database-split-plan-2026-11-07.md §6
 * Job 11, §5 steps 1–3 only — step 5, stopping the old main_store
 * write, was a separate push (26 Nov 2026, see
 * scripts/verify-job11-step5-marks.ts) and is reflected below:
 *  - New path is institutions/inst_madrasah_primary/marks/{id}
 *    (doc id = MarkRecord.id), built from
 *    CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Collection-only write (step 5, 26 Nov 2026, supersedes the
 *    dual-write below): writeMarksFieldToCloud writes the new
 *    collection ONLY; the old main_store write is stopped, the
 *    frozen copy stays. See scripts/verify-job11-step5-marks.ts.
 *    The collection leg writes in 500-doc writeBatch batches — a
 *    sequential setDoc loop over the full 2,601-record list would blow
 *    the 40 s confirm timeout, so the batch shape is part of the spec.
 *  - Deletes + restores of marks also reach the new collection, so a
 *    deleted mark can never be resurrected by the marks feed. Marks is
 *    a TRIPWIRE field, so the tripwire check runs BEFORE any
 *    new-collection doc is deleted (Job 4 / Job 10 reorder).
 *  - Read-switch: the onSnapshot feed on the new collection is the
 *    source once it covers every confirmed main_store record;
 *    main_store is the fallback until then (empty collection snapshot
 *    triggers backfill, not a wipe). A genuinely empty collection (was
 *    non-empty before) still applies as empty. AFTER takeover every
 *    non-empty snapshot applies — a mark changed on another device
 *    must appear without a reload (the Job 3 / Job 5 bug, fixed here
 *    with the Job 10 `fromCollection || complete` shape).
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection,
 *    extended to 'marks') is idempotent by id, skips id-less records,
 *    writes in 500-doc batches (2,601 records = 6 batches) with
 *    setDoc merge. A failed batch is retried alone, not the whole
 *    backfill. Counts match on RAW numbers: main_store array length
 *    = new collection doc count (no filtering before counting).
 *  - Auto-sync guard waits for the marks feed before sync starts
 *    (hasLoadedMarksCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Public portal: rebuildPublicPortalFromCloud reads marks from the
 *    new collection only when the collection covers the fresh
 *    main_store marks exactly (same id set) — otherwise main_store
 *    marks stay the source. buildPublicPortalData output is unchanged.
 *  - Marks entry two-level control (global switch + per-exam toggle,
 *    default open) is unchanged; the 40 s marks confirm timeout is
 *    unchanged.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Firestore-touching code lives in React/services modules, so the
 * feeds, dual-write wiring and guard are covered by source-order
 * assertions (the repo's established grep-proof style) plus real unit
 * checks on the pure parts (collection paths, backfill plan, raw
 * counts, batch split).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const migrationSplit: any = await import('../services/migrationSplit').catch(() => ({}));
const publicPortal: any = await import('../services/publicPortal').catch(() => ({}));

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

const M1: any = { id: 'mk-1', studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-1', obtained: 80, total: 100 };
const M2: any = { id: 'mk-2', studentId: 'st-2', subjectId: 'sub-1', examId: 'ex-1', obtained: 65, total: 100 };
const M3: any = { id: 'mk-3', studentId: 'st-1', subjectId: 'sub-2', examId: 'ex-1', obtained: 90, total: 100 };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('marks collection ref points at institutions/inst_madrasah_primary/marks', () => {
  assert.strictEqual(typeof cloudConfirm.marksCollectionRef, 'function', 'marksCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.marksCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/marks', 'collection path must be institutions/inst_madrasah_primary/marks');
});

check('marks collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function marksCollectionRef');
  assert.ok(start > -1, 'marksCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts, 500-doc batches) ---');

check('backfill plan keeps every mark id once, in order', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([M1, M2, M3]).docs.map((d: any) => d.id), ['mk-1', 'mk-2', 'mk-3']);
});

check('backfill plan dedupes the same mark id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([M1, M2, M1, { ...M2, obtained: 70 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['mk-1', 'mk-2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less mark records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([M1, { studentId: 'st-9' } as any, M2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['mk-1', 'mk-2']);
  assert.strictEqual(plan.skipped, 1);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[M1, M2], [M1, M2, M3], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
});

check('2,601 marks split into 6 batches of at most 500 (Firestore batch limit)', () => {
  const records = Array.from({ length: 2601 }, (_, i) => ({ id: `mk-${i + 1}`, studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-1', obtained: 50, total: 100 }));
  const plan = migrationSplit.scheduleBackfillPlan(records);
  assert.strictEqual(plan.docs.length, 2601, 'all 2,601 records become docs');
  assert.strictEqual(plan.skipped, 0);
  const batches: any[][] = [];
  for (let i = 0; i < plan.docs.length; i += 500) batches.push(plan.docs.slice(i, i + 500));
  assert.strictEqual(batches.length, 6, '2,601 records need exactly 6 batches');
  assert.ok(batches.every((b) => b.length <= 500), 'no batch may exceed 500 docs');
  assert.deepStrictEqual(batches.map((b) => b.length), [500, 500, 500, 500, 500, 101], 'batch sizes must be 500 x 5 + 101');
});

console.log('--- Backfill writer (source checks) ---');

check("migrateFieldToCollection covers 'marks', batched setDoc merge by id", () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("'marks'"), "migrateFieldToCollection must cover 'marks'");
  assert.ok(body.includes('marksCollectionRef'), 'marks backfill must write the new marks collection');
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('i += 500'), 'backfill must step in 500-doc batches');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes('doc(col, String('), 'doc id must be the record id');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
});

check('a failed backfill batch is retried alone, not the whole backfill', () => {
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  // The retry wraps one batch.commit() — a failure replays that batch
  // only; earlier batches are already committed and later batches
  // still run after it.
  assert.ok(/for\s*\(let\s+attempt/i.test(body) || body.includes('attempt'), 'backfill must retry a failed batch commit');
  assert.ok(body.includes('batch.commit()'), 'backfill must commit each batch');
});

console.log('--- Dual-write (source checks) ---');

check('writeMarksFieldToCloud writes the new collection ONLY (step 5 stopped the main_store leg)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeMarksFieldToCloud');
  assert.ok(start > -1, 'writeMarksFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeMarksToCollection'), 'must write the new marks collection');
  assert.ok(!body.includes("writeFieldToCloud('marks'"), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
  assert.ok(body.indexOf('writeMarksToCollection') > -1, 'collection write belongs to the same try');
  assert.ok(body.includes('withTimeout'), 'collection-only write must stay inside the confirm timeout');
});

check('dual-write asserts mark ids via the shared choke point', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeMarksFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn('marks')"), 'dual-write must key records with the shared fieldKeyFn');
});

check('marks confirm timeout is still 40 seconds (CONFIRM_TIMEOUT_MS unchanged)', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(src.includes('const CONFIRM_TIMEOUT_MS = 40000;'), 'CONFIRM_TIMEOUT_MS must stay 40000');
  const start = src.indexOf('export async function writeMarksFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('CONFIRM_TIMEOUT_MS'), 'marks dual-write must use the unchanged 40 s timeout');
});

check('collection leg writes in 500-doc writeBatch batches (no sequential loop over 2,601 docs)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeMarksToCollection');
  assert.ok(start > -1, 'writeMarksToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeBatch'), 'marks collection write must batch (500-doc Firestore limit)');
  assert.ok(body.includes('i += 500'), 'marks collection write must step in 500-doc batches');
  assert.ok(body.includes('{ merge: true }'), 'marks collection write must use setDoc merge');
});

check('marks deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'marks'"), 'delete writer must handle the marks field');
  assert.ok(body.includes('deleteMarksFromCollection'), 'delete writer must delete the new-collection docs');
});

check('tripwire runs BEFORE any new-collection doc is deleted (marks is a tripwire field)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertTripwire'), 'delete writer must keep the tripwire check');
  assert.ok(
    body.indexOf('assertTripwire(') < body.indexOf('deleteMarksFromCollection'),
    'a refused shrink must delete nothing anywhere — tripwire first, collection deletes after'
  );
});

check('marks restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'marks'"), 'trash-op writer must handle the marks field');
  assert.ok(body.includes('writeMarksToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a marks onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('marksCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startMarksFeed'), 'a marks feed starter must exist');
  const at = src.indexOf('const startMarksFeed');
  assert.ok(at > -1, 'startMarksFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'marks feed must use onSnapshot');
  assert.ok(body.includes('marksCollectionRef()'), 'marks feed must listen on the new collection');
});

check('marks feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startMarksFeed()'), 'main feed must start the marks feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopMarksFeed'), 'feed switch must also stop the marks feed');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startMarksFeed()'), 'public (anonymous) feed must NOT start the marks feed');
});

check('applyRemoteData marks branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('marksFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromMarksCollection'), 'applyRemoteData must know when data comes from the marks feed');
  assert.ok(src.includes('applyMarksFieldFromRemote'), 'a marks apply helper must exist');
  const at = src.indexOf('const applyMarksFieldFromRemote');
  assert.ok(at > -1, 'applyMarksFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!marksFromCollectionRef.current'), 'main_store marks must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromMarksCollection'), 'collection-feed snapshots must always apply');
});

check('demo-mark- records are still filtered on read, exactly as before', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyMarksFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("!m.id?.startsWith('demo-mark-')"), 'marks read must keep filtering demo-mark- records');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startMarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillMarksOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('marksFromCollectionRef.current = true'), 'a complete snapshot must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startMarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (marksFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ marks: [] }'), 'genuinely empty must clear the list');
});

check('feed takes over only when the collection covers every confirmed main_store mark', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startMarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('marksFromCollectionRef.current || complete'), 'takeover must be gated on completeness (or already taken over)');
});

check('AFTER takeover every non-empty snapshot applies (record added on another device shows without reload)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startMarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  // Job 10 shape: the completeness gate guards only the FIRST
  // takeover — once taken over, later snapshots apply as-is, so a
  // deletion on another device is not mistaken for a partial backfill.
  assert.ok(body.includes('marksFromCollectionRef.current || complete'), 'post-takeover snapshots must apply without re-checking completeness');
  assert.ok(body.includes('applyRemoteData({ marks: docs }'), 'post-takeover non-empty snapshot must reach state');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillMarksOnce = async (source?:');
  assert.ok(at > -1, 'backfillMarksOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['marks']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledMarkIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes("migrateFieldToCollection('marks', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyMarksFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionMarksRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillMarksOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the marks feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedMarksCollectionRef'), 'a marks-feed-loaded flag must exist');
  // The debounced auto-sync effect gates on it (both at entry and at fire time).
  const effectAt = src.indexOf('// Job 11: never auto-sync until the marks collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 11 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedMarksCollectionRef.current) return;'), 'auto-sync effect must return early until the marks feed settles');
  // A feed error also settles, so a dead listener can never block sync forever.
  const feedAt = src.indexOf('const startMarksFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markMarksFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the marks feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedMarksCollectionRef'), 'manual force-push must not wait for the marks feed');
});

console.log('--- Public portal (source checks + output identity) ---');

check('portal rebuild reads marks from the new collection only when it covers main_store marks exactly', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('readMarksFromCollection'), 'portal rebuild must read the marks collection');
  const at = src.indexOf('const rebuildPublicPortalFromCloud');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readMarksFromCollection'), 'portal rebuild must try the marks collection first');
  assert.ok(body.includes('colMarks'), 'portal rebuild must hold the collection marks separately');
  // Exact coverage (same id set), not just "has docs" — a partial
  // backfill (6 batches) must never drop portal marks.
  assert.ok(body.includes('every((id) => colMarkIds.has(id))'), 'portal must switch only when every main_store mark id is in the collection');
  assert.ok(body.includes('colMarks.length ==='), 'portal must also require the same count, so no extra mark leaks in');
});

check('buildPublicPortalData output is unchanged for the same marks (source or collection)', () => {
  assert.strictEqual(typeof publicPortal.buildPublicPortalData, 'function', 'buildPublicPortalData must be exported');
  const source = { schoolProfile: { name: 'মাদ্রাসা' }, students: [], subjects: [], exams: [], marks: [M1, M2], remarks: [], classes: [], examSubjectAssignments: [], notices: [] };
  const fromMainStore = publicPortal.buildPublicPortalData(source);
  const fromCollection = publicPortal.buildPublicPortalData({ ...source, marks: [M1, M2] });
  assert.deepStrictEqual(fromCollection.marks, fromMainStore.marks, 'portal marks must be identical whichever source they came from');
  assert.deepStrictEqual(fromCollection.marks, [
    { id: 'mk-1', studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-1', obtained: 80, total: 100 },
    { id: 'mk-2', studentId: 'st-2', subjectId: 'sub-1', examId: 'ex-1', obtained: 65, total: 100 },
  ], 'portal marks must carry exactly the public mark fields');
});

check('marks entry two-level control is unchanged (global switch + per-exam toggle, default open)', () => {
  const src = readSource('context/AppContext.tsx');
  // The global switch still only flips on a real boolean — an old doc
  // without the flag leaves entry open (default open, unchanged).
  assert.ok(src.includes("if (typeof data.markEntryEnabled === 'boolean'"), 'global mark-entry switch must keep its boolean-only rule');
  assert.ok(src.includes('markEntryEnabled'), 'mark-entry control must still exist');
});

console.log('--- Old upsert write stopped, collection write kept (source checks) ---');

check('pushDiffToCloud still writes marks through the collection-only writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('marks: writeMarksFieldToCloud'), 'auto-sync must still carry marks through writeMarksFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job11-marks-split'], 'tsx scripts/verify-job11-marks-split.ts', 'npm run test:job11-marks-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 11 marks-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
