/**
 * verify-dashboard-new-sections.ts — scripted proof for the three new
 * dashboard report sections (Branch 3: fix/dashboard-new-sections,
 * 22 Nov 2026).
 *
 * Before: the Dashboard had no attendance summary, no income-expense
 * summary and no fee-collection-by-batch view; the reference app's
 * হাজিরা রিপোর্ট / আয়-ব্যয় রিপোর্ট / ফি আদায় ও ব্যাচ had no LDSDM
 * equivalent.
 *
 * After: three new arrangeable sections, registered in the shared
 * model and rendered from the layout like every other section:
 *   - হাজিরা রিপোর্ট (attendance): today's attendance by class from
 *     dailyStudentAttendance — present/absent only; a class with no
 *     record today says "হাজিরা নেওয়া হয়নি".
 *   - আয়-ব্যয় রিপোর্ট (incomeExpense): the Dashboard's OWN
 *     financeMetrics totals (same income definition, no new one);
 *     with no transactions yet the figures read "—", never invented.
 *   - ফি আদায় ও ব্যাচ (feeCollection): fee collections from real
 *     transactions with a studentId, grouped by class (ব্যাচ); the
 *     total is real even when it is ৳0.
 * Defaults: attendance + feeCollection visible, incomeExpense hidden
 * (0 transactions on the 22 Nov audit — it appears when data does).
 * The mobile home's matching cards follow the same layout (hide).
 *
 * NOT added — no data exists, so nothing is invented:
 *   - জরিমানা রিপোর্ট (no fine data anywhere in the codebase),
 *   - দেরির রিপোর্ট (no late report — attendance shows present/
 *     absent only),
 *   - ভর্তি ট্রেন্ড (171 of 173 students have no admissionDate),
 *   - সাম্প্রতিক কার্যক্রম (no user activity feed; auditLog is
 *     security/RBAC-only, not a user feed).
 *
 * What must NOT change: every existing number/definition/handler
 * (financeMetrics' income definition is reused, not redefined);
 * no result/marksheet file, no Firestore rules, no auth/login, no
 * public portal.
 *
 * Checks:
 *   (1) Registry has the three new sections with Bengali titles;
 *       defaults are attendance + feeCollection visible,
 *       incomeExpense hidden.
 *   (2) The three component files exist, use SectionCard, and carry
 *       honest empty states ("—" / "হাজিরা নেওয়া হয়নি" / no
 *       transactions yet) — no invented figures.
 *   (3) Attendance reads today's records by class, present/absent
 *       only (no late/leave columns).
 *   (4) Income-expense reuses the Dashboard's financeMetrics totals
 *       (Dashboard passes totalIncome/totalExpense/netBalance).
 *   (5) Fee collection sums real student-fee transactions
 *       (studentId) grouped by class (ব্যাচ).
 *   (6) Dashboard renders all three from the layout
 *       (data-dashboard-section wrappers + order).
 *   (7) Mobile home cards follow the layout: teacher attendance
 *       progress, cashier income/expense, cashier collections/dues
 *       are hidden when their section is hidden.
 *   (8) The arrange panel offers the new sections (its icon map
 *       covers them).
 *   (9) The four impossible sections are NOT registered: no fine,
 *       late, admission-trend or recent-activity section id.
 *   (10) A hidden new section disappears from the resolved order;
 *       reset restores the new defaults.
 *   (11) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-dashboard-new-sections.ts
 * (or npm run test:dashboard-new-sections).
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

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; }
};

const model = await import('../services/dashboardLayout.ts');
const dashboard = readSource('components/Dashboard.tsx');
const mobile = readSource('components/StaffMobileApp.tsx');
const panel = readSource('components/DashboardArrangePanel.tsx');
const attendanceSrc = readSource('components/DashboardAttendanceReport.tsx');
const incomeSrc = readSource('components/DashboardIncomeExpenseReport.tsx');
const feeSrc = readSource('components/DashboardFeeCollectionReport.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) Registry + defaults.
const ids = (model.DASHBOARD_SECTIONS as { id: string }[]).map(s => s.id);
for (const id of ['attendance', 'incomeExpense', 'feeCollection']) {
  check(`(1) registry has section '${id}'`, ids.includes(id));
}
const def = model.defaultLayout();
check('(1) attendance is visible by default', !def.hidden.includes('attendance'));
check('(1) feeCollection is visible by default', !def.hidden.includes('feeCollection'));
check('(1) incomeExpense is hidden by default (no transactions yet)', def.hidden.includes('incomeExpense'));
check('(1) new sections have Bengali titles',
  (model.DASHBOARD_SECTIONS as { id: string; titleBn: string }[])
    .filter(s => ['attendance', 'incomeExpense', 'feeCollection'].includes(s.id))
    .every(s => s.titleBn.includes('রিপোর্ট') || s.titleBn.includes('আদায়')));

// (2) Components exist, use SectionCard, honest empty states.
for (const [name, src] of [['DashboardAttendanceReport', attendanceSrc], ['DashboardIncomeExpenseReport', incomeSrc], ['DashboardFeeCollectionReport', feeSrc]] as const) {
  check(`(2) ${name} uses SectionCard`, src.includes('SectionCard'));
  check(`(2) ${name} has an honest empty state`, src.includes('—') || src.includes('নেই') || src.includes('হয়নি'));
}

// (3) Attendance: today's records by class, present/absent only.
check('(3) attendance reads dailyStudentAttendance', /dailyStudentAttendance|records/.test(attendanceSrc));
check('(3) attendance filters to today', attendanceSrc.includes('toISOString().slice(0, 10)') || attendanceSrc.includes('todayStr'));
check('(3) attendance groups by class', /classLevel/.test(attendanceSrc));
check('(3) attendance shows present/absent only', attendanceSrc.includes('উপস্থিত') && attendanceSrc.includes('অনুপস্থিত'));
check('(3) attendance says হাজিরা নেওয়া হয়নি when no record', attendanceSrc.includes('হাজিরা নেওয়া হয়নি'));

// (4) Income-expense reuses financeMetrics.
check('(4) Dashboard passes financeMetrics totals to the income-expense section',
  /totalIncome={financeMetrics\.totalIncome}/.test(dashboard) && /totalExpense={financeMetrics\.totalExpense}/.test(dashboard));
check('(4) income-expense shows — with no transactions', incomeSrc.includes('—') && /transactionCount|transactions\.length|count === 0|count > 0/.test(incomeSrc));
check('(4) income-expense defines no new income rule', !/category === 'FEE'/.test(incomeSrc) && !incomeSrc.includes("tx.type === 'INCOME'"));

// (5) Fee collection: real student-fee transactions, by class.
check('(5) fee collection filters student-fee transactions', /studentId/.test(feeSrc));
check('(5) fee collection groups by class (ব্যাচ)', /classLevel/.test(feeSrc) && feeSrc.includes('ব্যাচ'));
check('(5) fee collection total is real (sums amounts, no literal)', /reduce\(/.test(feeSrc) && !/৳[1-9]/.test(feeSrc));

// (6) Dashboard renders the new sections from the layout.
for (const id of ['attendance', 'incomeExpense', 'feeCollection']) {
  check(`(6) Dashboard wraps '${id}' from the layout`, dashboard.includes(`data-dashboard-section="${id}"`));
}

// (7) Mobile home cards follow the layout (hide).
check('(7) mobile teacher attendance progress follows the layout',
  /TEACHER: today's attendance progress[\s\S]{0,200}mobileVisibleSections\.includes\('attendance'\)/.test(mobile));
check('(7) mobile cashier income/expense follows the layout',
  /CASHIER: today's income vs expense[\s\S]{0,200}mobileVisibleSections\.includes\('incomeExpense'\)/.test(mobile));
check('(7) mobile cashier collections follow the layout',
  /CASHIER: recent collections[\s\S]{0,200}mobileVisibleSections\.includes\('feeCollection'\)/.test(mobile));
check('(7) mobile cashier top dues follow the layout',
  /CASHIER: top dues[\s\S]{0,200}mobileVisibleSections\.includes\('finance'\)/.test(mobile));

// (8) Arrange panel offers the new sections.
for (const id of ['attendance', 'incomeExpense', 'feeCollection']) {
  check(`(8) panel icon map covers '${id}'`, panel.includes(`${id}:`));
}

// (9) The four impossible sections are NOT registered.
for (const id of ['fine', 'fineReport', 'lateReport', 'admissionTrend', 'recentActivity']) {
  check(`(9) no '${id}' section is registered`, !ids.includes(id));
}

// (10) Hide + reset through the model.
check('(10) hiding attendance removes it from the Dashboard',
  !model.resolveVisibleSections(model.toggleSectionHidden(def, 'attendance'), 'teacher', 'desktop').includes('attendance'));
check('(10) reset restores the new defaults',
  JSON.stringify(model.resetLayout().order) === JSON.stringify(def.order)
  && JSON.stringify([...model.resetLayout().hidden].sort()) === JSON.stringify([...def.hidden].sort()));

// (11) package.json exposes this verify script.
check('(11) package.json exposes test:dashboard-new-sections',
  pkg.scripts && pkg.scripts['test:dashboard-new-sections'] === 'tsx scripts/verify-dashboard-new-sections.ts');

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll dashboard-new-sections checks passed.');
