/**
 * Master audit F11 — Bengali-digit rolls break sort/search/auto-ID —
 * self-check. Run: npx tsx scripts/verify-master-bengali-digit-rolls.ts
 *
 *  - toAsciiDigits converts Bengali digits (Number('১') is NaN).
 *  - The student builders normalize roll/rollNumber to ASCII at save,
 *    so every save path (StudentManager, admission, portals) stores
 *    ASCII rolls — and a Bengali roll can never mint a mixed-script
 *    auto-ID like 202600১.
 *  - Search and sort comparators normalize both sides, so '1' finds
 *    roll '১' and Bengali-roll students sort by their real number.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { toAsciiDigits, buildCreateStudentPayload, buildUpdateStudentPayload } = await import('../services/studentService');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

check('toAsciiDigits converts Bengali digits', () => {
  assert.strictEqual(toAsciiDigits('১'), '1');
  assert.strictEqual(toAsciiDigits('২০২৬০১'), '202601');
  assert.strictEqual(toAsciiDigits('12'), '12');
  assert.strictEqual(toAsciiDigits(''), '');
});

check('create builder stores ASCII rolls', () => {
  const res = buildCreateStudentPayload({ name: 'Test', classLevel: 'Class 1', roll: '১', rollNumber: '১' } as any);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.student.roll, '1');
  assert.strictEqual(res.student.rollNumber, '1');
  assert.ok(!/[০-৯]/.test(res.student.studentId || ''), 'auto studentId must not contain Bengali digits');
});

check('update builder normalizes rolls', () => {
  const existing = { id: 's1', name: 'A', classLevel: 'Class 1', status: 'Active', roll: '2', rollNumber: '2' } as any;
  const res = buildUpdateStudentPayload(existing, { roll: '৫' } as any);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.student.roll, '5');
});

const usesNormalizer = (rel: string, snippet: string) => {
  const src = readSource(rel);
  assert.ok(src.includes('toAsciiDigits'), `${rel} must use toAsciiDigits`);
  assert.ok(src.includes(snippet), `${rel} must contain: ${snippet}`);
};

check('StudentManager search/sort/auto-ID normalize rolls', () => {
  usesNormalizer('components/StudentManager.tsx', 'toAsciiDigits(a.roll');
  usesNormalizer('components/StudentManager.tsx', 'toAsciiDigits(String(s.roll');
  usesNormalizer('components/StudentManager.tsx', 'toAsciiDigits(formData.roll');
});

check('ID-card, web-result and attendance-report sorts normalize rolls', () => {
  usesNormalizer('components/StudentIDCardGenerator.tsx', 'toAsciiDigits(a.roll');
  usesNormalizer('components/WebResultView.tsx', 'toAsciiDigits(a.roll');
  usesNormalizer('components/AttendanceReportView.tsx', 'toAsciiDigits(a.roll');
});

check('PublicResultSearch roll match normalizes both sides', () => {
  usesNormalizer('components/PublicResultSearch.tsx', 'toAsciiDigits(String(s.roll)');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F11 bengali-digit-rolls self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
