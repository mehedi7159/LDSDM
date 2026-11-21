/**
 * Job 1 step 5 (notices split) — self-check (21 Nov 2026, base commit 0b7c9dd).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-job1-step5-notices.ts
 * (or npm run test:job1-step5-notices).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store notices write after the dual-write soak:
 *  - writeNoticesFieldToCloud writes the new collection ONLY — the
 *    writeFieldToCloud('notices', ...) main_store leg is gone.
 *  - main_store.notices is NOT deleted — it stays as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and confirmNoticesCloudSync.
 *    (The plan's "pushDiffToCloud থেকে field বাদ" means the old
 *    main_store leg, NOT the notices entry — removing the entry would
 *    stop notices syncing entirely.)
 *  - Delete + restore still touch main_store notices (prune on delete,
 *    union on restore), so the frozen copy can never resurrect a
 *    deleted notice via the backfill or the portal fallback:
 *    main_store.notices stays a subset of the collection.
 *  - Read path untouched: collection feed + takeover gate, backfill,
 *    straggler rescue, portal rebuild preferring the collection.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Context: notices count is 0 in the new project ldsdmms (backup JSON
 * had 0 notices; 21 Nov morning audit showed 0). Dual-write ran 10
 * days in the old project (10–20 Nov, meets the plan's one week) but
 * only ~1 day in the new project — with 0 records the data risk is
 * nil; the soak shortfall is recorded, not hidden.
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

const noticesWriterBody = () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeNoticesFieldToCloud');
  assert.ok(start > -1, 'writeNoticesFieldToCloud must exist');
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5: old main_store upsert leg stopped ---');

check('writeNoticesFieldToCloud still writes the new collection', () => {
  const body = noticesWriterBody();
  assert.ok(body.includes('writeNoticesToCollection'), 'must still write the new collection');
  assert.ok(body.includes('assertUpsertRecords'), 'must still reuse assertUpsertRecords');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeNoticesFieldToCloud no longer writes main_store notices', () => {
  const body = noticesWriterBody();
  assert.ok(!body.includes("writeFieldToCloud('notices'"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('writeFieldsToCloud'), 'no main_store write path may remain in the notices writer');
});

check('no other main_store notices upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes("writeFieldToCloud('notices'"), 'no writeFieldToCloud(notices) call may remain anywhere');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes notices through writeNoticesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('notices: writeNoticesFieldToCloud'), 'auto-sync must still carry notices (now collection-only)');
});

check('queued-payload replay still routes notices through writeNoticesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const fieldWriter: Record<string, (records: any[], actor: string) => Promise<void>>');
  assert.ok(at > -1, 'queue replay fieldWriter must exist');
  const body = src.slice(at, at + 2500);
  assert.ok(body.includes('notices: writeNoticesFieldToCloud'), 'replay must still carry notices (now collection-only)');
});

check('confirmNoticesCloudSync still uses writeNoticesFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmNoticesCloudSync');
  assert.ok(at > -1, 'confirmNoticesCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeNoticesFieldToCloud(list, confirmActorName())'), 'notice save confirm must still call the notices writer');
});

console.log('--- Frozen copy stays consistent (delete + restore still prune/union main_store) ---');

check('notice deletes still delete the collection docs AND prune main_store notices', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'notices'"), 'delete writer must still handle the notices field');
  assert.ok(body.includes('deleteNoticesFromCollection'), 'delete must still delete the new-collection docs');
  assert.ok(body.includes("doc(db, 'institution', 'main_store')"), 'delete must still prune main_store (so the frozen copy never resurrects a deleted notice)');
  assert.ok(body.includes('setDoc(ref, payload, { merge: true })'), 'delete must still write the pruned main_store payload');
});

check('notice restores still write the collection AND union main_store notices', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'notices'"), 'trash-op writer must still handle the notices field');
  assert.ok(body.includes('writeNoticesToCollection'), 'restore must still write the notice back to the new collection');
  assert.ok(body.includes('payload[field] = mergeRecordsByKey'), 'restore must still union the notice into main_store');
});

console.log('--- Read path untouched ---');

check('notices feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startNoticesFeed'), 'startNoticesFeed must exist');
  assert.ok(src.includes('noticesFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillNoticesOnce'), 'backfill must still exist');
  assert.ok(src.includes('stragglers'), 'straggler rescue must still exist');
  assert.ok(src.includes("applyRemoteData({ notices: docs }, { fromNoticesCollection: true })"), 'feed must still apply collection snapshots');
});

check('portal rebuild still prefers the collection, main_store as fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readNoticesFromCollection'), 'portal rebuild must read the new collection');
  assert.ok(body.includes('colNotices.length > 0'), 'portal rebuild must use the collection when it has docs');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteField"), 'the frozen notices field must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job1-step5-notices'], 'tsx scripts/verify-job1-step5-notices.ts', 'npm run test:job1-step5-notices must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 1 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
