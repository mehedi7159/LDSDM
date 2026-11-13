/**
 * Master audit F3 — admission-approved students all got roll '১' —
 * self-check. Run: npx tsx scripts/verify-master-admission-roll.ts
 *
 *  - nextFreeRoll(students, classLevel) returns max numeric roll + 1
 *    in ASCII digits, counting Bengali-digit rolls ('১' = 1) and
 *    ignoring non-numeric rolls.
 *  - AdmissionApplicationManager enrols with that roll instead of
 *    the hardcoded '১'.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { nextFreeRoll, toAsciiDigits } = await import('../services/studentService');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

const student = (over: Record<string, unknown>) => ({ id: `s-${Math.random()}`, name: 'X', ...over } as any);

check('toAsciiDigits converts Bengali digits', () => {
  assert.strictEqual(toAsciiDigits('১'), '1');
  assert.strictEqual(toAsciiDigits('২০২৬০১'), '202601');
  assert.strictEqual(toAsciiDigits('12'), '12');
});

check('nextFreeRoll is max numeric roll + 1 in the target class only', () => {
  const list = [
    student({ classLevel: 'Class 1', roll: '১' }),
    student({ classLevel: 'Class 1', roll: '3' }),
    student({ classLevel: 'Class 1', rollNumber: '৫' }),
    student({ classLevel: 'Class 2', roll: '99' }),
    student({ classLevel: 'Class 1', roll: 'abc' }),
  ];
  assert.strictEqual(nextFreeRoll(list, 'Class 1'), '6');
  assert.strictEqual(nextFreeRoll(list, 'Class 2'), '100');
});

check('nextFreeRoll is 1 for an empty class', () => {
  assert.strictEqual(nextFreeRoll([], 'Class 1'), '1');
  assert.strictEqual(nextFreeRoll([student({ classLevel: 'Class 2', roll: '4' })], 'Class 1'), '1');
});

check('approve & enrol uses nextFreeRoll, never hardcoded ১', () => {
  const src = readSource('components/students/AdmissionApplicationManager.tsx');
  assert.ok(!src.includes("roll: '১'"), 'hardcoded roll ১ must be gone');
  assert.ok(!src.includes("rollNumber: '১'"), 'hardcoded rollNumber ১ must be gone');
  assert.ok(src.includes('nextFreeRoll('), 'approve & enrol must assign the next free roll');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F3 admission-roll self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
