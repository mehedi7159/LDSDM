import type { FinanceTransaction, Student } from '../types';

/**
 * Month-wise dues history for the Dues Directory (Pragya-inspired month grid,
 * LDSDM-adapted). Pure functions, no React.
 *
 * Rules (same honesty rules as the Dashboard alert strip):
 * - Only FINISHED months count: a month's fee becomes due after it ends.
 * - A transaction counts toward its feeMonth when present (Bangla month names
 *   like 'জানুয়ারি ২০২৬' are normalized), otherwise toward its payment month.
 * - Months before the student's admission month are 'na', never 'unpaid'.
 * - Student matching is by internal id only, matching the directory's own
 *   current-month logic.
 */

export type DueMonthStatus = 'paid' | 'partial' | 'unpaid' | 'na';

export interface DueMonthCell {
  month: string; // YYYY-MM
  paid: number;
  expected: number;
  status: DueMonthStatus;
}

export interface DueHistory {
  months: DueMonthCell[]; // oldest -> newest, always `count` entries
  dueMonths: number;
  dueAmount: number;
  from: string; // YYYY-MM of the first month in the window
  to: string; // YYYY-MM of the last month in the window
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, ch => String(BN_DIGITS.indexOf(ch)));

const BN_MONTH_PREFIX: Array<[string, string]> = [
  ['জানু', '01'], ['ফেব', '02'], ['মার্চ', '03'], ['এপ্রি', '04'],
  ['মে', '05'], ['জুন', '06'], ['জুলা', '07'], ['আগ', '08'],
  ['সেপ্টে', '09'], ['অক্টো', '10'], ['নভে', '11'], ['ডিসে', '12'],
];

export const BN_MONTH_SHORT = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
export const BN_MONTH_FULL = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

export function monthShort(month: string): string {
  return BN_MONTH_SHORT[Number(month.split('-')[1]) - 1] || month;
}

export function monthFull(month: string): string {
  return BN_MONTH_FULL[Number(month.split('-')[1]) - 1] || month;
}

export function normalizeFeeMonth(tx: { feeMonth?: string; date?: string }): string {
  const fm = String(tx.feeMonth || '').trim();
  if (/^\d{4}-\d{2}$/.test(fm)) return fm;
  const ascii = toAsciiDigits(fm);
  const ym = ascii.match(/(\d{4})/);
  const pref = BN_MONTH_PREFIX.find(([p]) => fm.startsWith(p));
  if (ym && pref) return `${ym[1]}-${pref[1]}`;
  return (tx.date || '').slice(0, 7);
}

/** Finished months ending before asOfMonth, oldest first. */
export function getFinishedMonths(asOfMonth: string, count = 12): string[] {
  const [cy, cm] = asOfMonth.split('-').map(Number);
  const out: string[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(cy, cm - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function computeDueHistory(
  student: Student,
  transactions: FinanceTransaction[],
  monthlyExpected: number,
  asOfMonth: string,
  count = 12,
): DueHistory {
  const months = getFinishedMonths(asOfMonth, count);
  const admMonth = (student.admissionDate || '').slice(0, 7);
  const paidByMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'INCOME' || tx.studentId !== student.id) continue;
    const m = normalizeFeeMonth(tx);
    paidByMonth.set(m, (paidByMonth.get(m) || 0) + (Number(tx.amount) || 0));
  }
  let dueMonths = 0;
  let dueAmount = 0;
  const cells: DueMonthCell[] = months.map(m => {
    if (!monthlyExpected || (admMonth && m < admMonth)) {
      return { month: m, paid: 0, expected: 0, status: 'na' as const };
    }
    const paid = paidByMonth.get(m) || 0;
    const status: DueMonthStatus = paid >= monthlyExpected ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    if (status !== 'paid') {
      dueMonths += 1;
      dueAmount += monthlyExpected - paid;
    }
    return { month: m, paid, expected: monthlyExpected, status };
  });
  const first = months[0] || '';
  const last = months[months.length - 1] || '';
  return { months: cells, dueMonths, dueAmount, from: first, to: last };
}
