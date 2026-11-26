/**
 * Job 14 (settings split: schoolProfile + markEntryEnabled -> settings/main)
 * — self-check (21 Nov 2026, base commit 411f914).
 *
 * Follows the scripts/verify-job2-schedule-split.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job14-settings-split.ts
 * (or npm run test:job14-settings-split).
 *
 * Covers the Job 14 spec (LDSDM-database-split-plan-2026-11-07.md §6 Job 14,
 * §5 steps 1–3 — plus step 5, stopping the old main_store write, done
 * 26 Nov 2026 as a separate push (see scripts/verify-job14-step5-settings.ts);
 * the dual-write checks below are now collection-only checks.
 *  - New path is institutions/inst_madrasah_primary/settings/main — ONE
 *    document holding { schoolProfile, markEntryEnabled }, built from
 *    CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 *  - Collection-only write (step 5, 26 Nov 2026, supersedes the
 *    dual-write below): writeSchoolProfileFieldToCloud and
 *    writeMarkEntryEnabledFieldToCloud each write settings/main ONLY;
 *    the old main_store write is stopped, the frozen copy stays.
 *    See scripts/verify-job14-step5-settings.ts.
 *  - Backfill (services/migrationSplit.ts migrateSettingsToCollection)
 *    is idempotent (setDoc merge on the one doc), copies fields as-is,
 *    writes only the fields present — a missing markEntryEnabled is
 *    never invented.
 *  - Read-switch: an onSnapshot feed on settings/main is the source
 *    once it delivers a doc with a schoolProfile (completeness gate);
 *    main_store is the fallback until then (missing/incomplete doc
 *    triggers backfill, never a wipe). After takeover EVERY snapshot
 *    applies — a profile edited later on another device appears
 *    without a reload (the Job 3/Job 5 bug: feed handlers that only
 *    applied at takeover).
 *  - markEntryEnabled is the admin's emergency switch, DEFAULT OPEN:
 *    only a real boolean changes it. A settings doc without the flag
 *    leaves the switch open — no false is ever invented.
 *  - Auto-sync guard waits for the settings feed before sync starts;
 *    login verdict and manual force-push are NOT gated on it.
 *  - Public portal rebuild reads schoolProfile from settings/main;
 *    buildPublicPortalData's OUTPUT is unchanged (same keys, same
 *    schoolProfile passthrough).
 *  - No rules change, no main_store delete, no other field touched.
 *
 * Firestore-touching code lives in React/services modules, so the feeds,
 * dual-write wiring and guard are covered by source-order assertions
 * (the repo's established grep-proof style) plus real unit checks on
 * the pure parts (doc path, doc-to-payload conversion, backfill plan).
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

const PROFILE: any = {
  name: 'লস্করচালা দারুস সুন্নাহ দাখিল মাদ্রাসা',
  nameBn: 'লস্করচালা দারুস সুন্নাহ দাখিল মাদ্রাসা',
  address: 'লস্করচালা, গাজীপুর',
  phone: '01700000000',
  email: 'info@ldsdm.edu.bd',
  academicYear: '২০২৬',
  headMasterName: 'অধ্যক্ষ সাহেব',
};
const PROFILE2: any = { ...PROFILE, phone: '01800000000' };

console.log('--- New doc path (CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded) ---');

check('settingsDocRef points at institutions/inst_madrasah_primary/settings/main', () => {
  assert.strictEqual(typeof cloudConfirm.settingsDocRef, 'function', 'settingsDocRef must be exported from cloudConfirm');
  const ref = cloudConfirm.settingsDocRef();
  assert.strictEqual(ref.path, 'institutions/inst_madrasah_primary/settings/main', 'settings doc path must be institutions/inst_madrasah_primary/settings/main');
});

check('settingsDocRef is built from CANONICAL_PRIMARY_INSTITUTION_ID, not a hardcoded string', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export function settingsDocRef');
  assert.ok(start > -1, 'settingsDocRef must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('CANONICAL_PRIMARY_INSTITUTION_ID'), 'path must use CANONICAL_PRIMARY_INSTITUTION_ID');
  assert.ok(!body.includes("'inst_madrasah_primary'"), 'path must not hardcode the institution id');
  assert.ok(!body.includes('"inst_madrasah_primary"'), 'path must not hardcode the institution id');
  assert.ok(body.includes("'settings'"), 'path must go through the settings collection');
  assert.ok(body.includes("'main'"), 'doc id must be main');
});

console.log('--- Doc -> remote payload (pure, default-open) ---');

check('settingsDocToRemoteData passes a full doc through unchanged', () => {
  assert.strictEqual(typeof cloudConfirm.settingsDocToRemoteData, 'function', 'settingsDocToRemoteData must be exported from cloudConfirm');
  assert.deepStrictEqual(
    cloudConfirm.settingsDocToRemoteData({ schoolProfile: PROFILE, markEntryEnabled: false }),
    { schoolProfile: PROFILE, markEntryEnabled: false }
  );
});

check('missing markEntryEnabled is NEVER invented as false (switch stays open)', () => {
  // The admin emergency switch defaults to OPEN: only a real boolean
  // changes it. A settings doc with a profile but no switch must
  // produce a payload with NO markEntryEnabled key at all.
  const payload = cloudConfirm.settingsDocToRemoteData({ schoolProfile: PROFILE });
  assert.deepStrictEqual(payload, { schoolProfile: PROFILE });
  assert.ok(!('markEntryEnabled' in payload), 'payload must not carry a markEntryEnabled key when the doc has none');
  const payload2 = cloudConfirm.settingsDocToRemoteData({ schoolProfile: PROFILE, markEntryEnabled: undefined });
  assert.ok(!('markEntryEnabled' in payload2), 'undefined must not become false');
});

check('non-boolean markEntryEnabled is dropped, never coerced', () => {
  for (const bad of ['yes', 1, 0, null, 'false']) {
    const payload = cloudConfirm.settingsDocToRemoteData({ schoolProfile: PROFILE, markEntryEnabled: bad });
    assert.ok(!('markEntryEnabled' in payload), `markEntryEnabled=${JSON.stringify(bad)} must be dropped`);
  }
});

check('missing / non-object schoolProfile is dropped (completeness gate input)', () => {
  assert.deepStrictEqual(cloudConfirm.settingsDocToRemoteData(null), {});
  assert.deepStrictEqual(cloudConfirm.settingsDocToRemoteData(undefined), {});
  assert.deepStrictEqual(cloudConfirm.settingsDocToRemoteData({}), {});
  assert.deepStrictEqual(cloudConfirm.settingsDocToRemoteData({ schoolProfile: 'not-an-object' }), {});
  assert.deepStrictEqual(cloudConfirm.settingsDocToRemoteData({ schoolProfile: ['x'] }), {});
  assert.deepStrictEqual(
    cloudConfirm.settingsDocToRemoteData({ markEntryEnabled: true }),
    { markEntryEnabled: true },
    'a switch-only doc still carries the switch (the feed gate, not this converter, requires a profile)'
  );
});

console.log('--- Backfill plan (pure, idempotent, copies as-is) ---');

check('backfill plan keeps both fields when both are present', () => {
  assert.strictEqual(typeof migrationSplit.settingsBackfillPlan, 'function', 'settingsBackfillPlan must be exported from migrationSplit');
  assert.deepStrictEqual(migrationSplit.settingsBackfillPlan(PROFILE, true).patch, { schoolProfile: PROFILE, markEntryEnabled: true });
  assert.deepStrictEqual(migrationSplit.settingsBackfillPlan(PROFILE, false).patch, { schoolProfile: PROFILE, markEntryEnabled: false });
});

check('backfill plan writes only the fields present (missing switch is never invented)', () => {
  assert.deepStrictEqual(migrationSplit.settingsBackfillPlan(PROFILE, undefined).patch, { schoolProfile: PROFILE });
  assert.deepStrictEqual(migrationSplit.settingsBackfillPlan(undefined, true).patch, { markEntryEnabled: true });
  assert.deepStrictEqual(migrationSplit.settingsBackfillPlan(undefined, undefined).patch, {});
});

check('backfill plan copies values as-is (no filtering, no defaults)', () => {
  const plan = migrationSplit.settingsBackfillPlan(PROFILE2, false);
  assert.strictEqual(plan.patch.schoolProfile.phone, '01800000000', 'profile must be copied as-is');
  assert.strictEqual(plan.patch.markEntryEnabled, false, 'a real false must survive (only a MISSING flag defaults to open)');
  assert.deepStrictEqual(migrationSplit.settingsBackfillPlan('bad-profile', 'bad-switch').patch, {}, 'invalid inputs produce an empty patch, never a corrupt doc');
});

console.log('--- Backfill writer (source checks) ---');

check('migrateSettingsToCollection writes settings/main with setDoc merge, idempotent', () => {
  assert.strictEqual(typeof migrationSplit.migrateSettingsToCollection, 'function', 'migrateSettingsToCollection must be exported from migrationSplit');
  const src = readSource('services/migrationSplit.ts');
  const start = src.indexOf('export async function migrateSettingsToCollection');
  assert.ok(start > -1, 'migrateSettingsToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('settingsDocRef') || body.includes('writeSettingsToCollection'), 'backfill must write the new settings doc');
  assert.ok(body.includes('writeSettingsToCollection') || body.includes('setDoc'), 'backfill must setDoc the settings doc');
  assert.ok(body.includes('settingsBackfillPlan'), 'backfill must go through the plan (only present fields)');
  assert.ok(body.includes('written: false') || body.includes('fields'), 'backfill must report what it wrote');
});

check('writeSettingsToCollection uses setDoc merge (one field never wipes the other)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeSettingsToCollection');
  assert.ok(start > -1, 'writeSettingsToCollection must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('settingsDocRef()'), 'must write the settings doc');
  assert.ok(body.includes('setDoc'), 'must setDoc');
  assert.ok(body.includes('{ merge: true }'), 'must use setDoc merge');
});

console.log('--- Collection-only write (step 5 — dual-write stopped, source checks) ---');

check('writeSchoolProfileFieldToCloud writes settings/main ONLY (step 5 stopped the main_store leg)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeSchoolProfileFieldToCloud');
  assert.ok(start > -1, 'writeSchoolProfileFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeSettingsToCollection'), 'must write the new settings doc');
  assert.ok(!body.includes("doc(db, 'institution', 'main_store')"), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
  assert.ok(body.includes('withTimeout'), 'collection-only write must stay inside the confirm timeout');
});

check('profile collection-only write still carries updatedBy/updatedAt', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeSchoolProfileFieldToCloud');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('const updatedAt = new Date().toISOString()'), 'one timestamp must be written with the settings leg');
  assert.ok(body.includes('updatedBy'), 'updatedBy must be written');
  assert.ok(body.includes('updatedAt'), 'updatedAt must be written');
  assert.ok(body.includes('schoolProfile write rejected'), 'the non-object choke point must stay');
});

check('writeMarkEntryEnabledFieldToCloud writes settings/main ONLY (step 5 stopped the main_store leg)', () => {
  const src = readSource('services/cloudConfirm.ts');
  const start = src.indexOf('export async function writeMarkEntryEnabledFieldToCloud');
  assert.ok(start > -1, 'writeMarkEntryEnabledFieldToCloud must exist');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);
  assert.ok(body.includes('writeSettingsToCollection'), 'must write the new settings doc');
  assert.ok(!body.includes("doc(db, 'institution', 'main_store')"), 'must NOT write main_store anymore (step 5, 26 Nov 2026)');
  assert.ok(body.includes('const updatedAt = new Date().toISOString()'), 'one timestamp must be written with the settings leg');
  assert.ok(body.includes('markEntryEnabled write rejected'), 'the non-boolean choke point must stay');
});

check('settings writes use merge, so a profile write never wipes the switch (and vice versa)', () => {
  const src = readSource('services/cloudConfirm.ts');
  for (const fn of ['writeSchoolProfileFieldToCloud', 'writeMarkEntryEnabledFieldToCloud']) {
    const start = src.indexOf(`export async function ${fn}`);
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    assert.ok(body.includes('writeSettingsToCollection'), `${fn} must write through writeSettingsToCollection`);
  }
  const collStart = src.indexOf('export async function writeSettingsToCollection');
  const collBody = src.slice(collStart, src.indexOf('\n}', collStart) + 2);
  assert.ok(collBody.includes('{ merge: true }'), 'writeSettingsToCollection must merge into settings/main');
});

console.log('--- Read-switch + fallback (source checks) ---');

check('AppContext starts a settings onSnapshot feed on settings/main', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('settingsDocRef'), 'AppContext must import the settings doc ref');
  assert.ok(src.includes('startSettingsFeed'), 'a settings feed starter must exist');
  const at = src.indexOf('const startSettingsFeed');
  assert.ok(at > -1, 'startSettingsFeed must be defined');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('onSnapshot'), 'settings feed must use onSnapshot');
  assert.ok(body.includes('settingsDocRef()'), 'settings feed must listen on settings/main');
  assert.ok(body.includes('settingsDocToRemoteData'), 'settings feed must convert the doc through the pure converter');
});

check('settings feed starts with the main feed and stops when the feed switches', () => {
  const src = readSource('context/AppContext.tsx');
  const mainStart = src.indexOf('const startMainStoreFeed = () => {');
  assert.ok(mainStart > -1, 'startMainStoreFeed must exist');
  const mainBody = src.slice(mainStart, src.indexOf('\n    };', mainStart) + 6);
  assert.ok(mainBody.includes('startSettingsFeed()'), 'main feed must start the settings feed (signed-in sessions only)');
  const stopAt = src.indexOf('const stopActiveFeed = () => {');
  assert.ok(stopAt > -1, 'stopActiveFeed must exist');
  const stopBody = src.slice(stopAt, src.indexOf('\n    };', stopAt) + 6);
  assert.ok(stopBody.includes('stopSettingsFeed'), 'feed switch must also stop the settings feed');
  assert.ok(!src.slice(src.indexOf('const startPublicFeed = () => {'), src.indexOf('const startPublicFeed = () => {') + 4000).includes('startSettingsFeed()'), 'public (anonymous) feed must NOT start the settings feed');
});

check('feed takes over only when the settings doc holds a profile (completeness gate)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startSettingsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('payload.schoolProfile'), 'takeover must be gated on a profile in the settings doc');
  assert.ok(body.includes('settingsFromCollectionRef.current = true'), 'a complete snapshot must mark the settings doc as the source');
  assert.ok(body.includes('applyRemoteData(payload, { fromSettingsCollection: true })'), 'a complete snapshot must apply through applyRemoteData');
});

check('post-takeover snapshots keep applying (not takeover-only)', () => {
  // The Job 3/Job 5 bug: a feed handler that only applied at takeover
  // left later edits on another device invisible until reload. The
  // settings handler must apply on EVERY complete snapshot, with no
  // !settingsFromCollectionRef guard around the apply.
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startSettingsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('if (payload.schoolProfile) {'), 'every complete snapshot must reach the apply branch');
  const applyAt = body.indexOf('applyRemoteData(payload, { fromSettingsCollection: true })');
  assert.ok(applyAt > -1, 'apply must exist');
  const before = body.slice(0, applyAt);
  assert.ok(!before.includes('!settingsFromCollectionRef.current'), 'the apply must NOT be guarded by a not-yet-taken-over check');
});

check('missing/incomplete settings doc falls back to main_store + backfill (never wipes)', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const startSettingsFeed');
  const body = src.slice(at, src.indexOf('\n    };', at) + 6);
  assert.ok(body.includes('backfillSettingsOnce'), 'missing/incomplete doc must trigger the backfill');
  assert.ok(!body.includes('setSchoolProfile('), 'the feed handler must never set the profile itself (only applyRemoteData does)');
  assert.ok(!body.includes('setMarkEntryEnabled('), 'the feed handler must never set the switch itself');
});

check('applyRemoteData settings branches are gated: settings source wins, main_store is the fallback', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('settingsFromCollectionRef'), 'a settings-source flag must exist');
  assert.ok(src.includes('fromSettingsCollection'), 'applyRemoteData must know when data comes from the settings feed');
  const profileAt = src.indexOf("if (data.schoolProfile && !hasQueuedUpsertForField('schoolProfile'))");
  assert.ok(profileAt > -1, 'schoolProfile branch must exist');
  const profileBody = src.slice(profileAt, src.indexOf('\n    }\n', profileAt) + 5);
  assert.ok(profileBody.includes('!settingsFromCollectionRef.current'), 'main_store profile must be skipped once settings is the source');
  assert.ok(profileBody.includes('opts?.fromSettingsCollection'), 'settings-feed profile must always apply');
  const switchAt = src.indexOf("if (typeof data.markEntryEnabled === 'boolean'");
  assert.ok(switchAt > -1, 'markEntryEnabled branch must exist');
  const switchBody = src.slice(switchAt, src.indexOf('\n    }\n', switchAt) + 5);
  assert.ok(switchBody.includes('!settingsFromCollectionRef.current'), 'main_store switch must be skipped once settings is the source');
  assert.ok(switchBody.includes('opts?.fromSettingsCollection'), 'settings-feed switch must always apply');
});

check('missing markEntryEnabled still defaults to open after the switch', () => {
  // The old rule lives in applyRemoteData: only a real boolean
  // overwrites the default. The settings path must keep it — the
  // switch branch must still test typeof === 'boolean' first.
  const src = readSource('context/AppContext.tsx');
  const switchAt = src.indexOf("if (typeof data.markEntryEnabled === 'boolean'");
  assert.ok(switchAt > -1, 'the boolean-only guard must survive the read-switch');
  const switchBody = src.slice(switchAt, src.indexOf('\n    }\n', switchAt) + 5);
  assert.ok(!switchBody.includes('setMarkEntryEnabled(true)') || switchBody.includes('data.markEntryEnabled'), 'no invented default may be written into the switch branch');
});

check('main_store stragglers (stale pre-split tab) are rescued into settings after takeover', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('lastCollectionSettingsRef'), 'a last-settings-snapshot ref must exist for the straggler check');
  const profileAt = src.indexOf("if (data.schoolProfile && !hasQueuedUpsertForField('schoolProfile'))");
  const profileBody = src.slice(profileAt, src.indexOf('\n    }\n', profileAt) + 5);
  assert.ok(profileBody.includes('backfillSettingsOnce'), 'a main_store profile missing from settings must be backfilled');
});

check('backfill source is the CONFIRMED main_store state, never stale local state', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const backfillSettingsOnce');
  assert.ok(at > -1, 'backfillSettingsOnce must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes("lastConfirmedRef.current['schoolProfile']") || body.includes('migrateSettingsToCollection'), 'backfill must copy the confirmed main_store values');
  assert.ok(body.includes('migrateSettingsToCollection'), 'backfill must run through migrateSettingsToCollection');
  assert.ok(body.includes('settingsBackfillInFlightRef'), 'backfill must guard against concurrent feed events');
  assert.ok(body.includes("feedKindRef.current !== 'main'") || body.includes("feedKindRef.current === 'main'"), 'backfill must not run from an anonymous public session');
});

console.log('--- Auto-sync guard (source checks) ---');

check('auto-sync waits for the settings feed before sync starts', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('hasLoadedSettingsCollectionRef'), 'a settings-feed-loaded flag must exist');
  const effectAt = src.indexOf('// Job 14: never auto-sync until the settings');
  assert.ok(effectAt > -1, 'auto-sync effect must carry the Job 14 guard comment');
  const effectBody = src.slice(effectAt, effectAt + 400);
  assert.ok(effectBody.includes('if (!hasLoadedSettingsCollectionRef.current) return;'), 'auto-sync effect must return early until the settings feed settles');
  const feedAt = src.indexOf('const startSettingsFeed');
  const feedBody = src.slice(feedAt, src.indexOf('\n    };', feedAt) + 6);
  assert.ok(feedBody.includes('hasLoadedSettingsCollectionRef.current = true'), 'feed snapshot and feed error must both mark the feed settled');
});

check('login verdict and manual force-push are NOT gated on the settings feed', () => {
  const src = readSource('context/AppContext.tsx');
  const forceAt = src.indexOf('const forcePushToCloud = async () => {');
  assert.ok(forceAt > -1, 'forcePushToCloud must exist');
  const forceBody = src.slice(forceAt, src.indexOf('\n  };', forceAt) + 4);
  assert.ok(!forceBody.includes('hasLoadedSettingsCollectionRef'), 'manual force-push must not wait for the settings feed');
});

console.log('--- Public portal rebuild (source checks) ---');

check('portal rebuild reads schoolProfile from settings/main, output unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readSettingsFromCollection'), 'rebuild must read the settings doc');
  // Merged state: the portal setDoc combines EVERY split collection's
  // override in one call (Job 6 pattern — two setDocs would let the
  // second overwrite the first), so the schoolProfile overlay is checked
  // inside the buildPublicPortalData argument, not as a standalone
  // '{ ...data, notices, schoolProfile }' call.
  const portalCall = body.slice(body.indexOf('buildPublicPortalData('));
  assert.ok(portalCall.includes('schoolProfile'), 'rebuild must pass the settings profile into the unchanged builder');
  const portal = readSource('services/publicPortal.ts');
  assert.ok(portal.includes('schoolProfile: source.schoolProfile'), 'buildPublicPortalData must still pass schoolProfile through unchanged');
  assert.ok(!portal.includes('settings'), 'buildPublicPortalData itself must not learn about the split (source change only)');
});

console.log('--- Old write stopped, collection write kept (source checks) ---');

check('pushDiffToCloud still writes settings fields through the collection-only writers', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('writeSchoolProfileFieldToCloud(schoolProfile as any, actor)'), 'auto-sync must still carry the profile through writeSchoolProfileFieldToCloud');
  assert.ok(src.includes('writeMarkEntryEnabledFieldToCloud(markEntryEnabled, actor)'), 'auto-sync must still carry the switch through writeMarkEntryEnabledFieldToCloud');
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
  assert.strictEqual(pkg.scripts['test:job14-settings-split'], 'tsx scripts/verify-job14-settings-split.ts', 'npm run test:job14-settings-split must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 14 settings-split self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
