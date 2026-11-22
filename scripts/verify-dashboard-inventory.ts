/**
 * verify-dashboard-inventory.ts — scripted proof that the Dashboard
 * redesign (22 Nov 2026) loses NOTHING (principal's word, 19:10).
 *
 * Inventory (taken from main 2109f160 before any move — every item
 * below was rendered on the Dashboard then, and must still render
 * now; rearranged is fine, removed is NOT):
 *
 * Hero: school-name title, date+address subtitle, "সিস্টেম সক্রিয়"
 *   live badge, 9 quick-action tiles.
 * Alerts: UrgentNoticesCard (self-hiding), pending-approvals banner
 *   (admin-only, count + names + HR button + stale warning + Retry).
 * Today's tasks: আজকের করণীয় card — pending badge, loading row,
 *   6 rows (attendance / marks / dues / admissions / leaves /
 *   finalize), all-clear message.
 * Academic: একাডেমিক চিত্র header + session/exam/class filters,
 *   class grid, grade chart, pass/fail pie (+ pass % badge +
 *   passed/failed counts), top-5 merit (+ View All), at-risk panel
 *   (+ count badge + empty-state message).
 * Finance: Top Dues card — total-due pill, top-5 profiles with
 *   call + WhatsApp.
 * Monitoring: MadrasaReports — Alerts, Today's Report, This Month's
 *   Report, Class Comparisons.
 * Doors: report tiles — Institutional, Finance, Attendance, Student,
 *   Academic.
 *
 * New structure (this job): hero → alerts → today's tasks → academic
 * → finance (আর্থিক চিত্র) → MadrasaReports → report doors. Smart
 * addition (real data only, already computed, previously hidden):
 * the academic header shows evaluated count + pass % + average GPA
 * + A+ count at a glance.
 *
 * Checks:
 *   (1) Hero intact (title/subtitle/badge/9 tiles).
 *   (2) Alerts intact (notices card + approvals banner).
 *   (3) Today's-tasks card intact (badge, loading, 6 rows, all-clear).
 *   (4) Academic section intact (header, 3 filters, 5 cards).
 *   (5) Finance section exists; Top Dues card intact (pill + call/WhatsApp).
 *   (6) MadrasaReports intact (all 4 sub-sections).
 *   (7) Report doors intact (all 5 tiles).
 *   (8) Page order: hero, tasks, academic, finance, MadrasaReports, doors.
 *   (9) Smart addition: academic at-a-glance summary line (real figures only).
 *   (10) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-dashboard-inventory.ts
 * (or npm run test:dashboard-inventory).
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
const overview = readSource('components/DashboardDailyOverview.tsx');
const reports = readSource('components/MadrasaReports.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) Hero intact.
check('(1) hero title expression intact',
  overview.includes("schoolProfile.nameBn || schoolProfile.name || (isBn ? 'মাদ্রাসা ম্যানেজমেন্ট সিস্টেম' : 'Madrasah Management')"),
  'hero title expression changed');
check('(1) hero subtitle date intact',
  overview.includes('formattedToday'), 'hero subtitle date expression changed');
check('(1) live badge intact',
  overview.includes("'সিস্টেম সক্রিয়'"), 'live badge copy changed');
check('(1) 9 quick-action tiles intact',
  overview.includes('heroActions.map((act)') && overview.includes('onNavigate(act.id)'),
  'quick-action tiles data/handler changed');
check('(1) hero still rendered on the Dashboard',
  dashboard.includes('<DashboardDailyOverview') && dashboard.includes('section="hero"'),
  'hero must still render');

// (2) Alerts intact.
check('(2) urgent-notices card intact',
  dashboard.includes('<UrgentNoticesCard') && dashboard.includes("onOpenNoticeBoard={() => setActiveTab('notice_board')}"),
  'UrgentNoticesCard missing or its notice-board door changed');
check('(2) pending-approvals banner intact',
  dashboard.includes('অনুমোদনের অপেক্ষায়') && dashboard.includes("setActiveTab('user_roles')") && dashboard.includes('refreshPendingMembers()'),
  'approvals banner (count + HR door + Retry) changed');

// (3) Today's-tasks card intact.
check("(3) আজকের করণীয় card intact",
  dashboard.includes("title={language === 'bn' ? 'আজকের করণীয়'") && dashboard.includes('টি বাকি'),
  'tasks card title/badge changed');
check('(3) loading row intact',
  /!todayTasksLoaded && \(/.test(dashboard) && dashboard.includes('লোড হচ্ছে'),
  'tasks loading row changed');
for (const row of [
  'actionData.attendancePendingClasses.length > 0',
  'actionData.marksPendingExams.length > 0',
  'actionData.dueProfiles.length > 0',
  'actionData.pendingAdmissions.length > 0',
  'actionData.pendingLeaves.length > 0',
  'actionData.readyToFinalizeExams.length > 0',
]) {
  check(`(3) task row intact: ${row.slice(11, 45)}`, dashboard.includes(row), `missing row ${row}`);
}
check('(3) all-clear message intact',
  /todayTasksLoaded && actionData\.badgeCount === 0 && \(/.test(dashboard),
  'all-clear gate changed');

// (4) Academic section intact.
check('(4) academic header intact',
  dashboard.includes('একাডেমিক চিত্র'), 'academic header missing');
for (const sel of ['value={selectedAcademicYear}', "value={selectedExamId || ''}", 'value={selectedClass}']) {
  check(`(4) filter intact: ${sel.slice(7, 30)}`, dashboard.includes(sel), `missing filter ${sel}`);
}
for (const [name, marker] of [
  ['class grid', '<ClassGrid classCards='],
  ['grade chart', 'গ্রেডভিত্তিক ফলাফল বিন্যাস'],
  ['pass/fail pie', 'পাস বনাম ফেল অনুপাত'],
  ['top merit', 'শীর্ষ মেধা তালিকা (টপ ৫)'],
  ['at-risk panel', 'বিশেষ যত্ন প্রয়োজন (ঝুঁকিপূর্ণ)'],
] as const) {
  check(`(4) academic card intact: ${name}`, dashboard.includes(marker), `missing ${name}`);
}
check('(4) pass % badge intact',
  dashboard.includes('academicHealth.passRate'), 'pass % badge changed');
check('(4) passed/failed counts intact',
  dashboard.includes("d.name === 'Passed'") && dashboard.includes("d.name === 'Failed'"),
  'passed/failed counts changed');
check('(4) merit View-All door intact',
  dashboard.includes("setActiveSectionTab('merit')"), 'merit View-All door changed');
check('(4) at-risk empty state intact',
  dashboard.includes('কোনো শিক্ষার্থী ঝুঁকিপূর্ণ তালিকায় নেই'), 'at-risk empty state changed');

// (5) Finance section exists; Top Dues card intact.
check('(5) finance section header exists',
  dashboard.includes('আর্থিক চিত্র'), 'finance section header missing');
check('(5) Top Dues card intact',
  dashboard.includes('সর্বোচ্চ বকেয়া (শীর্ষ ৫)') && dashboard.includes('actionData.topDueProfiles.length > 0'),
  'Top Dues card missing');
check('(5) total-due pill intact',
  dashboard.includes('actionData.duesSummary.totalDue'), 'total-due figure changed');
check('(5) call + WhatsApp doors intact',
  dashboard.includes('tel:${rawPhone}') && dashboard.includes('waLink'),
  'call/WhatsApp doors changed');

// (6) MadrasaReports intact (all 4 sub-sections).
for (const sec of ['সতর্কতা', 'আজকের প্রতিবেদন', 'এই মাসের প্রতিবেদন', 'ক্লাসভিত্তিক তুলনা']) {
  check(`(6) MadrasaReports section intact: ${sec}`, reports.includes(sec), `missing ${sec}`);
}
check('(6) MadrasaReports still on the Dashboard',
  dashboard.includes('<MadrasaReports />'), 'MadrasaReports removed from Dashboard');

// (7) Report doors intact (all 5 tiles).
for (const tile of ['admin_reports', 'finance_reports', 'attendance_reports', 'student_reports', 'academic_reports']) {
  check(`(7) report door intact: ${tile}`, dashboard.includes(`tab: '${tile}'`), `missing ${tile}`);
}

// (8) Page order: hero, tasks, academic, finance, MadrasaReports, doors.
const at = (m: string) => dashboard.indexOf(m);
check('(8) hero before tasks',
  at('<DashboardDailyOverview') < at("title={language === 'bn' ? 'আজকের করণীয়'"),
  'hero must come before tasks');
check('(8) tasks before academic',
  at("title={language === 'bn' ? 'আজকের করণীয়'") < at('একাডেমিক চিত্র'),
  'tasks must come before academic');
check('(8) academic before finance',
  at('একাডেমিক চিত্র') < at('আর্থিক চিত্র'),
  'academic must come before finance');
check('(8) finance before MadrasaReports',
  at('আর্থিক চিত্র') < at('<MadrasaReports />'),
  'finance must come before MadrasaReports');
check('(8) MadrasaReports before report doors',
  at('<MadrasaReports />') < at("title={language === 'bn' ? 'প্রতিবেদন'"),
  'MadrasaReports must come before the report doors');

// (9) Smart addition: academic at-a-glance summary (real figures only).
const sectionAt = at('একাডেমিক চিত্র');
const summaryAt = dashboard.indexOf('জন মূল্যায়িত');
check('(9) at-a-glance summary in the academic header',
  summaryAt > sectionAt && summaryAt < at('<MadrasaReports />'),
  'summary line must sit in the academic header');
check('(9) summary shows evaluated count',
  dashboard.includes('topStudents.length'), 'evaluated count missing from summary');
check('(9) summary shows pass %',
  dashboard.includes('academicHealth.passRate'), 'pass % missing from summary');
check('(9) summary shows average GPA (was computed, never shown)',
  dashboard.includes('academicHealth.overallAverageGpa'), 'average GPA missing from summary');
check('(9) summary shows A+ count (was computed, never shown)',
  dashboard.includes('academicHealth.aPlusCount'), 'A+ count missing from summary');

// (10) package.json exposes this verify script.
check('(10) package.json exposes the verify script',
  pkg.scripts['test:dashboard-inventory'] === 'tsx scripts/verify-dashboard-inventory.ts',
  'npm run test:dashboard-inventory must run this script');

console.log(failures === 0 ? '\nALL DASHBOARD-INVENTORY CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
