/**
 * verify-grade-lookup-gaps.ts — proof for fix/master-grade-lookup-gaps.
 *
 * Bug: services/gradingEngine.ts calculateSubjectGrade /
 * calculateSubjectGradePoint looked a percentage up with
 * find(g => percentage >= g.min && percentage <= g.max), but the bands
 * are integers (80-100, 70-79, ...) — so a fractional percentage
 * between bands (79.33%, 79.5%, 69.5%) matched nothing and fell back
 * to 'F' / 0.0. The fix uses the same >= min descending scan as
 * utils.calculateGrade.
 *
 * Run: npx tsx scripts/verify-grade-lookup-gaps.ts
 */
import { calculateSubjectGrade, calculateSubjectGradePoint } from '../services/gradingEngine';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

// (obtained, fullMarks) -> percentage; expected grade + grade point.
const cases: Array<[number, number, string, number]> = [
  [79.33, 100, 'A', 4.0], // was 'F' — falls between the 70-79 and 80-100 bands
  [79.5, 100, 'A', 4.0], // was 'F'
  [69.5, 100, 'A-', 3.5], // was 'F'
  [59.5, 100, 'B', 3.0], // was 'F'
  [49.5, 100, 'C', 2.0], // was 'F'
  [39.5, 100, 'D', 1.0], // was 'F' (below D's 32-39 integer band, above F's 0-31)
  [80, 100, 'A+', 5.0],
  [70, 100, 'A', 4.0],
  [60, 100, 'A-', 3.5],
  [50, 100, 'B', 3.0],
  [40, 100, 'C', 2.0],
  [32, 100, 'F', 0.0], // below the default pass mark 33, so F even though 32 is the D band's min
  [31, 100, 'F', 0.0],
  [100, 100, 'A+', 5.0],
  [0, 100, 'F', 0.0],
  [238, 300, 'A', 4.0], // 79.33% via a 300-mark subject
];

for (const [obtained, full, grade, gp] of cases) {
  const g = calculateSubjectGrade(obtained, full);
  const p = calculateSubjectGradePoint(obtained, full);
  check(`${obtained}/${full} -> ${grade}/${gp}`, g === grade && p === gp, `got ${g}/${p}`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
