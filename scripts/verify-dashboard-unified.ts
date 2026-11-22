/**
 * verify-dashboard-unified.ts — scripted proof for the Dashboard
 * unification (22 Nov 2026, principal's word).
 *
 * Before: the Dashboard was split by a two-button view switcher
 * ("ওভারভিউ" / "আজকের করণীয়", `activeView` state, default
 * 'overview'). The Overview half (notices, MadrasaReports, report
 * tiles, class grid, charts, merit, at-risk) and the Action half
 * (আজকের করণীয় to-do card + top dues) could never be seen together;
 * the tasks card sat behind a tab click.
 *
 * After: ONE single Dashboard page, no separation. The switcher and
 * the `activeView` state are gone, both conditional wrappers are
 * unwrapped, and the আজকের করণীয় block sits inside the single page
 * right after the hero/notices (before MadrasaReports), so today's
 * work is visible without scrolling past the whole overview.
 *
 * What must NOT change: the hero (flat light pattern, PRs #56-#63),
 * every overview block, all six task rows, the top-dues card, the
 * loading row and the all-clear gate, and every number/definition/
 * handler. The `activeView` dep of the actionData memo goes away
 * with the state (the mount tick is the only refresh trigger now —
 * see verify-today-tasks-load-on-mount.ts check (5), updated).
 *
 * Checks:
 *   (1) No view-switcher buttons (no setActiveView calls).
 *   (2) No activeView state.
 *   (3) No activeView conditional wrappers.
 *   (4) No activeView dep in the actionData memo.
 *   (5) Today's-tasks block still present (title + six rows + dues).
 *   (6) Loading row + all-clear gate still present.
 *   (7) Hero still present.
 *   (8) All overview blocks still present.
 *   (9) Tasks block sits before MadrasaReports in the single page.
 *   (10) No leftover "ওভারভিউ" switcher label.
 *   (11) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-dashboard-unified.ts
 * (or npm run test:dashboard-unified).
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

// (1) No view-switcher buttons.
check('(1) no setActiveView switcher buttons',
  !/setActiveView\(/.test(dashboard),
  'Dashboard must not call setActiveView anywhere');

// (2) No activeView state.
check('(2) no activeView state',
  !/const \[activeView, setActiveView\]/.test(dashboard),
  'activeView state must be gone');

// (3) No activeView conditional wrappers.
check("(3) no activeView === 'overview' wrapper",
  !/activeView === 'overview'/.test(dashboard),
  "no {activeView === 'overview' && ...} wrapper may remain");
check("(3) no activeView === 'action' wrapper",
  !/activeView === 'action'/.test(dashboard),
  "no {activeView === 'action' && ...} wrapper may remain");

// (4) No activeView dep in the actionData memo.
const memoDeps = dashboard.match(/return \{[\s\S]*?badgeCount[\s\S]*?\}, \[([^\]]*)\]\)/);
check('(4) actionData memo has no activeView dep',
  !!memoDeps && !memoDeps[1].includes('activeView'),
  'activeView must be gone from the actionData memo deps');
check('(4) actionData memo keeps the mount refresh tick dep',
  !!memoDeps && memoDeps[1].includes('todayTasksRefreshTick'),
  'todayTasksRefreshTick must stay a dep of the actionData memo');

// (5) Today's-tasks block still present: title + six rows + top dues.
check("(5) আজকের করণীয় card title still present",
  dashboard.includes("title={language === 'bn' ? 'আজকের করণীয়'"),
  'the আজকের করণীয় SectionCard title must stay');
for (const row of [
  'actionData.attendancePendingClasses.length > 0',
  'actionData.marksPendingExams.length > 0',
  'actionData.dueProfiles.length > 0',
  'actionData.pendingAdmissions.length > 0',
  'actionData.pendingLeaves.length > 0',
  'actionData.readyToFinalizeExams.length > 0',
]) {
  check(`(5) task row still present: ${row.slice(11, 45)}`, dashboard.includes(row), `missing row ${row}`);
}
check('(5) top-dues card still present',
  dashboard.includes('সর্বোচ্চ বকেয়া (শীর্ষ ৫)') && dashboard.includes('actionData.topDueProfiles.length > 0'),
  'the Top Dues card must stay');
check('(5) pending-count badge still on the tasks card',
  dashboard.includes('টি বাকি') && /actionData\.badgeCount > 0/.test(dashboard),
  'the tasks card must keep its pending badge');

// (6) Loading row + all-clear gate still present.
check('(6) loading row still shown while tasks load',
  /!todayTasksLoaded && \(/.test(dashboard) && dashboard.includes('লোড হচ্ছে'),
  'card must keep the loading row (লোড হচ্ছে) while !todayTasksLoaded');
check('(6) all-clear message still gated on loaded',
  /todayTasksLoaded && actionData\.badgeCount === 0 && \(/.test(dashboard),
  'the "সব কাজ সম্পন্ন" block must stay gated on todayTasksLoaded');

// (7) Hero still present (flat light pattern from PRs #56-#63).
check('(7) hero still rendered',
  dashboard.includes('<DashboardDailyOverview') && dashboard.includes('section="hero"'),
  'hero must still render');

// (8) All overview blocks still present.
for (const block of [
  ['UrgentNoticesCard', '<UrgentNoticesCard'],
  ['MadrasaReports', '<MadrasaReports />'],
  ['reports tiles', "title={language === 'bn' ? 'প্রতিবেদন'"],
  ['class grid', '<ClassGrid'],
  ['grade chart', 'গ্রেডভিত্তিক ফলাফল বিন্যাস'],
  ['pass/fail pie', 'পাস বনাম ফেল অনুপাত'],
  ['top merit', 'শীর্ষ মেধা তালিকা (টপ ৫)'],
  ['at-risk panel', 'বিশেষ যত্ন প্রয়োজন (ঝুঁকিপূর্ণ)'],
]) {
  check(`(8) overview block still present: ${block[0]}`, dashboard.includes(block[1]), `missing ${block[0]}`);
}

// (9) Tasks block sits before MadrasaReports in the single page
// (today's work visible near the top, not buried at the bottom).
const tasksAt = dashboard.indexOf("title={language === 'bn' ? 'আজকের করণীয়'");
const reportsAt = dashboard.indexOf('<MadrasaReports />');
check('(9) tasks block comes before MadrasaReports',
  tasksAt > 0 && reportsAt > 0 && tasksAt < reportsAt,
  'আজকের করণীয় must appear before MadrasaReports in the single page');

// (10) No leftover "ওভারভিউ" switcher label.
check('(10) no leftover ওভারভিউ switcher label',
  !dashboard.includes("'ওভারভিউ'"),
  "the 'ওভারভিউ' button label must be gone with the switcher");

// (11) package.json exposes this verify script.
check('(11) package.json exposes the verify script',
  pkg.scripts['test:dashboard-unified'] === 'tsx scripts/verify-dashboard-unified.ts',
  'npm run test:dashboard-unified must run this script');

console.log(failures === 0 ? '\nALL DASHBOARD-UNIFIED CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
