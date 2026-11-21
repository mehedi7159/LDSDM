/**
 * verify-fee-highimpact-shared.ts — scripted proof that the fee overview
 * tab's pending-fees card uses the ONE shared dues total (Fix #4).
 *
 * The bug (behaviour-live audit 13 Nov 2026): the fee page contradicted
 * itself — its top banner (FinanceManager KPI, calculateTotalDues) said
 * ৳177,800 while its card said ৳193,200. Fix #4 had wired the
 * dashboard, the header KPI, the fee-collection card and Reports to
 * calculateTotalDues, but MISSED one display: HighImpactSummaryCards
 * (the overview tab's "ছাত্রদের চলতি বকেয়া ফি" card, the first thing
 * the fee page shows). It kept its own inline math — struct tuition
 * `|| 700` for a missing structure, current month only, any status but
 * Inactive/Former, and it counted exam/admission money as collected.
 * On the live data of 13 Nov (173 active students, 0 transactions) the
 * old inline total is exactly ৳193,200, while the shared total as of
 * Nov 2026 is ৳1,955,800 (current ৳177,800 + aged ৳1,778,000 — the
 * approved Jan-2026 fallback for 171 dateless students). So even after
 * the PWA update banner is restored, this card would still disagree
 * with the banner unless it is wired to the shared total too.
 *
 * This fix replaces the card's inline math with calculateTotalDues
 * (same student set / month / feeTypes / aging fallback as the banner),
 * threads feeTypes + academicYears through FinanceManager ->
 * FinanceOverview -> HighImpactSummaryCards, and relabels the card to
 * "মোট বকেয়া ফি" with the চলতি + পুরনো split, like the fee card.
 * The momentum card's "collected this month" keeps reading the shared
 * totalPaid, so it stays this month's figure.
 *
 * Checks:
 *   (1) On a fixture where the old formula and the shared total differ
 *       three ways at once — an aged backlog the old card missed, a
 *       per-student override the old card ignored, and a missing fee
 *       structure the old card invented ৳700 for — calculateTotalDues
 *       gives the shared total and the old inline formula gives the
 *       wrong one (the fixture reproduces the live ৳15,400 gap shape).
 *   (2) Source checks: the card calls calculateTotalDues, the `|| 700`
 *       fallback and the feeMap are gone, the label + split are shown,
 *       and feeTypes/academicYears are threaded through both parents.
 *
 * Run: npx tsx scripts/verify-fee-highimpact-shared.ts
 * (or npm run test:fee-highimpact-shared).
 */
import {
  calculateTotalDues,
  academicYearFallbackStartMonth,
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
  { id: 'fs1', classLevel: 'Class 1', monthlyTuition: 1000, admissionFee: 1500, examFee: 400, boardingFee: 0, bookFee: 800 },
  // No structure at all for 'Class 2' — the old card invented ৳700 here.
];
const FEE_TYPES: FeeTypeDef[] = [
  { id: 'tuition', labelBn: 'মাসিক বেতন', labelEn: 'Tuition', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: true },
  { id: 'exam', labelBn: 'পরীক্ষার ফি', labelEn: 'Exam Fee', frequency: 'per_exam', appliesTo: 'all', collector: 'class_teacher', enabled: true },
  { id: 'food', labelBn: 'খাবার ফি', labelEn: 'Food Fee', frequency: 'monthly', appliesTo: 'all', collector: 'accountant', enabled: false },
];
const YEARS: AcademicYear[] = [
  { id: 'y26', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isCurrent: true },
] as AcademicYear[];
const AS_OF = '2026-10';
const FALLBACK = academicYearFallbackStartMonth(YEARS, AS_OF);

const student = (over: Partial<Student> = {}): Student => ({
  id: 's1', name: 'Test Student', classLevel: 'Class 1', status: 'Active',
  admissionDate: '2026-01-01', ...over,
} as Student);

// (1) The shared total vs the old inline formula on one fixture
{
  const s1 = student({ id: 's1' }); // Class 1, 1000/mo since Jan, never paid
  const s2 = student({ id: 's2', monthlyFee: 300 } as Partial<Student>); // override: 300/mo, not 1000
  const s3 = student({ id: 's3', classLevel: 'Class 2' }); // no structure -> 0, never 700
  const s4 = student({ id: 's4', status: 'Former' }); // excluded everywhere
  const actives = [s1, s2, s3, s4].filter(s => s.status === 'Active' && !(s as any).isFormer);
  const shared = calculateTotalDues(actives, STRUCT, [] as FinanceTransaction[], AS_OF, FEE_TYPES, FALLBACK);
  eq('(1) shared totalDue (10000 + 3000 + 0)', shared.totalDue, 13000);
  eq('(1) shared currentMonthDue (1000 + 300 + 0)', shared.currentMonthDue, 1300);
  eq('(1) shared agedDue (9000 + 2700 + 0)', shared.agedDue, 11700);
  eq('(1) shared dueStudentsCount', shared.dueStudentsCount, 2);

  // The old inline formula, exactly as HighImpactSummaryCards computed it:
  // struct tuition || 700, current month only, status not Inactive/Former.
  let oldPending = 0;
  [s1, s2, s3, s4].filter(s => s.status !== 'Inactive' && s.status !== 'Former').forEach(s => {
    const st = STRUCT.find(f => f.classLevel === s.classLevel);
    oldPending += (st?.monthlyTuition || 700);
  });
  eq('(1) old inline total on the same fixture', oldPending, 2700);
  check('(1) old formula disagrees with the shared total (the live bug)', oldPending !== shared.totalDue, `old ${oldPending} vs shared ${shared.totalDue}`);
}

// (2) Source checks: the card is wired to the shared total
{
  const card = readSource('components/finance/HighImpactSummaryCards.tsx');
  check('(2) card calls calculateTotalDues', card.includes('calculateTotalDues('), 'HighImpactSummaryCards must call calculateTotalDues');
  check('(2) card threads feeTypes into the call', card.includes('transactions, month, feeTypes,'), 'dues call must pass month + feeTypes');
  check('(2) card threads the aging fallback', card.includes('academicYearFallbackStartMonth(academicYears, month)'), 'dues call must pass the academic-year fallback');
  check('(2) card filters the canonical active set', card.includes("students.filter(s => s.status === 'Active' && !s.isFormer)"), 'must use the canonical active set');
  check('(2) invented ৳700 fallback is gone', !card.includes('|| 700'), 'no || 700 may remain in the card');
  check('(2) old feeMap is gone', !card.includes('feeMap'), 'the inline struct map must be gone');
  check('(2) card label is the combined total, not current-month only', card.includes('মোট বকেয়া ফি'), 'label must say মোট বকেয়া ফি');
  check('(2) card shows the current + aged split', card.includes('চলতি মাস') && card.includes('পুরনো'), 'card must show the চলতি + পুরনো split');
  const overview = readSource('components/finance/FinanceOverview.tsx');
  check('(2) FinanceOverview threads feeTypes to the cards', overview.includes('feeTypes={feeTypes}'), 'FinanceOverview must pass feeTypes down');
  check('(2) FinanceOverview threads academicYears to the cards', overview.includes('academicYears={academicYears}'), 'FinanceOverview must pass academicYears down');
  const fin = readSource('components/FinanceManager.tsx');
  check('(2) FinanceManager passes feeTypes to FinanceOverview', /<FinanceOverview[\s\S]*?feeTypes=\{feeTypes\}/.test(fin), 'FinanceManager must pass feeTypes to FinanceOverview');
  check('(2) FinanceManager passes academicYears to FinanceOverview', /<FinanceOverview[\s\S]*?academicYears=\{academicYears\}/.test(fin), 'FinanceManager must pass academicYears to FinanceOverview');
  const pkg = JSON.parse(readSource('package.json'));
  check('(2) package.json exposes the verify script',
    pkg.scripts['test:fee-highimpact-shared'] === 'tsx scripts/verify-fee-highimpact-shared.ts', 'npm run test:fee-highimpact-shared must run this script');
}

console.log(failures === 0 ? '\nALL FEE-HIGHIMPACT-SHARED CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
