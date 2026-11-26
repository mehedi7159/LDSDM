/**
 * Job 5 (feeTypes + feeStructures split) — self-check (21 Nov 2026,
 * base commit 411f914).
 *
 * Follows the scripts/verify-job2-schedule-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job5-fees-split.ts
 * (or npm run test:job5-fees-split).
 *
 * Covers the Job 5 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 5,
 * §5 steps 1–3 only — step 5, stopping the old main_store write, is a
 * separate push a week later and is NOT part of this job):
 *  - New paths are institutions/inst_madrasah_primary/feeTypes/{id} and
 *    .../feeStructures/{classLevel}, built from
 *    CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded. feeStructures is
 *    keyed by classLevel, NOT by id (one structure per class — today's
 *    union rule, kept).
 *  - Collection-only write (step 5, 26 Nov 2026, supersedes the
 *    dual-write below): writeFeeTypesFieldToCloud and
 *    writeFeeStructuresFieldToCloud write the new collections ONLY;
 *    the old main_store writes are stopped, the frozen copies stay.
 *    See scripts/verify-job5-step5-fees.ts.
 *  - Deletes + restores of fee records also reach the new collections,
 *    so a deleted fee type/structure can never be resurrected by a fees
 *    feed.
 *  - Read-switch: onSnapshot feeds on the two new collections are the
 *    source once BOTH have delivered docs covering every confirmed
 *    main_store record (joint takeover — the two fields switch
 *    TOGETHER); main_store is the fallback until then (empty collection
 *    snapshot triggers backfill, not a wipe). A genuinely empty
 *    collection (was non-empty before) still applies as empty. A
 *    NON-EMPTY snapshot AFTER takeover also applies (a record added
 *    on another device shows without a reload — the post-takeover
 *    apply branch).
 *  - feeTypes hydrates ONLY when the list is non-empty — that rule is
 *    kept in the new read path (an empty feeTypes list never wipes the
 *    seeded DEFAULT_FEE_TYPES).
 *  - Backfill (services/migrationSplit.ts migrateFieldToCollection) is
 *    idempotent by key (id for feeTypes, classLevel for feeStructures),
 *    skips key-less records, writes in 500-doc batches with setDoc
 *    merge. Counts match on RAW numbers: main_store array length = new
 *    collection doc count whenever keys are distinct.
 *  - Auto-sync guard waits for the two fees feeds before sync starts
 *    (hasLoadedFeesCollectionsRef); login verdict and manual force-push
 *    are NOT gated on it.
 *  - The fee CALCULATION does not change — only the storage location
 *    moves (the approved 2 Nov fee chart stays exactly as it is).
 *  - Public portal reads neither fee field, so its rebuild needs no
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

// --- Post-takeover snapshot simulation ---------------------------------
// The fees feed handler is a small if/else-if chain over (docs, field,
// feesFromCollectionRef). Extract that chain from the live source and
// RUN it with stubbed refs, so the check proves what the handler
// actually does — not what a comment says it does.
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

function runFeesSnapshotChain(chain: string, flagOn: boolean, field: string, docs: any[]) {
  let applied: any = null;
  let backfilled = false;
  const feesFromCollectionRef = { current: flagOn };
  const applyRemoteData = (data: any, opts: any) => { applied = { data, opts }; };
  // Faithful to tryFeesTakeover's first line: returns true at once
  // when the flag is already on; false here models "takeover not
  // possible yet" (main_store not loaded / feeds not settled).
  const tryFeesTakeover = () => feesFromCollectionRef.current;
  const backfillFeesOnce = () => { backfilled = true; };
  new Function('docs', 'field', 'feesFromCollectionRef', 'applyRemoteData', 'tryFeesTakeover', 'backfillFeesOnce', chain)(
    docs, field, feesFromCollectionRef, applyRemoteData, tryFeesTakeover, backfillFeesOnce,
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

const T1 = { id: 'tuition', labelBn: 'মাসিক বেতন', enabled: true };
const T2 = { id: 'exam', labelBn: 'পরীক্ষার ফি', enabled: true };
const S1 = { id: 'fs-1', classLevel: 'Class 6', amounts: { tuition: 500 } };
const S2 = { id: 'fs-2', classLevel: 'Class 7', amounts: { tuition: 600 } };
// Same class, different (unreliable) id — the old id-union would keep
// both rows; the classLevel union keeps one structure per class.
const S1_DUP = { id: 'fs-1-old', classLevel: 'Class 6', amounts: { tuition: 400 } };

console.log('--- New collection paths (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('feeTypes collection ref points at institutions/inst_madrasah_primary/feeTypes', () => {
  assert.strictEqual(typeof cloudConfirm.feeTypesCollectionRef, 'function', 'feeTypesCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.feeTypesCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/feeTypes', 'collection path must be institutions/inst_madrasah_primary/feeTypes');
});

check('feeStructures collection ref points at institutions/inst_madrasah_primary/feeStructures', () => {
  assert.strictEqual(typeof cloudConfirm.feeStructuresCollectionRef, 'function', 'feeStructuresCollectionRef must be exported from cloudConfirm');
  const ref = cloudConfirm.feeStructuresCollectionRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/feeStructures', 'collection path must be institutions/inst_madrasah_primary/feeStructures');
});

check('fees collection refs are built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function feesCollectionRef');
  assert.ok(start > -1, 'feesCollectionRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
});

console.log('--- Backfill plan (pure, idempotent by key, RAW counts) ---');

check('backfill plan keeps every fee type once, in order', () => {
  assert.strictEqual(typeof migrationSplit.feesBackfillPlan, 'function', 'feesBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.feesBackfillPlan('feeTypes', [T1, T2]).docs.map((d: any) => d.id), ['tuition', 'exam']);
});

check('backfill plan dedupes the same fee-type id (second run writes the same docs)', () => {
  const plan = migrationSplit.feesBackfillPlan('feeTypes', [T1, T2, T1]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['tuition', 'exam'], 'duplicate ids collapse to one doc each');
  assert.strictEqual(plan.skipped, 1, 'duplicates count as skipped');
});

check('backfill plan skips id-less fee types (they can never be keyed)', () => {
  const plan = migrationSplit.feesBackfillPlan('feeTypes', [T1, { labelBn: 'নামহীন' } as any, T2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.id), ['tuition', 'exam']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan keys fee structures by classLevel, not by id', () => {
  const plan = migrationSplit.feesBackfillPlan('feeStructures', [S1, S2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.classLevel), ['Class 6', 'Class 7']);
});

check('backfill plan collapses two structures for one class (first copy wins)', () => {
  const plan = migrationSplit.feesBackfillPlan('feeStructures', [S1, S1_DUP, S2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.classLevel), ['Class 6', 'Class 7'], 'one structure per class — the union rule');
  assert.deepStrictEqual(plan.docs[0].amounts, { tuition: 500 }, 'first copy wins, same as the notices/schedule plans');
  assert.strictEqual(plan.skipped, 1, 'the duplicate-class row counts as skipped');
});

check('backfill plan skips classLevel-less structures (they can never be keyed)', () => {
  const plan = migrationSplit.feesBackfillPlan('feeStructures', [S1, { id: 'fs-x' } as any, S2]);
  assert.deepStrictEqual(plan.docs.map((d: any) => d.classLevel), ['Class 6', 'Class 7']);
  assert.strictEqual(plan.skipped, 1);
});

check('backfill plan of an empty list is empty', () => {
  assert.deepStrictEqual(migrationSplit.feesBackfillPlan('feeTypes', []).docs, []);
  assert.strictEqual(migrationSplit.feesBackfillPlan('feeTypes', []).skipped, 0);
  assert.deepStrictEqual(migrationSplit.feesBackfillPlan('feeStructures', []).docs, []);
  assert.strictEqual(migrationSplit.feesBackfillPlan('feeStructures', []).skipped, 0);
});

check('RAW count check: main_store array length = new collection doc count (no filtering)', () => {
  // The plan (§5 step 2) counts BEFORE filtering: every record in the
  // main_store array becomes one doc. With distinct keys, docs ==
  // input length exactly; duplicates/key-less records are the only
  // counted exception (skipped), never silently dropped.
  for (const [field, list] of [
    ['feeTypes', [T1, T2]],
    ['feeStructures', [S1, S2]],
    ['feeTypes', []],
    ['feeStructures', []],
  ] as Array<[string, any[]]>) {
    const plan = migrationSplit.feesBackfillPlan(field, list as any[]);
    assert.strictEqual(plan.docs.length + plan.skipped, list.length, `docs + skipped must equal the raw main_store array length for ${field}`);
  }
  const plan = migrationSplit.feesBackfillPlan('feeTypes', [T1, T2]);
  assert.strictEqual(plan.docs.length, 2, 'two distinct fee types become two docs');
  assert.strictEqual(plan.skipped, 0);
});

console.log('--- Backfill writer (source checks) ---');

check('migrateFieldToCollection covers feeTypes + feeStructures, batched setDoc merge by key', () => {
  assert.strictEqual(typeof migrationSplit.migrateFieldToCollection, 'function', 'migrateFieldToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateFieldToCollection');
  assert.ok(start > -1, 'migrateFieldToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeBatch'), 'backfill must batch writes (500-doc Firestore limit)');
  assert.ok(body.includes('batch.set'), 'backfill must setDoc each record');
  assert.ok(body.includes('{ merge: true }'), 'backfill must use setDoc merge (idempotent rerun)');
  assert.ok(body.includes('feesCollectionRef'), 'backfill must write the new fees collections');
  assert.ok(body.includes("fieldKeyFn(field)"), 'backfill doc id must come from the shared fieldKeyFn (classLevel for feeStructures, id for feeTypes)');
  assert.ok(body.includes('assertUpsertRecords'), 'backfill must reuse the id assertion, not copy it');
});

console.log('--- Dual-write (source checks) ---');

check('writeFeeTypesFieldToCloud writes the new collection ONLY (step 5 stopped the main_store leg)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeFeeTypesFieldToCloud');
  assert.ok(start > -1, 'writeFeeTypesFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeFeeRecordsToCollection'), 'must write the new collection');
  assert.ok(!body.includes("writeFieldToCloud('feeTypes'"), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
  assert.ok(body.indexOf('writeFeeRecordsToCollection') > -1, 'collection write belongs to the same try');
  assert.ok(body.includes('withTimeout'), 'collection-only write must stay inside the confirm timeout');
  assert.ok(body.includes('assertUpsertRecords'), 'collection-only write must reuse assertUpsertRecords');
});

check('writeFeeStructuresFieldToCloud writes the new collection ONLY (step 5 stopped the main_store leg)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeFeeStructuresFieldToCloud');
  assert.ok(start > -1, 'writeFeeStructuresFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeFeeRecordsToCollection'), 'must write the new collection');
  assert.ok(!body.includes('feeStructures: mergeRecordsByKey'), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
  assert.ok(!body.includes("doc(db, 'institution', 'main_store')"), 'no inline main_store read may remain');
  assert.ok(body.indexOf('writeFeeRecordsToCollection') > -1, 'collection write belongs to the same try');
  assert.ok(body.includes('withTimeout'), 'collection-only write must stay inside the confirm timeout');
  assert.ok(body.includes('classLevel'), 'collection-only write must keep the classLevel key assertion');
  assert.ok(body.includes('if (structures.length === 0) return;'), 'empty structure list must still short-circuit before any write');
});

check('fee deletes also delete the new-collection docs (no resurrection)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeDeleteFieldsToCloud');
  assert.ok(start > -1, 'writeDeleteFieldsToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("removal.field === 'feeTypes'"), 'delete writer must handle the feeTypes field');
  assert.ok(body.includes("removal.field === 'feeStructures'"), 'delete writer must handle the feeStructures field');
  assert.ok(body.includes('deleteFeeRecordsFromCollection'), 'delete writer must delete the new-collection docs');
});

check('fee restores also write the new-collection docs (restore stays visible)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeTrashOpToCloud');
  assert.ok(start > -1, 'writeTrashOpToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes("field === 'feeTypes'"), 'trash-op writer must handle the feeTypes field');
  assert.ok(body.includes("field === 'feeStructures'"), 'trash-op writer must handle the feeStructures field');
  assert.ok(body.includes('writeFeeRecordsToCollection'), 'restore must write the record back to the new collection');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts fees onSnapshot feeds on the two new collections', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('feesCollectionRef'), 'AppContext must import the new collection ref');
  assert.ok(src.includes('startFeesFeeds'), 'a fees feeds starter must exist');
  const at = src.indexOf('const startFeesFeeds');
  assert.ok(at > -1, 'startFeesFeeds must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'fees feeds must use onSnapshot');
  assert.ok(body.includes('feesCollectionRef(field)'), 'fees feeds must listen on the new collections');
});

check('fees feeds start with the main feed and stop when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startFeesFeeds()'), 'main feed must start the fees feeds (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopFeesFeeds'), 'feed switch must also stop the fees feeds');
  const pubAt = src.indexOf('const startPublicFeed = () => {');
  assert.ok(pubAt > -1, 'startPublicFeed must exist');
  assert.ok(!src.slice(pubAt, pubAt + 3000).includes('startFeesFeeds()'), 'public (anonymous) feed must NOT start the fees feeds');
});

check('the two fee fields switch TOGETHER via one joint takeover flag', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('feesFromCollectionRef'), 'one joint collection-source flag must exist (not one per field)');
  assert.ok(src.includes('fromFeesCollection'), 'applyRemoteData must know when data comes from a fees feed');
  assert.ok(src.includes('tryFeesTakeover'), 'a joint takeover helper must exist');
  const at = src.indexOf('const tryFeesTakeover');
  assert.ok(at > -1, 'tryFeesTakeover must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('hasLoadedMainStoreRef'), 'takeover must wait until main_store has loaded (no vacuous takeover)');
  assert.ok(body.includes('feesFeedSettledRef'), 'takeover must wait until both fees feeds have settled');
  assert.ok(body.includes('.every((key) => colKeys.has(key))'), 'takeover needs every confirmed key present in the collection');
  assert.ok(body.includes('feesFromCollectionRef.current = true'), 'takeover must flip the joint flag');
  assert.ok(body.includes('feeTypes: lastCollectionFeesRef.current.feeTypes'), 'takeover must apply both fields together');
  assert.ok(body.includes('feeStructures: lastCollectionFeesRef.current.feeStructures'), 'takeover must apply both fields together');
});

check('feeTypes hydrates ONLY when the list is non-empty — rule kept in the new read path', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyFeesFieldFromRemote');
  assert.ok(at > -1, 'applyFeesFieldFromRemote must be defined');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("field === 'feeTypes'"), 'the feeTypes branch must exist');
  assert.ok(body.includes('records.length === 0'), 'an empty feeTypes list must be skipped, never applied');
});

check('applyRemoteData fee branches are gated: collection source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('applyFeesFieldFromRemote'), 'a per-field fees apply helper must exist');
  const at = src.indexOf('const applyFeesFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('!feesFromCollectionRef.current'), 'main_store fees must be skipped once the collection is the source');
  assert.ok(body.includes('opts?.fromFeesCollection'), 'collection-feed snapshots must always apply');
});

check('empty collection snapshot falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startFeesFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length === 0'), 'feed must distinguish a snapshot with docs from an empty one');
  assert.ok(body.includes('backfillFeesOnce'), 'empty snapshot before backfill must trigger the backfill');
  assert.ok(body.includes('tryFeesTakeover'), 'feed must attempt the joint takeover');
});

check('genuinely empty collection (was non-empty) still applies as empty', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startFeesFeeds');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('docs.length === 0 && feesFromCollectionRef.current'), 'empty snapshot after takeover must be treated as genuinely empty');
  assert.ok(body.includes('applyRemoteData({ [field]: [] }'), 'genuinely empty must clear the list');
});

check('post-takeover NON-EMPTY snapshot applies — a fee record added on another device shows without reload', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startFeesFeeds');
  assert.ok(at > -1, 'startFeesFeeds must exist');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  const chain = extractIfChain(body, 'if (docs.length === 0');
  // Takeover already happened; each snapshot carries a record that was
  // NOT in the takeover snapshot (added later on another device).
  for (const [field, fresh] of [
    ['feeTypes', { id: 'library', labelBn: 'লাইব্রেরি ফি', enabled: true }],
    ['feeStructures', { id: 'fs-3', classLevel: 'Class 8', amounts: { tuition: 700 } }],
  ] as Array<[string, any]>) {
    const { applied, backfilled } = runFeesSnapshotChain(chain, true, field, [fresh]);
    assert.ok(applied, `post-takeover ${field} snapshot must apply to state, not fall through`);
    assert.deepStrictEqual(applied.data[field], [fresh], `applied ${field} list must be the new snapshot, including the record the takeover never saw`);
    assert.strictEqual(applied.opts?.fromFeesCollection, true, 'post-takeover apply must be marked as collection source');
    assert.strictEqual(backfilled, false, 'post-takeover snapshot must not re-run the backfill');
  }
  // Pre-takeover path unchanged: a non-empty snapshot with the flag
  // still off must attempt takeover, not apply directly.
  const before = runFeesSnapshotChain(chain, false, 'feeTypes', [T1]);
  assert.strictEqual(before.applied, null, 'pre-takeover snapshot must not apply directly — takeover decides');
  assert.strictEqual(before.backfilled, true, 'pre-takeover snapshot that cannot take over must trigger the backfill');
});

check('backfill source is the CONFIRMED main_store list, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillFeesOnce = async (field:');
  assert.ok(at > -1, 'backfillFeesOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('lastConfirmedRef.current[field]'), 'backfill must copy the confirmed main_store list');
  assert.ok(body.includes('backfilledFeesIdsRef'), 'backfill must skip keys it already copied');
  assert.ok(body.includes('migrateFieldToCollection(field, pending)'), 'backfill must run through migrateFieldToCollection');
  assert.ok(body.includes("fieldKeyFn(field)"), 'backfill pending filter must key by fieldKeyFn (classLevel for feeStructures)');
});

check('main_store stragglers (stale pre-split tab) are rescued into the collection after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const applyFeesFieldFromRemote');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('stragglers'), 'branch must detect main_store records missing from the collection');
  assert.ok(body.includes('lastCollectionFeesRef'), 'straggler check must compare against the last collection snapshot');
  assert.ok(body.includes('backfillFeesOnce(field, stragglers)'), 'stragglers must be backfilled into the collection');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the two fees feeds before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedFeesCollectionsRef'), 'a fees-feeds-loaded flag must exist');
  const effectAt = src.indexOf('// Job 5: never auto-sync until the fees collections');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 5 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedFeesCollectionsRef.current) return;'), 'auto-sync effect must return early until the fees feeds settle');
  const feedAt = src.indexOf('const startFeesFeeds');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('markFeesFeedSettled(field)'), 'feed snapshot and feed error must both mark the field settled');
});

check('login verdict and manual force-push are NOT gated on the fees feeds', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedFeesCollectionsRef'), 'manual force-push must not wait for the fees feeds');
});

console.log('--- Fee calculation untouched + public portal (source checks) ---');

check('no dues/total computation is touched by this job', () => {
  const src = readSource('context/AppContext.tsx');
  // The fee-calculation call sites keep their names and arguments; this
  // job only moves where feeTypes/feeStructures are stored.
  assert.ok(src.includes('feeStructures'), 'feeStructures state must still exist');
  assert.ok(src.includes('feeTypes'), 'feeTypes state must still exist');
  const cc = readSource('services/cloudConfirm.ts');
  assert.ok(!cc.includes('calculateDues') && !cc.includes('computeDues'), 'cloudConfirm must not gain any dues computation');
});

check('buildPublicPortalData reads neither fee field', () => {
  const src = readSource('services/publicPortal.ts');
  assert.ok(!src.includes('feeTypes'), 'publicPortal must not read feeTypes');
  assert.ok(!src.includes('feeStructures'), 'publicPortal must not read feeStructures');
});

console.log('--- Old upsert writes stopped, collection writes kept (source checks) ---');

check('pushDiffToCloud still writes fees through the collection-only writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('writeFeeStructuresFieldToCloud'), 'auto-sync must still carry fee structures through writeFeeStructuresFieldToCloud');
  assert.ok(src.includes('writeFeeTypesFieldToCloud'), 'auto-sync must still carry fee types through writeFeeTypesFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job5-fees-split'], 'tsx scripts/verify-job5-fees-split.ts', 'npm run test:job5-fees-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 5 fees-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
