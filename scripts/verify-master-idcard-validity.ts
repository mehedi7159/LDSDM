/**
 * Master audit F8 — ID-card validity hardcoded to "December 2026" —
 * self-check. Run: npx tsx scripts/verify-master-idcard-validity.ts
 *
 *  - defaultIdCardValidity derives "Month YYYY" from the current
 *    academic year's end date, falling back to December of the
 *    current calendar year — never a hardcoded month.
 *  - StudentIDCardGenerator uses it as the initial value and offers
 *    an editable validity field (ID-card mode), so the printed
 *    মেয়াদ never silently expires.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { defaultIdCardValidity } = await import('../services/academicYearService');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

const year = (over: Record<string, unknown>) => ({ id: 'y1', name: '2026', status: 'ACTIVE', isCurrent: false, ...over } as any);

check('validity follows the current academic year end date', () => {
  const years = [year({ isCurrent: false, endDate: '2025-12-31' }), year({ isCurrent: true, endDate: '2026-12-31' })];
  assert.strictEqual(defaultIdCardValidity(years), 'December 2026');
  assert.strictEqual(defaultIdCardValidity([year({ isCurrent: true, endDate: '2027-06-30' })]), 'June 2027');
});

check('validity falls back to December of the current year', () => {
  const fallback = `December ${new Date().getFullYear()}`;
  assert.strictEqual(defaultIdCardValidity([]), fallback);
  assert.strictEqual(defaultIdCardValidity([year({ isCurrent: true })]), fallback);
});

check('generator derives validity and lets the admin edit it', () => {
  const src = readSource('components/StudentIDCardGenerator.tsx');
  assert.ok(!src.includes("useState<string>('December 2026')"), 'hardcoded December 2026 must be gone');
  assert.ok(src.includes('defaultIdCardValidity'), 'generator must derive validity from the academic year');
  assert.ok(src.includes('setValidUntil'), 'generator must offer an editable validity field');
  assert.ok(src.includes('academicYears'), 'generator must read academicYears from context');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F8 idcard-validity self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
