/**
 * verify-snapshot-fetch-failure.ts — self-check (15 Nov 2026, base commit e4c2526).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-snapshot-fetch-failure.ts
 * (or npm run test:snapshot-fetch-failure).
 *
 * Bug (morning audit 15 Nov 2026): Diagnostics / CloudSyncWidget showed
 * "9টি ব্যাকআপ ভার্সন" at 07:23, then "0টি ব্যাকআপ ভার্সন / এখনো কোনো
 * ক্লাউড স্ন্যাপশট ব্যাকআপ তৈরি করা হয়নি" at 07:32 in the same session,
 * with no button pressed. Live re-check the same morning: Diagnostics
 * first showed 0 again, then flipped to 10 on its own (a new daily
 * snapshot had landed at 07:26). The snapshots were never lost.
 *
 * Root cause: fetchFirestoreCloudSnapshotsPage
 * (services/multiStorePersistence.ts) catches ANY fetch error and
 * returns { items: [], hasMore: false, lastCreatedAt: null } — a page
 * indistinguishable from "genuinely zero snapshots". refreshSnapshotsList
 * (components/CloudSyncWidget.tsx) then does setCloudSnapshots([]), so
 * the list of 9 and the "Nটি ব্যাকআপ ভার্সন" count both collapse to 0.
 * The same empty page also feeds loadMoreCloudSnapshots and the
 * fetchFirestoreCloudSnapshots() wrapper. No code can delete all 9 at
 * once (delete is one-by-one with confirm; prune keeps the newest 50
 * and runs only after a new snapshot), so a fetch failure was the only
 * way to get 9 → 0 with no button pressed.
 *
 * Fix: the page fetch throws on error instead of returning an empty
 * page. Both widget call sites already handle a throw correctly —
 * refreshSnapshotsList only sets state on success (its catch only
 * logs), and loadMoreCloudSnapshots only appends on success (finally
 * resets the spinner) — so a failed fetch now keeps the old list and
 * the old count on screen. No new UI, no behaviour change on success,
 * no data, rules or auth change.
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

const svc = readSource('services/multiStorePersistence.ts');
const widget = readSource('components/CloudSyncWidget.tsx');
const pkg = JSON.parse(readSource('package.json'));

// The page function: from its export to the next top-level export.
const pageFn = svc.slice(
  svc.indexOf('export async function fetchFirestoreCloudSnapshotsPage'),
  svc.indexOf('/**\n * Fetches the newest 50 cloud snapshots')
);

console.log('--- Fetch failure must not look like zero snapshots ---');
check('page fetch has no empty-page return on error', () => {
  assert.ok(!pageFn.includes('return { items: [], hasMore: false, lastCreatedAt: null }'),
    'catch still returns an empty page — a failed fetch reads as 0 snapshots');
});
check('page fetch rethrows the error after logging it', () => {
  assert.ok(/catch \(err\) \{\s*console\.warn\('\[Cloud Snapshots\] Fetch page error:', err\);\s*throw err;/.test(pageFn),
    'catch must warn then throw so callers keep the old list');
});
check('page fetch still returns the real page on success', () => {
  assert.ok(pageFn.includes('return { items: page, hasMore, lastCreatedAt:'),
    'success path must still return the fetched page');
});

console.log('--- Widget keeps the old list when the fetch throws ---');
check('refreshSnapshotsList only sets state inside try (on success)', () => {
  const fn = widget.slice(widget.indexOf('const refreshSnapshotsList'), widget.indexOf('const loadMoreCloudSnapshots'));
  assert.ok(fn.includes('setCloudSnapshots(page.items)'), 'must set the list from the fetched page');
  assert.ok(fn.includes("catch (e) {") && fn.includes("console.warn('Failed to fetch cloud snapshots:', e);"),
    'catch must only log — no setCloudSnapshots([]) on failure');
  assert.ok(!fn.includes('setCloudSnapshots([])'), 'must never blank the list on failure');
});
check('loadMoreCloudSnapshots only appends inside try (on success)', () => {
  const fn = widget.slice(widget.indexOf('const loadMoreCloudSnapshots'), widget.indexOf('React.useEffect'));
  assert.ok(fn.includes('setCloudSnapshots((prev) => [...prev, ...page.items])'), 'must append the fetched page');
  assert.ok(!fn.includes('setCloudSnapshots([])'), 'must never blank the list on failure');
});

console.log('--- Wrapper keeps the honest contract ---');
check('fetchFirestoreCloudSnapshots delegates to the page function', () => {
  assert.ok(svc.includes('const page = await fetchFirestoreCloudSnapshotsPage(50);'),
    'wrapper must still delegate to the page fetch');
});

console.log('--- npm script ---');
check('package.json has test:snapshot-fetch-failure', () => {
  assert.strictEqual(pkg.scripts['test:snapshot-fetch-failure'],
    'tsx scripts/verify-snapshot-fetch-failure.ts');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: snapshot fetch-failure self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
