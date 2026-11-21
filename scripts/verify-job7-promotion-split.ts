/**
 * Job 7 (promotionHistory split) — self-check (21 Nov 2026, base 411f914).
 *
 * Follows the scripts/verify-job2-schedule-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job7-promotion-split.ts
 * (or npm run test:job7-promotion-split).
 *
 * Covers the Job 7 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 7,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New path is institutions/inst_madrasah_primary/promotionHistory/{id},
 *    built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write: writePromotionHistoryFieldToCloud writes the new
 *    collection AND main_store in one try; the old main_store write is
 *    NOT stopped.
 *  - Deletes (clear history) + restores also reach the new collection,
 *    so a cleared record can never be resurrected by the promotion feed.
 *  - Read-switch: an onSnapshot feed on the new collection is the source
 *    once it has delivered docs; main_store is the fallback until then
 *    (empty collection snapshot triggers backfill, not a wipe). A
 *    genuinely empty collection (was non-empty before) still applies
 *    as empty.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection with
 *    'promotionHistory') is idempotent by id, skips id-less records,
 *    writes in 500-doc batches with setDoc merge. Counts match on RAW
 *    numbers: main_store array length = new collection doc count (no
 *    filtering before counting).
 *  - Auto-sync guard waits for the promotion feed before sync starts
 *    (hasLoadedPromotionHistoryCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Public portal reads no promotionHistory, so its rebuild needs no
 *    source change.
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

const H1 = { id: 'ph-1', timestamp: '2026-03-01T10:00:00.000Z', date: '2026-03-01', sourceClass: 'Class 5', targetClass: 'Class 6', academicYear: '2026', targetAcademicYear: '2027', totalEvaluated: 20, totalPromoted: 18, totalRetained: 2, totalGraduated: 0, promotedBy: 'Principal', students: [] };
const H2 = { id: 'ph-2', timestamp: '2026-03-01T11:00:00.000Z', date: '2026-03-01', sourceClass: 'Class 9', targetClass: 'Class 10', academicYear: '2026', targetAcademicYear: '2027', totalEvaluated: 15, totalPromoted: 15, totalRetained: 0, totalGraduated: 0, promotedBy: 'Principal', students: [] };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('promotionHistory collection ref points at institutions/inst_madrasah_primary/promotionHistory', () => {
  assert.strictEqual(typeof cloudConfirm.promotionHistoryCollectionRef, 'function', 'promotionHistoryCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.promotionHistoryCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/promotionHistory', 'collection path must be institutions/inst_madrasah_primary/promotionHistory');
});

check('promotionHistory collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function promotionHistoryCollectionRef');
  assert.ok(start > -1, 'promotionHistoryCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every id once, in order', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([H1, H2]).docs.map((d: any) => d.id), ['ph-1', 'ph-2']);
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([H1, H2, H1, { ...H2, totalPromoted: 14 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['ph-1', 'ph-2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([H1, { sourceClass: 'Class 5' } as any, H2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['ph-1', 'ph-2']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan of an empty list is empty (no promotion has run yet)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[H1, H2], [H1], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([H1, H2]);
  assert.strictEqual(plan.docs.length, 2, 'two distinct records become two docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check("migrateFieldToCollection covers 'promotionHistory', batched setDoc merge by id", () => {
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
  assert.ok(body.includes('promotionHistoryCollectionRef'), 'backfill must write the promotionHistory collection for this field');
  assert.ok(body.includes("'promotionHistory'"), "backfill must handle the 'promotionHistory' field");
});

console.log('--- Dual-write (source checks) ---');

check('writePromotionHistoryFieldToCloud writes the new collection AND main_store in one try', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writePromotionHistoryFieldToCloud');
  assert.ok(start > -1, 'writePromotionHistoryFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writePromotionHistoryToCollection'), 'must write the new collection');
  assert.ok(body.includes("writeFieldsToCloud({ promotionHistory: records }"), 'must STILL write main_store (old write NOT stopped)');
  assert.ok(body.indexOf('writePromotionHistoryToCollection') < body.indexOf("writeFieldsToCloud({ promotionHistory: records }"), 'collection write and main_store write belong to the same try');
  assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
});

check('dual-write asserts ids via the shared choke point', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writePromotionHistoryFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn('promotionHistory')"), 'dual-write must key records with the shared fieldKeyFn');
});

check('promotion deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'promotionHistory'"), 'delete writer must handle the promotionHistory field');
  assert.ok(body.includes('deletePromotionHistoryFromCollection'), 'delete writer must delete the new-collection docs');
});

check('promotion restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'promotionHistory'"), 'trash-op writer must handle the promotionHistory field');
  assert.ok(body.includes('writePromotionHistoryToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a promotionHistory onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('promotionHistoryCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startPromotionHistoryFeed'), 'a promotion feed starter must exist');
  const at = src.indexOf('const startPromotionHistoryFeed');
  assert.ok(at > -1, 'startPromotionHistoryFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'promotion feed must use onSnapshot');
  assert.ok(body.includes('promotionHistoryCollectionRef()'), 'promotion feed must listen on the new collection');
});

check('promotion feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startPromotionHistoryFeed()'), 'main feed must start the promotion feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopPromotionHistoryFeed'), 'feed switch must also stop the promotion feed');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startPromotionHistoryFeed()'), 'public (anonymous) feed must NOT start the promotion feed');
});

check('applyRemoteData promotionHistory branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('promotionHistoryFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromPromotionHistoryCollection'), 'applyRemoteData must know when data comes from a promotion feed');
  assert.ok(src.includes('backfillPromotionHistoryOnce'), 'a promotion backfill helper must exist');
  const at = src.indexOf('if (data.promotionHistory && Array.isArray(data.promotionHistory))');
  assert.ok(at > -1, 'promotionHistory branch must exist in applyRemoteData');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('!promotionHistoryFromCollectionRef.current'), 'main_store promotionHistory must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromPromotionHistoryCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startPromotionHistoryFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillPromotionHistoryOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('promotionHistoryFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startPromotionHistoryFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (promotionHistoryFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ promotionHistory: [] }'), 'genuinely empty must clear the list');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillPromotionHistoryOnce = async (source?:');
  assert.ok(at > -1, 'backfillPromotionHistoryOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['promotionHistory']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledPromotionHistoryIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes("migrateFieldToCollection('promotionHistory', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('feed takes over only when the collection covers every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startPromotionHistoryFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'takeover must be gated on completeness');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.promotionHistory && Array.isArray(data.promotionHistory))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionPromotionHistoryRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillPromotionHistoryOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the promotion feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedPromotionHistoryCollectionRef'), 'a promotion-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 7: never auto-sync until the promotion collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 7 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 700);
  assert.ok(effectBody.includes('if (!hasLoadedPromotionHistoryCollectionRef.current) return;'), 'auto-sync effect must return early until the promotion feed settles');
  // A feed error also settles, so a dead listener can never block sync forever.
  const feedAt = src.indexOf('const startPromotionHistoryFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markPromotionHistoryFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the promotion feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedPromotionHistoryCollectionRef'), 'manual force-push must not wait for the promotion feed');
});

console.log('--- Public portal (source checks) ---');

check('buildPublicPortalData reads no promotionHistory', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('promotionHistory'), 'publicPortal must not read promotionHistory');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes promotionHistory through the dual-write writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('promotionHistory: writePromotionHistoryFieldToCloud'), 'auto-sync must still carry promotionHistory through writePromotionHistoryFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job7-promotion-split'], 'tsx scripts/verify-job7-promotion-split.ts', 'npm run test:job7-promotion-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 7 promotion-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
