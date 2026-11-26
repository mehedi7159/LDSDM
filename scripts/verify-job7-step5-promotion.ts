/**
 * Job 7 step 5 (promotionHistory split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert + tsx,
 * no test framework. Run: npx tsx scripts/verify-job7-step5-promotion.ts
 * (or npm run test:job7-step5-promotion).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store promotionHistory write after the dual-write soak:
 *  - writePromotionHistoryFieldToCloud writes the new collection ONLY — the
 *    writeFieldsToCloud({ promotionHistory: records }, ...) main_store leg
 *    is gone.
 *  - main_store.promotionHistory is NOT deleted — it stays as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmPromotionHistoryCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the promotionHistory entry — removing the entry
 *    would stop promotion history syncing entirely.)
 *  - Delete + restore still touch main_store promotionHistory (prune on
 *    delete, union on restore), so the frozen copy can never resurrect a
 *    cleared record via the backfill or the portal fallback:
 *    main_store.promotionHistory stays a subset of the collection.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue. Public portal reads no promotionHistory, so its
 *    rebuild needs no source change.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: promotionHistory is append-only history (never edited) — the
 * change only stops the old copy from growing. Dual-write ran since the
 * Job 7 steps 1–3 push (21 Nov 2026); step 5 lands 26 Nov 2026.
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

const promotionWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writePromotionHistoryFieldToCloud');
  assert.ok(start > -1, 'writePromotionHistoryFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writePromotionHistoryFieldToCloud still writes the new collection', () => {
  const body = promotionWriterBody();
  assert.ok(body.includes('writePromotionHistoryToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writePromotionHistoryFieldToCloud no longer writes main_store promotionHistory', () => {
  const body = promotionWriterBody();
  assert.ok(!body.includes('writeFieldsToCloud({ promotionHistory: records }'), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the promotion writer');
});

check('no other main_store promotionHistory upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('writeFieldsToCloud({ promotionHistory: records }'), 'no writeFieldsToCloud(promotionHistory) call may remain anywhere');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes promotionHistory through writePromotionHistoryFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('promotionHistory: writePromotionHistoryFieldToCloud'), 'auto-sync must still carry promotionHistory (now collection-only)');
});

check('queued-payload replay still routes promotionHistory through writePromotionHistoryFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('promotionHistory: writePromotionHistoryFieldToCloud'), 'replay must still carry promotionHistory (now collection-only)');
});

check('confirmPromotionHistoryCloudSync still uses writePromotionHistoryFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmPromotionHistoryCloudSync');
  assert.ok(at > -1, 'confirmPromotionHistoryCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writePromotionHistoryFieldToCloud(list, confirmActorName())'), 'promotion save confirm must still call the promotion writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('promotion deletes still delete the collection docs AND prune main_store promotionHistory', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'promotionHistory'"), 'delete writer must still handle the promotionHistory field');
  assert.ok(body.includes('deletePromotionHistoryFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a cleared record)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('promotion restores still write the collection AND union main_store promotionHistory', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'promotionHistory'"), 'trash-op writer must still handle the promotionHistory field');
  assert.ok(body.includes('writePromotionHistoryToCollection'), 'restore must still write the record back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the record into main_store');
});

console.log('--- Read path untouched ---');

check('promotion feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startPromotionHistoryFeed'), 'startPromotionHistoryFeed must exist');
  assert.ok(src.includes('promotionHistoryFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillPromotionHistoryOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ promotionHistory: docs }, { fromPromotionHistoryCollection: true })"), 'feed must still apply collection snapshots');
});

check('public portal still reads no promotionHistory', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('promotionHistory'), 'publicPortal must not read promotionHistory');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteField"), 'the frozen promotionHistory field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job7-step5-promotion'], 'tsx scripts/verify-job7-step5-promotion.ts', 'npm run test:job7-step5-promotion must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 7 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
