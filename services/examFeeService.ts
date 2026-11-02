/**
 * Teacher exam-fee pending derivation (2 Nov 2026).
 *
 * Single source of truth: a FinanceTransaction carrying examId is proof
 * that the student's fee for that exam is paid. Pending is DERIVED —
 * scheduled exam with a fee, minus recorded exam-fee payments — never
 * fanned out into a record per student, so there is no second ledger
 * that can drift from the transactions.
 *
 * Exam fee is SEPARATE from monthly dues: it never enters
 * monthlyExpectedFor / tuition dues math.
 */

import type { FinanceTransaction } from '../types';

export function examFeePaidKey(examId: string, studentId: string): string {
  return `${examId}:${studentId}`;
}

/** Keys of all paid (examId, studentId) pairs in the transaction list. */
export function paidExamFeeKeys(transactions: FinanceTransaction[]): Set<string> {
  const keys = new Set<string>();
  for (const tx of transactions) {
    if (tx.examId && tx.studentId) keys.add(examFeePaidKey(tx.examId, tx.studentId));
  }
  return keys;
}

/** True when a transaction proves this student's fee for this exam is paid. */
export function isExamFeePaid(
  transactions: FinanceTransaction[],
  examId: string,
  studentId: string
): boolean {
  return transactions.some(tx => tx.examId === examId && tx.studentId === studentId);
}
