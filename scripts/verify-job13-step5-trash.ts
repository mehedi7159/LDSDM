/**
 * Job 13 step 5 (trash split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-job13-step5-trash.ts
 * (or npm run test:job13-step5-trash).
 *
 * DECIDED CASE (b) — verify-only, NO behaviour change. Step 5 for
 * trash is NOT the Job 1 shape, because there is NO upsert writer
 * for trashBin to stop:
 *  - No writeTrashBinFieldToCloud exists, and no call site writes
 *    trashBin through writeFieldsToCloud / writeFieldToCloud.
 *    Trash reaches main_store ONLY through the two maintenance legs
 *    inside the delete / trash-op writers:
 *      writeDeleteFieldsToCloud (cloudConfirm.ts:1613-1614) unions
 *      new entries into main_store.trashBin, and
 *      writeTrashOpToCloud (cloudConfirm.ts:1732-1734) prunes
 *      removed entries out of it.
 *  - Those legs MUST stay (Job 1 precedent: delete-prune /
 *    restore-union of main_store is kept so the frozen copy can
 *    never resurrect a deleted record). The read path is NOT fully
 *    collection-based — main_store.trashBin is still live:
 *      * applyRemoteData (AppContext.tsx:3195-3204) applies
 *        main_store trashBin as the read source while the
 *        collection feed has not taken over
 *        (!trashFromCollectionRef.current).
 *      * After takeover main_store stays the removal authority
 *        (AppContext.tsx:3217): the taken-over branch refreshes
 *        lastConfirmedRef.current['trashBin'] from main_store, and
 *        the feed's exact-match gate compares the collection
 *        against that confirmed list (AppContext.tsx:4283).
 *      * backfillTrashOnce sources from the confirmed main_store
 *        list (AppContext.tsx:2503), and the trash filter is built
 *        from data.trashBin, which includes main_store snapshots
 *        (AppContext.tsx:3065).
 *    Stopping the union leg would break deletes for the principal
 *    (non-super-admin): the trash entry would land in the
 *    collection only, the exact-match gate would compare it against
 *    the frozen main_store list, takeover would never happen, and
 *    the main_store fallback — lacking the new entry — would keep
 *    showing the trashed record in lists. Stopping the prune leg
 *    would break restores: the entry would stay in
 *    main_store.trashBin and the trash filter would keep hiding the
 *    restored record. So step 5 here = prove the maintenance legs
 *    are intact and no upsert path writes trashBin.
 *  - main_store.trashBin is NOT deleted — it stays as the frozen /
 *    removal-authority copy, maintained by the two writers.
 *  - No rules change, no main_store delete, no other field touched.
 *  - The Job 13 split script (scripts/verify-job13-trash-split.ts)
 *    is updated to this step-5 expectation: its dual-write section
 *    now states the union/prune maintenance legs stay.
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

const writerBody = (fnName: string) => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf(`export async function ${fnName}`);
  assert.ok(start > -1, `${fnName} must exist`);
  return src.slice(start, src.indexOf('\n}', start) + 2);
};

console.log('--- Step 5 case (b): no upsert path writes trashBin ---');

check('no upsert writer for trashBin exists', () => {
  const src = readSource('services/cloudConfirm.ts');
  assert.ok(!src.includes('writeTrashBinFieldToCloud'), 'there must be no writeTrashBinFieldToCloud upsert writer');
  assert.ok(!src.includes("writeFieldToCloud('trashBin'"), 'no writeFieldToCloud(trashBin) call may exist');
  assert.ok(!src.includes('writeFieldsToCloud({ trashBin'), 'no writeFieldsToCloud({ trashBin }) call may exist');
  const appSrc = readSource('context/AppContext.tsx');
  assert.ok(!appSrc.includes("writeFieldToCloud('trashBin'"), 'AppContext must not write trashBin through the upsert path either');
});

check('exactly two main_store.trashBin writes exist, both inside the maintenance writers', () => {
  const src = readSource('services/cloudConfirm.ts');
  const matches = [...src.matchAll(/payload\.trashBin =/g)];
  assert.strictEqual(matches.length, 2, 'only two payload.trashBin assignments may exist in cloudConfirm');
  const delBody = writerBody('writeDeleteFieldsToCloud');
  const opBody = writerBody('writeTrashOpToCloud');
  assert.ok(delBody.includes('payload.trashBin = mergeRecordsByKey'), 'the delete writer must hold the union leg');
  assert.ok(opBody.includes('payload.trashBin = existingTrash.filter'), 'the trash-op writer must hold the prune leg');
});

console.log('--- Maintenance legs intact (Job 1 precedent: prune/union stay) ---');

check('writeDeleteFieldsToCloud still unions trash into main_store AND writes the trash collection first', () => {
  const body = writerBody('writeDeleteFieldsToCloud');
  assert.ok(body.includes('payload.trashBin = mergeRecordsByKey(existingTrash, cleanTrash'), 'must still union new entries into main_store.trashBin');
  assert.ok(body.includes('writeTrashRecordsToCollection'), 'must still write the trash entries to the new collection');
  assert.ok(body.includes("assertUpsertRecords('trashBin'"), 'trash write must still reuse the shared id assertion');
  assert.ok(body.indexOf('writeTrashRecordsToCollection') < body.indexOf('await setDoc(ref, payload, { merge: true })'), 'collection write must come before the main_store write (plan point 1: trash entry first)');
  assert.ok(body.includes('await setDoc(ref, payload, { merge: true })'), 'must still write the pruned/unioned main_store payload');
});

check('writeTrashOpToCloud still prunes main_store.trashBin AND removes the trash docs from the collection', () => {
  const body = writerBody('writeTrashOpToCloud');
  assert.ok(body.includes('payload.trashBin = existingTrash.filter((t) => !t.id || !idSet.has(String(t.id)))'), 'must still prune removed entries from main_store.trashBin');
  assert.ok(body.includes('deleteTrashRecordsFromCollection'), 'must still remove the trash docs from the new collection');
  assert.ok(body.includes('deleteSplitDocsBestEffort'), 'the trash-doc delete must stay best-effort (principal leaves an orphan, super admin removes it)');
  assert.ok(body.includes('await setDoc(ref, payload, { merge: true })'), 'must still write the pruned main_store payload');
});

check('tripwire still runs before any collection write in both writers', () => {
  const delBody = writerBody('writeDeleteFieldsToCloud');
  assert.ok(delBody.includes('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)'), 'delete writer must still call the SAME assertTripwire');
  assert.ok(delBody.indexOf('assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize)') < delBody.indexOf('writeTrashRecordsToCollection'), 'tripwire must run before the trash collection write');
  const opBody = writerBody('writeTrashOpToCloud');
  assert.ok(opBody.includes('assertTripwire('), 'trash-op writer must still call assertTripwire');
  assert.ok(opBody.indexOf('assertTripwire(') < opBody.indexOf('deleteTrashRecordsFromCollection'), 'tripwire must run before the trash-doc delete');
});

console.log('--- Routing unchanged: pushDiffToCloud + queue replay still use these writers ---');

check('delete confirm paths still route through writeDeleteFieldsToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('() => writeDeleteFieldsToCloud(removals, trashEntries, confirmActorName())'), 'delete confirm must still call the delete writer');
  assert.ok(src.includes("() => writeDeleteFieldsToCloud([{ field: 'students', ids: op.deletedIds }], op.trashEntries, confirmActorName())"), 'student delete confirm must still call the delete writer');
});

check('queue replay still routes trash through both writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('await writeDeleteFieldsToCloud(item.removals, (item.trashEntries || []) as { id: string }[], actor)'), 'replay must still carry deletes through the delete writer');
  assert.ok(src.includes('await writeTrashOpToCloud(item.removeTrashIds || [], item.upserts || {}, actor)'), 'replay must still carry trash ops through the trash-op writer');
  assert.ok(src.includes('() => writeTrashOpToCloud(removeTrashIds, upserts, confirmActorName())'), 'trash-op confirm must still call the trash-op writer');
});

console.log('--- Read path as found: main_store is still the fallback + removal authority ---');

check('applyRemoteData still applies main_store trashBin while the collection has not taken over', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.trashBin && Array.isArray(data.trashBin))');
  assert.ok(at > -1, 'trashBin branch must exist in applyRemoteData');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  assert.ok(body.includes('!trashFromCollectionRef.current'), 'main_store trashBin must apply before takeover');
  assert.ok(body.includes('setTrashBin(data.trashBin)'), 'pre-takeover main_store snapshot must set the trash list');
});

check('taken-over branch still refreshes the confirmed list from main_store (removal authority)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('if (data.trashBin && Array.isArray(data.trashBin))');
  const body = src.slice(at, src.indexOf('\n    }', at) + 6);
  const elseAt = body.indexOf('} else {');
  assert.ok(elseAt > -1, 'trashBin branch must have a taken-over else path');
  assert.ok(body.slice(elseAt).includes("lastConfirmedRef.current['trashBin'] = data.trashBin"), 'taken-over branch must refresh the confirmed list from main_store');
});

check('feed gate still compares the collection against the confirmed main_store list', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startTrashFeed');
  assert.ok(at > -1, 'startTrashFeed must exist');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes("trashCollectionComplete(lastConfirmedRef.current['trashBin'] || [], docs)"), 'gate must compare against the confirmed main_store list');
  assert.ok(body.includes('applyRemoteData({ trashBin: known })'), 'relinquish must re-apply the confirmed main_store list');
});

check('backfill still sources from the confirmed main_store list', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillTrashOnce = async (source?:');
  assert.ok(at > -1, 'backfillTrashOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['trashBin']"), 'backfill must copy the confirmed main_store list');
});

check('trash filter is still built from data.trashBin (main_store snapshots included) + local state', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('collectTrashedIds(data.trashBin, trashBinRef.current)'), 'the filter must cover the remote list and local state');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen trashBin field must never be deleted from main_store');
});

console.log('--- Split script updated to the step-5 case (b) expectation ---');

check('verify-job13-trash-split.ts states the step-5 case (b) decision', () => {
  const src = readSource('scripts/verify-job13-trash-split.ts');
  assert.ok(src.includes('step 5'), 'split script must mention step 5');
  assert.ok(src.includes('case (b)') || src.includes('case b'), 'split script must name the decided case (b)');
  assert.ok(!src.includes('step 5, stopping the old main_store\n * write, is a separate push a week later and is NOT part of this job'), 'split script must no longer say step 5 is a separate later push');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job13-step5-trash'], 'tsx scripts/verify-job13-step5-trash.ts', 'npm run test:job13-step5-trash must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 13 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
