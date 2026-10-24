/**
 * verify-fee-aging.ts — scripted proof for the additive fee-aging function
 * (services/studentDuesService.ts calculateFeeAging, Phase 2 mobile Due
 * report sections only — existing dues functions are untouched).
 *
 * The owner's rule: a month's fee becomes due only AFTER that month ends
 * — September's unpaid fee shows as due from Oct 1, bucketed by age.
 *
 * Cases (all viewed from asOfMonth 2026-10 unless noted):
 *   (1) September unpaid -> 1-month-old bucket
 *   (2) August unpaid (September paid) -> 2+ months bucket
 *   (3) September partially paid -> remainder in 1-month-old
 *   (4) Current (unfinished) month unpaid -> NEVER in aging
 *   (5) Fully paid finished month -> no aging
 *   (6) Unallocated payment reduces the OLDEST bucket first
 *   (7) No admission/created date -> start = earliest paid feeMonth
 *   (8) Boarding fee joins tuition in the expected amount
 *   (9) Per-student monthlyFee override wins over the class structure
 *   (10) Admission in the current month -> only a current-month due
 *
 * Run: npx tsx scripts/verify-fee-aging.ts
 */
import { calculateFeeAging } from '../services/studentDuesService';
import type { Student } from '../types/student';
import type { ClassFeeStructure, FinanceTransaction } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const STRUCT: ClassFeeStructure[] = [
  { id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1000, admissionFee: 0, examFee: 0, boardingFee: 0, bookFee: 0 }
];
const STRUCT_BOARDING: ClassFeeStructure[] = [
  { id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1000, admissionFee: 0, examFee: 0, boardingFee: 500, bookFee: 0 }
];

const student = (over: Partial<Student> = {}): Student => ({
  id: 's1', name: 'Test Student', classLevel: 'Class 1', status: 'Active',
  admissionDate: '2026-09-01', ...over
});

const tx = (over: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: 'tx', type: 'INCOME', category: 'STUDENT_TUITION', amount: 0,
  date: '2026-10-05', studentId: 's1', ...over
} as FinanceTransaction);

const AS_OF = '2026-10';

// (1) September unpaid -> 1-month-old
{
  const a = calculateFeeAging(student(), STRUCT, [], AS_OF);
  eq('(1) Sep unpaid: oneMonthOld', a.oneMonthOld, 1000);
  eq('(1) Sep unpaid: twoPlusMonthsOld', a.twoPlusMonthsOld, 0);
  eq('(1) Sep unpaid: totalAged', a.totalAged, 1000);
  eq('(1) Sep unpaid: byMonth', JSON.stringify(a.byMonth), JSON.stringify([{ month: '2026-09', due: 1000 }]));
}

// (2) August unpaid, September paid -> 2+ months bucket only
{
  const a = calculateFeeAging(
    student({ admissionDate: '2026-08-01' }), STRUCT,
    [tx({ feeMonth: '2026-09', date: '2026-10-02', amount: 1000 })], AS_OF);
  eq('(2) Aug unpaid: twoPlusMonthsOld', a.twoPlusMonthsOld, 1000);
  eq('(2) Aug unpaid: oneMonthOld', a.oneMonthOld, 0);
}

// (3) September partially paid -> remainder in 1-month-old
{
  const a = calculateFeeAging(
    student(), STRUCT,
    [tx({ feeMonth: '2026-09', date: '2026-09-20', amount: 400 })], AS_OF);
  eq('(3) Sep partial: oneMonthOld', a.oneMonthOld, 600);
  eq('(3) Sep partial: totalAged', a.totalAged, 600);
}

// (4) Current month unpaid never in aging (September paid, October unpaid)
{
  const a = calculateFeeAging(
    student(), STRUCT,
    [tx({ feeMonth: '2026-09', date: '2026-09-20', amount: 1000 })], AS_OF);
  eq('(4) Current month: totalAged', a.totalAged, 0);
  eq('(4) Current month: currentMonthDue', a.currentMonthDue, 1000);
  eq('(4) Current month: byMonth empty', a.byMonth.length, 0);
}

// (5) Fully paid finished month -> no aging
{
  const a = calculateFeeAging(
    student(), STRUCT,
    [tx({ feeMonth: '2026-09', date: '2026-10-01', amount: 1000 })], AS_OF);
  eq('(5) Fully paid: totalAged', a.totalAged, 0);
  eq('(5) Fully paid: byMonth empty', a.byMonth.length, 0);
}

// (6) Unallocated payment reduces the OLDEST bucket first
{
  const a = calculateFeeAging(
    student({ admissionDate: '2026-08-01' }), STRUCT,
    [tx({ date: '', feeMonth: '', amount: 1500 })], AS_OF);
  eq('(6) Oldest-first: twoPlusMonthsOld', a.twoPlusMonthsOld, 0);
  eq('(6) Oldest-first: oneMonthOld', a.oneMonthOld, 500);
  eq('(6) Oldest-first: totalAged', a.totalAged, 500);
}

// (7) No admission/created date -> start = earliest paid feeMonth
{
  const s = student({ admissionDate: undefined, createdAt: undefined });
  const a = calculateFeeAging(
    s, STRUCT,
    [tx({ feeMonth: '2026-08', date: '2026-08-15', amount: 1000 })], AS_OF);
  eq('(7) Fallback startMonth', a.startMonth, '2026-08');
  eq('(7) Fallback: Sep unpaid in 1-month-old', a.oneMonthOld, 1000);
  eq('(7) Fallback: Aug paid, no 2+ bucket', a.twoPlusMonthsOld, 0);
}

// (8) Boarding fee joins tuition
{
  const a = calculateFeeAging(student(), STRUCT_BOARDING, [], AS_OF);
  eq('(8) Boarding: oneMonthOld', a.oneMonthOld, 1500);
}

// (9) Per-student monthlyFee override wins
{
  const a = calculateFeeAging(
    student({ monthlyFee: 2000 } as Partial<Student>), STRUCT, [], AS_OF);
  eq('(9) Override: oneMonthOld', a.oneMonthOld, 2000);
}

// (10) Admitted in the current month -> only a current-month due
{
  const a = calculateFeeAging(student({ admissionDate: '2026-10-01' }), STRUCT, [], AS_OF);
  eq('(10) New admission: totalAged', a.totalAged, 0);
  eq('(10) New admission: currentMonthDue', a.currentMonthDue, 1000);
}

// (11) Payment dated in October with NO feeMonth pays October, not aging
{
  const a = calculateFeeAging(
    student(), STRUCT,
    [tx({ feeMonth: '2026-09', date: '2026-09-20', amount: 1000 }),
     tx({ date: '2026-10-05', amount: 1000 })], AS_OF);
  eq('(11) Oct payment: totalAged', a.totalAged, 0);
  eq('(11) Oct payment: currentMonthDue', a.currentMonthDue, 0);
}

console.log(failures === 0 ? '\nALL FEE-AGING CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
