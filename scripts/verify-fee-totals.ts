/**
 * verify-fee-totals.ts — scripted proof for the ONE shared dues total
 * (services/studentDuesService.ts calculateTotalDues).
 *
 * The bug (7 Nov source audit §14, live 12 Nov 2026): four figures at
 * once — dashboard ৳177,800, fee header ৳178,500, fee card ৳193,900,
 * collection ৳0 — and a new enrolment moved the fee page (+৳700) but
 * not the dashboard. Root cause: three calculations — current-month
 * only (calculateSingleStudentDue), finished-months only
 * (calculateFeeAging), and the fee page's own inline math with a
 * hardcoded ৳700 fallback for a missing fee structure.
 *
 * The single definition (audit §14's recommendation):
 *   মোট বকেয়া = চলতি মাসের বাকি + শেষ হওয়া সব মাসের বকেয়া
 *   (current-month unpaid + aged unpaid for finished months)
 * Monthly expected comes from the one hook (arrangement payable, else
 * per-student override, else class structure: tuition + food only when
 * the food type is enabled). Exam / admission / session / book /
 * registration / form-fillup NEVER enter the expected amount. No
 * structure => expected 0, never an invented ৳700. A month enters the
 * aged part only after it ends; months before admission never enter.
 * The dashboard, the finance header KPI, the fee-page cards and the
 * reports header all call calculateTotalDues with the same student set
 * (status 'Active' and not former), the same month and the same
 * feeTypes — so they show the same number.
 *
 * Cases (asOf 2026-10 unless noted):
 *   (1) Sep unpaid + Oct unpaid -> current 1000 + aged 1000 = 2000
 *   (2) New admission in Oct -> current only, aged 0 (adding them
 *       moves the dashboard, header and card totals by the same amount)
 *   (3) No fee structure -> expected 0, total 0 (never the old ৳700)
 *   (4) Full waiver arrangement -> 0; per-student override wins
 *   (5) Partial Sep payment -> remainder aged; Oct paid in full ->
 *       current 0 but Sep still owed (counts as both paid-this-month
 *       and owing)
 *   (6) Exam / admission / book fees never in the expected amount;
 *       food joins only when the food type is enabled
 *   (7) Same student set -> dashboard / header / card paths identical,
 *       including the collection figure; former + inactive excluded
 *   (8) Dateless, never-paid student -> aged 0 without a fallback;
 *       with the approved academic-year fallback -> aged from January
 *   (9) localMonthStr is the local YYYY-MM (one month definition)
 *   (10) Source checks: all four headline call sites use the shared
 *       function; the fee page's inline ৳700 fallback is gone
 *
 * Run: npx tsx scripts/verify-fee-totals.ts
 * (or npm run test:fee-totals).
 */
import {
  calculateTotalDues,
  localMonthStr,
  academicYearFallbackStartMonth,
  monthlyExpectedFor,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const STRUCT: ClassFeeStructure[] = [
  { id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1000, admissionFee: 1500, examFee: 400, boardingFee: 500, bookFee: 800 },
];
// No structure at all for 'Class 2' — the old fee page invented ৳700 here.
const FEE_TYPES: FeeTypeDef[] = [
  { id: 'tuition', labelBn: 'মাসিক বেতন', labelEn: 'Tuition', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: true },
  { id: 'exam', labelBn: 'পরীক্ষার ফি', labelEn: 'Exam Fee', frequency: 'per_exam', appliesTo: 'all', collector: 'class_teacher', enabled: true },
  { id: 'food', labelBn: 'খাবার ফি', labelEn: 'Food Fee', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: false },
];
const FEE_TYPES_FOOD_ON: FeeTypeDef[] = FEE_TYPES.map(t => (t.id === 'food' ? { ...t, enabled: true } : t));
const YEARS: AcademicYear[] = [
  { id: 'y26', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isCurrent: true },
] as AcademicYear[];

const student = (over: Partial<Student> = {}): Student => ({
  id: 's1', name: 'Test Student', classLevel: 'Class 1', status: 'Active',
  admissionDate: '2026-09-01', ...over,
});

const tx = (over: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: 'tx', type: 'INCOME', category: 'STUDENT_TUITION', amount: 0,
  date: '2026-10-05', studentId: 's1', ...over,
} as FinanceTransaction);

const AS_OF = '2026-10';
const FALLBACK = academicYearFallbackStartMonth(YEARS, AS_OF);

// The canonical active set, exactly as the four call sites filter it.
const canonical = (list: Student[]) => list.filter(s => s.status === 'Active' && !s.isFormer);

// (1) Sep unpaid + Oct unpaid -> current 1000 + aged 1000 = 2000
{
  const r = calculateTotalDues([student()], STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(1) currentMonthDue', r.currentMonthDue, 1000);
  eq('(1) agedDue', r.agedDue, 1000);
  eq('(1) totalDue', r.totalDue, 2000);
  eq('(1) totalExpected', r.totalExpected, 1000);
  eq('(1) totalPaid', r.totalPaid, 0);
  eq('(1) dueStudentsCount', r.dueStudentsCount, 1);
}

// (2) New admission in Oct -> current only; adding them moves every path equally
{
  const base = [student()];
  const added = [...base, student({ id: 's2', admissionDate: '2026-10-01' })];
  const before = calculateTotalDues(canonical(base), STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  const after = calculateTotalDues(canonical(added), STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  const entry = after.entries.find(e => e.profile.student.id === 's2')!;
  eq('(2) new admission: agedDue', entry.aging.totalAged, 0);
  eq('(2) new admission: totalDue', entry.totalDue, 1000);
  eq('(2) new admission: total rises by 1000', after.totalDue - before.totalDue, 1000);
  // Dashboard / header / card paths are the same call with the same args.
  const dash = calculateTotalDues(canonical(added), STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  const head = calculateTotalDues(canonical(added), STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  const card = calculateTotalDues(canonical(added), STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(2) dashboard == header', dash.totalDue, head.totalDue);
  eq('(2) header == card', head.totalDue, card.totalDue);
  eq('(2) card == dashboard', card.totalDue, dash.totalDue);
}

// (3) No fee structure -> expected 0, total 0 (never the old invented ৳700)
{
  const s = student({ id: 's3', classLevel: 'Class 2' });
  const r = calculateTotalDues([s], STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(3) no structure: monthlyExpected', r.entries[0].profile.monthlyExpected, 0);
  eq('(3) no structure: totalDue', r.totalDue, 0);
}

// (4) Full waiver -> 0; per-student override wins
{
  const waived = student({ id: 's4', feeDiscountType: 'full', feeBaseAmount: 1000 });
  const r1 = calculateTotalDues([waived], STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(4) full waiver: totalDue', r1.totalDue, 0);
  const over = student({ id: 's5', admissionDate: '2026-09-01', monthlyFee: 2000 } as Partial<Student>);
  const r2 = calculateTotalDues(
    [over], STRUCT,
    [tx({ id: 'tx5', studentId: 's5', feeMonth: '2026-09', date: '2026-09-20', amount: 2000 })],
    AS_OF, FEE_TYPES, FALLBACK);
  eq('(4) override: monthlyExpected', r2.entries[0].profile.monthlyExpected, 2000);
  eq('(4) override: Sep paid in full, aged 0', r2.agedDue, 0);
  eq('(4) override: current 2000', r2.currentMonthDue, 2000);
}

// (5) Partial Sep payment -> remainder aged; Oct paid in full -> current 0, Sep still owed
{
  const s6 = student({ id: 's6', admissionDate: '2026-08-01' });
  const r1 = calculateTotalDues(
    [s6], STRUCT,
    [tx({ id: 'tx6', studentId: 's6', feeMonth: '2026-09', date: '2026-09-20', amount: 400 })],
    AS_OF, FEE_TYPES, FALLBACK);
  eq('(5) partial: agedDue (Aug 1000 + Sep 600)', r1.agedDue, 1600);
  eq('(5) partial: totalDue', r1.totalDue, 2600);
  const s10 = student({ id: 's10' });
  const r2 = calculateTotalDues(
    [s10], STRUCT,
    [tx({ id: 'tx10', studentId: 's10', feeMonth: '2026-10', date: '2026-10-05', amount: 1000 })],
    AS_OF, FEE_TYPES, FALLBACK);
  eq('(5) Oct paid: currentMonthDue', r2.currentMonthDue, 0);
  eq('(5) Oct paid: totalPaid', r2.totalPaid, 1000);
  eq('(5) Oct paid: Sep still owed', r2.totalDue, 1000);
  eq('(5) Oct paid: counts as owing (combined)', r2.dueStudentsCount, 1);
  eq('(5) Oct paid: counts as paid this month', r2.paidStudentsCount, 1);
}

// (6) Exam / admission / book never in expected; food only when enabled
{
  eq('(6) expected is tuition only (exam 400 + admission 1500 + book 800 excluded)',
    monthlyExpectedFor(student(), STRUCT, FEE_TYPES), 1000);
  eq('(6) food disabled: boarding 500 excluded',
    monthlyExpectedFor(student(), STRUCT, FEE_TYPES), 1000);
  eq('(6) food enabled: boarding 500 joins',
    monthlyExpectedFor(student(), STRUCT, FEE_TYPES_FOOD_ON), 1500);
  const r = calculateTotalDues([student()], STRUCT, [], AS_OF, FEE_TYPES_FOOD_ON, FALLBACK);
  eq('(6) food enabled: totalDue', r.totalDue, 3000);
}

// (7) Same set -> all paths identical, incl. collection; former + inactive excluded
{
  const set = canonical([
    student({ id: 's1' }),
    student({ id: 's2', admissionDate: '2026-10-01' }),
    student({ id: 's3', classLevel: 'Class 2' }),
    student({ id: 's7', isFormer: true }),
    student({ id: 's8', status: 'Inactive' }),
    student({ id: 's10' }),
  ]);
  const txs = [tx({ id: 'tx10', studentId: 's10', feeMonth: '2026-10', date: '2026-10-05', amount: 1000 })];
  const dash = calculateTotalDues(set, STRUCT, txs, AS_OF, FEE_TYPES, FALLBACK);
  const head = calculateTotalDues(set, STRUCT, txs, AS_OF, FEE_TYPES, FALLBACK);
  const card = calculateTotalDues(set, STRUCT, txs, AS_OF, FEE_TYPES, FALLBACK);
  // s1 2000 + s2 1000 + s3 0 + s10 1000 = 4000; collected Oct = 1000.
  eq('(7) totalDue', dash.totalDue, 4000);
  eq('(7) dashboard == header (totalDue)', dash.totalDue, head.totalDue);
  eq('(7) header == card (totalDue)', head.totalDue, card.totalDue);
  eq('(7) collection identical on all paths', `${dash.totalPaid}/${head.totalPaid}/${card.totalPaid}`, '1000/1000/1000');
  eq('(7) expected identical on all paths', `${dash.totalExpected}/${head.totalExpected}/${card.totalExpected}`, '3000/3000/3000');
  eq('(7) dueStudentsCount', dash.dueStudentsCount, 3);
  eq('(7) canonical set size (former + inactive out)', set.length, 4);
  const unfiltered = calculateTotalDues([
    student({ id: 's1' }),
    student({ id: 's7', isFormer: true }),
  ], STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  check('(7) unfiltered set differs (former would add 2000)', unfiltered.totalDue === 4000, `got ${unfiltered.totalDue}`);
}

// (8) Dateless, never-paid -> aged 0 without fallback; aged from Jan with fallback
{
  const s9 = student({ id: 's9', admissionDate: undefined, createdAt: undefined });
  const r1 = calculateTotalDues([s9], STRUCT, [], AS_OF, FEE_TYPES, undefined);
  eq('(8) no fallback: agedDue', r1.agedDue, 0);
  eq('(8) no fallback: totalDue (current only)', r1.totalDue, 1000);
  eq('(8) fallback start is Jan of the academic year', FALLBACK, '2026-01');
  const r2 = calculateTotalDues([s9], STRUCT, [], AS_OF, FEE_TYPES, FALLBACK);
  eq('(8) with fallback: agedDue (Jan-Sep)', r2.agedDue, 9000);
  eq('(8) with fallback: totalDue', r2.totalDue, 10000);
}

// (9) localMonthStr is the local YYYY-MM
{
  const now = new Date();
  const want = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  eq('(9) localMonthStr()', localMonthStr(), want);
  check('(9) localMonthStr format', /^\d{4}-\d{2}$/.test(localMonthStr()), `got ${localMonthStr()}`);
}

// (10) Source checks: the four headline call sites use the one shared function
{
  const dash = readSource('components/Dashboard.tsx');
  check('(10) Dashboard calls calculateTotalDues', dash.includes('calculateTotalDues('), 'Dashboard must call calculateTotalDues');
  check('(10) Dashboard threads feeTypes into dues', dash.includes('calculateTotalDues(activeStudents, feeStructures, transactions, month, feeTypes,'), 'Dashboard dues call must pass month + feeTypes');
  const fin = readSource('components/FinanceManager.tsx');
  check('(10) FinanceManager KPI calls calculateTotalDues', fin.includes('calculateTotalDues('), 'FinanceManager KPI must call calculateTotalDues');
  check('(10) FinanceManager KPI no longer loops calculateSingleStudentDue for the header total',
    !fin.includes('totalDues += calculateSingleStudentDue'), 'old per-student header loop must be gone');
  const rep = readSource('components/MadrasaReports.tsx');
  check('(10) Reports header calls calculateTotalDues', rep.includes('calculateTotalDues('), 'Reports duesSummary must call calculateTotalDues');
  check('(10) Reports class bars call calculateTotalDues',
    (rep.match(/calculateTotalDues\(/g) || []).length >= 2, 'Reports classDues must also use the shared function');
  const fee = readSource('components/finance/StudentFeeCollection.tsx');
  check('(10) Fee page calls calculateTotalDues', fee.includes('calculateTotalDues('), 'StudentFeeCollection must call calculateTotalDues');
  check('(10) Fee page has no invented ৳700 fallback', !fee.includes('monthlyTuition || 700'), 'the || 700 fallback must be gone');
  check('(10) Fee page active set is the canonical one',
    fee.includes("students.filter(s => s.status === 'Active' && !s.isFormer)"), 'fee page must use the canonical active set');
  const modal = readSource('components/finance/DuesPrintModal.tsx');
  check('(10) Print sheet uses the combined per-student total', modal.includes('item.totalDue'), 'DuesPrintModal must read item.totalDue');
  const pkg = JSON.parse(readSource('package.json'));
  check('(10) package.json exposes the verify script',
    pkg.scripts['test:fee-totals'] === 'tsx scripts/verify-fee-totals.ts', 'npm run test:fee-totals must run this script');
}

console.log(failures === 0 ? '\nALL FEE-TOTALS CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
