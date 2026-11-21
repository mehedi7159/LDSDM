/**
 * verify-pass-rate-unify.ts — scripted proof that the same exam shows the
 * same pass rate on every page (Fix #5's one shared calculation, finished).
 *
 * The bug (behaviour-live audit 13 Nov 2026): the same First Term showed
 * 7.3% on the dashboard chart (6 pass / 76 fail, 82 evaluated) but 5.9%
 * in the Exams hub (101 students). The dashboard's "recent results" card
 * showed 23% — but that card is the Reports latest-exam summary, always
 * the LAST exam (Second Term: 38/168 = 22.6%), a different exam by
 * design, not a disagreement.
 *
 * Root causes, all in the denominator / rounding — the pass rule itself
 * (calculateTotalGPA) was already shared:
 *   (1) ExamResultsManager KPI counted every distinct studentId appearing
 *       in the exam's marks as evaluated — including ORPHAN marks whose
 *       student record is gone (deleted students leave their marks
 *       behind). The pass loop already skipped unresolvable IDs, so the
 *       numerator was 6 but the denominator was 101. On the live data
 *       of 13 Nov: First Term has 101 mark-holders but only 82 resolve
 *       to a live student (19 orphans); Second Term 177 vs 168 (9
 *       orphans). Old KPI: 6/101 = 5.9%. Fixed: 6/82 = 7.3%, matching
 *       the dashboard exactly. (The audit tab also ran pre-#5 code, so
 *       the old all-students denominator was in play there too; this
 *       fix removes the remaining denominator gap in current code.)
 *   (2) ExecutiveInstitutionalDashboard counted a student as evaluated
 *       only when totalMarks > 0 — a student who sat the exam and scored
 *       0 in every subject was dropped, while the dashboard and reports
 *       count them as evaluated (and failed).
 *   (3) StaffMobileApp's teacher class report rounded the rate to an
 *       integer (Math.round) while every other page shows 1 decimal via
 *       calcPassRate — the same class could show 23% on the phone and
 *       22.6% on the dashboard.
 *
 * NOT changed here (needs Sagor's decision, master-audit D3): which exam
 * each page defaults to (dashboard yearExams[0], reports exams[last],
 * Exams hub first SCHEDULED else exams[0]), and the gazette's
 * "promotion rate" label. Those pick a different exam on purpose; this
 * fix only makes the SAME exam agree everywhere.
 *
 * Checks:
 *   (1) calcPassRate on the live numbers: 6/82 = 7.3, 6/101 = 5.9
 *       (the whole First-Term gap was the denominator), 38/168 = 22.6.
 *   (2) Orphan fixture: 3 live students (1 pass, 1 fail, 1 all-zero)
 *       + marks for 2 deleted students. Old KPI rule: 1/5 = 20%.
 *       Fixed rule: 1/3 = 33.3%.
 *   (3) All-zero fixture: the old totalMarks > 0 rule evaluates 2 of
 *       3 mark-holders; the marks-presence rule evaluates all 3.
 *   (4) Source checks: the KPI counts only resolvable active students,
 *       the Executive page uses marks-presence, the mobile report uses
 *       calcPassRate.
 *
 * Run: npx tsx scripts/verify-pass-rate-unify.ts
 * (or npm run test:pass-rate-unify).
 */
import { calcPassRate } from '../services/gradingEngine';
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

// Fixture: exam ex1. s1 passes, s2 fails, s3 sat the exam and scored 0.
// gone1/gone2 are mark rows for deleted students (no student record).
type Row = { studentId: string; obtained: number };
const students = [
  { id: 's1', status: 'Active', isFormer: false },
  { id: 's2', status: 'Active', isFormer: false },
  { id: 's3', status: 'Active', isFormer: false },
];
const markRows: Row[] = [
  { studentId: 's1', obtained: 80 },
  { studentId: 's2', obtained: 20 },
  { studentId: 's3', obtained: 0 },
  { studentId: 'gone1', obtained: 90 },
  { studentId: 'gone2', obtained: 10 },
];
const passedIds = new Set(['s1']);
const totalMarksOf = (id: string) =>
  markRows.filter(m => m.studentId === id).reduce((s, m) => s + m.obtained, 0);

// (1) The live numbers: the whole First-Term gap was the denominator
eq('(1) live First Term, dashboard denominator 82', calcPassRate(6, 82), 7.3);
eq('(1) live First Term, Exams-hub denominator 101', calcPassRate(6, 101), 5.9);
eq('(1) live Second Term, 38/168', calcPassRate(38, 168), 22.6);
eq('(1) 0 evaluated is 0, never 100', calcPassRate(0, 0), 0);

// (2) Orphan marks: old KPI rule vs fixed rule
{
  const distinctHolders = Array.from(new Set(markRows.map(m => m.studentId)));
  const oldEvaluated = distinctHolders.length; // 5: s1, s2, s3, gone1, gone2
  const oldPassed = distinctHolders.filter(id => passedIds.has(id)).length; // 1 (orphans never resolve)
  eq('(2) old KPI denominator counts orphans', oldEvaluated, 5);
  eq('(2) old KPI rate', calcPassRate(oldPassed, oldEvaluated), 20);

  // Fixed rule, exactly as the component now computes it.
  const evaluatedIds = distinctHolders.filter(id => {
    const st = students.find(s => s.id === id);
    return !!st && st.status === 'Active' && !st.isFormer;
  });
  const newPassed = evaluatedIds.filter(id => passedIds.has(id)).length;
  eq('(2) fixed KPI denominator (live students only)', evaluatedIds.length, 3);
  eq('(2) fixed KPI rate', calcPassRate(newPassed, evaluatedIds.length), 33.3);
}

// (3) All-zero student: totalMarks > 0 vs marks-presence
{
  const liveIds = ['s1', 's2', 's3'];
  const oldEvaluated = liveIds.filter(id => totalMarksOf(id) > 0);
  eq('(3) old Executive rule drops the all-zero student', oldEvaluated.length, 2);
  const newEvaluated = liveIds.filter(id => markRows.some(m => m.studentId === id));
  eq('(3) marks-presence rule keeps them (evaluated, failed)', newEvaluated.length, 3);
}

// (4) Source checks — since fix/pass-rate-v2 the KPI and the Executive
// page no longer build their own evaluated lists: both delegate to the
// ONE shared calcExamPassRate (services/examPassRate.ts), which embodies
// the rules checked in (2)–(3) above (resolvable students only, orphans
// excluded, marks-presence so all-zero students count as evaluated and
// failed). verify-pass-rate-v2.ts proves the helper itself.
{
  const kpi = readSource('components/examination/ExamResultsManager.tsx');
  check('(4) KPI uses the shared calcExamPassRate',
    kpi.includes('calcExamPassRate'), 'KPI must delegate to calcExamPassRate');
  check('(4) KPI rate comes from the shared result',
    kpi.includes('passRate: rate.passRate'), 'KPI passRate must come from the shared result');
  check('(4) KPI evaluated count comes from the shared result',
    kpi.includes('evaluatedStudentsCount: rate.evaluated'), 'KPI evaluated count must come from the shared result');
  check('(4) KPI no longer counts raw mark-holder IDs',
    !kpi.includes('evaluatedStudentsCount = activeStudentIds.length'), 'the orphan-counting line must be gone');
  const exec = readSource('components/ExecutiveInstitutionalDashboard.tsx');
  check('(4) Executive uses the shared calcExamPassRate',
    exec.includes('calcExamPassRate'), 'Executive must delegate to calcExamPassRate');
  check('(4) Executive totalMarks > 0 rule is gone',
    !exec.includes('results.filter(r => r.totalMarks > 0)'), 'the totalMarks > 0 filter must be gone');
  const mobile = readSource('components/StaffMobileApp.tsx');
  check('(4) mobile class report imports calcPassRate',
    mobile.includes('calcPassRate') && mobile.includes("from '../services/gradingEngine'"), 'StaffMobileApp must import calcPassRate');
  check('(4) mobile class report uses calcPassRate, not Math.round',
    mobile.includes('calcPassRate(passed.length, appeared.length)'), 'classResultReport passRate must use calcPassRate');
  check('(4) mobile class report has no integer-rounded pass rate',
    !mobile.includes('Math.round((passed.length / appeared.length) * 100)'), 'the Math.round pass rate must be gone');
  const pkg = JSON.parse(readSource('package.json'));
  check('(4) package.json exposes the verify script',
    pkg.scripts['test:pass-rate-unify'] === 'tsx scripts/verify-pass-rate-unify.ts', 'npm run test:pass-rate-unify must run this script');
}

console.log(failures === 0 ? '\nALL PASS-RATE-UNIFY CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
