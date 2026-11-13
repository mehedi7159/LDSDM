/**
 * verify-master-voucher-reuse.ts — voucher numbers must never be re-used
 * after a transaction is deleted (master audit, Fix #2).
 *
 * Old bug: generateVoucherNo used transactions.length + 1, so deleting a
 * transaction shrank the list and the next voucher re-used the deleted
 * number. New rule: next serial = max(existing serial for that
 * prefix+year) + 1, scanning live AND trashed transactions; addTransaction
 * regenerates on collision.
 *
 * Run: npx tsx scripts/verify-master-voucher-reuse.ts
 */
import { generateVoucherNo, ensureUniqueVoucherNo } from '../services/utils';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const Y = new Date().getFullYear();
const tx = (voucherNo: string) => ({ voucherNo });

// (1) Deleted middle number is NOT re-used: 0001 + 0003 live -> next 0004.
eq(
  'deleted middle number not re-used',
  generateVoucherNo('INCOME', [tx(`MR-${Y}-0001`), tx(`MR-${Y}-0003`)]),
  `MR-${Y}-0004`
);

// (2) Another year's high serial is ignored for this year.
eq(
  'other-year serial ignored',
  generateVoucherNo('INCOME', [tx(`MR-${Y - 1}-0009`), tx(`MR-${Y}-0001`)]),
  `MR-${Y}-0002`
);

// (3) The other prefix (DV) does not count toward MR serials.
eq(
  'other prefix ignored',
  generateVoucherNo('INCOME', [tx(`DV-${Y}-0007`), tx(`MR-${Y}-0002`)]),
  `MR-${Y}-0003`
);

// (4) EXPENSE side has its own series.
eq(
  'expense series independent',
  generateVoucherNo('EXPENSE', [tx(`MR-${Y}-0005`), tx(`DV-${Y}-0002`)]),
  `DV-${Y}-0003`
);

// (5) Number input keeps the old count+1 behaviour.
eq('number input unchanged', generateVoucherNo('INCOME', 5), `MR-${Y}-0006`);

// (6) A voucher colliding with a TRASHED transaction is regenerated past
// both the live max and the trashed number (live 0001+0003, trash 0002).
eq(
  'collision with trashed voucher regenerates',
  ensureUniqueVoucherNo(
    `MR-${Y}-0002`,
    'INCOME',
    [tx(`MR-${Y}-0001`), tx(`MR-${Y}-0003`)],
    [tx(`MR-${Y}-0002`)]
  ),
  `MR-${Y}-0004`
);

// (7) No collision -> the voucher is left untouched.
eq(
  'no collision left untouched',
  ensureUniqueVoucherNo(`MR-${Y}-0009`, 'INCOME', [tx(`MR-${Y}-0001`)], []),
  `MR-${Y}-0009`
);

// (8) Collision with a LIVE transaction regenerates too.
eq(
  'collision with live voucher regenerates',
  ensureUniqueVoucherNo(`MR-${Y}-0001`, 'INCOME', [tx(`MR-${Y}-0001`)], []),
  `MR-${Y}-0002`
);

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll voucher-reuse checks passed.');
