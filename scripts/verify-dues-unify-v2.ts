/**
 * verify-dues-unify-v2.ts — scripted proof for the dues-unify-v2 fix
 * (MadrasaReports alerts + fee-page dues table + PortalsServicesManager
 * student card + GuardianPortal fee tab + computeDueHistory fallback).
 *
 * Bug (morning audit 21 Nov 2026): the SAME student showed FOUR dues
 * figures. Mim: Overview top-5 ৳15,000, "আজকের করণীয়" follow-up
 * ৳1,500/person, alerts card 12 months ৳18,000, guardian portal
 * "চলতি বকেয়া" ৳5,000. The two top-5 cards were already unified by
 * PR #27 (topDueEntries over calculateTotalDues entries), but four
 * other per-student figures still ran their own math:
 *
 *   (a) Fee page dues table "চলতি বকেয়া" column showed dueThisMonth
 *       (current month only, ৳1,500) — and a student owing ONLY old
 *       months showed "পরিশোধিত ✅" with no Collect button.
 *   (b) Reports alerts "৩ মাস+ বকেয়া" recomputed dues by hand over the
 *       last 12 finished months with NO admission/fallback start, so a
 *       dateless never-paid student showed 12 x ৳1,500 = ৳18,000 while
 *       the shared aging (Jan-2026 fallback, approved 2 Nov 2026)
 *       counts 10 finished months = ৳15,000.
 *   (c) PortalsServicesManager studentFinancials invented a yearly bill
 *       (tuitionFee || 500, boarding || 2500) x 10 minus ALL lifetime
 *       payments, labelled "চলতি বকেয়া" — the ৳5,000 figure.
 *   (d) GuardianPortal fee tab showed dueThisMonth only ("চলতি মাসের
 *       বকেয়া"), no total at all — and passed an undefined month, so
 *       it used the UTC month instead of the shared local month.
 *   (e) The fee table's expanded 12-month grid (computeDueHistory)
 *       had the same no-fallback window as (b), so its summary line
 *       disagreed with the shared total on the same page.
 *
 * Fix: every one of those reads the ONE shared dues total
 * (calculateTotalDues / its entries: totalDue = totalAged — finished
 * months only; a month's fee becomes due only after that month ends,
 * Sagor's rule 23 Nov 2026), and every per-student line labels how
 * many months the figure covers (dueMonthCount). The current
 * (unfinished) month's unpaid fee is NOT in the total — it stays
 * visible as the current month's payable where collection needs it.
 * One month's unpaid fees drop out of the live total by definition
 * (the ৳19,55,800 figure falls by ≈ one month's dues); nothing else
 * about the total changes.
 *
 * Cases (asOf 2026-11, monthly ৳1,500):
 *   (1) Dateless never-paid student: shared total 15,000 (10 finished
 *       months); alerts long-dues 15,000 / 10 months (the old hand
 *       math said 12 months ৳18,000); computeDueHistory with the
 *       Jan-2026 fallback start: 10 months, 15,000, Nov-Dec 2025 'na'.
 *   (2) Student admitted Oct 2026, never paid: shared total 1,500
 *       (1 finished month — Oct); NOT in the 3+ months alerts list.
 *   (3) Current month paid, 10 aged months owed: shared total 15,000
 *       (10 months), dueThisMonth 0 — the fee table must still show
 *       the 15,000 with a Collect button, never "পরিশোধিত ✅".
 *   (4) Fully paid student: total 0, no dues anywhere.
 *   (5) Source checks: alerts derive longDues from duesSummary.entries
 *       (no hand-rolled paidByKey / finishedMonths recompute, no
 *       12-month slice); fee table column shows item.totalDue + month
 *       count and hasDue uses totalDue; portal manager calls
 *       calculateTotalDues (no estimatedYearlyBill, no || 500 / ||
 *       2500 fallbacks) and labels the month count; guardian
 *       feeSummary carries the shared total + month count and uses
 *       localMonthStr(); computeDueHistory accepts the fallback start.
 *
 * Run: npx tsx scripts/verify-dues-unify-v2.ts
 */
import {
  calculateTotalDues,
  calculateSingleStudentDue,
  calculateFeeAging,
  academicYearFallbackStartMonth,
  localMonthStr,
} from '../services/studentDuesService';
import { computeDueHistory } from '../services/studentDuesHistory';
import type { Student } from '../types/student';
import type { ClassFeeStructure, FinanceTransaction } from '../types';
import type { FeeTypeDef } from '../services/feeTypes';
import type { AcademicYear } from '../types/academic';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const AS_OF = '2026-11';
const FALLBACK = '2026-01';
const FEE_TYPES: FeeTypeDef[] = [
  { id: 'tuition', labelBn: 'মাসিক বেতন', labelEn: 'Tuition', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: true },
];
const YEARS: AcademicYear[] = [
  { id: 'y2026', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isCurrent: true } as AcademicYear,
];
const STRUCTS: ClassFeeStructure[] = [
  { classLevel: 'Play', monthlyTuition: 1500 } as ClassFeeStructure,
];
const stu = (id: string, admissionDate?: string): Student =>
  ({ id, studentId: id, name: id, nameBn: id, classLevel: 'Play', status: 'Active', admissionDate } as unknown as Student);
const tx = (studentId: string, feeMonth: string, amount: number, category = 'STUDENT_TUITION'): FinanceTransaction =>
  ({ id: `tx-${studentId}-${feeMonth}`, type: 'INCOME', category, studentId, feeMonth, date: `${feeMonth}-05`, amount } as unknown as FinanceTransaction);

const summaryFor = (students: Student[], transactions: FinanceTransaction[] = []) =>
  calculateTotalDues(students, STRUCTS, transactions, AS_OF, FEE_TYPES, FALLBACK);

/** The alerts derivation, exactly as the component must compute it: the
 *  shared total and its month count straight from the entries — never a
 *  hand-rolled recompute, never a 12-month slice. Mirrors
 *  components/MadrasaReports.tsx longDues. */
const sharedLongDues = (students: Student[], transactions: FinanceTransaction[] = []) =>
  summaryFor(students, transactions).entries
    .map(e => ({
      student: e.profile.student,
      dueMonths: e.dueMonthCount,
      dueAmount: e.totalDue,
    }))
    .filter(d => d.dueMonths >= 3)
    .sort((a, b) => b.dueMonths - a.dueMonths || b.dueAmount - a.dueAmount);

// (1) Dateless never-paid student (Mim's shape).
{
  const s = summaryFor([stu('mim')]);
  const e = s.entries[0];
  eq('(1) Dateless never-paid shared total is 15,000 (10 finished months)', e?.totalDue, 15000);
  eq('(1) Dateless never-paid dueMonthCount is 10', e?.dueMonthCount, 10);
  eq('(1) Dateless never-paid aged is 15,000 (10 finished months)', e?.aging.totalAged, 15000);
  const ld = sharedLongDues([stu('mim')]);
  eq('(1) Alerts long-dues for the same student is 15,000, not 18,000', ld[0]?.dueAmount, 15000);
  eq('(1) Alerts long-dues counts 10 months, not 12', ld[0]?.dueMonths, 10);
  const h = computeDueHistory(stu('mim'), [], 1500, AS_OF, 12, FALLBACK);
  eq('(1) Due-history with fallback start is 10 months', h.dueMonths, 10);
  eq('(1) Due-history with fallback start is 15,000', h.dueAmount, 15000);
  check('(1) Due-history marks pre-2026 months na, not unpaid',
    h.months.filter(m => m.month < FALLBACK).every(m => m.status === 'na'),
    `got ${JSON.stringify(h.months.filter(m => m.month < FALLBACK).map(m => m.status))}`);
}

// (2) Admitted Oct 2026, never paid: 1 finished month, below the alerts threshold.
{
  const s = summaryFor([stu('oct', '2026-10-10')]);
  eq('(2) Oct-admitted never-paid shared total is 1,500', s.entries[0]?.totalDue, 1500);
  eq('(2) Oct-admitted never-paid dueMonthCount is 1', s.entries[0]?.dueMonthCount, 1);
  eq('(2) Oct-admitted student is NOT in the 3+ months alerts list',
    sharedLongDues([stu('oct', '2026-10-10')]).length, 0);
}

// (3) Current month paid, aged months owed: the total is the aged part,
//     and dueThisMonth alone (0) must never read as "paid".
{
  const s = summaryFor([stu('aged', '2026-01-10')], [tx('aged', '2026-11', 1500)]);
  const e = s.entries[0];
  eq('(3) Current month paid, aged owed: total is 15,000', e?.totalDue, 15000);
  eq('(3) Current month paid, aged owed: dueMonthCount is 10', e?.dueMonthCount, 10);
  eq('(3) Current month paid, aged owed: dueThisMonth is 0', e?.profile.dueThisMonth, 0);
  check('(3) A student with totalDue > 0 counts as having dues even when dueThisMonth is 0',
    (e?.totalDue || 0) > 0 && e?.profile.dueThisMonth === 0);
}

// (4) Fully paid student: nothing due anywhere.
{
  const allMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const s = summaryFor([stu('paid', '2026-01-10')], allMonths.map(m => tx('paid', m, 1500)));
  eq('(4) Fully paid totalDue is 0', s.entries[0]?.totalDue, 0);
  eq('(4) Fully paid student is not in the alerts list', sharedLongDues([stu('paid', '2026-01-10')], allMonths.map(m => tx('paid', m, 1500))).length, 0);
}

// (5) The shared total is one number: the finished-months aging
//     (totalAged) equals calculateTotalDues totalDue. The current
//     month's payable (dueThisMonth) is kept outside the total.
{
  const student = stu('mim');
  const profile = calculateSingleStudentDue(student, STRUCTS, [], AS_OF, FEE_TYPES);
  const aging = calculateFeeAging(student, STRUCTS, [], AS_OF, FEE_TYPES, FALLBACK);
  const s = summaryFor([student]);
  eq('(5) totalAged equals the shared totalDue',
    aging.totalAged, s.entries[0]?.totalDue);
  eq('(5) The current month payable (1,500) is outside the total',
    profile.dueThisMonth, 1500);
  eq('(5) The shared summary still exposes the current-month payable separately',
    s.currentMonthDue, 1500);
  eq('(5) Academic-year fallback start is 2026-01',
    academicYearFallbackStartMonth(YEARS, AS_OF), '2026-01');
  eq('(5) localMonthStr is the local YYYY-MM', localMonthStr(),
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
}

// (6) Source checks: every per-student dues figure reads the shared total.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
{
  const rep = read('components/MadrasaReports.tsx');
  check('(6) Reports alerts derive longDues from duesSummary.entries',
    /longDues[\s\S]{0,600}duesSummary\.entries/.test(rep), 'longDues must read the shared entries');
  check('(6) Reports alerts no longer hand-roll paidByKey',
    !rep.includes('paidByKey'), 'the hand-rolled paidByKey recompute must be gone');
  check('(6) Reports alerts no longer build their own finishedMonths list',
    !/const finishedMonths: string\[\]/.test(rep), 'the hand-rolled finishedMonths list must be gone');
  check('(6) Reports alerts no longer slice the last 12 months',
    !rep.includes('byMonth.slice(-12)'), 'the 12-month slice must be gone — the box shows the full shared total');
  check('(6) Reports alerts still show the month count',
    /dueMonths/.test(rep) && /মাস/.test(rep), 'alerts rows must label the month count');

  const fee = read('components/finance/StudentFeeCollection.tsx');
  check('(6) Fee table column shows the shared totalDue, not dueThisMonth',
    /মোট বক[\s\S]{0,3000}item\.totalDue/.test(fee) || /item\.totalDue[\s\S]{0,600}মাসের/.test(fee),
    'the dues column must show item.totalDue with a month label');
  check('(6) Fee table hasDue uses the shared total (old-months-only debtors are not "paid")',
    /hasDue = item\.totalDue > 0/.test(fee), 'hasDue must be item.totalDue > 0');
  check('(6) Fee table passes the fallback start into the 12-month history',
    /computeDueHistory\([\s\S]{0,200}agingFallbackStart|fallbackStart\)/.test(fee) || /computeDueHistory\(item\.student, transactions, item\.monthlyExpected, asOf, 12,/.test(fee),
    'dueHistoryById must pass the fallback start');
  check('(6) Fee table reminder SMS uses the shared total, not dueThisMonth alone',
    /handleCopyReminderSMS[\s\S]{0,800}item\.totalDue/.test(fee), 'the SMS must quote the shared total');

  const mgr = read('components/portals/PortalsServicesManager.tsx');
  check('(6) Portal manager computes pending dues from calculateTotalDues',
    mgr.includes('calculateTotalDues('), 'studentFinancials must call calculateTotalDues');
  check('(6) Portal manager yearly-bill invention is gone',
    !mgr.includes('estimatedYearlyBill') && !mgr.includes('tuitionFee || 500') && !mgr.includes('boardingFee || 2500'),
    'estimatedYearlyBill / || 500 / || 2500 must be gone');
  check('(6) Portal manager labels the month count on the dues line',
    /dueMonthCount/.test(mgr) && /মাস/.test(mgr), 'the dues line must show the month count');

  const portal = read('components/GuardianPortal.tsx');
  check('(6) Guardian fee summary carries the shared total + month count',
    /totalDue/.test(portal) && /dueMonthCount/.test(portal),
    'feeSummary must carry totalDue and dueMonthCount');
  check('(6) Guardian portal shows the shared total as "মোট বকেয়া"',
    /মোট বকেয়া/.test(portal), 'the fee tab must show a মোট বকেয়া figure');
  check('(6) Guardian portal uses the shared local month, not UTC',
    /const month = localMonthStr\(\);[\s\S]{0,400}calculateTotalDues\(\s*\[linkedStudent\], feeStructures, transactions, month, feeTypes/.test(portal),
    'calculateTotalDues must be passed localMonthStr()');
  check('(6) Guardian portal no longer hand-adds dueThisMonth + totalAged',
    !/dueThisMonth \+ .*totalAged/.test(portal),
    'the hand-add of the current month onto the aged dues must be gone');

  const hist = read('services/studentDuesHistory.ts');
  check('(6) computeDueHistory accepts the fallback start',
    /computeDueHistory\(/.test(hist) && /startMonth\?: string/.test(hist),
    'computeDueHistory needs an optional startMonth param');
}

console.log(failures === 0 ? '\nALL DUES-UNIFY-V2 CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
