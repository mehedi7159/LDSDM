/**
 * RC audit 2026-11-13 — student IDs render with mixed Bengali/English
 * digits (e.g. "2026১০১") — self-check.
 * Run: npx tsx scripts/verify-rc-students-studentid-ascii.ts
 *
 * The Bengali-digit fix (Batch F) normalized roll/rollNumber at save
 * but never the studentId: buildCreateStudentPayload stores a
 * user-typed '2026১০১' verbatim, and resolveUniqueStudentId does not
 * even collide it with its ASCII twin '2026101' — so a Bengali-typed
 * ID and its ASCII twin can coexist as two "different" IDs. The fix
 * normalizes once inside resolveUniqueStudentId (the single choke
 * point every mint path funnels through: StudentManager auto-ID,
 * admission, create builder), on both the preferred ID and the
 * taken-set.
 *
 * Deliberately NOT changed: update never rewrites an already-stored
 * studentId — guardian accounts link on the public studentId
 * (services/guardianScope.ts), so stored mixed IDs ('2026১০১' minted
 * by the pre-fix auto-ID path) are data repair, not a silent edit.
 */
import assert from 'node:assert';

const { toAsciiDigits, resolveUniqueStudentId, buildCreateStudentPayload, buildUpdateStudentPayload } = await import('../services/studentService');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

check('toAsciiDigits converts a mixed-script ID', () => {
  assert.strictEqual(toAsciiDigits('2026১০১'), '2026101');
  assert.strictEqual(toAsciiDigits('2026101'), '2026101');
});

check('create builder stores an ASCII studentId for a Bengali-typed one', () => {
  const res = buildCreateStudentPayload({ name: 'Test', classLevel: 'Play', roll: '১০১', studentId: '2026১০১' } as any);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.student.studentId, '2026101');
  assert.strictEqual(res.student.roll, '101');
});

check('Bengali preferred ID collides with its ASCII twin', () => {
  assert.strictEqual(resolveUniqueStudentId('2026১০১', ['2026101']), '2026102');
});

check('ASCII preferred ID collides with a stored Bengali twin', () => {
  assert.strictEqual(resolveUniqueStudentId('2026101', ['2026১০১']), '2026102');
});

check('ASCII behaviour unchanged (free ID passes, numeric bump, suffix)', () => {
  assert.strictEqual(resolveUniqueStudentId('2026101', []), '2026101');
  assert.strictEqual(resolveUniqueStudentId('2026174', ['2026174']), '2026175');
  assert.strictEqual(resolveUniqueStudentId('STD-1', ['STD-1']), 'STD-1-2');
  assert.strictEqual(resolveUniqueStudentId('STD-১', ['STD-1']), 'STD-1-2');
});

check('update never rewrites an already-stored studentId (data-repair boundary)', () => {
  const existing = { id: 's1', name: 'A', classLevel: 'Play', status: 'Active', studentId: '2026১০১', roll: '101', rollNumber: '101' } as any;
  const res = buildUpdateStudentPayload(existing, { name: 'A2' } as any);
  assert.ok(!res.error, res.error);
  assert.strictEqual(res.student.studentId, '2026১০১', 'stored mixed IDs are repaired as data, not by editing');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: rc-students-studentid-ascii self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
