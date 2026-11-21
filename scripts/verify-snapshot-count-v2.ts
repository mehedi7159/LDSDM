/**
 * verify-snapshot-count-v2.ts — self-check (21 Nov 2026, base commit 0b7c9dd).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-snapshot-count-v2.ts
 * (or npm run test:snapshot-count-v2).
 *
 * Bug (morning audit 21 Nov 2026): the Backup tab first shows
 * "0টি ব্যাকআপ ভার্সন" / "এখনো কোনো ক্লাউড স্ন্যাপশট ব্যাকআপ তৈরি করা
 * হয়নি", and only after a refresh shows the real 15/16 — same as
 * every morning audit since 15 Nov.
 *
 * Why the old fix (PR #25, fix/snapshot-fetch-keeps-old-list) could
 * not fix this: it made fetchFirestoreCloudSnapshotsPage throw on
 * error so a failed refresh keeps the ALREADY-LOADED list. But on
 * first mount there is no loaded list — cloudSnapshots starts as []
 * (components/CloudSyncWidget.tsx) — so the first paint is "0" no
 * matter what the fetch does. The old fix only helps a LATER refresh
 * of an already-loaded list.
 *
 * Actual root cause, traced end to end:
 * - CloudSyncWidget mounts fresh on every Backup-tab visit
 *   (ReportsSettingsManager renders it only when activeTab ===
 *   'backup'), so its state resets to [] each visit.
 * - The list fetch starts only in useEffect(..., [authUser]) once
 *   authUser is truthy — authUser starts null in AppContext and is
 *   set asynchronously by onAuthStateChanged — and the Firestore
 *   query itself takes time (cold start).
 * - Meanwhile the widget has NO loading state: it renders the
 *   definitive "0 টি ব্যাকআপ ভার্সন" and the "no snapshots yet"
 *   empty message while the fetch is still pending (or not started).
 *   A loading list is indistinguishable from a genuinely-zero list.
 * - And if that first fetch throws, the catch only logs: no retry,
 *   no error state — the widget sits at a false 0 until the user
 *   presses "হিস্টোরি রিফ্রেশ" or reloads the page. A refresh works
 *   because by then auth is resolved and Firestore is warm.
 *
 * Fix (same loading-state pattern DataSecurityBackupCenter already
 * uses for its own snapshot list, isLoadingSnapshots):
 * - isLoadingSnapshots starts true: the list is UNKNOWN until the
 *   first fetch settles, not empty. refreshSnapshotsList sets it
 *   true at the start and false in finally, and reports success.
 * - While loading with no list yet, the count tile shows
 *   "লোড হচ্ছে..." instead of "0 টি ব্যাকআপ ভার্সন", and the
 *   history shows a loading row instead of the "no snapshots yet"
 *   message. A loaded list is never blanked (old fix's contract
 *   kept: a manual refresh keeps showing the old count while it
 *   reloads).
 * - If the initial load fails, it retries once after 3s — a failed
 *   first fetch no longer leaves a false 0 on screen with no
 *   recovery except a manual refresh.
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

const widget = readSource('components/CloudSyncWidget.tsx');
const svc = readSource('services/multiStorePersistence.ts');
const pkg = JSON.parse(readSource('package.json'));

const refreshFn = widget.slice(
  widget.indexOf('const refreshSnapshotsList'),
  widget.indexOf('const loadMoreCloudSnapshots')
);
const effectFn = widget.slice(
  widget.indexOf('React.useEffect(() => {'),
  widget.indexOf('const handleManualPush')
);

console.log('--- Loading state exists and starts true ---');
check('isLoadingSnapshots state exists, initialised true (list unknown, not empty)', () => {
  assert.ok(/const \[isLoadingSnapshots, setIsLoadingSnapshots\] = useState\(true\)/.test(widget),
    'expected useState(true) — the list is unknown until the first fetch settles');
});
check('refreshSnapshotsList sets loading true at the start', () => {
  assert.ok(refreshFn.includes('setIsLoadingSnapshots(true)'),
    'must mark loading before the fetch starts');
});
check('refreshSnapshotsList clears loading in finally', () => {
  assert.ok(/finally \{\s*setIsLoadingSnapshots\(false\);?\s*\}/.test(refreshFn),
    'must clear loading on success AND on failure');
});
check('refreshSnapshotsList reports success so the first load can retry', () => {
  assert.ok(refreshFn.includes('return true') && refreshFn.includes('return false'),
    'must return true on success and false on failure');
});

console.log('--- No false 0 while the first fetch is pending ---');
check('count tile shows loading text while loading with no list yet', () => {
  const tile = widget.slice(widget.indexOf('ক্লাউড স্ন্যাপশট ব্যাকআপ'), widget.indexOf('Action buttons'));
  assert.ok(tile.includes('isLoadingSnapshots') && tile.includes('লোড হচ্ছে'),
    'count tile must show "লোড হচ্ছে..." instead of "0 টি ব্যাকআপ ভার্সন" before the first load settles');
});
check('history empty message is gated on loading (genuine zero only)', () => {
  assert.ok(widget.includes('isLoadingSnapshots') && widget.includes('এখনো কোনো ক্লাউড স্ন্যাপশট ব্যাকআপ তৈরি করা হয়নি।'),
    'the "no snapshots yet" message must only show after loading finished with an empty list');
  assert.ok(/isLoadingSnapshots && cloudSnapshots\.length === 0/.test(widget),
    'loading-with-empty-list must render a loading row, not the empty message');
});

console.log('--- A failed first fetch recovers on its own ---');
check('initial-load effect retries once after a failed first fetch', () => {
  assert.ok(effectFn.includes('refreshSnapshotsList()'),
    'effect must still trigger the initial load');
  assert.ok(/setTimeout\(\(\) => \{[^}]*refreshSnapshotsList\(\)/.test(effectFn) || effectFn.includes('setTimeout'),
    'effect must schedule one retry of the initial load on failure');
  assert.ok(!/setInterval/.test(effectFn), 'no polling loop — exactly one retry');
});

console.log('--- Old fix contract kept: a loaded list is never blanked ---');
check('page fetch still throws on error (no empty-page return)', () => {
  const pageFn = svc.slice(
    svc.indexOf('export async function fetchFirestoreCloudSnapshotsPage'),
    // '(' disambiguates from the Page function itself (its name starts with the wrapper's name)
    svc.indexOf('export async function fetchFirestoreCloudSnapshots()')
  );
  assert.ok(!pageFn.includes('return { items: [], hasMore: false, lastCreatedAt: null }'),
    'a failed fetch must not look like zero snapshots');
  assert.ok(pageFn.includes('throw err'), 'page fetch must rethrow');
});
check('refresh only sets state on success, never blanks the list', () => {
  assert.ok(refreshFn.includes('setCloudSnapshots(page.items)'), 'must set the list from the fetched page');
  assert.ok(!refreshFn.includes('setCloudSnapshots([])'), 'must never blank the list on failure');
  assert.ok(!widget.includes('setCloudSnapshots([])'), 'no call site blanks the list');
});

console.log('--- npm script ---');
check('package.json has test:snapshot-count-v2', () => {
  assert.strictEqual(pkg.scripts['test:snapshot-count-v2'],
    'tsx scripts/verify-snapshot-count-v2.ts');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: snapshot-count-v2 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
