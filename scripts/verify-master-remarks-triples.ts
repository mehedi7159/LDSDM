/**
 * Master audit F10 — remarks table accepts impossible triples —
 * self-check. Run: npx tsx scripts/verify-master-remarks-triples.ts
 *
 *  - validateRemarkAttendance: present + absent must not exceed
 *    working days, all >= 0; returns a message or null.
 *  - cappedAttendanceRate never exceeds 100.
 *  - The Hub validates on change (warns, does not queue the save),
 *    caps the displayed rate, and re-validates on flush.
 *  - updateRemark refuses an invalid numeric update instead of
 *    saving whatever it is given.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { validateRemarkAttendance, cappedAttendanceRate } = await import('../services/dailyAttendanceService');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

check('validateRemarkAttendance accepts valid triples', () => {
  assert.strictEqual(validateRemarkAttendance(20, 18, 2), null);
  assert.strictEqual(validateRemarkAttendance(0, 0, 0), null);
  assert.strictEqual(validateRemarkAttendance(undefined, undefined, undefined), null);
});

check('validateRemarkAttendance refuses impossible triples', () => {
  assert.ok(validateRemarkAttendance(20, 18, 3), 'present + absent > working days must be refused');
  assert.ok(validateRemarkAttendance(10, 11, 0), 'present > working days must be refused');
  assert.ok(validateRemarkAttendance(-1, 0, 0), 'negative working days must be refused');
  assert.ok(validateRemarkAttendance(10, -1, 0), 'negative present must be refused');
});

check('cappedAttendanceRate never exceeds 100', () => {
  assert.strictEqual(cappedAttendanceRate(25, 20), 100);
  assert.strictEqual(cappedAttendanceRate(18, 20), 90);
  assert.strictEqual(cappedAttendanceRate(0, 0), 0);
});

check('Hub validates on change, caps the rate, warns visibly', () => {
  const src = readSource('components/attendance/DailyAttendanceHub.tsx');
  assert.ok(src.includes('validateRemarkAttendance'), 'Hub must validate remark triples');
  assert.ok(src.includes('cappedAttendanceRate'), 'Hub must cap the displayed rate');
  assert.ok(src.includes('remarksWarnings') || src.includes('remarksWarning'), 'Hub must keep a visible warning for invalid triples');
  const changeFn = src.slice(src.indexOf('const handleRemarkFieldChange'), src.indexOf('const handleApplyPresetRemark'));
  assert.ok(changeFn.includes('validateRemarkAttendance'), 'field change must validate before queueing the save');
  assert.ok(!src.includes('Math.round((present / workingDays) * 100)'), 'uncapped rate formula must be gone');
});

check('updateRemark refuses invalid numeric updates', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const updateRemark = (studentId: string, examId: string, data: Partial<RemarkRecord>) => {');
  assert.ok(start > -1, 'updateRemark must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes('validateRemarkAttendance') || body.includes('totalPresent') && body.includes('workingDays'), 'updateRemark must check the triple before saving');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F10 remarks-triples self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
