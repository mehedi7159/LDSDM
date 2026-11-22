/**
 * Hero banners — Staff + Finance pages, light professional pattern
 * (22 Nov 2026, Sagor 18:06 + 18:14: all hero banners look AI-made,
 * colours/backgrounds bad; redesign to professional grade, no page
 * missed).
 *
 * Shared pattern lives in branch fix/hero-shared-pattern (NOT merged
 * yet): PageHeader tone="brand" is a flat LIGHT hero — white /
 * dark slate-900 card, dark title, muted subtitle, teal icon chip —
 * and it wraps `footer` with its own light divider
 * (mt-5 pt-5 border-t border-slate-200/80). This job only updates the
 * CALL-SITE classes in the two files below so they read on the light
 * hero. Merge order: pattern branch FIRST, then this one.
 *
 * Scope (classes in the hero/footer/children areas ONLY):
 *  - StaffManager.tsx PageHeader (~:1241): footer 6 KPI glass tiles
 *    + children 3 glass buttons.
 *  - FinanceManager.tsx PageHeader (~:255): footer 6 KPI glass tiles
 *    + children 4 glass buttons.
 * Titles, subtitles, numbers, handlers, KPI expressions stay
 * byte-identical. Cards/modals/tables elsewhere in StaffManager are
 * NOT hero areas and are untouched. No result/marksheet file, no
 * Firestore rules, no auth/login, no data/number/definition change.
 *
 * Light map (applied):
 *  - tile `bg-white/5 ... border-white/10 backdrop-blur-2xs`
 *    -> `bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80
 *    dark:border-slate-700 rounded-2xl p-3`
 *  - footer grid: strip `mt-6 pt-5 border-t border-white/10`
 *    (PageHeader wraps the footer with its own light divider now)
 *  - tile label `text-slate-300` -> `text-slate-500 dark:text-slate-400`
 *  - tile values -> `text-slate-900 dark:text-white`; semantic only:
 *    emerald/rose/amber -> `text-{c}-600 dark:text-{c}-400`
 *  - tile sub-labels: teal-300/emerald-400/blue-300/purple-300/rose-400/
 *    amber-200 -> `text-{c}-600 dark:text-{c}-400`; slate-300 -> slate-500
 *  - glass buttons `bg-white/10 ... text-white border-white/15`
 *    -> `bg-white dark:bg-slate-800 hover:bg-slate-50
 *    dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200
 *    border border-slate-200 dark:border-slate-700`
 *  - coloured glass buttons `bg-{c}-600/30 text-{c}-200
 *    border-{c}-500/30` -> `bg-{c}-50 dark:bg-{c}-500/10
 *    text-{c}-700 dark:text-{c}-300 border border-{c}-200
 *    dark:border-{c}-500/30`
 *
 * Run: npx tsx scripts/verify-hero-staff-finance.ts
 *      (or npm run test:hero-staff-finance).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

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

/** The hero area: from the opening <PageHeader to its </PageHeader>. */
function heroArea(src: string, file: string): string {
  const start = src.indexOf('<PageHeader');
  assert.ok(start >= 0, `${file}: no <PageHeader found`);
  const end = src.indexOf('</PageHeader>', start);
  assert.ok(end >= 0, `${file}: no </PageHeader> found`);
  return src.slice(start, end + '</PageHeader>'.length);
}

const staff = readSource('components/staff/StaffManager.tsx');
const finance = readSource('components/FinanceManager.tsx');
const staffHero = heroArea(staff, 'StaffManager.tsx');
const financeHero = heroArea(finance, 'FinanceManager.tsx');

// Light-on-dark classes that must NOT remain in a hero area. The
// `(?<!dark:)` guard lets the new `dark:text-{c}-400` variants pass
// while catching the bare light-only usage.
const BANNED_HERO = [
  'bg-white/10',
  'bg-white/5',
  'bg-white/20',
  'border-white/',
  'backdrop-blur',
  'text-cyan-300',
  'text-amber-300',
  'text-rose-300',
  'text-indigo-300',
  'text-emerald-300',
  'text-teal-300',
  'text-slate-300',
  'text-amber-200',
  'text-blue-300',
  'text-purple-300',
  'text-indigo-400',
];
const bannedRe = (cls: string) =>
  new RegExp(`(?<!dark:)${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const bannedReLoose = (cls: string) =>
  // Same guard as above; also catches the old `/90` opacity form
  // (e.g. `text-emerald-400/90`) since the class name itself matches.
  new RegExp(`(?<!dark:)${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

for (const [label, hero] of [
  ['Staff hero', staffHero],
  ['Finance hero', financeHero],
] as const) {
  for (const cls of BANNED_HERO) {
    check(`${label}: no ${cls}`, () => {
      assert.ok(!bannedRe(cls).test(hero), `${cls} still present in ${label}`);
    });
  }
  for (const cls of ['text-emerald-400', 'text-rose-400']) {
    check(`${label}: no bare ${cls}`, () => {
      assert.ok(!bannedReLoose(cls).test(hero), `${cls} still present bare in ${label}`);
    });
  }
  check(`${label}: footer grid has no own dark divider`, () => {
    assert.ok(!hero.includes('border-white/10'), 'footer still carries border-white/10');
    assert.ok(!/mt-6 pt-5 border-t/.test(hero), 'footer still carries its own mt-6 pt-5 border-t');
  });
  check(`${label}: 6 light KPI tiles`, () => {
    const n = hero.split('bg-slate-50 dark:bg-slate-800/60').length - 1;
    assert.strictEqual(n, 6, `expected 6 light KPI tiles, found ${n}`);
  });
  check(`${label}: 6 light tile labels`, () => {
    const n = hero.split('text-slate-500 dark:text-slate-400').length - 1;
    assert.ok(n >= 6, `expected >= 6 light tile labels, found ${n}`);
  });
  check(`${label}: no glass button left`, () => {
    assert.ok(!hero.includes('bg-white/10'), 'glass button bg-white/10 remains');
    assert.ok(!/bg-(blue|emerald|rose|teal|cyan)-600\/30/.test(hero), 'coloured glass button remains');
  });
}

// Titles / subtitles byte-identical.
check('Staff: title/subtitle strings unchanged', () => {
  assert.ok(staff.includes("'শিক্ষক, কর্মচারী ও মানবসম্পদ (HR) কেন্দ্র'"));
  assert.ok(staff.includes("'Staff, Faculty & HR Hub'"));
  assert.ok(staff.includes('মোট শিক্ষক ও উস্তাদ') && staff.includes('Total Teachers'));
  assert.ok(staff.includes('কর্মচারী ও অফিস স্টাফ') && staff.includes('Office & Staff'));
  assert.ok(staff.includes('আজকের স্টাফ উপস্থিতি') && staff.includes('Attendance Today'));
  assert.ok(staff.includes('মাসিক বেতন বিতরণ') && staff.includes('Monthly Payroll'));
  assert.ok(staff.includes('আজকের অনুমোদিত ছুটি') && staff.includes('Staff on Leave'));
  assert.ok(staff.includes('স্টাফ আইডি কার্ড') && staff.includes('Staff ID Cards'));
});
check('Finance: title/subtitle strings unchanged', () => {
  assert.ok(finance.includes("'হিসাব, ফি ও অর্থ ব্যবস্থাপনা কেন্দ্র'"));
  assert.ok(finance.includes("'Finance, Fees & Accounts Suite'"));
  assert.ok(finance.includes('আজকের মোট আয়') && finance.includes("Today's Income"));
  assert.ok(finance.includes('আজকের মোট ব্যয়') && finance.includes("Today's Expense"));
  assert.ok(finance.includes('ক্যাশ ব্যালেন্স') && finance.includes('Net Balance'));
  assert.ok(finance.includes('চলতি মাসে আদায়') && finance.includes('Month Inflow'));
  assert.ok(finance.includes('বকেয়া ফি') && finance.includes('Pending Dues'));
  assert.ok(finance.includes('মোট লেনদেন') && finance.includes('Vouchers'));
});

// KPI value expressions byte-identical (same data, only classes changed).
check('Staff: KPI value expressions unchanged', () => {
  for (const expr of [
    "formatNumber(kpis.teachersOnlyCount, 'bn')",
    "formatNumber(kpis.officeStaffCount, 'bn')",
    'kpis.staffAttendanceRate',
    'formatBanglaNumber(kpis.totalDisbursed)',
    "formatNumber(kpis.leavesTodayCount, 'bn')",
    'kpis.attendanceRecorded',
  ]) {
    assert.ok(staff.includes(expr), `missing KPI expression: ${expr}`);
  }
});
check('Finance: KPI value expressions unchanged', () => {
  for (const expr of [
    'formatNumber(kpis.todayIncome, language)',
    'formatNumber(kpis.todayExpense, language)',
    'kpis.netBalance >= 0',
    'formatNumber(kpis.netBalance, language)',
    'formatNumber(kpis.monthIncome, language)',
    'formatNumber(kpis.totalDues, language)',
    'formatNumber(kpis.totalTransactions, language)',
  ]) {
    assert.ok(finance.includes(expr), `missing KPI expression: ${expr}`);
  }
});

// Buttons: handlers + labels unchanged, light classes present.
check('Staff: hero buttons keep handlers and labels', () => {
  assert.ok(staffHero.includes('handleOpenAddModal'));
  assert.ok(staffHero.includes("setActiveTab('attendance')"));
  assert.ok(staffHero.includes("setActiveTab('payroll')"));
  assert.ok(staffHero.includes('+ নতুন শিক্ষক যুক্ত') && staffHero.includes('Add Staff'));
  assert.ok(staffHero.includes('দৈনিক স্টাফ হাজিরা') && staffHero.includes('Staff Attendance'));
  assert.ok(staffHero.includes('বেতন প্রদান') && staffHero.includes('Payroll'));
});
check('Finance: hero buttons keep handlers and labels', () => {
  for (const tab of ['student-fee', 'donation', 'salary', 'reports']) {
    assert.ok(financeHero.includes(`setActiveTab('${tab}')`), `missing setActiveTab('${tab}')`);
  }
  assert.ok(financeHero.includes('ছাত্র ফি আদায়') && financeHero.includes('Collect Fee'));
  assert.ok(financeHero.includes('দান ও সদকা') && financeHero.includes('Donations'));
  assert.ok(financeHero.includes('উস্তাদ বেতন') && financeHero.includes('Salary'));
  assert.ok(financeHero.includes('আর্থিক বিবরণী') && financeHero.includes('Reports'));
});
check('Staff: light button classes present', () => {
  assert.ok(staffHero.includes('bg-teal-50 dark:bg-teal-500/10'), 'teal button not light');
  assert.ok(staffHero.includes('bg-cyan-50 dark:bg-cyan-500/10'), 'cyan button not light');
  assert.ok(staffHero.includes('bg-white dark:bg-slate-800 hover:bg-slate-50'), 'glass button not light');
});
check('Finance: light button classes present', () => {
  for (const c of ['blue', 'emerald', 'rose']) {
    assert.ok(
      financeHero.includes(`bg-${c}-50 dark:bg-${c}-500/10`),
      `${c} button not light`,
    );
  }
  assert.ok(financeHero.includes('bg-white dark:bg-slate-800 hover:bg-slate-50'), 'glass button not light');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
