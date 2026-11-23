/**
 * verify-top-debtors-shared.ts — scripted proof for the shared
 * top-debtors fix (services/studentDuesService.ts + Dashboard.tsx +
 * MadrasaReports.tsx).
 *
 * Bug (morning audit 20 Nov 2026): the "সর্বোচ্চ বকেয়া (শীর্ষ ৫)"
 * card showed ৳15,000/person in Overview but ৳1,500/person in the
 * "আজকের করণীয়" tab, for the SAME 5 students (Mim, Rumman, Jebina,
 * Lamia, Sumaiya).
 *
 * Root cause (read, not guessed): two different calculations for the
 * same card. Overview renders <MadrasaReports />, whose "সর্বোচ্চ
 * বকেয়া" list mapped each student to calculateFeeAging(...).totalAged
 * — finished months only (10 × ৳1,500 = ৳15,000 for a dateless,
 * never-paid student as of Nov 2026). The করণীয় tab's own card in
 * Dashboard.tsx mapped the shared summary's profiles to
 * p.dueThisMonth — the current month only (৳1,500). Neither was the
 * shared definition.
 *
 * Fix (Fix #4 pattern — the ONE shared dues total):
 *   মোট বকেয়া = শেষ হওয়া সব মাসের বকেয়া (finished months only;
 *   a month's fee becomes due only after that month ends — Sagor's
 *   rule 23 Nov 2026). The current month's unpaid fee is NOT dues
 *   yet; it stays visible as the current month's payable.
 * calculateTotalDues(...).entries[].totalDue already IS that number,
 * so both cards now read the same entries through one shared helper,
 * topDueEntries(entries, 5) (totalDue desc, top 5), and each row
 * labels how many months the figure covers
 * (dueMonthCount = finished months owed).
 * The fee RULE is unchanged — only the two displays are unified.
 *
 * Cases (asOf 2026-11, monthly ৳1,500, admission Jan 2026):
 *   (1) Never-paid student: totalDue 15,000 (10 finished months),
 *       dueMonthCount 10
 *   (2) Admitted Oct 2026, never paid: totalDue 1,500, dueMonthCount 1
 *   (3) Current month paid, aged months owed: totalDue is aged only,
 *       dueMonthCount counts aged months only
 *   (4) Fully paid student: totalDue 0, excluded from topDueEntries
 *   (5) topDueEntries sorts by totalDue desc and takes the top 5
 *   (6) Source checks: Dashboard card uses topDueEntries on
 *       duesSummary.entries and shows totalDue + the month count;
 *       MadrasaReports topDues uses the same helper (no direct
 *       calculateFeeAging for the list); both render the month label
 *
 * Run: npx tsx scripts/verify-top-debtors-shared.ts
 */
import {
  calculateTotalDues,
  topDueEntries,
  academicYearFallbackStartMonth,
} from '../services/studentDuesService';
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
const stu = (id: string, admissionDate?: string): Student =>
  ({ id, studentId: `2026${id}`, name: id, classLevel: 'Class 1', status: 'Active', admissionDate } as unknown as Student);
const structures: ClassFeeStructure[] = [{ id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1500, admissionFee: 0, examFee: 0, boardingFee: 0, bookFee: 0 } as unknown as ClassFeeStructure];
const feeTypes: FeeTypeDef[] = [];
const years: AcademicYear[] = [{ name: '2026', startDate: '2026-01-01', isCurrent: true } as unknown as AcademicYear];
const tx = (studentId: string, feeMonth: string, amount: number): FinanceTransaction =>
  ({ type: 'INCOME', studentId, feeMonth, date: `${feeMonth}-05`, amount } as unknown as FinanceTransaction);

const summaryFor = (students: Student[], transactions: FinanceTransaction[] = []) =>
  calculateTotalDues(students, structures, transactions, AS_OF, feeTypes,
    academicYearFallbackStartMonth(years, AS_OF) || FALLBACK);

// (1) Never-paid, admitted Jan 2026: 10 finished months only.
{
  const s = summaryFor([stu('mim', '2026-01-10')]);
  eq('(1) Never-paid totalDue is 10 months', s.entries[0]?.totalDue, 15000);
  eq('(1) Never-paid dueMonthCount is 10', s.entries[0]?.dueMonthCount, 10);
}
// (2) Admitted Oct 2026, never paid: Oct finished, Nov not yet.
{
  const s = summaryFor([stu('new', '2026-10-03')]);
  eq('(2) Oct admission totalDue is 1 month', s.entries[0]?.totalDue, 1500);
  eq('(2) Oct admission dueMonthCount is 1', s.entries[0]?.dueMonthCount, 1);
}
// (3) Current month paid, aged months owed.
{
  const s = summaryFor([stu('old', '2026-01-10')], [tx('2026old', '2026-11', 1500)]);
  eq('(3) Current paid: totalDue is aged only', s.entries[0]?.totalDue, 15000);
  eq('(3) Current paid: dueMonthCount counts aged months only', s.entries[0]?.dueMonthCount, 10);
}
// (4) Fully paid student is excluded from the top list.
{
  const allMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const s = summaryFor([stu('paid', '2026-01-10')], allMonths.map(m => tx('2026paid', m, 1500)));
  eq('(4) Fully paid totalDue is 0', s.entries[0]?.totalDue, 0);
  eq('(4) Fully paid excluded from topDueEntries', topDueEntries(s.entries).length, 0);
}
// (5) topDueEntries sorts by totalDue desc, top 5.
{
  const students = [stu('a', '2026-01-10'), stu('b', '2026-06-10'), stu('c', '2026-10-10'), stu('d', '2026-01-10'), stu('e', '2026-01-10'), stu('f', '2026-01-10')];
  const s = summaryFor(students);
  const top = topDueEntries(s.entries);
  eq('(5) Top 5 of 6 debtors', top.length, 5);
  check('(5) Sorted by totalDue desc',
    top.every((e, i) => i === 0 || e.totalDue <= top[i - 1].totalDue));
  eq('(5) Highest first is the Jan student', top[0]?.totalDue, 15000);
  eq('(5) Lowest in top 5 is the Jun student (7,500)', top[4]?.totalDue, 7500);
  check('(5) Oct student (1,500) is 6th, outside the top 5',
    !top.some(e => e.totalDue === 1500));
}

// (6) Source checks: both cards read the same shared entries.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dash = read('components/Dashboard.tsx');
const reports = read('components/MadrasaReports.tsx');
check('(6) Dashboard top-dues card uses topDueEntries(duesSummary.entries)',
  /topDueEntries\(duesSummary\.entries\)/.test(dash));
check('(6) Dashboard card shows the shared totalDue, not dueThisMonth',
  /topDueProfiles\.map\([\s\S]{0,2000}totalDue/.test(dash) &&
  !/topDueProfiles\.map\([\s\S]{0,2000}p\.dueThisMonth/.test(dash));
check('(6) Dashboard card labels the month count',
  /dueMonthCount/.test(dash));
check('(6) MadrasaReports topDues uses the same shared helper',
  /topDueEntries\(duesSummary\.entries\)/.test(reports));
check('(6) MadrasaReports topDues no longer calls calculateFeeAging directly',
  !/topDues = useMemo\(\s*\(\) => activeStudents\s*\.map\([\s\S]{0,300}calculateFeeAging/.test(reports));
check('(6) MadrasaReports rows show the month count too',
  /dueMonthCount/.test(reports));

console.log(failures === 0 ? '\nALL TOP-DEBTORS-SHARED CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
