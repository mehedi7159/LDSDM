/**
 * Job 6 (remarks split) — self-check (21 Nov 2026, base 411f914).
 *
 * Follows the scripts/verify-job7-promotion-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job6-remarks-split.ts
 * (or npm run test:job6-remarks-split).
 *
 * Covers the Job 6 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 6,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New path is institutions/inst_madrasah_primary/remarks/{studentId}__{examId},
 *    built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *    RemarkRecord has NO id field — the doc id is studentId__examId
 *    (services/payloadQueue.ts fieldKeyFn('remarks')).
 *  - Dual-write: writeRemarksFieldToCloud writes the new collection AND
 *    main_store in one try; the old main_store write is NOT stopped.
 *  - Deletes + restores also reach the new collection, so a deleted
 *    remark can never be resurrected by the remarks feed.
 *  - Read-switch: an onSnapshot feed on the new collection is the source
 *    once it has delivered docs; main_store is the fallback until then
 *    (empty collection snapshot triggers backfill, not a wipe). A
 *    genuinely empty collection (was non-empty before) still applies
 *    as empty.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection with
 *    'remarks') is idempotent by studentId__examId, skips records
 *    missing studentId or examId, writes in 500-doc batches with setDoc
 *    merge. Counts match on RAW numbers: main_store array length = new
 *    collection doc count (no filtering before counting).
 *  - Auto-sync guard waits for the remarks feed before sync starts
 *    (hasLoadedRemarksCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Public portal: buildPublicPortalData output is unchanged (same
 *    input -> same output); only the rebuild SOURCE changes —
 *    rebuildPublicPortalFromCloud reads remarks from the new collection
 *    when it has docs, main_store stays the fallback.
 *  - No rules change, no main_store delete, no other field touched.
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

const R1 = { studentId: '2026001', examId: 'exam-1', remark: 'ভালো করছে', workingDays: 100, totalPresent: 95, totalAbsent: 5 };
const R2 = { studentId: '2026002', examId: 'exam-1', remark: 'আরও মনোযোগ দরকার', workingDays: 100, totalPresent: 90, totalAbsent: 10 };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('remarks collection ref points at institutions/inst_madrasah_primary/remarks', () => {
  assert.strictEqual(typeof cloudConfirm.remarksCollectionRef, 'function', 'remarksCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.remarksCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/remarks', 'collection path must be institutions/inst_madrasah_primary/remarks');
});

check('remarks collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function remarksCollectionRef');
  assert.ok(start > -1, 'remarksCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

check('remarks doc id is studentId__examId (RemarkRecord has no id field)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeRemarksToCollection');
  assert.ok(start > -1, 'writeRemarksToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("fieldKeyFn('remarks')"), 'doc id must come from the shared remarks key fn');
  assert.ok(body.includes('__'), 'doc id must join studentId and examId with __');
});

console.log('--- Backfill plan (pure, idempotent by studentId__examId, RAW counts) ---');

check('backfill plan keeps every studentId__examId once, in order', () => {
  assert.strictEqual(typeof migrationSplit.remarksBackfillPlan, 'function', 'remarksBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.remarksBackfillPlan([R1, R2]).docs.map((d: any) => `${d.studentId}__${d.examId}`), ['2026001__exam-1', '2026002__exam-1']);
});

check('backfill plan dedupes the same studentId__examId (second run writes the same docs)', () => {
  const plan = migrationSplit.remarksBackfillPlan([R1, R2, R1, { ...R2, remark: 'বদলানো' }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => `${d.studentId}__${d.examId}`), ['2026001__exam-1', '2026002__exam-1'], 'duplicate keys collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips records missing studentId or examId (they can never be keyed)', () => {
  const plan = migrationSplit.remarksBackfillPlan([R1, { examId: 'exam-1', remark: 'x' } as any, { studentId: '2026003', remark: 'y' } as any, R2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => `${d.studentId}__${d.examId}`), ['2026001__exam-1', '2026002__exam-1']);
  assert.strictEqual(plan.skipped, 2);
});

check('backfill plan of an empty list is empty (no remark written yet)', () => {
  const plan = migrationSplit.remarksBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[R1, R2], [R1], []]) {
    const plan = migrationSplit.remarksBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.remarksBackfillPlan([R1, R2]);
  assert.strictEqual(plan.docs.length, 2, 'two distinct records become two docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check("migrateFieldToCollection covers 'remarks', batched setDoc merge by studentId__examId", () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes("fieldKeyFn(field)"), 'doc id must come from the shared fieldKeyFn (studentId__examId for remarks)');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
  assert.ok(body.includes('remarksCollectionRef'), 'backfill must write the remarks collection for this field');
  assert.ok(body.includes("'remarks'"), "backfill must handle the 'remarks' field");
});

console.log('--- Dual-write (source checks) ---');

check('writeRemarksFieldToCloud writes the new collection AND main_store in one try', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeRemarksFieldToCloud');
  assert.ok(start > -1, 'writeRemarksFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeRemarksToCollection'), 'must write the new collection');
  assert.ok(body.includes("writeFieldsToCloud({ remarks }"), 'must STILL write main_store (old write NOT stopped)');
  assert.ok(body.indexOf('writeRemarksToCollection') < body.indexOf("writeFieldsToCloud({ remarks }"), 'collection write and main_store write belong to the same try');
  assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
});

check('dual-write asserts keys via the shared choke point (studentId+examId)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeRemarksFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn('remarks')"), 'dual-write must key records with the shared fieldKeyFn');
});

check('remark deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'remarks'"), 'delete writer must handle the remarks field');
  assert.ok(body.includes('deleteRemarksFromCollection'), 'delete writer must delete the new-collection docs');
});

check('remark restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'remarks'"), 'trash-op writer must handle the remarks field');
  assert.ok(body.includes('writeRemarksToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a remarks onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('remarksCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startRemarksFeed'), 'a remarks feed starter must exist');
  const at = src.indexOf('const startRemarksFeed');
  assert.ok(at > -1, 'startRemarksFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'remarks feed must use onSnapshot');
  assert.ok(body.includes('remarksCollectionRef()'), 'remarks feed must listen on the new collection');
});

check('remarks feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startRemarksFeed()'), 'main feed must start the remarks feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopRemarksFeed'), 'feed switch must also stop the remarks feed');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startRemarksFeed()'), 'public (anonymous) feed must NOT start the remarks feed');
});

check('applyRemoteData remarks branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('remarksFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromRemarksCollection'), 'applyRemoteData must know when data comes from a remarks feed');
  assert.ok(src.includes('backfillRemarksOnce'), 'a remarks backfill helper must exist');
  const at = src.indexOf('if (data.remarks && Array.isArray(data.remarks))');
  assert.ok(at > -1, 'remarks branch must exist in applyRemoteData');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('!remarksFromCollectionRef.current'), 'main_store remarks must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromRemarksCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startRemarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillRemarksOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('remarksFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startRemarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (remarksFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ remarks: [] }'), 'genuinely empty must clear the list');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillRemarksOnce = async (source?:');
  assert.ok(at > -1, 'backfillRemarksOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['remarks']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledRemarkKeysRef'), 'backfill must skip keys it already copied');
  assert.ok(body.includes("migrateFieldToCollection('remarks', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('feed takes over only when the collection covers every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startRemarksFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'takeover must be gated on completeness');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.remarks && Array.isArray(data.remarks))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionRemarksRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillRemarksOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the remarks feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedRemarksCollectionRef'), 'a remarks-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 6: never auto-sync until the remarks collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 6 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 700);
  assert.ok(effectBody.includes('if (!hasLoadedRemarksCollectionRef.current) return;'), 'auto-sync effect must return early until the remarks feed settles');
  // A feed error also settles, so a dead listener can never block sync forever.
  const feedAt = src.indexOf('const startRemarksFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markRemarksFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the remarks feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedRemarksCollectionRef'), 'manual force-push must not wait for the remarks feed');
});

console.log('--- Public portal (source + output checks) ---');

check('buildPublicPortalData output is unchanged for the same input (only its rebuild source moves)', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(src.includes('remarks: pickList(source.remarks,'), 'portal builder must still derive remarks the same way');
});

check('portal rebuild reads remarks from the new collection when it has docs, main_store stays the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readRemarksFromCollection'), 'rebuild must read the remarks collection');
  assert.ok(body.includes('colRemarks'), 'rebuild must prefer collection remarks when they exist');
  assert.ok(body.includes('remarks'), 'rebuild must still pass remarks to the portal builder');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes remarks through the dual-write writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('remarks: writeRemarksFieldToCloud'), 'auto-sync must still carry remarks through writeRemarksFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job6-remarks-split'], 'tsx scripts/verify-job6-remarks-split.ts', 'npm run test:job6-remarks-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 6 remarks-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
