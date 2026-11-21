/**
 * verify-pass-rate-v2.ts — scripted proof that ONE exam + ONE definition
 * drives the pass rate on every surface (21 Nov 2026 live audit).
 *
 * The bug (morning audit 21 Nov 2026, live bundle index-BkNd_5QA.js):
 * the same First Term showed SIX different rates — dashboard header 23%
 * (Second Term's number), pie 7.3%, class ledger Play 100%, Reports
 * 7.7%, portal 5.9%, portal Play merit 50% — and the exam selector did
 * not move the header cards at all, while every page reset the selector
 * to First Term on navigation. PR #28 (merged 21 Nov) unified only the
 * FORMULA (calcPassRate) in 4 places; the disagreement lived elsewhere:
 *
 * Root causes, all in code on main (0b7c9dd):
 *   (1) NO shared selected exam. Every page owns a local useState
 *       initialised to exams[0] (First Term): Dashboard, WebResultView
 *       (portal), AuthPage (public portal), ExecutiveInstitutionalDashboard
 *       (Reports), ExamResultsManager analytics/tabulation/SMS. Navigating
 *       unmounts the page, so the selector resets to First Term.
 *   (2) Header cards ignore any selector by design: MadrasaReports
 *       (the Dashboard Overview "header" card) always uses
 *       exams[exams.length - 1] (Second Term, 22.6% -> "23%"); the
 *       ExamResultsManager KPI header always uses the first SCHEDULED /
 *       MARKS_ENTRY exam else exams[0]; neither has a selector at all.
 *   (3) Different denominators: WebResultView counts EVERY active class
 *       student — a student with no marks in the exam appears as a failed
 *       examinee (portal Play merit 50% = 6/12) — while the Dashboard
 *       ledger counts only students with marks (Play 100% = 6/6).
 *   (4) Different subject sets feeding calculateTotalGPA (a missing mark
 *       in a passed-in core subject = fail): the Dashboard passes only
 *       the exam-assigned subjects (fallback: all class subjects);
 *       Executive / Reports / Exams-hub analytics / SubjectPerformance
 *       Analytics pass ALL class subjects. Same exam, same students,
 *       different pass/fail -> 7.3% vs 7.7% (and class chart 73% vs
 *       ledger 100% for Play).
 *
 * The fix: ONE shared exam in AppContext (persisted to localStorage, so
 * it survives navigation AND reload) + ONE shared calcExamPassRate in
 * services/examPassRate.ts (D3 option (k): selected exam everywhere;
 * evaluated = an Active, non-former student with >= 1 mark record in
 * the exam — 0 in every subject still counts, as failed; no-marks
 * students excluded; 1 decimal via calcPassRate) used by the Dashboard,
 * MadrasaReports, ExecutiveInstitutionalDashboard, ExamResultsManager
 * KPI + analytics, SubjectPerformanceAnalytics overall, and the portal
 * (WebResultView, filter-only: no-marks students leave the merit list).
 *
 * Checks:
 *   (1) Live-number sanity via calcPassRate: 6/82 = 7.3, 38/168 = 22.6.
 *   (2) Fixture: 8 students + 1 orphan mark-holder. Fixed rule gives
 *       evaluated 5, passed 2, failed 3, rate 40.0; class-level Play
 *       gives evaluated 4, passed 1, rate 25.0. An all-zero student is
 *       evaluated + failed; a student whose only mark is in a subject
 *       NOT assigned to the exam is evaluated + failed (missing mark in
 *       an assigned subject fails them); no-marks / inactive / former /
 *       orphan students are all excluded.
 *   (3) resolveSelectedExamId: a stored, still-existing exam id is kept;
 *       a stale stored id falls back to the first exam of the current
 *       year; with no stored id the default is the first exam of the
 *       current year; with no year match it is exams[0]; with no exams
 *       it is ''.
 *   (4) Source checks: every pass-rate surface uses calcExamPassRate and
 *       the shared context exam; no local exam useState remains in
 *       Dashboard / WebResultView / ExecutiveInstitutionalDashboard /
 *       AuthPage; no exams[last] in MadrasaReports; no SCHEDULED-first
 *       KPI exam pick in ExamResultsManager; no analyticsExamId there;
 *       SubjectPerformanceAnalytics falls back to the context exam, not
 *       exams[0]; WebResultView drops no-marks students from the merit
 *       list (filter-only).
 *
 * Run: npx tsx scripts/verify-pass-rate-v2.ts
 * (or npm run test:pass-rate-v2).
 */
import { calcPassRate } from '../services/gradingEngine';
import { calcExamPassRate, resolveSelectedExamId } from '../services/examPassRate';
import type { Exam, MarkRecord, Student, Subject } from '../types';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failures = 0;
let checks = 0;
function check(name: string, cond: boolean, detail?: string) {
  checks++;
  if (cond) {
    console.log(`  PASS: ${name}`);
  } else {
    failures++;
    console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

// ---- (1) live-number sanity -------------------------------------------
console.log('(1) Live numbers (calcPassRate, 1 decimal)');
check('First Term 6/82 = 7.3', calcPassRate(6, 82) === 7.3);
check('Second Term 38/168 = 22.6', calcPassRate(38, 168) === 22.6);
check('Portal old denominator 6/101 = 5.9 (the gap was the denominator)', calcPassRate(6, 101) === 5.9);

// ---- (2) fixture --------------------------------------------------------
console.log('(2) Shared definition fixture (D3 option k)');
const exams: Exam[] = [
  { id: 'ex1', academicYear: '2026', name: 'First Term', category: 'Term', status: 'FINALIZED' },
  { id: 'ex2', academicYear: '2026', name: 'Second Term', category: 'Term', status: 'SCHEDULED' },
];
// Play: Bangla + Math assigned to ex1; English assigned to ex2 only.
const subjects: Subject[] = [
  { id: 'sub-bn', name: 'Bangla', classLevel: 'Play', examIds: ['ex1', 'ex2'], fullMarks: 100, passMarks: 33, isOptional: false, order: 1 },
  { id: 'sub-mt', name: 'Math', classLevel: 'Play', examIds: ['ex1', 'ex2'], fullMarks: 100, passMarks: 33, isOptional: false, order: 2 },
  { id: 'sub-en', name: 'English', classLevel: 'Play', examIds: ['ex2'], fullMarks: 100, passMarks: 33, isOptional: false, order: 3 },
  { id: 'sub-bn1', name: 'Bangla', classLevel: 'Class 1', examIds: ['ex1', 'ex2'], fullMarks: 100, passMarks: 33, isOptional: false, order: 1 },
  { id: 'sub-mt1', name: 'Math', classLevel: 'Class 1', examIds: ['ex1', 'ex2'], fullMarks: 100, passMarks: 33, isOptional: false, order: 2 },
];
const mkStudent = (id: string, classLevel: string, extra: Partial<Student> = {}): Student => ({
  id, name: `Student ${id}`, classLevel, status: 'Active', ...extra,
} as Student);
const students: Student[] = [
  mkStudent('s1', 'Play'), // pass: 80 + 70 in ex1
  mkStudent('s2', 'Play'), // fail: 80 + 10 in ex1
  mkStudent('s3', 'Play'), // only an English mark in ex1 (English NOT assigned to ex1) -> evaluated + failed
  mkStudent('s4', 'Play'), // no marks in ex1 -> excluded
  mkStudent('s5', 'Play'), // all-zero marks in ex1 -> evaluated + failed
  mkStudent('s6', 'Play', { status: 'Inactive' }), // marks, but inactive -> excluded
  mkStudent('s7', 'Play', { isFormer: true }), // marks, but former -> excluded
  mkStudent('s8', 'Class 1'), // pass: 90 + 85 in ex1
];
const mkMark = (id: string, studentId: string, subjectId: string, obtained: number): MarkRecord => ({
  id, studentId, subjectId, examId: 'ex1', obtained, total: 100,
} as MarkRecord);
const marks: MarkRecord[] = [
  mkMark('m1', 's1', 'sub-bn', 80), mkMark('m2', 's1', 'sub-mt', 70),
  mkMark('m3', 's2', 'sub-bn', 80), mkMark('m4', 's2', 'sub-mt', 10),
  mkMark('m5', 's3', 'sub-en', 90),
  mkMark('m6', 's5', 'sub-bn', 0), mkMark('m7', 's5', 'sub-mt', 0),
  mkMark('m8', 's6', 'sub-bn', 90), mkMark('m9', 's6', 'sub-mt', 90),
  mkMark('m10', 's7', 'sub-bn', 90), mkMark('m11', 's7', 'sub-mt', 90),
  mkMark('m12', 's8', 'sub-bn1', 90), mkMark('m13', 's8', 'sub-mt1', 85),
  mkMark('m14', 'ghost', 'sub-bn', 95), mkMark('m15', 'ghost', 'sub-mt', 95), // orphan: no student record
];

const whole = calcExamPassRate({ students, marks, subjects, exams, examId: 'ex1' });
check('whole-school evaluated = 5 (s1,s2,s3,s5,s8)', whole.evaluated === 5, `got ${whole.evaluated}`);
check('whole-school passed = 2 (s1,s8)', whole.passed === 2, `got ${whole.passed}`);
check('whole-school failed = 3 (s2,s3,s5)', whole.failed === 3, `got ${whole.failed}`);
check('whole-school passRate = 40.0', whole.passRate === 40, `got ${whole.passRate}`);
check('results list holds exactly the evaluated students', whole.results.length === 5);
check('all-zero student s5 is evaluated + failed', whole.results.some(r => r.student.id === 's5' && r.isFail));
check('English-only student s3 is evaluated + failed (assigned subjects have no marks)', whole.results.some(r => r.student.id === 's3' && r.isFail));
check('no-marks student s4 is excluded', !whole.results.some(r => r.student.id === 's4'));
check('inactive s6 and former s7 are excluded', !whole.results.some(r => r.student.id === 's6' || r.student.id === 's7'));
check('orphan mark-holder ghost is excluded', !whole.results.some(r => r.student.id === 'ghost'));

const play = calcExamPassRate({ students, marks, subjects, exams, examId: 'ex1', classLevel: 'Play' });
check('Play evaluated = 4', play.evaluated === 4, `got ${play.evaluated}`);
check('Play passed = 1', play.passed === 1, `got ${play.passed}`);
check('Play passRate = 25.0', play.passRate === 25, `got ${play.passRate}`);

const empty = calcExamPassRate({ students, marks, subjects, exams, examId: 'no-such-exam' });
check('unknown exam: evaluated 0, rate 0', empty.evaluated === 0 && empty.passRate === 0);

// ---- (3) shared-exam default resolution ---------------------------------
console.log('(3) Shared exam default (resolveSelectedExamId)');
check('stored id that still exists is kept', resolveSelectedExamId(exams, 'ex2', '2026') === 'ex2');
check('stale stored id falls back to first exam of the current year', resolveSelectedExamId(exams, 'gone', '2026') === 'ex1');
check('no stored id defaults to first exam of the current year', resolveSelectedExamId(exams, '', '2026') === 'ex1');
check('no exam in the year falls back to exams[0]', resolveSelectedExamId(exams, '', '2030') === 'ex1');
check('no exams gives empty string', resolveSelectedExamId([], '', '2026') === '');

// ---- (4) source checks: one exam + one definition everywhere ------------
console.log('(4) Source checks');
const ctx = read('context/AppContext.tsx');
check('AppContext exposes selectedExamId', ctx.includes('selectedExamId'));
check('AppContext exposes setSelectedExamId', ctx.includes('setSelectedExamId'));
check('AppContext persists the exam like activeTab', ctx.includes('madrasha_selected_exam_id'));

const usesShared = (p: string) => {
  const src = read(p);
  return src.includes('calcExamPassRate') && src.includes('selectedExamId');
};
check('Dashboard uses the shared exam + shared calc', usesShared('components/Dashboard.tsx'));
check('MadrasaReports uses the shared exam + shared calc', usesShared('components/MadrasaReports.tsx'));
check('ExecutiveInstitutionalDashboard uses the shared exam + shared calc', usesShared('components/ExecutiveInstitutionalDashboard.tsx'));
check('ExamResultsManager uses the shared exam + shared calc', usesShared('components/examination/ExamResultsManager.tsx'));
check('SubjectPerformanceAnalytics uses the shared calc', read('components/SubjectPerformanceAnalytics.tsx').includes('calcExamPassRate'));
// WebResultView is protected (filter-only exception): it does NOT re-derive
// per-student results via calcExamPassRate — it keeps its own
// calculateTotalGPA calls and only (a) follows the shared exam,
// (b) filters no-marks students out of the list, (c) rates the list with
// the shared 1-decimal calcPassRate.
check('WebResultView uses the shared exam + shared rate formula', read('components/WebResultView.tsx').includes('selectedExamId') && read('components/WebResultView.tsx').includes('calcPassRate'));
check('AuthPage uses the shared exam', read('components/AuthPage.tsx').includes('selectedExamId'));

const noLocalExamState = (p: string) => {
  const src = read(p);
  return !/const \[selectedExamId, setSelectedExamId\] = useState/.test(src);
};
check('Dashboard has no local exam state', noLocalExamState('components/Dashboard.tsx'));
check('WebResultView has no local exam state', noLocalExamState('components/WebResultView.tsx'));
check('ExecutiveInstitutionalDashboard has no local exam state', noLocalExamState('components/ExecutiveInstitutionalDashboard.tsx'));
check('AuthPage has no local exam state', noLocalExamState('components/AuthPage.tsx'));

check('MadrasaReports no longer uses exams[last]', !read('components/MadrasaReports.tsx').includes('exams[exams.length - 1]'));
check('ExamResultsManager KPI no longer picks SCHEDULED/MARKS_ENTRY first', !/exams\.find\(e => e\.status === 'SCHEDULED'/.test(read('components/examination/ExamResultsManager.tsx')));
check('ExamResultsManager analytics tab no longer has its own exam id', !read('components/examination/ExamResultsManager.tsx').includes('analyticsExamId'));
check('SubjectPerformanceAnalytics falls back to the context exam, not exams[0]', /propSelectedExamId \?\? .*selectedExamId/.test(read('components/SubjectPerformanceAnalytics.tsx')) && !read('components/SubjectPerformanceAnalytics.tsx').includes("propSelectedExamId ?? (exams.length > 0 ? exams[0].id : 'ALL')"));
check('WebResultView drops no-marks students from the merit list (filter-only)', /marks\.some\(m => m\.studentId === student\.id && m\.examId === selectedExam\.id\)/.test(read('components/WebResultView.tsx')));

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.log(`${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log('All checks passed.');
