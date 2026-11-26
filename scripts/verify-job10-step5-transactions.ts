/**
 * Job 10 step 5 (transactions split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job10-step5-transactions.ts
 * (or npm run test:job10-step5-transactions).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store transactions write after the dual-write soak:
 *  - writeTransactionsFieldToCloud writes the new collection ONLY — the
 *    writeFieldToCloud('transactions', ...) main_store leg is gone.
 *  - main_store.transactions is NOT deleted — it stays as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmFeeCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the transactions entry — removing the entry
 *    would stop fee syncing entirely.)
 *  - Delete + restore still touch main_store transactions (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted transaction via the backfill or the portal fallback:
 *    main_store.transactions stays a subset of the collection.
 *  - transactions is a TRIPWIRE-protected list: it stays in
 *    TRIPWIRE_FIELDS and assertTripwire still runs BEFORE any
 *    new-collection doc is deleted (Job 4 reorder) — untouched.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue, portal rebuild (portal reads no transactions).
 *  - Money rules do not change: exam fee never enters monthly dues,
 *    one payment record only — this is location only.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: dual-write ran since the Job 10 split (21 Nov 2026, #43);
 * the plan counted 0 transactions at plan time (6 Nov). The soak is
 * 5 days, short of the plan's one week — recorded here, not hidden;
 * with the frozen copy kept and delete/restore still pruning/unioning
 * main_store, a rollback is one line (re-add the leg) and no record
 * can be lost by stopping the leg.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const transactionsWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTransactionsFieldToCloud');
  assert.ok(start > -1, 'writeTransactionsFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writeTransactionsFieldToCloud still writes the new collection', () => {
  const body = transactionsWriterBody();
  assert.ok(body.includes('writeTransactionsToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
  assert.ok(body.includes('CONFIRM_TIMEOUT_MS'), 'fee confirm timeout must stay unchanged');
  assert.ok(body.includes("'fee cloud confirm'"), 'fee confirm label must stay unchanged');
});

check('writeTransactionsFieldToCloud no longer writes main_store transactions', () => {
  const body = transactionsWriterBody();
  assert.ok(!body.includes("writeFieldToCloud('transactions'"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the transactions writer');
});

check('no other main_store transactions upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("writeFieldToCloud('transactions'"), 'no writeFieldToCloud(transactions) call may remain anywhere');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes transactions through writeTransactionsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('transactions: writeTransactionsFieldToCloud'), 'auto-sync must still carry transactions (now collection-only)');
});

check('queued-payload replay still routes transactions through writeTransactionsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('transactions: writeTransactionsFieldToCloud'), 'replay must still carry transactions (now collection-only)');
});

check('confirmFeeCloudSync still uses writeTransactionsFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmFeeCloudSync');
  assert.ok(at > -1, 'confirmFeeCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeTransactionsFieldToCloud(list, confirmActorName())'), 'fee save confirm must still call the transactions writer');
});

console.log('--- Tripwire still protects transactions (untouched) ---');

check('transactions stays a TRIPWIRE field and the SAME assertTripwire is reused (not copied)', () => {
  const src = readSource('services/mainStoreWrite.ts');
  assert.ok(src.includes("'transactions'"), 'transactions must stay in TRIPWIRE_FIELDS');
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(!cc.includes('export function assertTripwire'), 'cloudConfirm must reuse assertTripwire, never redefine it');
  assert.ok(cc.includes('assertTripwire('), 'cloudConfirm must call the shared assertTripwire');
});

check('tripwire runs BEFORE any new-collection transaction doc is deleted (Job 4 reorder)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  const tripwireAt = body.indexOf('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)');
  assert.ok(tripwireAt > -1, 'delete writer must call assertTripwire with the size maps');
  const deleteAt = body.indexOf('deleteTransactionsFromCollection');
  assert.ok(deleteAt > tripwireAt, 'a refused shrink must delete nothing anywhere — tripwire first, collection delete after');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('transaction deletes still delete the collection docs AND prune main_store transactions', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'transactions'"), 'delete writer must still handle the transactions field');
  assert.ok(body.includes('deleteTransactionsFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted transaction)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('transaction restores still write the collection AND union main_store transactions', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'transactions'"), 'trash-op writer must still handle the transactions field');
  assert.ok(body.includes('writeTransactionsToCollection'), 'restore must still write the transaction back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the transaction into main_store');
});

console.log('--- Read path untouched ---');

check('transactions feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startTransactionsFeed'), 'startTransactionsFeed must exist');
  assert.ok(src.includes('transactionsFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillTransactionsOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ transactions: docs }, { fromTransactionsCollection: true })"), 'feed must still apply collection snapshots');
});

check('public portal still reads no transactions data', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('data.transactions'), 'publicPortal must not read transactions data');
  assert.ok(!src.includes('transactions:'), 'publicPortal must not take transactions as an input');
});

console.log('--- Money rules + frozen copy ---');

check('no dues/exam-fee calculation is touched by this job', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('monthlyTuition'), 'cloudConfirm must not touch dues calculations');
  assert.ok(!src.includes('examFee'), 'cloudConfirm must not touch exam-fee rules');
});

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteField"), 'the frozen transactions field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job10-step5-transactions'], 'tsx scripts/verify-job10-step5-transactions.ts', 'npm run test:job10-step5-transactions must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 10 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
