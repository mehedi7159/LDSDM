// Payment method codes are stored structured on every transaction
// (CASH / BKASH / NAGAD / ROCKET / BANK_TRANSFER / CHEQUE). This helper is
// the single place that turns a stored code into the label a human reads —
// so history tables, ledgers, reports and receipts never show the raw code
// ('BKASH') again. Unknown codes fall back to the raw code, never blank,
// so no transaction's method is ever hidden by a missing mapping.

export const PAYMENT_METHOD_ORDER = ['CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER', 'CHEQUE'] as const;

export function paymentMethodLabel(code: string | undefined | null, isBn: boolean): string {
  switch ((code || '').toUpperCase()) {
    case 'CASH':
      return isBn ? 'নগদ ক্যাশ' : 'Cash';
    case 'BKASH':
      return isBn ? 'বিকাশ' : 'bKash';
    case 'NAGAD':
      return isBn ? 'নগদ' : 'Nagad';
    case 'ROCKET':
      return isBn ? 'রকেট' : 'Rocket';
    case 'BANK_TRANSFER':
      return isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer';
    case 'CHEQUE':
      return isBn ? 'চেক' : 'Cheque';
    default:
      return code || '—';
  }
}
