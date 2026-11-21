/**
 * Job 10 (transactions split) — self-check (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job8-leaves-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job10-transactions-split.ts
 * (or npm run test:job10-transactions-split).
 *
 * Covers the Job 10 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 10,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New path is institutions/inst_madrasah_primary/transactions/{id},
 *    built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write: writeTransactionsFieldToCloud writes the new collection
 *    AND main_store in one try; the old main_store write is NOT stopped.
 *  - Deletes + restores of transactions also reach the new collection,
 *    so a deleted transaction can never be resurrected by the feed.
 *    transactions is a TRIPWIRE field: the SAME assertTripwire runs
 *    BEFORE any new-collection doc is deleted (Job 4 reorder).
 *  - Read-switch: an onSnapshot feed on the new collection is the
 *    source once it has delivered docs; main_store is the fallback
 *    until then (empty collection snapshot triggers backfill, not a
 *    wipe). A genuinely empty collection (was non-empty before) still
 *    applies as empty. AFTER takeover every non-empty snapshot
 *    applies — a fee collected on another device appears without a
 *    reload (the Job 3/Job 5 bug, fixed here).
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection,
 *    extended to 'transactions') is idempotent by id, skips id-less
 *    records, writes in 500-doc batches with setDoc merge. Counts match
 *    on RAW numbers: main_store array length = new collection doc
 *    count (demo tx-init- records copied as-is, filtered on read).
 *  - Auto-sync guard waits for the transactions feed before sync starts
 *    (hasLoadedTransactionsCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Fee rules do NOT change: exam fee stays out of monthly dues, one
 *    payment is the truth (examId linkage applied as-is, never
 *    rewritten), dues calculations untouched.
 *  - Public portal reads no transactions, so its rebuild needs no
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

const T1 = { id: 'tx-001', voucherNo: 'MR-2026-0001', type: 'INCOME', category: 'TUITION_FEE', fundType: 'GENERAL', amount: 500, date: '2026-11-21', paymentMethod: 'CASH', studentId: '2026001', studentNameBn: 'আবদুল্লাহ', classLevel: 'Class 3', feeMonth: '2026-10', payerOrPayee: 'আবদুল্লাহ', createdAt: '2026-11-21T10:00:00.000Z' };
const T2 = { id: 'tx-002', voucherNo: 'MR-2026-0002', type: 'INCOME', category: 'EXAM_FEE', fundType: 'GENERAL', amount: 300, date: '2026-11-21', paymentMethod: 'CASH', studentId: '2026002', studentNameBn: 'রুম্মান', classLevel: 'Class 6', examId: 'exam-1st-term', payerOrPayee: 'রুম্মান', createdAt: '2026-11-21T10:05:00.000Z' };
const T3 = { id: 'tx-003', voucherNo: 'DV-2026-0001', type: 'EXPENSE', category: 'MISC_EXPENSE', fundType: 'GENERAL', amount: 200, date: '2026-11-20', paymentMethod: 'CASH', payerOrPayee: 'স্টেশনারি দোকান', createdAt: '2026-11-20T09:00:00.000Z' };
const T0 = { id: 'tx-init-001', voucherNo: 'MR-2026-0000', type: 'INCOME', category: 'TUITION_FEE', fundType: 'GENERAL', amount: 0, date: '2026-01-01', paymentMethod: 'CASH', payerOrPayee: 'ডেমো', createdAt: '2026-01-01T00:00:00.000Z' };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('transactions collection ref points at institutions/inst_madrasah_primary/transactions', () => {
  assert.strictEqual(typeof cloudConfirm.transactionsCollectionRef, 'function', 'transactionsCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.transactionsCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/transactions', 'collection path must be institutions/inst_madrasah_primary/transactions');
});

check('transactions collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function transactionsCollectionRef');
  assert.ok(start > -1, 'transactionsCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every transaction id once, in order (tuition + exam fee + expense)', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([T1, T2, T3]).docs.map((d: any) => d.id), ['tx-001', 'tx-002', 'tx-003']);
});

check('backfill plan keeps the exam-fee linkage as-is (examId is the single source of truth for paid)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([T1, T2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['tx-001', 'tx-002']);
  assert.strictEqual(plan.docs.find((d: any) => d.id === 'tx-002').examId, 'exam-1st-term', 'examId must be copied as-is, never rewritten or dropped');
  assert.strictEqual(plan.docs.find((d: any) => d.id === 'tx-001').examId, undefined, 'a tuition transaction must not gain an examId');
});

check('backfill plan copies demo tx-init- records as-is (read filters them, counts stay RAW)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([T0, T1]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['tx-init-001', 'tx-001'], 'demo records are copied as-is per plan §5 step 2');
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([T1, T2, T1, { ...T2, amount: 999 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['tx-001', 'tx-002'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([T1, { voucherNo: 'MR-X' } as any, T2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['tx-001', 'tx-002']);
  assert.strictEqual(plan.skipped, 1);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[T1, T2], [T0, T1, T2, T3], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([T0, T1, T2, T3]);
  assert.strictEqual(plan.docs.length, 4, 'four distinct transactions (demo included) become four docs');
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers transactions, batched setDoc merge by id', () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('transactions'), 'migrateFieldToCollection must handle the transactions field');
  assert.ok(body.includes('transactionsCollectionRef'), 'backfill must write the new transactions collection');
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes('doc(col, String('), 'doc id must be the record id');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
});

console.log('--- Dual-write (source checks) ---');

check('writeTransactionsFieldToCloud writes the new collection AND main_store in one try', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTransactionsFieldToCloud');
  assert.ok(start > -1, 'writeTransactionsFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeTransactionsToCollection'), 'must write the new collection');
  assert.ok(body.includes("writeFieldToCloud('transactions'"), 'must STILL write main_store (old write NOT stopped)');
  assert.ok(body.indexOf('writeTransactionsToCollection') < body.indexOf("writeFieldToCloud('transactions'"), 'collection write and main_store write belong to the same try');
  assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
  assert.ok(body.includes('CONFIRM_TIMEOUT_MS'), 'fee confirm timeout must stay unchanged');
  assert.ok(body.includes("'fee cloud confirm'"), 'fee confirm label must stay unchanged');
});

check('dual-write asserts ids via the shared choke point', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTransactionsFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
  assert.ok(body.includes("fieldKeyFn('transactions')"), 'dual-write must key records with the shared fieldKeyFn');
});

check('dual-write skips the collection leg for an empty list (nothing to write yet)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTransactionsFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('if (list.length > 0)'), 'empty list must not touch the new collection');
});

console.log('--- Tripwire + deletes + restores (source checks) ---');

check('transactions stays a TRIPWIRE field and the SAME assertTripwire is reused (not copied)', () => {
  const src = readSource('services/mainStoreWrite.ts');
  assert.ok(src.includes("'transactions'"), 'transactions must stay in TRIPWIRE_FIELDS');
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(!cc.includes('export function assertTripwire'), 'cloudConfirm must reuse assertTripwire, never redefine it');
  assert.ok(cc.includes('assertTripwire('), 'cloudConfirm must call the shared assertTripwire');
});

check('transaction deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'transactions'"), 'delete writer must handle the transactions field');
  assert.ok(body.includes('deleteTransactionsFromCollection'), 'delete writer must delete the new-collection docs');
});

check('tripwire runs BEFORE any new-collection doc is deleted (Job 4 reorder — transactions is tripwire-protected)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  const tripwireAt = body.indexOf('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)');
  assert.ok(tripwireAt > -1, 'delete writer must call assertTripwire with the size maps');
  const deleteAt = body.indexOf('deleteTransactionsFromCollection');
  assert.ok(deleteAt > tripwireAt, 'a refused shrink must delete nothing anywhere — tripwire first, collection delete after');
  assert.ok(body.indexOf('deleteNoticesFromCollection') > tripwireAt, 'the reorder covers the older collection deletes too');
});

check('transaction restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'transactions'"), 'trash-op writer must handle the transactions field');
  assert.ok(body.includes('writeTransactionsToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a transactions onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('transactionsCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startTransactionsFeed'), 'a transactions feed starter must exist');
  const at = src.indexOf('const startTransactionsFeed');
  assert.ok(at > -1, 'startTransactionsFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'transactions feed must use onSnapshot');
  assert.ok(body.includes('transactionsCollectionRef()'), 'transactions feed must listen on the new collection');
});

check('transactions feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startTransactionsFeed()'), 'main feed must start the transactions feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopTransactionsFeed'), 'feed switch must also stop the transactions feed');
  const pubAt = src.indexOf('const startPublicFeed = () => {');
  assert.ok(pubAt > -1, 'startPublicFeed must exist');
  assert.ok(!src.slice(pubAt, pubAt + 3000).includes('startTransactionsFeed()'), 'public (anonymous) feed must NOT start the transactions feed');
});

check('applyRemoteData transactions branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('transactionsFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromTransactionsCollection'), 'applyRemoteData must know when data comes from the transactions feed');
  assert.ok(src.includes('applyTransactionsFieldFromRemote'), 'a transactions apply helper must exist');
  const at = src.indexOf('const applyTransactionsFieldFromRemote');
  assert.ok(at > -1, 'applyTransactionsFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!transactionsFromCollectionRef.current'), 'main_store transactions must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromTransactionsCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTransactionsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillTransactionsOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('transactionsFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTransactionsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (transactionsFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ transactions: [] }'), 'genuinely empty must clear the list');
});

check('POST-TAKEOVER: every later non-empty snapshot applies without re-checking completeness', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTransactionsFeed');
  assert.ok(at > -1, 'startTransactionsFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('transactionsFromCollectionRef.current || complete'), 'after takeover a later snapshot must apply even when main_store has not caught up yet (Job 3/Job 5 bug: feed went silent after takeover)');
  assert.ok(body.includes('applyRemoteData({ transactions: docs }, { fromTransactionsCollection: true })'), 'a post-takeover snapshot must flow through applyRemoteData as collection data');
  const applyAt = src.indexOf('const applyTransactionsFieldFromRemote');
  const applyBody = src.slice(applyAt, src.indexOf('\n  };', applyAt) + 4);
  assert.ok(applyBody.includes('opts?.fromTransactionsCollection || !transactionsFromCollectionRef.current'), 'the apply helper must let collection snapshots through unconditionally');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillTransactionsOnce = async (');
  assert.ok(at > -1, 'backfillTransactionsOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['transactions']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledTransactionIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes("migrateFieldToCollection('transactions', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('feed takes over only when the collection covers every confirmed main_store record', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTransactionsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)') || body.includes('transactionsFromCollectionRef.current || complete'), 'takeover must be gated on completeness before it first happens');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyTransactionsFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionTransactionsRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillTransactionsOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

check('transactions apply keeps the tx-init- demo filter and the examId linkage as-is', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyTransactionsFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("startsWith('tx-init-')"), 'read path must still filter demo tx-init- records, same as before');
  assert.ok(body.includes('setTransactions(cleanTransactions)'), 'read path must apply the filtered list as received');
  assert.ok(!body.includes('examId:'), 'read path must never rewrite examId — the transaction stays the single source of truth for exam-fee paid');
  assert.ok(!body.includes('feeMonth'), 'read path must not touch fee-month/dues fields');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the transactions feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedTransactionsCollectionRef'), 'a transactions-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 10: never auto-sync until the transactions collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 10 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 500);
  assert.ok(effectBody.includes('if (!hasLoadedTransactionsCollectionRef.current) return;'), 'auto-sync effect must return early until the transactions feed settles');
  const fireAt = src.indexOf('if (feedKindRef.current === \'public\' || !hasLoadedMainStoreRef.current || !hasLoadedScheduleCollectionsRef.current || !hasLoadedTransactionsCollectionRef.current) return;');
  assert.ok(fireAt > -1, 'fire-time re-validation must also wait for the transactions feed');
  const feedAt = src.indexOf('const startTransactionsFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markTransactionsFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the transactions feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedTransactionsCollectionRef'), 'manual force-push must not wait for the transactions feed');
});

console.log('--- Fee rules + public portal (source checks) ---');

check('public portal reads no transactions data (no rebuild source change needed)', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('data.transactions'), 'publicPortal must not read transactions data');
  assert.ok(!src.includes('transactions:'), 'publicPortal must not take transactions as an input');
});

check('no dues/exam-fee calculation file is touched by this job', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('monthlyTuition'), 'cloudConfirm must not touch dues calculations');
  assert.ok(!src.includes('examFee'), 'cloudConfirm must not touch exam-fee rules');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes transactions through the dual-write writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('transactions: writeTransactionsFieldToCloud'), 'auto-sync must still carry transactions through writeTransactionsFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job10-transactions-split'], 'tsx scripts/verify-job10-transactions-split.ts', 'npm run test:job10-transactions-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 10 transactions-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
