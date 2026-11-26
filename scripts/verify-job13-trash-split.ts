/**
 * Job 13 (trashBin → trash collection + delete rules) — self-check
 * (21 Nov 2026, base 411f914).
 *
 * Follows the scripts/verify-job7-promotion-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job13-trash-split.ts
 * (or npm run test:job13-trash-split).
 *
 * Covers the Job 13 spec (LDSDM-database-split-plan-2026-11-07.md §6
 * Job 13, §5 steps 1–3, plus the step-5 decision of 26 Nov 2026):
 * step 5 decided case (b) — verify-only, NO behaviour change. There
 * is NO upsert writer for trashBin to stop (no
 * writeTrashBinFieldToCloud, no writeFieldsToCloud({ trashBin })),
 * so there is no old upsert leg to remove; the union/prune legs in
 * writeDeleteFieldsToCloud / writeTrashOpToCloud are maintenance
 * (Job 1 precedent) and stay, because the read path is not fully
 * collection-based — main_store.trashBin is still the pre-takeover
 * fallback and the post-takeover removal authority the feed's
 * exact-match gate compares against. See
 * scripts/verify-job13-step5-trash.ts for the full evidence.
 *  - New path is institutions/inst_madrasah_primary/trash/{id}
 *    (doc id = TrashItem.id), built from
 *    CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Dual-write (step 5 case (b): the maintenance shape, it stays):
 *    writeDeleteFieldsToCloud writes trash entries to the new
 *    collection AND unions them into main_store.trashBin in one
 *    try; writeTrashOpToCloud prunes them from main_store.trashBin
 *    and deletes the trash docs from the new collection. The
 *    main_store legs are maintenance, not an upsert leg — stopping
 *    them would break deletes/restores for the principal
 *    (non-super-admin), see verify-job13-step5-trash.ts.
 *  - Rules limit (plan points 1–3): trash entry first (any logged-in
 *    user can setDoc); then the real doc delete is attempted
 *    (deleteDoc) — the super admin succeeds, anyone else gets
 *    permission-denied and the doc STAYS, but the trash filter hides
 *    it from lists. Restore = delete the trash entry + re-write the
 *    record; permanent delete from trash = super admin only
 *    (firestore.rules isSuperAdmin() checks the owner EMAIL only —
 *    the principal's {role:'admin'} claim never grants deleteDoc).
 *  - Tripwire: the SAME assertTripwire runs BEFORE any collection
 *    doc is deleted (Job 4 lesson); counts match via
 *    lastConfirmedRef length — a list may shrink only by as much as
 *    trash grew in the same write.
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection
 *    with 'trashBin') is idempotent by id, skips id-less records,
 *    writes in 500-doc batches with setDoc merge. Counts match on RAW
 *    numbers: main_store array length = new collection doc count.
 *  - Read-switch: an onSnapshot feed on the new collection is the
 *    source once it matches the confirmed main_store list EXACTLY
 *    (every confirmed id present AND no extra doc — an extra doc is
 *    an orphan left by a non-super-admin restore/permanent-delete,
 *    which cannot deleteDoc the trash doc); main_store is the
 *    fallback until then (empty collection snapshot triggers
 *    backfill, not a wipe). A genuinely empty collection (was
 *    non-empty before) still applies as empty. EVERY non-empty
 *    snapshot applies once the collection is complete (Job 7/Job 8
 *    lesson — not just at takeover).
 *  - Auto-sync guard waits for the trash feed before sync starts
 *    (hasLoadedTrashCollectionRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - The trash filter hides a record whose deleteDoc failed: the
 *    already-split fields (notices + schedule) are filtered by the
 *    same trashed-ids set as students/teachers/users.
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Firestore-touching code lives in React/services modules, so the feed,
 * dual-write wiring and guard are covered by source-order assertions
 * (the repo's established grep-proof style) plus real unit checks on
 * the pure parts (collection path, backfill plan, raw counts, the
 * exact-match completeness gate, the trashed-ids set).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const migrationSplit: any = await import('../services/migrationSplit').catch(() => ({}));
const trashRestore: any = await import('../services/trashRestore').catch(() => ({}));

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

// Trash entries, as they sit in main_store.trashBin (doc id = entry id).
const T1 = { id: 'trash-1', type: 'student', data: { id: 'std-1', studentId: '2026001' }, deletedAt: '2026-11-21' };
const T2 = { id: 'trash-2', type: 'notice', data: { id: 'notice-1' }, deletedAt: '2026-11-21' };
const T3 = { id: 'trash-3', type: 'subject', data: { id: 'sub-1' }, deletedAt: '2026-11-21' };

console.log('--- New collection path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('trash collection ref points at institutions/inst_madrasah_primary/trash', () => {
  assert.strictEqual(typeof cloudConfirm.trashCollectionRef, 'function', 'trashCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.trashCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/trash', 'collection path must be institutions/inst_madrasah_primary/trash');
});

check('trash collection ref is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function trashCollectionRef');
  assert.ok(start > -1, 'trashCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every trash id once, in order', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([T1, T2, T3]).docs.map((d: any) => d.id), ['trash-1', 'trash-2', 'trash-3']);
});

check('backfill plan dedupes the same trash id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([T1, T2, T1, { ...T2, deletedAt: '2026-11-22' }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['trash-1', 'trash-2'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less trash entries (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([T1, { type: 'student', data: {} } as any, T2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['trash-1', 'trash-2']);
  assert.strictEqual(plan.skipped, 1);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[T1, T2, T3], [T1], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([T1, T2, T3]);
  assert.strictEqual(plan.docs.length, 3, 'three distinct entries become three docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check("migrateFieldToCollection covers 'trashBin', batched setDoc merge by id", () => {
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
  assert.ok(body.includes('trashCollectionRef'), 'backfill must write the trash collection for this field');
  assert.ok(body.includes("'trashBin'"), "backfill must handle the 'trashBin' field");
});

console.log('--- Completeness gate (pure: exact match, orphans refuse takeover) ---');

check('gate passes when the collection holds exactly the confirmed trash entries', () => {
  assert.strictEqual(typeof migrationSplit.trashCollectionComplete, 'function', 'trashCollectionComplete must be exported from migrationSplit');
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1, T2], [T2, T1]), true, 'same ids in any order is complete');
  assert.strictEqual(migrationSplit.trashCollectionComplete([], []), true, 'empty + empty is complete');
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1], [{ ...T1, deletedAt: '2026-11-22' }]), true, 'same id with changed fields is still complete');
});

check('gate fails when the collection is missing a confirmed entry (backfill pending)', () => {
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1, T2], [T1]), false, 'a missing confirmed id is incomplete');
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1], []), false, 'an empty collection with confirmed entries is incomplete');
});

check('gate fails when the collection holds an EXTRA doc (orphan from a non-super-admin restore)', () => {
  // The principal restores T2: main_store drops it, but deleteDoc on
  // trash/trash-2 fails (permission-denied) so the doc stays. A subset
  // gate would take over and the orphan would hide the restored
  // notice again — exact match refuses and main_store stays the source.
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1], [T1, T2]), false, 'an extra collection doc is incomplete');
  assert.strictEqual(migrationSplit.trashCollectionComplete([], [T1]), false, 'an orphan with an empty confirmed list is incomplete');
});

check('gate ignores id-less entries on both sides (they can never be keyed)', () => {
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1, { type: 'student', data: {} } as any], [T1]), true);
  assert.strictEqual(migrationSplit.trashCollectionComplete([T1], [T1, { type: 'notice', data: {} } as any]), true);
});

console.log('--- Trashed-ids set (pure: the filter that hides a failed deleteDoc) ---');

check('collectTrashedIds carries each entry id AND its deleted record id', () => {
  assert.strictEqual(typeof trashRestore.collectTrashedIds, 'function', 'collectTrashedIds must be exported from trashRestore');
  const ids = trashRestore.collectTrashedIds([T1, T2]);
  assert.ok(ids instanceof Set, 'must return a Set');
  // Entry ids + deleted record ids (data.id) — studentId is a
  // different field and never joins the set, same as before.
  assert.deepStrictEqual([...ids].sort(), ['notice-1', 'std-1', 'trash-1', 'trash-2'].sort(), 'entry ids + data ids');
});

check('collectTrashedIds merges the remote list with local state, skips non-arrays', () => {
  const ids = trashRestore.collectTrashedIds([T1], undefined, [T3] as any, null as any, 'nope' as any);
  assert.deepStrictEqual([...ids].sort(), ['std-1', 'sub-1', 'trash-1', 'trash-3'].sort());
  assert.deepStrictEqual([...trashRestore.collectTrashedIds()], [], 'no bins means no ids');
});

check('the filter hides a record whose deleteDoc failed (non-super-admin path)', () => {
  // Principal deletes notice-1: the trash entry lands in the trash
  // collection + main_store, but deleteDoc on notices/notice-1 fails
  // (permission-denied) so the doc STAYS and the notices feed keeps
  // delivering it. The trash filter must hide it from the list.
  const ids = trashRestore.collectTrashedIds([T2]);
  const notices = [{ id: 'notice-1', title: 'Gone' }, { id: 'notice-2', title: 'Live' }];
  const visible = notices.filter((n) => !ids.has(String(n.id)));
  assert.deepStrictEqual(visible.map((n) => n.id), ['notice-2'], 'the failed-delete notice is hidden, the live one shows');
  const students = [{ id: 'std-1' }, { id: 'std-2' }];
  const visibleStudents = students.filter((s) => !trashRestore.collectTrashedIds([T1]).has(String(s.id)));
  assert.deepStrictEqual(visibleStudents.map((s) => s.id), ['std-2']);
});

console.log('--- Dual-write (step 5 case (b): the maintenance shape, it stays) ---');

check('writeDeleteFieldsToCloud writes trash entries to the new collection first, then main_store', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeTrashRecordsToCollection'), 'must write the trash entries to the new collection');
  assert.ok(body.includes('await setDoc(ref, payload, { merge: true })'), 'must STILL write main_store (step 5 case (b): the union leg is maintenance, it stays — no upsert leg exists to stop)');
  assert.ok(body.includes('payload.trashBin = mergeRecordsByKey'), 'must still union the entries into main_store.trashBin');
  assert.ok(body.indexOf('writeTrashRecordsToCollection') < body.indexOf('await setDoc(ref, payload, { merge: true })'), 'collection write comes before the main_store write (plan point 1: trash entry first)');
  assert.ok(body.includes("assertUpsertRecords('trashBin'"), 'trash write must reuse the shared id assertion');
  assert.ok(body.includes("fieldKeyFn('trashBin')"), 'trash write must key entries with the shared fieldKeyFn');
});

check('trash collection writer is setDoc merge by id (idempotent retry)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashRecordsToCollection');
  assert.ok(start > -1, 'writeTrashRecordsToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('setDoc(doc(col, String('), 'doc id must be the trash entry id');
  assert.ok(body.includes('{ merge: true }'), 'must use setDoc merge');
});

console.log('--- Rules limit: deleteDoc is best-effort, tripwire runs first ---');

check('source-doc deletes swallow ONLY permission-denied (plan point 2)', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(src.includes('deleteSplitDocsBestEffort'), 'a best-effort delete helper must exist');
  const start = src.indexOf('async function deleteSplitDocsBestEffort');
  assert.ok(start > -1, 'deleteSplitDocsBestEffort must be defined');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("err?.code === 'permission-denied'"), 'only permission-denied is swallowed');
  assert.ok(body.includes('throw err'), 'any other failure still fails the write');
  const delStart = src.indexOf('export async function writeDeleteFieldsToCloud');
  const delBody = src.slice(delStart, src.indexOf('\n}', delStart) + 2);
  assert.ok(delBody.includes('deleteSplitDocsBestEffort'), 'the delete writer must use the best-effort helper for split-field docs');
  assert.ok(delBody.includes('deleteNoticesFromCollection'), 'notices docs are still deleted for the super admin');
  assert.ok(delBody.includes('deleteScheduleRecordsFromCollection'), 'schedule docs are still deleted for the super admin');
});

check('tripwire runs BEFORE any collection doc is deleted (Job 4 lesson, same function)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)'), 'must call the SAME assertTripwire, not a copy');
  assert.ok(body.indexOf('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)') < body.indexOf('deleteSplitDocsBestEffort'), 'tripwire must run before any collection delete');
  assert.ok(body.indexOf('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)') < body.indexOf('writeTrashRecordsToCollection'), 'tripwire must run before the trash collection write too');
});

check('rules still grant delete only to the super-admin EMAIL (principal cannot deleteDoc)', () => {
  const src = readSource('firestore.rules');
  assert.ok(src.includes("request.auth.token.email.lower() == 'mehedihasansagor26@gmail.com'"), 'isSuperAdmin must check the owner email only');
  assert.ok(src.includes('allow delete: if isSuperAdmin();'), 'institutions delete must stay super-admin-only');
  assert.ok(!src.includes('ldsdm.2003@gmail.com'), 'the principal email must NOT appear in the rules (no rules change in this job)');
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(cc.includes('mehedihasansagor26@gmail.com'), 'the delete helper must name the super-admin email in its comment, so the limit is visible in code');
});

console.log('--- Trash-op writer: restore + permanent delete reach the trash collection ---');

check('writeTrashOpToCloud deletes the removed trash docs from the new collection (best-effort)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('deleteTrashRecordsFromCollection'), 'trash-op must remove the trash docs from the new collection');
  assert.ok(body.includes('deleteSplitDocsBestEffort'), 'the trash-doc delete must be best-effort (principal leaves an orphan, super admin removes it)');
  assert.ok(body.includes('await setDoc(ref, payload, { merge: true })'), 'must STILL write main_store (step 5 case (b): the prune leg is maintenance, it stays)');
  assert.ok(body.includes('payload.trashBin = existingTrash.filter'), 'must still prune the removed entries from main_store.trashBin');
  assert.ok(body.indexOf('assertTripwire(') < body.indexOf('deleteTrashRecordsFromCollection'), 'tripwire must run before the trash-doc delete');
});

check('trash-op restores still write the record back to its split collection', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'notices'"), 'trash-op must handle restored notices');
  assert.ok(body.includes('writeNoticesToCollection'), 'a restored notice must return to the notices collection');
  assert.ok(body.includes('writeScheduleRecordsToCollection'), 'a restored schedule record must return to its collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a trash onSnapshot feed on the new collection', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('trashCollectionRef'), 'AppContext must import the trash collection ref');
  assert.ok(src.includes('startTrashFeed'), 'a trash feed starter must exist');
  const at = src.indexOf('const startTrashFeed');
  assert.ok(at > -1, 'startTrashFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'trash feed must use onSnapshot');
  assert.ok(body.includes('trashCollectionRef()'), 'trash feed must listen on the new collection');
});

check('trash feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startTrashFeed()'), 'main feed must start the trash feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopTrashFeed'), 'feed switch must also stop the trash feed');
  const pubStart = src.indexOf('const startPublicFeed = () => {');
  assert.ok(pubStart > -1, 'startPublicFeed must exist');
  assert.ok(!src.slice(pubStart, pubStart + 3000).includes('startTrashFeed()'), 'public (anonymous) feed must NOT start the trash feed');
});

check('applyRemoteData trashBin branch is gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('trashFromCollectionRef'), 'a collection-source flag must exist');
  assert.ok(src.includes('fromTrashCollection'), 'applyRemoteData must know when data comes from a trash feed');
  assert.ok(src.includes('backfillTrashOnce'), 'a trash backfill helper must exist');
  const at = src.indexOf('if (data.trashBin && Array.isArray(data.trashBin))');
  assert.ok(at > -1, 'trashBin branch must exist in applyRemoteData');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('!trashFromCollectionRef.current'), 'main_store trashBin must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromTrashCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTrashFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length > 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillTrashOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('trashFromCollectionRef.current = true'), 'a snapshot with docs must mark the collection as the source');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTrashFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('} else if (trashFromCollectionRef.current)'), 'empty snapshot after docs existed must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ trashBin: [] }'), 'genuinely empty must clear the list');
});

check('feed takes over ONLY on exact match with the confirmed main_store list (orphans refuse)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTrashFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('trashCollectionComplete'), 'feed must use the exact-match gate');
  assert.ok(body.includes("lastConfirmedRef.current['trashBin']"), 'gate must compare against the confirmed main_store list');
  assert.ok(!body.includes('.every((id) => colIds.has(id))'), 'feed must NOT use the subset gate (it would take over with an orphan still hiding a restored record)');
});

check('an incomplete snapshot relinquishes takeover so main_store applies again', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTrashFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('trashFromCollectionRef.current = false'), 'a failed gate must relinquish a previous takeover');
  assert.ok(body.includes('applyRemoteData({ trashBin: known })') || body.includes("applyRemoteData({ trashBin: lastConfirmedRef.current['trashBin']"), 'relinquish must re-apply the confirmed main_store list');
});

check('EVERY non-empty snapshot applies once the collection is complete (Job 7/Job 8 lesson)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTrashFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  // The apply call sits inside the docs.length > 0 branch with no
  // "only at takeover" condition — a record trashed later on another
  // device appears without a reload.
  assert.ok(body.includes('applyRemoteData({ trashBin: docs }, { fromTrashCollection: true })'), 'every complete non-empty snapshot must apply');
  assert.ok(!body.includes('if (!trashFromCollectionRef.current)'), 'the snapshot handler must not apply only before takeover');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillTrashOnce = async (source?:');
  assert.ok(at > -1, 'backfillTrashOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['trashBin']"), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledTrashIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes("migrateFieldToCollection('trashBin', pending)"), 'backfill must run through migrateFieldToCollection');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.trashBin && Array.isArray(data.trashBin))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store entries missing from the collection');
  assert.ok(body.includes('lastCollectionTrashRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillTrashOnce(stragglers)'), 'stragglers must be backfilled into the collection');
});

check('main_store stays the removal authority after takeover (gate compares fresh truth)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.trashBin && Array.isArray(data.trashBin))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  // The taken-over branch still refreshes lastConfirmedRef from
  // main_store — otherwise a restore on another device would leave
  // the gate comparing against a stale list.
  const elseAt = body.indexOf('} else {');
  assert.ok(elseAt > -1, 'trashBin branch must have a taken-over else path');
  const elseBody = body.slice(elseAt);
  assert.ok(elseBody.includes("lastConfirmedRef.current['trashBin'] = data.trashBin"), 'taken-over branch must refresh the confirmed list from main_store');
});

console.log('--- Trash filter covers the already-split fields ---');

check('applyRemoteData builds the trashed-ids set with the shared helper', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('collectTrashedIds'), 'AppContext must use collectTrashedIds');
  // 24 Nov 2026 (student delete cloud-confirm fix): the local bin is
  // read from trashBinRef.current, not the stale trashBin closure —
  // the set still covers the remote list AND local state, fresher.
  assert.ok(src.includes('collectTrashedIds(data.trashBin, trashBinRef.current)'), 'the set must cover the remote list and local state');
});

check('notices are hidden when their record is trashed (failed deleteDoc path)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.notices && Array.isArray(data.notices))');
  assert.ok(at > -1, 'notices branch must exist');
  const body = src.slice(at, src.indexOf('    }\n\n    // Prune pending payload', at));
  assert.ok(body.includes('trashedIds.has(String(n.id))'), 'notices must be filtered by the trashed-ids set');
});

check('schedule records are hidden when their record is trashed (failed deleteDoc path)', () => {
  const src = readSource('context/AppContext.tsx');
  for (const field of ['classRoutines', 'syllabusItems', 'calendarEvents']) {
    const call = `applyScheduleFieldFromRemote('${field}', data.${field}.filter(`;
    assert.ok(src.includes(call), `the ${field} call must filter before applying`);
  }
  assert.ok(src.includes('trashedIds.has(String(r.id))'), 'schedule records must be filtered by the trashed-ids set');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the trash feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedTrashCollectionRef'), 'a trash-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 13: never auto-sync until the trash collection');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 13 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 700);
  assert.ok(effectBody.includes('if (!hasLoadedTrashCollectionRef.current) return;'), 'auto-sync effect must return early until the trash feed settles');
  // A feed error also settles, so a dead listener can never block sync forever.
  const feedAt = src.indexOf('const startTrashFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markTrashFeedSettled()'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the trash feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedTrashCollectionRef'), 'manual force-push must not wait for the trash feed');
});

console.log('--- Public portal + old write NOT stopped (source checks) ---');

check('buildPublicPortalData reads no trashBin', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('trashBin'), 'publicPortal must not read trashBin');
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
  assert.strictEqual(pkg.scripts['test:job13-trash-split'], 'tsx scripts/verify-job13-trash-split.ts', 'npm run test:job13-trash-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 13 trash-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
