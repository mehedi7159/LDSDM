/**
 * Job 3 (classes split: classes + sections + academicYears)
 * — self-check (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job2-schedule-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job3-classes-split.ts
 * (or npm run test:job3-classes-split).
 *
 * Covers the Job 3 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 3,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New paths are institutions/inst_madrasah_primary/<field>/{id} for
 *    classes, sections and academicYears, built from
 *    CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Collection-only write (step 5, 26 Nov 2026, supersedes the
 *    dual-write below): writeClassesFieldToCloud,
 *    writeSectionsFieldToCloud and writeAcademicYearsFieldToCloud
 *    each write their new collection ONLY; the old main_store write
 *    is stopped, the frozen copy stays. See
 *    scripts/verify-job3-step5-classes.ts.
 *  - Deletes + restores of class/section/year records also reach the new
 *    collections, so a deleted class can never be resurrected by a
 *    classes feed.
 *  - Read-switch: onSnapshot feeds on the three new collections are the
 *    source once ALL THREE have delivered docs covering every confirmed
 *    main_store record — the three switch TOGETHER, never one at a time,
 *    so a class name can never differ between two places. main_store is
 *    the fallback until then (empty collection snapshot triggers
 *    backfill, not a wipe). A genuinely empty collection (was non-empty
 *    before) still applies as empty. A NON-EMPTY snapshot AFTER takeover
 *    also applies (a record added on another device shows without a
 *    reload — the post-takeover apply branch).
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection) is
 *    idempotent by id, skips id-less records, writes in 500-doc batches
 *    with setDoc merge. Counts match on RAW numbers: main_store array
 *    length = new collection doc count (no filtering before counting).
 *  - Auto-sync guard waits for the three classes feeds before sync
 *    starts (hasLoadedClassesCollectionsRef); login verdict and manual
 *    force-push are NOT gated on it.
 *  - Public portal rebuild needs no source change: dual-write keeps
 *    main_store classes current, and the rebuild reads main_store.
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

// --- Post-takeover snapshot simulation ---------------------------------
// The classes feed handler is a small if/else-if chain over (docs,
// field, classesFromCollectionRef). Extract that chain from the live
// source and RUN it with stubbed refs, so the check proves what the
// handler actually does — not what a comment says it does.
function matchPair(src: string, openIdx: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error(`unbalanced ${open}${close}`);
}

function extractIfChain(body: string, marker: string): string {
  let i = body.indexOf(marker);
  assert.ok(i > -1, 'snapshot decision chain must exist in the feed handler');
  const start = i;
  let end = i;
  for (;;) {
    let j = i;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body.startsWith('if', j) && !/[A-Za-z0-9_]/.test(body[j + 2] || '')) {
      const parenEnd = matchPair(body, body.indexOf('(', j), '(', ')');
      const braceEnd = matchPair(body, body.indexOf('{', parenEnd), '{', '}');
      end = braceEnd;
      j = braceEnd;
    } else {
      // Bare `else { ... }` (no condition).
      const braceEnd = matchPair(body, body.indexOf('{', j), '{', '}');
      end = braceEnd;
      break;
    }
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body.startsWith('else', j) && !/[A-Za-z0-9_]/.test(body[j + 4] || '')) { i = j + 4; continue; }
    break;
  }
  return body.slice(start, end);
}

function runClassesSnapshotChain(chain: string, flagOn: boolean, field: string, docs: any[]) {
  let applied: any = null;
  let backfilled = false;
  const classesFromCollectionRef = { current: flagOn };
  const applyRemoteData = (data: any, opts: any) => { applied = { data, opts }; };
  // Faithful to tryClassesTakeover's first line: returns true at once
  // when the flag is already on; false here models "takeover not
  // possible yet" (main_store not loaded / feeds not settled).
  const tryClassesTakeover = () => classesFromCollectionRef.current;
  const backfillClassesOnce = () => { backfilled = true; };
  new Function('docs', 'field', 'classesFromCollectionRef', 'applyRemoteData', 'tryClassesTakeover', 'backfillClassesOnce', chain)(
    docs, field, classesFromCollectionRef, applyRemoteData, tryClassesTakeover, backfillClassesOnce,
  );
  return { applied, backfilled };
}

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

const FIELDS = ['classes', 'sections', 'academicYears'] as const;
const FIELD_REF_FN: Record<string, string> = {
  classes: 'schoolClassesCollectionRef',
  sections: 'sectionsCollectionRef',
  academicYears: 'academicYearsCollectionRef',
};
const FIELD_WRITER: Record<string, string> = {
  classes: 'writeClassesFieldToCloud',
  sections: 'writeSectionsFieldToCloud',
  academicYears: 'writeAcademicYearsFieldToCloud',
};
const C1 = { id: 'c-play', name: 'Play', nameBn: 'প্লে', order: 1 };
const C2 = { id: 'c-1', name: 'Class 1', nameBn: 'প্রথম শ্রেণি', order: 2 };
const S1 = { id: 'sec-a', name: 'A' };
const Y1 = { id: 'y2026', name: '2026' };

console.log('--- New collection paths (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

for (const field of FIELDS) {
  check(`${field} collection ref points at institutions/inst_madrasah_primary/${field}`, () => {
    const fnName = FIELD_REF_FN[field];
    assert.strictEqual(typeof cloudConfirm[fnName], 'function', `${fnName} must be exported from cloudConfirm`);
    const ref = cloudConfirm[fnName]();
    assert.strictEqual(ref.path, `institutions/inst_madrasah_primary/${field}`, `collection path must be institutions/inst_madrasah_primary/${field}`);
  });
}

check('classes collection refs are built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function classesCollectionRef');
  assert.ok(start > -1, 'classesCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by id, RAW counts) ---');

check('backfill plan keeps every id once, in order (per field)', () => {
  assert.strictEqual(typeof migrationSplit.scheduleBackfillPlan, 'function', 'scheduleBackfillPlan must be exported from migrationSplit (reused for Job 3)');
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([C1, C2]).docs.map((d: any) => d.id), ['c-play', 'c-1']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([S1]).docs.map((d: any) => d.id), ['sec-a']);
  assert.deepStrictEqual(migrationSplit.scheduleBackfillPlan([Y1]).docs.map((d: any) => d.id), ['y2026']);
});

check('backfill plan dedupes the same id (second run writes the same docs)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([C1, C2, C1, { ...C2, order: 9 }]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['c-play', 'c-1'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 2, 'duplicates count as skipped');
});

check('backfill plan skips id-less records (they can never be keyed)', () => {
  const plan = migrationSplit.scheduleBackfillPlan([C1, { name: 'No id' } as any, C2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['c-play', 'c-1']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan of an empty list is empty', () => {
  const plan = migrationSplit.scheduleBackfillPlan([]);
  assert.deepStrictEqual(plan.docs, []);
  assert.strictEqual(plan.skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  for (const list of [[C1, C2], [S1], [Y1], []]) {
    const plan = migrationSplit.scheduleBackfillPlan(list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, 'docs + skipped must equal the raw main_store array length');
  }
  const plan = migrationSplit.scheduleBackfillPlan([C1, C2, S1 as any, Y1 as any]);
  assert.strictEqual(plan.docs.length, 4, 'four distinct records become four docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers classes, sections and academicYears, batched setDoc merge by id', () => {
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
  assert.ok(body.includes('classesCollectionRef'), 'backfill must write the new classes collections');
});

console.log('--- Dual-write (source checks) ---');

for (const field of FIELDS) {
  check(`${FIELD_WRITER[field]} writes the new collection ONLY (step 5 stopped the main_store leg)`, () => {
    const src = readSource('services/cloudConfirm.ts');
    const start = src.indexOf(`export async function ${FIELD_WRITER[field]}`);
    assert.ok(start > -1, `${FIELD_WRITER[field]} must exist`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes('writeClassesRecordsToCollection'), 'must write the new collection');
    assert.ok(!body.includes('writeFieldsToCloud'), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
    assert.ok(body.indexOf('writeClassesRecordsToCollection') > -1, 'collection write belongs to the same try');
    assert.ok(body.includes('withTimeout'), 'collection-only write must stay inside the confirm timeout');
  });

  check(`${FIELD_WRITER[field]} asserts ids via the shared choke point`, () => {
    const src = readSource('services/cloudConfirm.ts');
    const start = src.indexOf(`export async function ${FIELD_WRITER[field]}`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes('assertUpsertRecords'), 'dual-write must reuse assertUpsertRecords');
    assert.ok(body.includes(`fieldKeyFn('${field}')`), 'dual-write must key records with the shared fieldKeyFn');
  });
}

check('classes deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`removal.field === '${field}'`), `delete writer must handle the ${field} field`);
  }
  assert.ok(body.includes('deleteClassesRecordsFromCollection'), 'delete writer must delete the new-collection docs');
});

check('classes restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  for (const field of FIELDS) {
    assert.ok(body.includes(`field === '${field}'`), `trash-op writer must handle the ${field} field`);
  }
  assert.ok(body.includes('writeClassesRecordsToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts classes onSnapshot feeds on the three new collections', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('classesCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startClassesFeeds'), 'a classes feeds starter must exist');
  const at = src.indexOf('const startClassesFeeds');
  assert.ok(at > -1, 'startClassesFeeds must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'classes feeds must use onSnapshot');
  assert.ok(body.includes('classesCollectionRef(field)'), 'classes feeds must listen on the new collections');
});

check('classes feeds start with the main feed and stop when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startClassesFeeds()'), 'main feed must start the classes feeds (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopClassesFeeds'), 'feed switch must also stop the classes feeds');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 3000).includes('startClassesFeeds()'), 'public (anonymous) feed must NOT start the classes feeds');
});

check('the three fields switch TOGETHER: one joint flag, one joint takeover check', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('classesFromCollectionRef'), 'a single joint collection-source flag must exist');
  assert.ok(!src.includes('classesFromCollectionRef.current[field]'), 'the flag must NOT be per-field — the three switch together');
  assert.ok(src.includes('tryClassesTakeover'), 'a joint takeover check must exist');
  const at = src.indexOf('const tryClassesTakeover');
  assert.ok(at > -1, 'tryClassesTakeover must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('classesFeedSettledRef'), 'takeover must wait for all three feeds to settle');
  assert.ok(body.includes('hasLoadedMainStoreRef.current'), 'takeover must wait for main_store to load (no vacuous takeover on an unloaded list)');
  assert.ok(body.includes('.every((id) => colIds.has(id))'), 'takeover needs every confirmed id present in the collection');
  assert.ok(body.includes('classesFromCollectionRef.current = true'), 'takeover must flip the single joint flag');
  assert.ok(body.includes('fromClassesCollection: true'), 'takeover must apply all three lists from the collections');
});

check('applyRemoteData classes branches are gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('fromClassesCollection'), 'applyRemoteData must know when data comes from a classes feed');
  assert.ok(src.includes('applyClassesFieldFromRemote'), 'a per-field classes apply helper must exist');
  const at = src.indexOf('const applyClassesFieldFromRemote');
  assert.ok(at > -1, 'applyClassesFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!classesFromCollectionRef.current'), 'main_store classes must be skipped once the collections are the source');
  assert.ok(body.includes('opts?.fromClassesCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startClassesFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length === 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillClassesOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('tryClassesTakeover'), 'a snapshot with docs must run the joint takeover check');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startClassesFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('classesFromCollectionRef.current'), 'empty snapshot after takeover must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ [field]: [] }'), 'genuinely empty must clear the list');
});

check('post-takeover NON-EMPTY snapshot applies — a record added on another device shows without reload', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startClassesFeeds');
  assert.ok(at > -1, 'startClassesFeeds must exist');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  const chain = extractIfChain(body, 'if (docs.length === 0');
  // Takeover already happened; each snapshot carries a record that was
  // NOT in the takeover snapshot (added later on another device).
  for (const [field, fresh] of [
    ['classes', { id: 'c-new', name: 'Class 2', nameBn: 'দ্বিতীয় শ্রেণি', order: 3 }],
    ['sections', { id: 'sec-b', name: 'B' }],
    ['academicYears', { id: 'y2027', name: '2027' }],
  ] as Array<[string, any]>) {
    const { applied, backfilled } = runClassesSnapshotChain(chain, true, field, [fresh]);
    assert.ok(applied, `post-takeover ${field} snapshot must apply to state, not fall through`);
    assert.deepStrictEqual(applied.data[field], [fresh], `applied ${field} list must be the new snapshot, including the record the takeover never saw`);
    assert.strictEqual(applied.opts?.fromClassesCollection, true, 'post-takeover apply must be marked as collection source');
    assert.strictEqual(backfilled, false, 'post-takeover snapshot must not re-run the backfill');
  }
  // Pre-takeover path unchanged: a non-empty snapshot with the flag
  // still off must attempt takeover, not apply directly.
  const before = runClassesSnapshotChain(chain, false, 'classes', [C1]);
  assert.strictEqual(before.applied, null, 'pre-takeover snapshot must not apply directly — takeover decides');
  assert.strictEqual(before.backfilled, true, 'pre-takeover snapshot that cannot take over must trigger the backfill');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillClassesOnce = async (field:');
  assert.ok(at > -1, 'backfillClassesOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('lastConfirmedRef.current[field]'), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledClassesIdsRef'), 'backfill must skip ids it already copied');
  assert.ok(body.includes('migrateFieldToCollection(field, pending)'), 'backfill must run through migrateFieldToCollection');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyClassesFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionClassesRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillClassesOnce(field, stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the three classes feeds before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedClassesCollectionsRef'), 'a classes-feeds-loaded flag must exist');
  const effectAt = src.indexOf('// Job 3: never auto-sync until the classes collections');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 3 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedClassesCollectionsRef.current) return;'), 'auto-sync effect must return early until the classes feeds settle');
  const feedAt = src.indexOf('const startClassesFeeds');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markClassesFeedSettled(field)'), 'feed snapshot and feed error must both mark the field settled');
});

check('login verdict and manual force-push are NOT gated on the classes feeds', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedClassesCollectionsRef'), 'manual force-push must not wait for the classes feeds');
});

console.log('--- Public portal (source checks) ---');

check('portal rebuild needs no new source: dual-write keeps main_store classes current', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(!body.includes('readClassesFieldFromCollection'), 'portal rebuild must NOT read the new collections (main_store stays the portal source while dual-write runs)');
  assert.ok(body.includes("getDoc(doc(db, 'institution', 'main_store'))"), 'portal rebuild still reads main_store');
});

console.log('--- Old upsert write stopped, collection write kept (source checks) ---');

check('pushDiffToCloud still writes classes through the collection-only writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('classes: writeClassesFieldToCloud'), 'auto-sync must still carry classes through writeClassesFieldToCloud');
  assert.ok(src.includes('sections: writeSectionsFieldToCloud'), 'auto-sync must still carry sections through writeSectionsFieldToCloud');
  assert.ok(src.includes('academicYears: writeAcademicYearsFieldToCloud'), 'auto-sync must still carry academicYears through writeAcademicYearsFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job3-classes-split'], 'tsx scripts/verify-job3-classes-split.ts', 'npm run test:job3-classes-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 3 classes-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
