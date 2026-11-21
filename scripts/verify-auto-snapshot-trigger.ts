/**
 * Daily auto snapshot — boot-time trigger self-check (20 Nov 2026, base commit 39351fb).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-auto-snapshot-trigger.ts
 * (or npm run test:auto-snapshot-trigger).
 *
 * Bug: the automatic daily cloud snapshot had NO trigger of its own.
 * Its only caller was the auto-sync effect in AppContext — the FIRST
 * confirmed write of the day (maybeCreateDailyCloudSnapshot, called
 * only when pushDiffToCloud returns with no failed fields). A day (or
 * a morning window) with no confirmed write before the check simply
 * got no snapshot, and a first write whose sync failed / was skipped
 * (degraded, no-auth) had no retry until the NEXT write. That matches
 * the 18/11 + 20/11 misses (snapshot latest 17/11 7:32, then 19/11
 * 7:26, nothing on 18/11 or 20/11 by ~07:33) with no code change:
 * on 19/11 a write happened before 7:26; on 18/11 and 20/11 none had
 * happened before the check. There is no scheduler, no interval and
 * no on-load check anywhere in the code — the write path was the
 * only trigger (one caller in the whole repo).
 *
 * Fix contract:
 *  - AppContext attempts the daily snapshot once per boot, after the
 *    first server snapshot has settled (cloudHydrated) and with a
 *    signed-in session (authUser) — the same once-per-boot pattern as
 *    the banner fee seeding effect — by calling the existing
 *    maybeCreateDailyCloudSnapshot, which already guards the date key,
 *    auth and degraded state itself. The public feed never triggers
 *    it (same feedKind guard as the auto-sync effect).
 *  - The existing write-path trigger is untouched: the auto-sync
 *    effect still calls maybeCreateDailyCloudSnapshot on a confirmed
 *    write, so a day's first write still snapshots even if the boot
 *    attempt was skipped (e.g. degraded at boot, healthy later).
 *  - No retention change: nothing here touches pruneCloudSnapshots,
 *    no snapshot is deleted, and the date key still allows at most
 *    one daily snapshot per device per day.
 *
 * The boot trigger is a React effect, so it is covered by
 * source-order assertions (the repo's established grep-proof style)
 * plus real unit checks on maybeCreateDailyCloudSnapshot's guards.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- in-memory localStorage (multiStorePersistence reads window.localStorage) ----
const store = new Map<string, string>();
const stubLocalStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
(globalThis as any).localStorage = stubLocalStorage;
const resetStore = () => store.clear();
const todayKey = () => new Date().toLocaleDateString('en-CA');

// Import first (like verify-backup-snapshot-count.ts): the module must
// load in node before any window stub exists.
const { maybeCreateDailyCloudSnapshot }: any = await import('../services/multiStorePersistence');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    const r = fn() as any;
    if (r && typeof r.then === 'function') throw new Error('async check used sync runner — use checkAsync');
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}
async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

function appContextSrc() { return readSource('context/AppContext.tsx'); }

console.log('--- maybeCreateDailyCloudSnapshot guards (real function) ---');

await checkAsync('no window/localStorage at all → failed (never throws, never sets the date key)', async () => {
  resetStore();
  assert.strictEqual(await maybeCreateDailyCloudSnapshot('admin@test'), 'failed');
  assert.strictEqual(store.has('ldsdm_last_daily_cloud_snapshot'), false);
});

// From here on the browser-like window stub is present.
(globalThis as any).window = { localStorage: stubLocalStorage };

await checkAsync('date key already today → skipped-today (checked before auth)', async () => {
  resetStore();
  store.set('ldsdm_last_daily_cloud_snapshot', todayKey());
  assert.strictEqual(await maybeCreateDailyCloudSnapshot('admin@test'), 'skipped-today');
});

await checkAsync('no signed-in user in node → skipped-noauth, and the date key is NOT set', async () => {
  resetStore();
  assert.strictEqual(await maybeCreateDailyCloudSnapshot('admin@test'), 'skipped-noauth');
  assert.strictEqual(store.has('ldsdm_last_daily_cloud_snapshot'), false, 'a skipped day must retry on the next write/boot, so the key must stay unset');
});

await checkAsync('yesterday’s key + no auth → still skipped-noauth (stale key is not treated as done)', async () => {
  resetStore();
  const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
  store.set('ldsdm_last_daily_cloud_snapshot', y);
  assert.strictEqual(await maybeCreateDailyCloudSnapshot('admin@test'), 'skipped-noauth');
});

console.log('--- Boot-time trigger exists (source checks) ---');

check('AppContext calls maybeCreateDailyCloudSnapshot from TWO places (write path + boot path)', () => {
  const src = appContextSrc();
  const calls = src.split('maybeCreateDailyCloudSnapshot(').length - 1;
  assert.ok(calls >= 2, `expected >= 2 call sites, found ${calls} — the boot-time trigger is missing`);
});

check('the boot trigger is a once-per-boot effect gated on cloudHydrated + authUser', () => {
  const src = appContextSrc();
  const at = src.indexOf('dailySnapshotBootAttemptedRef');
  assert.ok(at > -1, 'a once-per-boot ref guard (dailySnapshotBootAttemptedRef) must exist');
  const body = src.slice(Math.max(0, at - 200), at + 900);
  assert.ok(body.includes('cloudHydrated'), 'boot trigger must wait for the settled snapshot (cloudHydrated)');
  assert.ok(body.includes('authUser'), 'boot trigger must require a signed-in session (authUser)');
  assert.ok(body.includes('maybeCreateDailyCloudSnapshot('), 'boot trigger must call maybeCreateDailyCloudSnapshot');
});

check('the boot trigger never fires on the public feed', () => {
  const src = appContextSrc();
  const at = src.indexOf('dailySnapshotBootAttemptedRef');
  assert.ok(at > -1, 'boot trigger must exist');
  const body = src.slice(Math.max(0, at - 200), at + 900);
  assert.ok(body.includes("feedKindRef.current === 'public'") || body.includes("feedKindRef.current !== 'public'"), 'boot trigger must skip public-feed sessions like the auto-sync effect does');
});

check('the boot trigger does not touch retention or delete anything', () => {
  const src = appContextSrc();
  const at = src.indexOf('dailySnapshotBootAttemptedRef');
  assert.ok(at > -1, 'boot trigger must exist');
  const body = src.slice(Math.max(0, at - 200), at + 900);
  assert.ok(!body.includes('pruneCloudSnapshots'), 'boot trigger must not prune');
  assert.ok(!body.includes('deleteDoc'), 'boot trigger must not delete');
});

console.log('--- Write-path trigger untouched ---');

check('the auto-sync effect still calls maybeCreateDailyCloudSnapshot on a confirmed write', () => {
  const src = appContextSrc();
  const at = src.indexOf('void maybeCreateDailyCloudSnapshot(adminEmail)');
  assert.ok(at > -1, 'auto-sync success path must still attempt the daily snapshot');
  const body = src.slice(Math.max(0, at - 600), at);
  assert.ok(body.includes('pushDiffToCloud'), 'the call must still sit in the auto-sync success path after pushDiffToCloud');
});

check('the date-key guard still lives inside maybeCreateDailyCloudSnapshot (one snapshot per day)', () => {
  const src = readSource('services/multiStorePersistence.ts');
  const at = src.indexOf('export async function maybeCreateDailyCloudSnapshot');
  assert.ok(at > -1, 'maybeCreateDailyCloudSnapshot must exist');
  const body = src.slice(at, at + 1200);
  assert.ok(body.includes("getItem('ldsdm_last_daily_cloud_snapshot')"), 'date-key read must exist');
  assert.ok(body.includes("setItem('ldsdm_last_daily_cloud_snapshot', today)"), 'date-key write must exist (only on success)');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:auto-snapshot-trigger'], 'tsx scripts/verify-auto-snapshot-trigger.ts', 'npm run test:auto-snapshot-trigger must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: auto snapshot trigger self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
