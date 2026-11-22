/**
 * verify-today-tasks-load-on-mount.ts — scripted proof for the
 * "আজকের করণীয়" lazy-load bug (morning audits 16–17 Nov 2026).
 *
 * Symptom: the Today's Tasks card showed an empty white box on first
 * load (badge 184, nothing inside); the rows (attendance pending 11,
 * marks entry pending 157, due fees 171) only appeared after clicking
 * a tab.
 *
 * Root cause (code): the card's data lives in the `actionData` useMemo
 * in components/Dashboard.tsx, whose freshness for the non-React
 * admission-applications store depends on `activeView` changing
 * ("re-read them on view switches"). Nothing recomputes the memo on
 * mount and nothing shows while the first computation is pending, so
 * the first paint can be a blank card until a tab click forces the
 * recompute.
 *
 * Fix: load on mount — a mount effect bumps a refresh tick that is a
 * dep of the actionData memo (fresh recompute right after mount) and
 * flips a loaded flag; the card shows a small loading row until then,
 * and the "সব কাজ সম্পন্ন" all-clear message is gated on loaded so it
 * never flashes on an empty first paint.
 *
 * Overview check (same branch decision): the 15 Nov "ওভারভিউ empty
 * blue bar" is NOT the same cause — the Overview hero
 * (DashboardDailyOverview section="hero") and MadrasaReports are
 * synchronous useMemos over context data with no effect/fetch and no
 * tab-click dep, and the whole Dashboard sits behind ServerDataGate,
 * which shows an explicit loading panel (not an empty blue bar) until
 * the first snapshot lands. No Overview code change in this branch.
 *
 * Checks:
 *   (1) A mount effect refreshes today's tasks (tick bump on mount).
 *   (2) The refresh tick is a dep of the actionData memo.
 *   (3) The card shows a loading indicator while not loaded.
 *   (4) The all-clear message is gated on loaded (no false "all done").
 *   (5) The activeView dep is GONE (22 Nov 2026 unify: the view switcher
 *       no longer exists, so the state is gone too; admissions re-read
 *       on mount via the tick).
 *   (6) Overview untouched: no overview load-on-mount code added.
 *   (7) The action rows themselves are unchanged (same six categories).
 *
 * Run: npx tsx scripts/verify-today-tasks-load-on-mount.ts
 * (or npm run test:today-tasks-load-on-mount).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const dashboard = readSource('components/Dashboard.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) Mount effect: a refresh tick bumped once on mount.
check('(1) mount effect bumps a today-tasks refresh tick',
  /useEffect\(\(\) => \{\s*setTodayTasksRefreshTick\(/.test(dashboard) ||
    /setTodayTasksRefreshTick\(\s*t\s*=>\s*t\s*\+\s*1\s*\)/.test(dashboard),
  'Dashboard must bump a refresh tick in a mount effect');
check('(1) refresh tick state exists',
  /const \[todayTasksRefreshTick, setTodayTasksRefreshTick\] = useState\(0\)/.test(dashboard),
  'missing todayTasksRefreshTick state');

// (2) The tick is a dep of the actionData memo (so mount recomputes it).
const memoDeps = dashboard.match(/return \{[\s\S]*?badgeCount[\s\S]*?\}, \[([^\]]*)\]\)/);
check('(2) actionData memo depends on the refresh tick',
  !!memoDeps && memoDeps[1].includes('todayTasksRefreshTick'),
  'actionData memo deps must include todayTasksRefreshTick');

// (3) Loading indicator inside the Today's Tasks card while not loaded.
check('(3) loading row shown while today\'s tasks load',
  /!todayTasksLoaded && \(/.test(dashboard) && dashboard.includes('লোড হচ্ছে'),
  'card must show a loading row (লোড হচ্ছে) while !todayTasksLoaded');
check('(3) loading row uses a spinner',
  dashboard.includes('Loader2') && /animate-spin/.test(dashboard),
  'loading row must use the Loader2 spinner');
check('(3) loaded flag state exists',
  /const \[todayTasksLoaded, setTodayTasksLoaded\] = useState\(false\)/.test(dashboard),
  'missing todayTasksLoaded state');

// (4) All-clear message gated on loaded — never flashes on first paint.
check('(4) all-clear message gated on loaded',
  /todayTasksLoaded && actionData\.badgeCount === 0 && \(/.test(dashboard),
  'the "সব কাজ সম্পন্ন" block must render only when todayTasksLoaded');

// (5) activeView dep GONE with the view switcher (22 Nov 2026 unify:
// no view switch exists anymore, so the state is gone; the mount tick
// is the only refresh trigger).
check('(5) activeView dep gone from actionData memo',
  !!memoDeps && !memoDeps[1].includes('activeView'),
  'activeView state is gone; it must not be a dep anymore');

// (6) Overview untouched in this branch — no overview load-on-mount code.
check('(6) no overview load-on-mount code added',
  !/overviewRefreshTick|overviewLoaded|OverviewLoaded/.test(dashboard),
  'Overview has no lazy-load cause; nothing added for it here');
check('(6) Overview hero still rendered as before',
  dashboard.includes('<DashboardDailyOverview') && dashboard.includes('section="hero"'),
  'hero must still render');

// (7) The six action rows are unchanged.
for (const row of [
  'actionData.attendancePendingClasses.length > 0',
  'actionData.marksPendingExams.length > 0',
  'actionData.dueProfiles.length > 0',
  'actionData.pendingAdmissions.length > 0',
  'actionData.pendingLeaves.length > 0',
  'actionData.readyToFinalizeExams.length > 0',
]) {
  check(`(7) action row still present: ${row.slice(11, 45)}`, dashboard.includes(row), `missing row ${row}`);
}

check('(8) package.json exposes the verify script',
  pkg.scripts['test:today-tasks-load-on-mount'] === 'tsx scripts/verify-today-tasks-load-on-mount.ts',
  'npm run test:today-tasks-load-on-mount must run this script');

console.log(failures === 0 ? '\nALL TODAY-TASKS-LOAD-ON-MOUNT CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
