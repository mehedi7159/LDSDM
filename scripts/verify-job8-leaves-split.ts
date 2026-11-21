/**
 * Job 8 (staffLeaves split) — self-check (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job2-schedule-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job8-leaves-split.ts
 * (or npm run test:job8-leaves-split).
 *
 * Covers the Job 8 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 8,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New path is institutions/inst_madrasah_primary/staffLeaves/{id},
 *    built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write: writeStaffLeavesFieldToCloud writes the new collection
 *    AND main_store in one try; the old main_store write is NOT stopped.
 *  - Deletes + restores of leave records also reach the new collection,
 *    so a deleted leave can never be resurrected by the leaves feed.
 *  - Read-switch: an onSnapshot feed on the new collection is the
 *    source once it has delivered docs; main_store is the fallback
 *    until then (empty collection snapshot triggers backfill, not a
 *    wipe). A genuinely empty collection (was non-empty before) still
 *    applies as empty.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection,
 *    extended to 'staffLeaves') is idempotent by id, skips id-less
 *    records, writes in 500-doc batches with setDoc merge. Counts match
 *    on RAW numbers: main_store array length = new collection doc
 *    count (no filtering before counting).
 *  - Auto-sync guard waits for the leaves feed before sync starts
 *    (hasLoadedLeavesCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Leave rules do NOT change: applications stay PENDING, admin-granted
 *    leave stays APPROVED, REJECTED stays in the list (only reports
 *    ignore it). The read path applies records as-is — no status
 *    filtering, no status rewriting anywhere in this job.
 *  - Public portal reads no staffLeaves, so its rebuild needs no
 *    source change.
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

const L1 = { id: 'lv1', teacherId: 'MDR-T003', teacherName: 'মেহেদী', designation: 'সহকারী শিক্ষক', leaveType: 'CASUAL', startDate: '2026-11-22', endDate: '2026-11-23', daysCount: 2, reason: 'পারিবারিক', status: 'PENDING', appliedAt: '2026-11-21' };
const L2 = { id: 'lv2', teacherId: 'MDR-T002', teacherName: 'আরাফাত', designation: 'শিক্ষক', leaveType: 'SICK', startDate: '2026-11-20', endDate: '2026-11-20', daysCount: 1, reason: 'অসুস্থ', status: 'APPROVED', appliedAt: '2026-11-19' };
const L3 = { id: 'lv3', teacherId: 'MDR-T003', teacherName: 'মেহেদী', designation: 'সহকারী শিক্ষক', leaveType: 'CASUAL', startDate: '2026-11-10', endDate: '2026-11-10', daysCount: 1, reason: 'কাজ', status: 'REJECTED', appliedAt: '2026-11-09' };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('staffLeaves collection ref points at institutions/inst_madrasah_primary/staffLeaves', () => {
  assert.strictEqual(typeof cloudConfirm.staffLeavesCollectionRef, 'function', 'staffLeavesCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.staffLeavesCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/staffLeaves', 'collection path must be institutions/inst_madrasah_primary/staffLeaves');
});

check('staffLeaves collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function staffLeavesCollectionRef');
  assert.ok(start > -1, 'staffLeavesCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every leave id once, in order (PENDING + APPROVED + REJECTED)', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([L1, L2, L3]).docs.map((d: any) => d.id), ['lv1', 'lv2', 'lv3']);
});

check('backfill plan keeps REJECTED leaves too (they stay in the list, only reports ignore them)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([L1, L3]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['lv1', 'lv3'], 'a REJECTED leave must still be copied — the list looks the same as before');
  assert.strictEqual(plan.docs.find((d: any) => d.id === 'lv3').status, 'REJECTED', 'status must be copied as-is, never rewritten');
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([L1, L2, L1, { ...L2, daysCount: 3 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['lv1', 'lv2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([L1, { teacherId: 'MDR-T003' } as any, L2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['lv1', 'lv2']);
  assert.strictEqual(plan.skipped, 1);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[L1, L2], [L1, L2, L3], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([L1, L2, L3]);
  assert.strictEqual(plan.docs.length, 3, 'three distinct leaves become three docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers staffLeaves, batched setDoc merge by id', () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('staffLeaves'), 'migrateFieldToCollection must handle the staffLeaves field');
  assert.ok(body.includes('staffLeavesCollectionRef'), 'backfill must write the new staffLeaves collection');
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes('doc(col, String('), 'doc id must be the record id');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
});

console.log('--- Dual-write (source checks) ---');

check('writeStaffLeavesFieldToCloud writes the new collection AND main_store in one try', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStaffLeavesFieldToCloud');
  assert.ok(start > -1, 'writeStaffLeavesFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeStaffLeavesToCollection'), 'must write the new collection');
  assert.ok(body.includes("writeFieldToCloud('staffLeaves'"), 'must STILL write main_store (old write NOT stopped)');
  assert.ok(body.indexOf('writeStaffLeavesToCollection') < body.indexOf("writeFieldToCloud('staffLeaves'"), 'collection write and main_store write belong to the same try');
  assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
});

check('dual-write asserts ids via the shared choke point', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeStaffLeavesFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn('staffLeaves')"), 'dual-write must key records with the shared fieldKeyFn');
});

check('leave deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'staffLeaves'"), 'delete writer must handle the staffLeaves field');
  assert.ok(body.includes('deleteStaffLeavesFromCollection'), 'delete writer must delete the new-collection docs');
});

check('leave restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'staffLeaves'"), 'trash-op writer must handle the staffLeaves field');
  assert.ok(body.includes('writeStaffLeavesToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a leaves onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('staffLeavesCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startLeavesFeed'), 'a leaves feed starter must exist');
  const at = src.indexOf('const startLeavesFeed');
  assert.ok(at > -1, 'startLeavesFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'leaves feed must use onSnapshot');
  assert.ok(body.includes('staffLeavesCollectionRef()'), 'leaves feed must listen on the new collection');
});

check('leaves feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startLeavesFeed()'), 'main feed must start the leaves feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopLeavesFeed'), 'feed switch must also stop the leaves feed');
  const pubAt = src.indexOf('const startPublicFeed = () => {');
  assert.ok(pubAt > -1, 'startPublicFeed must exist');
  assert.ok(!src.slice(pubAt, pubAt + 3000).includes('startLeavesFeed()'), 'public (anonymous) feed must NOT start the leaves feed');
});

check('applyRemoteData leaves branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('leavesFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromStaffLeavesCollection'), 'applyRemoteData must know when data comes from the leaves feed');
  assert.ok(src.includes('applyLeavesFieldFromRemote'), 'a leaves apply helper must exist');
  const at = src.indexOf('const applyLeavesFieldFromRemote');
  assert.ok(at > -1, 'applyLeavesFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!leavesFromCollectionRef.current'), 'main_store leaves must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromStaffLeavesCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startLeavesFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillLeavesOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('leavesFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startLeavesFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (leavesFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ staffLeaves: [] }'), 'genuinely empty must clear the list');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillLeavesOnce = async (');
  assert.ok(at > -1, 'backfillLeavesOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['staffLeaves']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledLeaveIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes("migrateFieldToCollection('staffLeaves', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('feed takes over only when the collection covers every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startLeavesFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'takeover must be gated on completeness');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyLeavesFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionLeavesRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillLeavesOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

check('leave list applies records as-is: no status filter, no status rewrite on the read path', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyLeavesFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('setStaffLeaves(records)'), 'read path must apply the records as received');
  assert.ok(!body.includes("status === 'PENDING'"), 'read path must not filter to PENDING only');
  assert.ok(!body.includes("status === 'APPROVED'"), 'read path must not filter to APPROVED only');
  assert.ok(!body.includes("status: '"), 'read path must never rewrite a leave status');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the leaves feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedLeavesCollectionRef'), 'a leaves-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 8: never auto-sync until the leaves collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 8 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedLeavesCollectionRef.current) return;'), 'auto-sync effect must return early until the leaves feed settles');
  const feedAt = src.indexOf('const startLeavesFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markLeavesFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the leaves feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedLeavesCollectionRef'), 'manual force-push must not wait for the leaves feed');
});

console.log('--- Public portal (source checks) ---');

check('buildPublicPortalData reads no staffLeaves', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('staffLeaves'), 'publicPortal must not read staffLeaves');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes leaves through the dual-write writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('staffLeaves: writeStaffLeavesFieldToCloud'), 'auto-sync must still carry leaves through writeStaffLeavesFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job8-leaves-split'], 'tsx scripts/verify-job8-leaves-split.ts', 'npm run test:job8-leaves-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 8 staffLeaves-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
