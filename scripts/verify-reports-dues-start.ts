/**
 * Reports "৩ মাস+ বকেয়া" must not count months before a student started —
 * self-check (21 Nov 2026, morning audit observation (b)).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-reports-dues-start.ts
 *
 * Bug: a brand-new TEST student landed in the Reports "৩ মাস+ বকেয়া"
 * list the day it was added, while the shared total due rose by only
 * one month (৳700). Root cause: the alerts loop in
 * components/MadrasaReports.tsx guarded finished months with
 * admissionDate ONLY —
 *     const admMonth = (st.admissionDate || '').slice(0, 7);
 *     if (admMonth && m < admMonth) continue;
 * so a student with no admissionDate counted ALL 12 finished months as
 * due (12 >= 3). The shared calculateFeeAging instead resolves the start
 * as admissionDate -> createdAt -> earliest paid month -> academic-year
 * January fallback (approved 2 Nov 2026); a new student (createdAt =
 * today) gets only the current month's due. The same admissionDate-only
 * guard also lived in services/studentDuesHistory.ts computeDueHistory
 * (fee-history grid).
 *
 * Fix contract:
 *  - services/studentDuesService.ts exports resolveAgingStartMonth(
 *    student, paidMonths, fallbackStartMonth?, asOfMonth?) — the one
 *    shared start-month rule; calculateFeeAging uses it (same behavior).
 *  - MadrasaReports alerts loop uses it (admissionDate / createdAt /
 *    earliest paid month / agingFallbackStart already in scope); the
 *    12-finished-month window is unchanged.
 *  - computeDueHistory takes an optional fallbackStartMonth and uses the
 *    same helper; StudentFeeCollection passes its academic-year fallback.
 *  - Fully dateless students still accrue from the January fallback, so
 *    the 171 old dateless students stay in the 3+ list — only genuinely
 *    new students (start = this month) drop out.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Student } from '../types/student';
import type { ClassFeeStructure, FinanceTransaction } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const svc: any = await import('../services/studentDuesService').catch(() => ({}));
const hist: any = await import('../services/studentDuesHistory').catch(() => ({}));
const { resolveAgingStartMonth, calculateFeeAging } = svc;
const { computeDueHistory } = hist;

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

const student = (over: Partial<Student> = {}): Student => ({
  id: 's1', name: 'Test Student', classLevel: 'Class 1', status: 'Active',
  admissionDate: '2026-09-01', ...over,
});
const STRUCT: ClassFeeStructure[] = [
  { id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1000, admissionFee: 0, examFee: 0, boardingFee: 0, bookFee: 0 },
];

console.log('--- resolveAgingStartMonth (services/studentDuesService.ts) ---');

check('helper exists', () => {
  assert.equal(typeof resolveAgingStartMonth, 'function', 'resolveAgingStartMonth is not exported');
});

check('(1) admissionDate wins', () => {
  assert.equal(resolveAgingStartMonth(student({ admissionDate: '2026-11-21' }), [], '2026-01', '2026-11'), '2026-11');
});

check('(2) NEW student: no admissionDate, createdAt today -> this month (the audit case)', () => {
  const s = student({ admissionDate: undefined, createdAt: '2026-11-21T07:00:00.000Z' });
  assert.equal(resolveAgingStartMonth(s, [], '2026-01', '2026-11'), '2026-11');
});

check('(3) admissionDate beats createdAt', () => {
  const s = student({ admissionDate: '2026-03-01', createdAt: '2026-11-21T07:00:00.000Z' });
  assert.equal(resolveAgingStartMonth(s, [], '2026-01', '2026-11'), '2026-03');
});

check('(4) no dates -> earliest paid month', () => {
  const s = student({ admissionDate: undefined, createdAt: undefined });
  assert.equal(resolveAgingStartMonth(s, ['2026-08', '2026-03'], '2026-01', '2026-11'), '2026-03');
});

check('(5) no dates at all -> January fallback', () => {
  const s = student({ admissionDate: undefined, createdAt: undefined });
  assert.equal(resolveAgingStartMonth(s, [], '2026-01', '2026-11'), '2026-01');
});

check('(6) fallback at/after asOf is ignored -> null', () => {
  const s = student({ admissionDate: undefined, createdAt: undefined });
  assert.equal(resolveAgingStartMonth(s, [], '2026-12', '2026-11'), null);
});

check('(7) invalid admissionDate falls through to createdAt', () => {
  const s = student({ admissionDate: 'not-a-date', createdAt: '2026-05-10T00:00:00.000Z' });
  assert.equal(resolveAgingStartMonth(s, [], '2026-01', '2026-11'), '2026-05');
});

console.log('--- calculateFeeAging still uses the same rule (regression) ---');

check('(8) new student: aging 0, only current-month due', () => {
  const s = student({ admissionDate: undefined, createdAt: '2026-11-21T07:00:00.000Z' });
  const a = calculateFeeAging(s, STRUCT, [], '2026-11', undefined, '2026-01');
  assert.equal(a.startMonth, '2026-11');
  assert.equal(a.totalAged, 0);
  assert.equal(a.currentMonthDue, 1000);
});

check('(9) dateless + fallback still accrues from January', () => {
  const s = student({ admissionDate: undefined, createdAt: undefined });
  const a = calculateFeeAging(s, STRUCT, [], '2026-11', undefined, '2026-01');
  assert.equal(a.startMonth, '2026-01');
  assert.equal(a.totalAged, 10000);
});

console.log('--- computeDueHistory (services/studentDuesHistory.ts, fee grid) ---');

check('(10) dateless + fallback: only Jan–Oct due (10), Nov 2025–Dec 2025 na', () => {
  const s = student({ admissionDate: undefined, createdAt: undefined });
  const h = computeDueHistory(s, [], 700, '2026-11', 12, '2026-01');
  assert.equal(h.dueMonths, 10);
  assert.equal(h.dueAmount, 7000);
  assert.equal(h.months.filter((c: any) => c.status === 'na').length, 2);
});

check('(11) NEW student: 0 due months, all 12 na', () => {
  const s = student({ admissionDate: undefined, createdAt: '2026-11-21T07:00:00.000Z' });
  const h = computeDueHistory(s, [], 700, '2026-11', 12, '2026-01');
  assert.equal(h.dueMonths, 0);
  assert.equal(h.months.filter((c: any) => c.status === 'na').length, 12);
});

check('(12) admitted Sep: 2 due months (Sep, Oct)', () => {
  const s = student({ admissionDate: '2026-09-01' });
  const h = computeDueHistory(s, [], 700, '2026-11', 12, '2026-01');
  assert.equal(h.dueMonths, 2);
  assert.equal(h.dueAmount, 1400);
});

console.log('--- call sites use the shared rule ---');

// MERGE NOTE (21 Nov 2026, batch B2): dues-unify-v2 rewrote the Reports
// alerts loop to read the SHARED aging (duesSummary.entries —
// calculateFeeAging, which itself calls resolveAgingStartMonth, see the
// 'calculateFeeAging uses resolveAgingStartMonth' check below). The
// hand-rolled loop this script originally grepped for would have
// duplicated that shared rule, and it conflicts with the dues-unify
// contract (no paidByKey / finishedMonths recompute in MadrasaReports).
// Behaviour is identical: same start rule, same finished-months-only
// window, same last-12 slice — proven by checks (1)-(12) above plus the
// dues-unify behavioural checks. So these three checks assert the merged
// shape instead of the hand-rolled loop.
const reports = readSource('components/MadrasaReports.tsx');
check('MadrasaReports longDues reads the shared aging (same start rule, no hand-rolled loop)', () => {
  assert.ok(/longDues[\s\S]{0,600}duesSummary\.entries/.test(reports),
    'longDues must derive from duesSummary.entries (shared aging)');
  assert.ok(!reports.includes('paidByKey'), 'hand-rolled paidByKey recompute must be gone');
  assert.ok(!/const finishedMonths: string\[\]/.test(reports), 'hand-rolled finishedMonths list must be gone');
  assert.ok(!reports.includes('if (admMonth && m < admMonth) continue;'),
    'old admissionDate-only guard still present in MadrasaReports');
});
check('MadrasaReports imports the shared dues total from studentDuesService', () => {
  assert.ok(reports.includes('calculateTotalDues') && reports.includes("from '../services/studentDuesService'"),
    'shared-total import missing');
});
check('MadrasaReports alerts memo depends on duesSummary', () => {
  // The alerts memo derives longDues from duesSummary.entries and closes
  // with a deps array containing duesSummary (chained .filter().sort(),
  // so there is no standalone 'longDues.sort' statement to anchor on).
  const idx = reports.indexOf('duesSummary.entries');
  assert.ok(idx >= 0, 'longDues block not found');
  const tail = reports.slice(idx, idx + 4000);
  assert.ok(/\}, \[[^\]]*duesSummary[^\]]*\]\);/.test(tail), 'alerts memo does not depend on duesSummary');
});

const duesSvc = readSource('services/studentDuesService.ts');
check('calculateFeeAging uses resolveAgingStartMonth (one rule)', () => {
  assert.ok(duesSvc.includes('resolveAgingStartMonth('), 'helper not used in studentDuesService');
});

const feePage = readSource('components/finance/StudentFeeCollection.tsx');
check('StudentFeeCollection passes the fallback into computeDueHistory', () => {
  assert.ok(feePage.includes('computeDueHistory(item.student, transactions, item.monthlyExpected, asOf, 12,'),
    'fee grid does not pass the fallback to computeDueHistory');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
