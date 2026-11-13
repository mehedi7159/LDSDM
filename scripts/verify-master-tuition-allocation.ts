/**
 * verify-master-tuition-allocation.ts — exam-fee money must not clear
 * tuition dues (master audit, Fix #4).
 *
 * Old bug: calculateFeeAging, computeDueHistory, the Reports long-dues
 * alert and the profile fee summary counted EVERY income transaction
 * toward tuition. New rule: one shared helper (isTuitionPayment) — a
 * payment counts toward tuition only when it is real tuition money:
 * INCOME, not category EXAM_FEE / no examId, and when it carries a
 * feeBreakdown at least one line must be a monthly (tuition / boarding /
 * food) line. Legacy rows with no breakdown still count as tuition.
 *
 * Run: npx tsx scripts/verify-master-tuition-allocation.ts
 */
import { calculateFeeAging, isTuitionPayment } from '../services/studentDuesService';
import { computeDueHistory } from '../services/studentDuesHistory';
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
  { id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1000, admissionFee: 0, examFee: 0, boardingFee: 0, bookFee: 0 },
];
const student = (): Student => ({
  id: 's1', name: 'Test Student', classLevel: 'Class 1', status: 'Active',
  admissionDate: '2026-09-01',
} as Student);
const tx = (over: Partial<FinanceTransaction> = {}): FinanceTransaction =>
  ({ id: 'tx', type: 'INCOME', category: 'STUDENT_TUITION', amount: 1000,
    date: '2026-09-05', studentId: 's1', feeMonth: '2026-09', ...over } as FinanceTransaction);
const AS_OF = '2026-10'; // finished month: September only

// (1) Exam-fee money does NOT clear September tuition.
eq(
  'aging: exam fee does not clear tuition',
  calculateFeeAging(student(), STRUCT, [tx({ category: 'EXAM_FEE', examId: 'e1', feeBreakdown: [{ name: 'Exam Fee', nameBn: 'পরীক্ষার ফি', amount: 1000 }] })], AS_OF).totalAged,
  1000
);

// (2) Real tuition money still clears it.
eq(
  'aging: tuition clears tuition',
  calculateFeeAging(student(), STRUCT, [tx()], AS_OF).totalAged,
  0
);

// (3) A breakdown with no tuition line (admission only) does not clear it.
eq(
  'aging: admission-only breakdown does not clear tuition',
  calculateFeeAging(student(), STRUCT, [tx({ feeBreakdown: [{ name: 'Admission Fee', nameBn: 'ভর্তি ফি', amount: 1000 }] })], AS_OF).totalAged,
  1000
);

// (4) A legacy row with no breakdown still counts as tuition.
eq(
  'aging: legacy no-breakdown row counts as tuition',
  calculateFeeAging(student(), STRUCT, [tx({ feeBreakdown: undefined })], AS_OF).totalAged,
  0
);

// (5) A boarding/food line is monthly money, so it clears tuition dues.
eq(
  'aging: boarding line clears tuition dues',
  calculateFeeAging(student(), STRUCT, [tx({ feeBreakdown: [{ name: 'Boarding & Food Fee', nameBn: 'বোর্ডিং ও খাবার ফি', amount: 1000 }] })], AS_OF).totalAged,
  0
);

// (6) An examId on a miscategorised row still keeps it out of tuition.
eq(
  'aging: examId row excluded even with tuition category',
  calculateFeeAging(student(), STRUCT, [tx({ examId: 'e1', feeBreakdown: [{ name: 'Monthly Tuition', nameBn: 'মাসিক বেতন', amount: 1000 }] })], AS_OF).totalAged,
  1000
);

// (7) Dues history: exam money leaves September unpaid.
{
  const h = computeDueHistory(student(), [tx({ category: 'EXAM_FEE', examId: 'e1' })], 1000, AS_OF);
  eq('history: exam fee leaves month unpaid', h.months.find(m => m.month === '2026-09')?.status, 'unpaid');
  eq('history: exam fee leaves due amount', h.dueAmount, 1000);
  const h2 = computeDueHistory(student(), [tx()], 1000, AS_OF);
  eq('history: tuition marks month paid', h2.months.find(m => m.month === '2026-09')?.status, 'paid');
}

// (8) The shared helper itself.
check('helper: exam category excluded', !isTuitionPayment(tx({ category: 'EXAM_FEE' })));
check('helper: expense excluded', !isTuitionPayment(tx({ type: 'EXPENSE' })));
check('helper: examId excluded', !isTuitionPayment(tx({ examId: 'e1' })));
check('helper: tuition line included', isTuitionPayment(tx()));
check('helper: no-breakdown legacy included', isTuitionPayment(tx({ feeBreakdown: undefined })));
check('helper: admission-only excluded', !isTuitionPayment(tx({ feeBreakdown: [{ name: 'Admission Fee', nameBn: 'ভর্তি ফি', amount: 1000 }] })));

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll tuition-allocation checks passed.');
