/**
 * verify-master-exam-fee-paid.ts — exam-fee "paid" proof must be
 * amount- and type-aware (master audit, Fix #3).
 *
 * Old bug: any transaction carrying examId+studentId marked the fee paid
 * — even an EXPENSE row, a ৳0 row, or a partial payment smaller than
 * the exam's fee. New rule: only type==='INCOME' with amount>0 counts,
 * and where the exam is known the summed amount for (examId, studentId)
 * must reach the exam's fee.
 *
 * Run: npx tsx scripts/verify-master-exam-fee-paid.ts
 */
import { paidExamFeeKeys, isExamFeePaid, examFeePaidKey, examFeePaidAmount } from '../services/examFeeService';
import type { FinanceTransaction } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const tx = (over: Partial<FinanceTransaction>): FinanceTransaction =>
  ({ id: 'tx', type: 'INCOME', category: 'EXAM_FEE', amount: 500, date: '2026-11-01', studentId: 's1', examId: 'e1', ...over } as FinanceTransaction);

const EXAMS = [{ id: 'e1', examFee: 500 }];
const key = examFeePaidKey('e1', 's1');

// (1) An EXPENSE row carrying examId is not a payment.
check(
  'expense row does not mark paid',
  !paidExamFeeKeys([tx({ type: 'EXPENSE' })], EXAMS).has(key)
);

// (2) A ৳0 income row is not a payment.
check(
  'zero-amount row does not mark paid',
  !paidExamFeeKeys([tx({ amount: 0 })], EXAMS).has(key)
);

// (3) A negative-amount row is not a payment.
check(
  'negative-amount row does not mark paid',
  !paidExamFeeKeys([tx({ amount: -100 })], EXAMS).has(key)
);

// (4) A partial payment below the exam fee is not paid.
check(
  'partial payment below fee does not mark paid',
  !paidExamFeeKeys([tx({ amount: 200 })], EXAMS).has(key)
);

// (5) The full fee marks paid.
check(
  'full fee marks paid',
  paidExamFeeKeys([tx({ amount: 500 })], EXAMS).has(key)
);

// (6) Two partials that add up to the fee mark paid.
check(
  'summed partials reaching fee mark paid',
  paidExamFeeKeys([tx({ id: 'a', amount: 200 }), tx({ id: 'b', amount: 300 })], EXAMS).has(key)
);

// (7) Overpayment still marks paid.
check(
  'overpayment marks paid',
  paidExamFeeKeys([tx({ amount: 600 })], EXAMS).has(key)
);

// (8) Without the exam list (fee unknown), any positive income counts.
check(
  'fee unknown: any positive income marks paid',
  paidExamFeeKeys([tx({ amount: 200 })]).has(key)
);

// (9) isExamFeePaid honours the expected fee.
eq('isExamFeePaid: partial below fee', isExamFeePaid([tx({ amount: 200 })], 'e1', 's1', 500), false);
eq('isExamFeePaid: full fee', isExamFeePaid([tx({ amount: 500 })], 'e1', 's1', 500), true);
eq('isExamFeePaid: no expected fee, any positive', isExamFeePaid([tx({ amount: 200 })], 'e1', 's1'), true);
eq('isExamFeePaid: expense never counts', isExamFeePaid([tx({ type: 'EXPENSE' })], 'e1', 's1'), false);

// (10) Another student's payment does not mark this student paid.
check(
  'other student does not mark paid',
  !paidExamFeeKeys([tx({ studentId: 's2' })], EXAMS).has(key)
);

// (11) A row without examId does not mark paid.
check(
  'row without examId does not mark paid',
  !paidExamFeeKeys([tx({ examId: undefined })], EXAMS).has(key)
);

// (12) The summed amount helper only counts qualifying income.
eq('examFeePaidAmount sums qualifying income only', examFeePaidAmount([tx({ amount: 200 }), tx({ id: 'b', amount: 300 }), tx({ id: 'c', type: 'EXPENSE', amount: 999 })], 'e1', 's1'), 500);

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll exam-fee-paid checks passed.');
