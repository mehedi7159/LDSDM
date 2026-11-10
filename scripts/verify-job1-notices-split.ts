/**
 * Job 1 (notices split) — self-check (10 Nov 2026, base commit 7483b20).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-job1-notices-split.ts
 * (or npm run test:job1-notices-split).
 *
 * Covers the Job 1 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 1,
 * LDSDM-job1-go-ahead-2026-11-09.md):
 *  - New path is institutions/inst_madrasah_primary/notices/{id}, built
 *    from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write: writeNoticesFieldToCloud writes the new collection AND
 *    main_store in one try; the old main_store write is NOT stopped.
 *  - Deletes + restores of notices also reach the new collection, so a
 *    deleted notice can never be resurrected by the notices feed.
 *  - Read-switch: the notices feed (onSnapshot on the new collection) is
 *    the source once it has delivered docs; main_store notices are the
 *    fallback until then (empty collection snapshot triggers backfill,
 *    not a wipe). A genuinely empty collection (was non-empty before)
 *    still applies as empty.
 *  - Backfill (services/migrationSplit.ts) is idempotent by id, skips
 *    id-less records, writes in 500-doc batches with setDoc merge.
 *  - Public portal rebuild reads notices from the new collection, with
 *    main_store notices as fallback when the collection is empty.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Firestore-touching code lives in React/services modules, so the feed,
 * dual-write wiring and portal rebuild are covered by source-order
 * assertions (the repo's established grep-proof style) plus real unit
 * checks on the pure parts (collection path, backfill plan).
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

const N1 = { id: 'n1', title: 'পরীক্ষা', content: 'ক্লাস ৬', category: 'exam', priority: 'normal', target: 'all', createdAt: '2026-11-10T00:00:00.000Z' };
const N2 = { id: 'n2', title: 'ছুটি', content: 'ঈদ', category: 'holiday', priority: 'normal', target: 'all', createdAt: '2026-11-10T00:00:00.000Z' };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('noticesCollectionRef points at institutions/inst_madrasah_primary/notices', () => {
  assert.strictEqual(typeof cloudConfirm.noticesCollectionRef, 'function', 'noticesCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.noticesCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/notices', 'collection path must be institutions/inst_madrasah_primary/notices');
});

check('noticesCollectionRef is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function noticesCollectionRef');
  assert.ok(start > -1, 'noticesCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id) ---');

check('backfill plan keeps every id once, in order', () => {
  assert.strictEqual(typeof migrationSplit.noticesBackfillPlan, 'function', 'noticesBackfillPlan must be exported from migrationSplit');
  const plan = migrationSplit.noticesBackfillPlan([N1, N2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['n1', 'n2']);
  assert.strictEqual(plan.skipped, 0);
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.noticesBackfillPlan([N1, N2, N1, { ...N2, title: 'বদলানো' }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['n1', 'n2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.noticesBackfillPlan([N1, { title: 'নাম নেই' } as any, N2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['n1', 'n2']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan of an empty list is empty', () => {
  const plan = migrationSplit.noticesBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check('migrateNoticesToCollection uses writeBatch + setDoc merge, doc id = record id', () => {
  const src = readSource('services/migrationSplit.ts');
  assert.ok(src.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(src.includes('setDoc') || src.includes('batch.set'), 'backfill must setDoc each notice');
  assert.ok(src.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(src.includes('String(n.id)') || src.includes('String((n as any).id)') || src.includes('doc(col, String('), 'doc id must be the record id');
  assert.ok(src.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
});

console.log('--- Dual-write (source checks) ---');

check('writeNoticesFieldToCloud writes the new collection AND main_store in one try', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeNoticesFieldToCloud');
  assert.ok(start > -1, 'writeNoticesFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeNoticesToCollection'), 'must write the new collection');
  assert.ok(body.includes("writeFieldToCloud('notices'"), 'must STILL write main_store (old write NOT stopped)');
  assert.ok(body.indexOf('writeNoticesToCollection') < body.indexOf("writeFieldToCloud('notices'"), 'collection write and main_store write belong to the same try');
  assert.ok(body.includes('withTimeout'), 'dual-write must stay inside the confirm timeout');
});

check('writeNoticesToCollection asserts ids via the shared choke point', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeNoticesFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
});

check('notice deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'notices'"), 'delete writer must handle the notices field');
  assert.ok(body.includes('deleteNoticesFromCollection'), 'delete writer must delete the new-collection docs');
});

check('notice restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'notices'"), 'trash-op writer must handle the notices field');
  assert.ok(body.includes('writeNoticesToCollection'), 'restore must write the notice back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a notices onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('noticesCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startNoticesFeed'), 'a notices feed starter must exist');
  const at = src.indexOf('const startNoticesFeed');
  assert.ok(at > -1, 'startNoticesFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'notices feed must use onSnapshot');
  assert.ok(body.includes('noticesCollectionRef()'), 'notices feed must listen on the new collection');
});

check('notices feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startNoticesFeed()'), 'main feed must start the notices feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopNoticesFeed'), 'feed switch must also stop the notices feed');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startNoticesFeed()'), 'public (anonymous) feed must NOT start the notices feed');
});

check('applyRemoteData notices branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('noticesFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromNoticesCollection'), 'applyRemoteData must know when data comes from the notices feed');
  const nb = src.indexOf("if (data.notices && Array.isArray(data.notices)) {");
  assert.ok(nb > -1, 'applyRemoteData must have a notices branch');
  const branch = src.slice(nb, nb + 700);
  assert.ok(branch.includes('!noticesFromCollectionRef.current'), 'main_store notices must be skipped once the collection is the source');
  assert.ok(branch.includes('opts?.fromNoticesCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startNoticesFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillNoticesOnce') || body.includes('migrateNoticesToCollection'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('noticesFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startNoticesFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (noticesFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes("applyRemoteData({ notices: [] }"), 'genuinely empty must clear the list');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillNoticesOnce = async (source?: NoticeItem[]) => {');
  assert.ok(at > -1, 'backfillNoticesOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['notices']"), 'backfill must copy the confirmed main_store list');
  assert.ok(!body.includes('noticesRef.current'), 'backfill must NOT copy local state (it may hold a notice deleted elsewhere)');
  assert.ok(body.includes('backfilledNoticeIdsRef'), 'backfill must skip ids it already copied');
});

check('feed takes over only when the collection covers every confirmed main_store notice', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startNoticesFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('knownIds'), 'feed must know the confirmed main_store ids');
  assert.ok(body.includes('colIds'), 'feed must know the collection ids');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('if (complete)'), 'takeover must be gated on completeness');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const nb = src.indexOf("if (data.notices && Array.isArray(data.notices)) {");
  assert.ok(nb > -1, 'applyRemoteData must have a notices branch');
  const branch = src.slice(nb, nb + 2200);
  assert.ok(branch.includes('stragglers'), 'branch must detect main_store notices missing from the collection');
  assert.ok(branch.includes('lastCollectionNoticesRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(branch.includes('backfillNoticesOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Public portal rebuild (source checks) ---');

check('rebuildPublicPortalFromCloud reads notices from the new collection, main_store as fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readNoticesFromCollection'), 'portal rebuild must read the new collection');
  assert.ok(body.includes('colNotices.length > 0'), 'portal rebuild must use the collection only when it has docs');
  assert.ok(body.includes('buildPublicPortalData({ ...data, notices })') || body.includes('buildPublicPortalData({'), 'portal rebuild must pass the chosen notices into buildPublicPortalData');
});

console.log('--- Old write NOT stopped (source checks) ---');

check('pushDiffToCloud still writes notices through the dual-write writer', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('notices: writeNoticesFieldToCloud'), 'auto-sync must still carry notices through writeNoticesFieldToCloud');
});

check('no Firestore rules change and no main_store delete in this job', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('deleteDoc(doc(db, \'institution\', \'main_store\')'), 'main_store must never be deleted');
  const appSrc = readSource('context/AppContext.tsx');
  assert.ok(!appSrc.includes('deleteDoc(doc(db, \'institution\', \'main_store\')'), 'main_store must never be deleted');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job1-notices-split'], 'tsx scripts/verify-job1-notices-split.ts', 'npm run test:job1-notices-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 1 notices-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
