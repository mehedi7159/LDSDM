/**
 * Teacher exam-fee pending derivation (2 Nov 2026).
 *
 * Single source of truth: a FinanceTransaction carrying examId is proof
 * that the student's fee for that exam is paid — but only when it is a
 * real payment: type==='INCOME' with amount>0. An EXPENSE row, a ৳0 row,
 * or a partial payment below the exam's fee proves nothing. Pending is
 * DERIVED — scheduled exam with a fee, minus recorded exam-fee payments
 * — never fanned out into a record per student, so there is no second
 * ledger that can drift from the transactions.
 *
 * Exam fee is SEPARATE from monthly dues: it never enters
 * monthlyExpectedFor / tuition dues math.
 */

import type { FinanceTransaction } from '../types';

export function examFeePaidKey(examId: string, studentId: string): string {
  return `${examId}:${studentId}`;
}

/** A transaction that can prove an exam-fee payment: real income only. */
function isQualifyingExamFeePayment(tx: FinanceTransaction): boolean {
  return tx.type === 'INCOME' && (Number(tx.amount) || 0) > 0;
}

/** Total qualifying exam-fee money for (examId, studentId). */
export function examFeePaidAmount(
  transactions: FinanceTransaction[],
  examId: string,
  studentId: string
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.examId === examId && tx.studentId === studentId && isQualifyingExamFeePayment(tx)) {
      total += Number(tx.amount) || 0;
    }
  }
  return total;
}

/**
 * Keys of all paid (examId, studentId) pairs in the transaction list.
 * When the exams are passed, a key counts only when the summed
 * qualifying payments reach that exam's fee — a partial payment is not
 * paid. Without the exams list (fee unknown), any qualifying payment
 * counts, as before.
 */
export function paidExamFeeKeys(
  transactions: FinanceTransaction[],
  exams?: Array<{ id: string; examFee?: number }>
): Set<string> {
  const keys = new Set<string>();
  const feeById = new Map<string, number>();
  for (const e of exams || []) feeById.set(e.id, Number(e.examFee) || 0);
  for (const tx of transactions) {
    if (!tx.examId || !tx.studentId || !isQualifyingExamFeePayment(tx)) continue;
    const key = examFeePaidKey(tx.examId, tx.studentId);
    if (keys.has(key)) continue;
    const fee = feeById.get(tx.examId);
    if (fee === undefined || fee <= 0) {
      keys.add(key);
    } else if (examFeePaidAmount(transactions, tx.examId, tx.studentId) >= fee) {
      keys.add(key);
    }
  }
  return keys;
}

/**
 * True when qualifying payments prove this student's fee for this exam
 * is paid. When expectedFee is given (> 0), the summed payments must
 * reach it; otherwise any qualifying payment counts.
 */
export function isExamFeePaid(
  transactions: FinanceTransaction[],
  examId: string,
  studentId: string,
  expectedFee?: number
): boolean {
  const paid = examFeePaidAmount(transactions, examId, studentId);
  return paid > 0 && (expectedFee === undefined || expectedFee <= 0 || paid >= expectedFee);
}
