/**
 * Job 14 step 5 (settings split) — self-check (26 Nov 2026, base commit dcc44ee5).
 *
 * Follows the scripts/verify-job1-step5-notices.ts pattern: node:assert
 * + tsx, no test framework. Run: npx tsx scripts/verify-job14-step5-settings.ts
 * (or npm run test:job14-step5-settings).
 *
 * Step 5 (LDSDM-database-split-plan-2026-11-07.md §5 step 5) stops the
 * OLD main_store settings write after the dual-write soak:
 *  - writeSchoolProfileFieldToCloud writes settings/main ONLY — the
 *    inline main_store setDoc leg is gone.
 *  - writeMarkEntryEnabledFieldToCloud writes settings/main ONLY — the
 *    inline main_store setDoc leg is gone.
 *  - main_store.schoolProfile / main_store.markEntryEnabled are NOT
 *    deleted — they stay as a frozen copy.
 *  - The collection write stays wired everywhere it was: pushDiffToCloud
 *    auto-sync, the queued-payload replay, and the confirm functions
 *    confirmSchoolProfileCloudSync / confirmMarkEntryEnabledCloudSync.
 *  - Unlike Job 1 (notices), these are scalar fields that are never
 *    deleted or trashed, so there is no delete/restore prune/union to
 *    keep — the frozen copy simply stays, untouched.
 *  - Read path untouched: settings feed + takeover gate, backfill,
 *    portal rebuild reading settings/main.
 *  - markEntryEnabled is the admin's emergency switch, DEFAULT OPEN:
 *    only a real boolean changes it in applyRemoteData. A missing
 *    value means open — no false is ever invented.
 *  - No rules change, no main_store delete, no other field touched,
 *    no marksheet file touched.
 *
 * Context: Job 14 split landed 21 Nov 2026 (base commit 411f914),
 * so dual-write ran 21–26 Nov (5 days) — short of the plan's one
 * week; the soak shortfall is recorded, not hidden. The settings
 * doc holds exactly 2 fields (profile + switch), both live in the
 * new project ldsdmms, and the frozen main_store copy keeps the
 * same values, so the data risk is nil.
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

console.log('--- Step 5: old main_store legs stopped ---');

check('writeSchoolProfileFieldToCloud still writes settings/main, choke point + timeout kept', () => {
  const body = writerBody('writeSchoolProfileFieldToCloud');
  assert.ok(body.includes('writeSettingsToCollection'), 'must still write settings/main');
  assert.ok(body.includes('schoolProfile write rejected'), 'the profile-object choke point must stay');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeSchoolProfileFieldToCloud no longer writes main_store', () => {
  const body = writerBody('writeSchoolProfileFieldToCloud');
  assert.ok(!body.includes("doc(db, 'institution', 'main_store')"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('await setDoc(ref,'), 'no inline main_store setDoc may remain in the profile writer');
});

check('writeMarkEntryEnabledFieldToCloud still writes settings/main, choke point + timeout kept', () => {
  const body = writerBody('writeMarkEntryEnabledFieldToCloud');
  assert.ok(body.includes('writeSettingsToCollection'), 'must still write settings/main');
  assert.ok(body.includes('markEntryEnabled write rejected'), 'the boolean choke point must stay');
  assert.ok(body.includes('withTimeout'), 'must stay inside the confirm timeout');
});

check('writeMarkEntryEnabledFieldToCloud no longer writes main_store', () => {
  const body = writerBody('writeMarkEntryEnabledFieldToCloud');
  assert.ok(!body.includes("doc(db, 'institution', 'main_store')"), 'the old main_store leg must be gone');
  assert.ok(!body.includes('await setDoc(ref,'), 'no inline main_store setDoc may remain in the switch writer');
});

check('no other main_store schoolProfile/markEntryEnabled upsert remains in cloudConfirm', () => {
  const src = readSource('services/cloudConfirm.ts');
  // The two writers are the only upsert writers for these fields; the
  // delete/restore writers never touch them (scalars are never deleted).
  assert.ok(!src.includes('schoolProfile: stripUndefinedRecord(profile),\n      updatedBy'), 'no main_store profile setDoc may remain anywhere');
  assert.ok(!src.includes('markEntryEnabled: enabled,\n      updatedBy'), 'no main_store switch setDoc may remain anywhere');
});

console.log('--- Collection write stays wired everywhere ---');

check('pushDiffToCloud still routes the profile through writeSchoolProfileFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('writeSchoolProfileFieldToCloud(schoolProfile as any, actor)'), 'auto-sync must still carry the profile (now collection-only)');
});

check('pushDiffToCloud still routes the switch through writeMarkEntryEnabledFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('writeMarkEntryEnabledFieldToCloud(markEntryEnabled, actor)'), 'auto-sync must still carry the switch (now collection-only)');
});

check('queued-payload replay still routes the profile through writeSchoolProfileFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf("if (item.field === 'schoolProfile')");
  assert.ok(at > -1, 'queue replay scalar branch for schoolProfile must exist');
  const body = src.slice(at, at + 400);
  assert.ok(body.includes('writeSchoolProfileFieldToCloud(item.scalarValue as any, actor)'), 'replay must still carry the profile (now collection-only)');
});

check('queued-payload replay still routes the switch through writeMarkEntryEnabledFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf("} else if (item.field === 'markEntryEnabled')");
  assert.ok(at > -1, 'queue replay scalar branch for markEntryEnabled must exist');
  const body = src.slice(at, at + 400);
  assert.ok(body.includes('writeMarkEntryEnabledFieldToCloud(item.scalarValue as boolean, actor)'), 'replay must still carry the switch (now collection-only)');
});

check('confirmSchoolProfileCloudSync still uses writeSchoolProfileFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmSchoolProfileCloudSync');
  assert.ok(at > -1, 'confirmSchoolProfileCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeSchoolProfileFieldToCloud(profile as any, confirmActorName())'), 'profile save confirm must still call the profile writer');
});

check('confirmMarkEntryEnabledCloudSync still uses writeMarkEntryEnabledFieldToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const confirmMarkEntryEnabledCloudSync');
  assert.ok(at > -1, 'confirmMarkEntryEnabledCloudSync must exist');
  const body = src.slice(at, at + 900);
  assert.ok(body.includes('writeMarkEntryEnabledFieldToCloud(value, confirmActorName())'), 'switch save confirm must still call the switch writer');
});

console.log('--- Default-open rule + read path untouched ---');

check('applyRemoteData still changes markEntryEnabled only on a real boolean (default open)', () => {
  const src = readSource('context/AppContext.tsx');
  const switchAt = src.indexOf("if (typeof data.markEntryEnabled === 'boolean'");
  assert.ok(switchAt > -1, 'the boolean-only guard must survive step 5');
  const switchBody = src.slice(switchAt, src.indexOf('\n    }\n', switchAt) + 5);
  assert.ok(!switchBody.includes('setMarkEntryEnabled(true)') || switchBody.includes('data.markEntryEnabled'), 'no invented default may be written into the switch branch');
});

check('settings feed, takeover gate and backfill are unchanged', () => {
  const src = readSource('context/AppContext.tsx');
  assert.ok(src.includes('const startSettingsFeed'), 'startSettingsFeed must exist');
  assert.ok(src.includes('settingsFromCollectionRef'), 'collection-source flag must exist');
  assert.ok(src.includes('backfillSettingsOnce'), 'backfill must still exist');
  assert.ok(src.includes('applyRemoteData(payload, { fromSettingsCollection: true })'), 'feed must still apply collection snapshots');
});

check('portal rebuild still reads schoolProfile from settings/main', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const rebuildPublicPortalFromCloud = async () => {');
  assert.ok(at > -1, 'rebuildPublicPortalFromCloud must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  assert.ok(body.includes('readSettingsFromCollection'), 'portal rebuild must read the settings doc');
  const portalCall = body.slice(body.indexOf('buildPublicPortalData('));
  assert.ok(portalCall.includes('schoolProfile'), 'rebuild must pass the settings profile into the unchanged builder');
});

console.log('--- Frozen copy is kept, never deleted ---');

check('no main_store delete anywhere', () => {
  const appSrc = readSource('context/AppContext.tsx');
  const ccSrc = readSource('services/cloudConfirm.ts');
  assert.ok(!appSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes("deleteDoc(doc(db, 'institution', 'main_store')"), 'main_store must never be deleted');
  assert.ok(!ccSrc.includes('deleteField'), 'the frozen settings fields must never be deleted from main_store');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:job14-step5-settings'], 'tsx scripts/verify-job14-step5-settings.ts', 'npm run test:job14-step5-settings must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: Job 14 step 5 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
