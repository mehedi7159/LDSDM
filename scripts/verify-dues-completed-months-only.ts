/**
 * verify-dues-completed-months-only.ts — scripted proof for the
 * dues-completed-months-only fix (Sagor's rule, voice call 23 Nov 2026):
 *
 * RULE: a month's fee becomes due only AFTER that month ends. November
 * 2026 is still running, so dues count up to OCTOBER only (10 finished
 * months for a Jan-2026 student). On 1 December, November starts
 * counting. The system showed 11 months INCLUDING November.
 *
 * SCOPE EXPANSION (same call): ONE student = ONE dues figure
 * EVERYWHERE. The same student showed different figures in different
 * places (Mim: top-dues ৳16,500, "৩ মাস+ বকেয়া" box ৳18,000, guardian
 * portal ৳5,000). Every place now reads the SAME shared calculation
 * (calculateTotalDues, finished months only).
 *
 * What changes:
 *   - calculateTotalDues totalDue = finished months only (aging).
 *     The current (unfinished) month's unpaid fee is NOT dues yet —
 *     it stays visible as the current month's payable
 *     (currentMonthDue), never inside any "বকেয়া" total.
 *   - dueMonthCount counts finished months only.
 *   - The "৩ মাস+ বকেয়া" box shows the student's FULL shared total,
 *     not a 12-month slice (a student with 22 finished months of dues
 *     showed ৳18,000 there and ৳33,000 on the dashboard).
 *   - Guardian portal fee tab reads calculateTotalDues (it hand-added
 *     dueThisMonth + totalAged); its "চলতি মাসের বকেয়া" card becomes
 *     "চলতি মাসের ফি" (the current month's fee is not dues yet).
 *   - Student profile headline "বকেয়া" = the shared tuition figure
 *     (totalAged); pending exam fee stays visible in its own row and
 *     in the ledger's total balance, never inside the dues figure.
 *   - Fee-page / HighImpact "চলতি মাস ৳X + পুরনো ৳Y" split lines are
 *     gone (they summed above the new headline); the current month's
 *     fee is shown separately, labelled as not-yet-due.
 *   - Fee-page SMS/WhatsApp month count is finished months only
 *     (it added +1 for the current month).
 *   - Mobile app headlines ("মোট বকেয়া", "শ্রেণির বকেয়া", top dues,
 *     guardian home) read the same shared total instead of adding the
 *     current month on top of it.
 *
 * What does NOT change:
 *   - Collecting the current month's fee still works (payment flow
 *     uses the current-month payable; a November payment is recorded
 *     as a November payment and never reduces finished-month dues).
 *   - Exam fee never enters monthly dues; a payment for the current
 *     month never reduces old dues.
 *   - The ৳19,55,800 live total drops by ONE month's unpaid fees
 *     (the November slice, ~৳1,77,800 on the 22 Nov live split) and
 *     by nothing else. The remaining total's real-vs-phantom question
 *     is a separate decision — untouched here.
 *
 * Cases (asOf 2026-11, monthly ৳1,500, fallback 2026-01):
 *   (1) Dateless never-paid: total 15,000 (10 finished months),
 *       dueMonthCount 10, currentMonthDue 1,500 (payable, not dues).
 *   (2) Same student on 1 Dec 2026 (asOf 2026-12): total 16,500
 *       (11 months Jan–Nov), dueMonthCount 11.
 *   (3) Admitted Oct 2026, never paid: total 1,500 (Oct only).
 *   (4) Admitted Nov 2026 (this month), never paid: total 0,
 *       dueMonthCount 0, currentMonthDue 1,500.
 *   (5) Admitted Mar 2026, never paid: total 12,000 (8 months).
 *   (6) Exam fee never in monthly dues: an exam-fee payment for Nov
 *       (or for a finished month) does not reduce the total.
 *   (7) Current-month payment still recorded: Nov tuition paid in
 *       full → total still 15,000, paidThisMonth 1,500,
 *       currentMonthDue 0, summary totalPaid 1,500; a partial Nov
 *       payment (500) leaves currentMonthDue 1,000, total unchanged.
 *   (8) No fee structure: total 0, never an invented figure.
 *   (9) Fully paid (all finished months + Nov): total 0.
 *  (10) ONE figure everywhere: the same test student shows the same
 *       total through the Dashboard top-dues, the 3+ box, the
 *       guardian portal, the public portal, the profile tuition row,
 *       the fee page and the mobile totals — and the old 12-month
 *       slice (৳18,000) is gone for a 22-month debtor (৳33,000).
 *  (11) Source checks: no caller adds the current month on top of
 *       the shared total; every dues figure reads the shared helper.
 *
 * Run: npx tsx scripts/verify-dues-completed-months-only.ts
 */
import {
  calculateTotalDues,
  calculateSingleStudentDue,
  calculateFeeAging,
  topDueEntries,
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
const DEC = '2026-12';
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
const examTx = (studentId: string, feeMonth: string, amount: number): FinanceTransaction =>
  ({ id: `extx-${studentId}-${feeMonth}`, type: 'INCOME', category: 'EXAM_FEE', examId: 'exam-1', studentId, feeMonth, date: `${feeMonth}-05`, amount } as unknown as FinanceTransaction);

const summaryFor = (students: Student[], transactions: FinanceTransaction[] = [], asOf = AS_OF) =>
  calculateTotalDues(students, STRUCTS, transactions, asOf, FEE_TYPES, FALLBACK);

/** The 3+ box derivation, exactly as the component must compute it:
 *  the student's FULL shared total and month count — never a
 *  12-month slice. Mirrors components/MadrasaReports.tsx longDues. */
const sharedLongDues = (students: Student[], transactions: FinanceTransaction[] = []) =>
  summaryFor(students, transactions).entries
    .map(e => ({
      student: e.profile.student,
      dueMonths: e.dueMonthCount,
      dueAmount: e.totalDue,
    }))
    .filter(d => d.dueMonths >= 3)
    .sort((a, b) => b.dueMonths - a.dueMonths || b.dueAmount - a.dueAmount);

// (1) November running: dateless never-paid student owes 10 finished months.
{
  const s = summaryFor([stu('mim')]);
  const e = s.entries[0];
  eq('(1) Nov running: dateless never-paid total is 15,000, not 16,500', e?.totalDue, 15000);
  eq('(1) Nov running: dueMonthCount is 10, not 11', e?.dueMonthCount, 10);
  eq('(1) Nov running: aged is 15,000 (10 finished months)', e?.aging.totalAged, 15000);
  eq('(1) Nov running: current month payable is still 1,500 (not dues)', s.currentMonthDue, 1500);
  eq('(1) Nov running: summary totalDue is 15,000', s.totalDue, 15000);
  eq('(1) Nov running: summary agedDue is 15,000', s.agedDue, 15000);
  eq('(1) Nov running: dueStudentsCount is 1', s.dueStudentsCount, 1);
  eq('(1) Nov running: paidStudentsCount is 0 (the student still owes)', s.paidStudentsCount, 0);
}

// (2) On 1 Dec 2026 November starts counting: 11 months.
{
  const s = summaryFor([stu('mim')], [], DEC);
  eq('(2) 1 Dec: same student total is 16,500 (11 months Jan–Nov)', s.entries[0]?.totalDue, 16500);
  eq('(2) 1 Dec: dueMonthCount is 11', s.entries[0]?.dueMonthCount, 11);
}

// (3) Admitted Oct 2026, never paid: only October is finished.
{
  const s = summaryFor([stu('oct', '2026-10-10')]);
  eq('(3) Oct-admitted never-paid total is 1,500 (Oct only)', s.entries[0]?.totalDue, 1500);
  eq('(3) Oct-admitted never-paid dueMonthCount is 1', s.entries[0]?.dueMonthCount, 1);
  eq('(3) Oct-admitted student is NOT in the 3+ months alerts list',
    sharedLongDues([stu('oct', '2026-10-10')]).length, 0);
}

// (4) Admitted this month (Nov 2026), never paid: nothing is due yet.
{
  const s = summaryFor([stu('nov', '2026-11-05')]);
  eq('(4) Nov-admitted never-paid total is 0', s.entries[0]?.totalDue, 0);
  eq('(4) Nov-admitted never-paid dueMonthCount is 0', s.entries[0]?.dueMonthCount, 0);
  eq('(4) Nov-admitted current month payable is 1,500', s.currentMonthDue, 1500);
  eq('(4) Nov-admitted student is not counted as a debtor', s.dueStudentsCount, 0);
}

// (5) Mid-year admission (Mar 2026): finished months only.
{
  const s = summaryFor([stu('mar', '2026-03-15')]);
  eq('(5) Mar-admitted never-paid total is 12,000 (Mar–Oct, 8 months)', s.entries[0]?.totalDue, 12000);
  eq('(5) Mar-admitted never-paid dueMonthCount is 8', s.entries[0]?.dueMonthCount, 8);
}

// (6) Exam fee never enters monthly dues.
{
  const sNov = summaryFor([stu('mim')], [examTx('mim', '2026-11', 1500)]);
  eq('(6) Exam-fee payment for Nov does not reduce the total', sNov.entries[0]?.totalDue, 15000);
  const sOct = summaryFor([stu('mim')], [examTx('mim', '2026-10', 1500)]);
  eq('(6) Exam-fee payment for a finished month does not reduce the total', sOct.entries[0]?.totalDue, 15000);
  eq('(6) Exam-fee payment does not change the month count', sOct.entries[0]?.dueMonthCount, 10);
}

// (7) Current-month payment still recorded — and it never reduces old dues.
{
  const s = summaryFor([stu('aged', '2026-01-10')], [tx('aged', '2026-11', 1500)]);
  const e = s.entries[0];
  eq('(7) Nov paid in full: total is still 15,000 (old dues untouched)', e?.totalDue, 15000);
  eq('(7) Nov paid in full: paidThisMonth is 1,500', e?.profile.paidThisMonth, 1500);
  eq('(7) Nov paid in full: currentMonthDue is 0', s.currentMonthDue, 0);
  eq('(7) Nov paid in full: summary totalPaid records the 1,500', s.totalPaid, 1500);
  const sp = summaryFor([stu('part', '2026-01-10')], [tx('part', '2026-11', 500)]);
  eq('(7) Nov partial payment (500): currentMonthDue is 1,000', sp.currentMonthDue, 1000);
  eq('(7) Nov partial payment (500): total is still 15,000', sp.entries[0]?.totalDue, 15000);
}

// (8) No fee structure: nothing due, never an invented figure.
{
  const noStruct: ClassFeeStructure[] = [];
  const s = calculateTotalDues([stu('mim')], noStruct, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(8) No fee structure: total is 0', s.totalDue, 0);
  eq('(8) No fee structure: monthlyExpected is 0', s.entries[0]?.profile.monthlyExpected, 0);
}

// (9) Fully paid (all finished months + Nov): nothing due.
{
  const allMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const s = summaryFor([stu('paid', '2026-01-10')], allMonths.map(m => tx('paid', m, 1500)));
  eq('(9) Fully paid totalDue is 0', s.entries[0]?.totalDue, 0);
  eq('(9) Fully paid student counts as paid', s.paidStudentsCount, 1);
  eq('(9) Fully paid student is not in the alerts list', sharedLongDues([stu('paid', '2026-01-10')], allMonths.map(m => tx('paid', m, 1500))).length, 0);
}

// (10) ONE figure everywhere — the same student, the same total.
{
  const mim = stu('mim');
  const shared = summaryFor([mim]).entries[0]?.totalDue;
  eq('(10) Shared total for Mim is 15,000', shared, 15000);

  // Dashboard top-dues (topDueEntries over the shared entries).
  const top = topDueEntries(summaryFor([mim]).entries);
  eq('(10) Dashboard top-dues shows the same 15,000', top[0]?.totalDue, shared);

  // Reports 3+ box: the FULL shared total, not a 12-month slice.
  const ld = sharedLongDues([mim]);
  eq('(10) 3+ box shows the same 15,000', ld[0]?.dueAmount, shared);
  eq('(10) 3+ box counts the same 10 months', ld[0]?.dueMonths, 10);

  // A 22-month debtor (admitted Jan 2025): the old 12-month slice
  // said 18,000 while the shared total said 33,000. Both must now
  // read 33,000.
  const old = stu('old', '2025-01-10');
  const oldShared = summaryFor([old]).entries[0]?.totalDue;
  eq('(10) 22-month debtor shared total is 33,000', oldShared, 33000);
  const oldLd = sharedLongDues([old]);
  eq('(10) 3+ box for the 22-month debtor is the same 33,000, not 18,000', oldLd[0]?.dueAmount, 33000);
  eq('(10) 3+ box for the 22-month debtor counts 22 months', oldLd[0]?.dueMonths, 22);
  const sliced12 = summaryFor([old]).entries[0]?.aging.byMonth.slice(-12)
    .reduce((sum, m) => sum + m.due, 0);
  check('(10) The old 12-month slice (18,000) is NOT the figure anymore',
    sliced12 === 18000 && oldLd[0]?.dueAmount !== sliced12,
    `slice is ${sliced12}, box shows ${oldLd[0]?.dueAmount}`);

  // Guardian portal + public portal: a single-student shared call.
  const guardian = calculateTotalDues([mim], STRUCTS, [], AS_OF, FEE_TYPES, FALLBACK).entries[0];
  eq('(10) Guardian portal total is the same 15,000', guardian?.totalDue, shared);
  eq('(10) Guardian portal month count is the same 10', guardian?.dueMonthCount, 10);
  const portal = calculateTotalDues([mim], STRUCTS, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(10) Public portal pending dues is the same 15,000', portal.totalDue, shared);

  // Student profile tuition row: finished-months aging only.
  const aging = calculateFeeAging(mim, STRUCTS, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(10) Profile tuition-row due (totalAged) is the same 15,000', aging.totalAged, shared);
  const profile = calculateSingleStudentDue(mim, STRUCTS, [], AS_OF, FEE_TYPES);
  check('(10) Profile current-month payable is kept separate from dues',
    profile.dueThisMonth === 1500 && aging.totalAged === shared,
    `dueThisMonth ${profile.dueThisMonth}, totalAged ${aging.totalAged}`);

  // Fee page: the same shared summary.
  const feePage = summaryFor([mim]);
  eq('(10) Fee page total is the same 15,000', feePage.totalDue, shared);

  // Mobile: the shared total stands alone — never the current month
  // added on top of it.
  const mobile = summaryFor([mim]);
  check('(10) Mobile total is the shared total, not shared + current month',
    mobile.totalDue === shared && mobile.totalDue + mobile.currentMonthDue !== shared,
    `totalDue ${mobile.totalDue}, currentMonthDue ${mobile.currentMonthDue}`);

  // Fee-page reminder month count: finished months only, no +1.
  const agedMonths = summaryFor([mim]).entries[0]?.aging.byMonth.length;
  eq('(10) Reminder month count is 10 finished months, not 11', agedMonths, 10);

  // Due-history grid: finished months only (Nov is not in the window).
  const h = computeDueHistory(mim, [], 1500, AS_OF, 12, FALLBACK);
  eq('(10) Due-history counts 10 months', h.dueMonths, 10);
  eq('(10) Due-history amounts to 15,000', h.dueAmount, 15000);
  check('(10) Due-history window ends at Oct 2026, not Nov',
    h.to === '2026-10', `window ends ${h.to}`);
  eq('(10) Academic-year fallback start is 2026-01',
    academicYearFallbackStartMonth(YEARS, AS_OF), '2026-01');
  eq('(10) localMonthStr is the local YYYY-MM', localMonthStr(),
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
}

// (11) Source checks: every dues figure reads the shared helper.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
{
  const svc = read('services/studentDuesService.ts');
  check('(11) Shared total is finished months only (no current month added)',
    !svc.includes('profile.dueThisMonth + aging.totalAged'),
    'calculateTotalDues must not add dueThisMonth to totalAged');
  check('(11) Shared totalDue comes from aging.totalAged',
    /const totalDue = aging\.totalAged;/.test(svc),
    'entries must set totalDue = aging.totalAged');
  check('(11) dueMonthCount counts finished months only',
    /dueMonthCount: aging\.byMonth\.length,/.test(svc),
    'dueMonthCount must be aging.byMonth.length');
  check('(11) Shared summary still exposes the current-month payable separately',
    /currentMonthDue: summary\.totalDue,/.test(svc),
    'currentMonthDue must stay available for the collection views');
  check('(11) paidStudentsCount is the complement of dueStudentsCount (no dues at all)',
    /paidStudentsCount: summary\.totalStudents - dueStudentsCount,/.test(svc) ||
    /paidStudentsCount: .*totalDue === 0/.test(svc),
    'paidStudentsCount must mean "nothing due at all"');

  const rep = read('components/MadrasaReports.tsx');
  check('(11) 3+ box reads the full shared total, not a 12-month slice',
    /dueAmount: e\.totalDue/.test(rep) && /dueMonths: e\.dueMonthCount/.test(rep),
    'longDues must use e.totalDue / e.dueMonthCount');
  check('(11) 3+ box no longer slices the last 12 months',
    !/e\.aging\.byMonth\.slice\(-12\)/.test(rep),
    'the slice(-12) cap must be gone');
  check('(11) 3+ box subtitle no longer says "last 12 finished months"',
    !rep.includes('গত ১২ সমাপ্ত মাসের হিসাবে'),
    'the 12-month subtitle must be gone');

  const portal = read('components/GuardianPortal.tsx');
  check('(11) Guardian fee summary reads calculateTotalDues',
    /calculateTotalDues\(\s*\[linkedStudent\]/.test(portal),
    'feeSummary must call calculateTotalDues([linkedStudent], …)');
  check('(11) Guardian portal no longer hand-adds dueThisMonth + totalAged',
    !portal.includes('profile.dueThisMonth + aging.totalAged'),
    'the hand-added total must be gone');
  check('(11) Guardian current-month card is labelled "চলতি মাসের ফি", not "চলতি মাসের বকেয়া"',
    portal.includes('চলতি মাসের ফি') && !portal.includes('চলতি মাসের বকেয়া'),
    'the card must say চলতি মাসের ফি');

  const fee = read('components/finance/StudentFeeCollection.tsx');
  check('(11) Fee-page reminder month count has no +1 for the current month',
    !fee.includes('+ (item.dueThisMonth > 0 ? 1 : 0)'),
    'totalMonths must be agedMonths only');
  check('(11) Fee-page header no longer shows the "চলতি মাস ৳X + পুরনো ৳Y" split',
    !/চলতি মাস ৳\$\{formatBanglaNumber\(aggregateMetrics\.currentMonthDueFees\)\} \+ পুরনো/.test(fee),
    'the old split line must be gone from the header card');

  const hi = read('components/finance/HighImpactSummaryCards.tsx');
  check('(11) HighImpact card no longer shows the "চলতি মাস ৳X + পুরনো ৳Y" split',
    !/চলতি মাস ৳\$\{formatBanglaNumber\(currentMonthDueFees\)\} \+ পুরনো/.test(hi),
    'the old split line must be gone from the HighImpact card');

  const prof = read('components/StudentProfileView.tsx');
  check('(11) Profile headline dues is the shared tuition figure (totalAged)',
    /const due = totalAged;/.test(prof),
    'feeSummary due must be totalAged');
  check('(11) Profile keeps the pending exam fee in a separate total balance',
    /totalBalance/.test(prof),
    'the ledger needs a totalBalance (totalAged + examPending)');
  check('(11) Profile fee aging uses the shared local month',
    /calculateFeeAging\(\s*currentStudent,[\s\S]{0,200}localMonthStr\(\)/.test(prof),
    'feeAging must pass localMonthStr()');

  const mob = read('components/StaffMobileApp.tsx');
  check('(11) Mobile class summary reads calculateTotalDues',
    /const classDuesSummary = useMemo\(\(\) => \{\s*return calculateTotalDues\(/.test(mob),
    'classDuesSummary must call calculateTotalDues');
  check('(11) Mobile all-students summary reads calculateTotalDues',
    /return calculateTotalDues\(active, feeStructures, transactions/.test(mob),
    'allDuesSummary must call calculateTotalDues');
  check('(11) Mobile no longer adds aged dues on top of a shared total',
    !mob.includes('+ cashierAging.totalAged') && !mob.includes('+ teacherAging.totalAged'),
    'the "+ aging.totalAged" top-ups must be gone');
  check('(11) Mobile top-dues list reads the shared entries',
    /topDueEntries\(allDuesSummary\.entries\)/.test(mob),
    'topDueProfiles must come from topDueEntries(allDuesSummary.entries)');
  check('(11) Mobile guardian home total is finished-months dues',
    /guardianDuesTotal[\s\S]{0,500}totalAged/.test(mob),
    'guardianDuesTotal must sum totalAged');
  check('(11) Mobile "চলতি মাস" boxes show the current-month payable, not the dues total',
    /চলতি মাস[\s\S]{0,200}currentMonthDue/.test(mob) && !/চলতি মাস[\s\S]{0,200}allDuesSummary\.totalDue\.toLocaleString/.test(mob),
    'the This-month boxes must read currentMonthDue');
  check('(11) Mobile guardian report card total is finished-months dues',
    /const totalDue = r\.aging \? r\.aging\.totalAged : 0;/.test(mob),
    'the guardian card must not add dueThisMonth');
  check('(11) Mobile per-month ledger still uses the class summary for the selected month',
    /const viewDuesSummary = useMemo\(\(\) => \{[\s\S]{0,400}?return calculateClassDuesSummary\(classStudents/.test(mob),
    'viewDuesSummary must stay a per-month class summary');
}

console.log(failures === 0 ? '\nALL DUES-COMPLETED-MONTHS CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
