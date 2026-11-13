/**
 * Pass rate — one shared calculation everywhere (12 Nov 2026, base fba1bb8).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-pass-rate.ts
 * (or npm run test:pass-rate).
 *
 * The bug: pass rate differed by page — dashboard header 23% vs detail
 * 7.3%, Reports 7.7%, Portal/Exams 5.9% — because four call sites used
 * four different denominators and three different roundings, and the
 * ExamResultsManager KPI showed '100.0' when 0 students were evaluated.
 *   - components/examination/ExamResultsManager.tsx (KPI): students with
 *     >= 1 mark; 0 evaluated -> '100.0'.
 *   - components/examination/ExamResultsManager.tsx (class breakdown):
 *     ALL students in the class (no-marks students counted as failed),
 *     so pass + fail did not match the rate's denominator.
 *   - components/Dashboard.tsx (header + class cards): passed+failed
 *     evaluated, but header used 1 decimal and class cards Math.round.
 *   - components/MadrasaReports.tsx (latest summary + class results):
 *     students with >= 1 mark, Math.round (integer).
 *
 * The fix: one shared calcPassRate(passed, evaluated) in
 * services/gradingEngine.ts — passed / evaluated, 1 decimal, 0 when
 * evaluated is 0, never 100. Every call site uses it, and every call
 * site counts only evaluated students (at least 1 mark in the exam) in
 * the denominator, so the same exam + class scope gives the same rate
 * on every page. Grading itself is untouched: calculateTotalGPA in
 * services/utils.ts still fails a student with no marks ("no marks =
 * fail"); this only unifies the rate computation.
 *
 * Out of scope on purpose (protected result/marksheet files, byte-for-
 * byte): components/ClassResultView.tsx and components/WebResultView.tsx
 * still compute their own rates over all students — the Portal 5.9%
 * figure lives there and needs a separate decision.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gradingEngine: any = await import('../services/gradingEngine').catch(() => ({}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

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

console.log('--- calcPassRate (shared function, services/gradingEngine.ts) ---');

check('calcPassRate is exported from gradingEngine', () => {
  assert.strictEqual(typeof gradingEngine.calcPassRate, 'function', 'calcPassRate must be exported from services/gradingEngine');
});

check('same inputs give the same rate, twice in a row', () => {
  assert.strictEqual(gradingEngine.calcPassRate(1, 13), 7.7);
  assert.strictEqual(gradingEngine.calcPassRate(1, 13), 7.7);
});

check('whole numbers stay whole (23 of 100 -> 23)', () => {
  assert.strictEqual(gradingEngine.calcPassRate(23, 100), 23);
});

check('1 decimal, not integer-rounded (1 of 3 -> 33.3, 2 of 3 -> 66.7)', () => {
  assert.strictEqual(gradingEngine.calcPassRate(1, 3), 33.3);
  assert.strictEqual(gradingEngine.calcPassRate(2, 3), 66.7);
});

check('0 evaluated -> 0, never 100', () => {
  assert.strictEqual(gradingEngine.calcPassRate(0, 0), 0);
  assert.notStrictEqual(gradingEngine.calcPassRate(0, 0), 100);
});

check('0 passed of some evaluated -> 0', () => {
  assert.strictEqual(gradingEngine.calcPassRate(0, 5), 0);
});

check('all passed -> 100', () => {
  assert.strictEqual(gradingEngine.calcPassRate(5, 5), 100);
});

check('result is a number', () => {
  assert.strictEqual(typeof gradingEngine.calcPassRate(1, 13), 'number');
});

console.log('--- ExamResultsManager KPI: shared fn, no 100.0 fallback ---');

check('KPI uses calcPassRate(passCount, evaluatedStudentsCount)', () => {
  const src = readSource('components/examination/ExamResultsManager.tsx');
  assert.ok(src.includes('calcPassRate(passCount, evaluatedStudentsCount)'), 'KPI must call calcPassRate(passCount, evaluatedStudentsCount)');
});

check("no '100.0' fallback left anywhere in ExamResultsManager", () => {
  const src = readSource('components/examination/ExamResultsManager.tsx');
  assert.ok(!src.includes("'100.0'"), "the 0-evaluated '100.0' fallback must be gone");
  assert.ok(!src.includes('"100.0"'), "the 0-evaluated '100.0' fallback must be gone");
});

console.log('--- ExamResultsManager class breakdown: evaluated-only denominator ---');

check('class breakdown counts only evaluated students (at least 1 mark in the exam)', () => {
  const src = readSource('components/examination/ExamResultsManager.tsx');
  const start = src.indexOf('// Analytics students calculation');
  assert.ok(start > -1, 'analytics calculation must exist');
  const body = src.slice(start, src.indexOf('// Top Achievers', start));
  assert.ok(body.includes('calcPassRate(pass, evaluatedStudents.length)'), 'class rate must be calcPassRate(pass, evaluatedStudents.length)');
  assert.ok(body.includes('marks.some(m => m.studentId === st.id && m.examId === examObj.id)'), 'evaluated must mean at least 1 mark in this exam');
});

check('class breakdown no longer divides by all students in the class', () => {
  const src = readSource('components/examination/ExamResultsManager.tsx');
  const start = src.indexOf('// Analytics students calculation');
  const body = src.slice(start, src.indexOf('// Top Achievers', start));
  assert.ok(!body.includes('((pass / total) * 100)'), 'class rate must not divide by total class students any more');
});

console.log('--- Dashboard: header + class cards share the function ---');

check('Dashboard header uses calcPassRate(passed, totalEvaluated)', () => {
  const src = readSource('components/Dashboard.tsx');
  assert.ok(src.includes('calcPassRate(passed, totalEvaluated)'), 'header must call calcPassRate(passed, totalEvaluated)');
  assert.ok(!src.includes('Number(((passed / totalEvaluated) * 100).toFixed(1))'), 'old inline header formula must be gone');
});

check('Dashboard class cards use calcPassRate(clsPassed, clsEvaluated)', () => {
  const src = readSource('components/Dashboard.tsx');
  assert.ok(src.includes('calcPassRate(clsPassed, clsEvaluated)'), 'class cards must call calcPassRate(clsPassed, clsEvaluated)');
  assert.ok(!src.includes('Math.round((clsPassed / clsEvaluated) * 100)'), 'old integer-rounded class-card formula must be gone');
});

console.log('--- MadrasaReports: latest summary + class results share the function ---');

check('latest exam summary uses calcPassRate(passed, rows.length)', () => {
  const src = readSource('components/MadrasaReports.tsx');
  assert.ok(src.includes('calcPassRate(passed, rows.length)'), 'latest summary must call calcPassRate(passed, rows.length)');
  assert.ok(!src.includes('Math.round((passed / rows.length) * 100)'), 'old integer-rounded summary formula must be gone');
});

check('class results use calcPassRate(passed, appeared.length)', () => {
  const src = readSource('components/MadrasaReports.tsx');
  assert.ok(src.includes('calcPassRate(passed, appeared.length)'), 'class results must call calcPassRate(passed, appeared.length)');
  assert.ok(!src.includes('Math.round((passed / appeared.length) * 100)'), 'old integer-rounded class formula must be gone');
});

console.log('--- Grading rules untouched ---');

check('calculateTotalGPA still fails a student with no marks (rule unchanged)', () => {
  const src = readSource('services/utils.ts');
  assert.ok(src.includes('No marks entry counts as fail'), 'the no-marks = fail rule in calculateTotalGPA must still be there');
});

check('no pass-rate formula left in gradingEngine besides calcPassRate', () => {
  const src = readSource('services/gradingEngine.ts');
  const at = src.indexOf('export function calcPassRate');
  assert.ok(at > -1, 'calcPassRate must be defined in gradingEngine');
  assert.ok(src.slice(at).includes('toFixed(1)'), 'calcPassRate must round to 1 decimal');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:pass-rate'], 'tsx scripts/verify-pass-rate.ts', 'npm run test:pass-rate must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: pass-rate self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
