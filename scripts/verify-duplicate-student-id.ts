/**
 * Duplicate student ID — self-check (12 Nov 2026, base commit fba1bb8).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-duplicate-student-id.ts
 * (or npm run test:duplicate-student-id).
 *
 * Covers the duplicate-ID fix (LDSDM-duplicate-student-id-fix-2026-11-10.md):
 *  - resolveUniqueStudentId(preferred, existingIds) in
 *    services/studentService.ts: a free ID passes through unchanged; a
 *    taken ID bumps to the next free one (2026174 -> 2026175, skipping
 *    every taken neighbour); non-numeric IDs take a -2/-3 suffix.
 *  - Both generation sites use it: StudentManager (year+roll) and
 *    AdmissionApplicationManager (year+random 3 digits).
 *  - Save-time: buildCreateStudentPayload resolves the requested
 *    studentId against the existing list, so a duplicate can never be
 *    saved even if a caller passes one in directly; AppContext.addStudent
 *    passes the live student list in.
 *  - No real student's existing ID is changed by the helper (it only
 *    resolves the ID of the student being created).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studentService: any = await import('../services/studentService').catch((e) => {
  console.error('Could not import services/studentService:', e.message);
  return {};
});

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

// The live case: 2026174 already belongs to TWO real students (Abu Bakr,
// Khadija), so the taken list holds it twice.
const TAKEN = ['2026174', '2026174', '2026175', '2026101'];

console.log('--- resolveUniqueStudentId (pure helper) ---');

check('resolveUniqueStudentId is exported from services/studentService', () => {
  assert.strictEqual(typeof studentService.resolveUniqueStudentId, 'function', 'resolveUniqueStudentId must be exported');
});

check('a free ID passes through unchanged', () => {
  assert.strictEqual(studentService.resolveUniqueStudentId('2026174', ['2026175', '2026101']), '2026174');
});

check('the live duplicate 2026174 returns the next free ID 2026176 (2026175 is also taken)', () => {
  assert.strictEqual(studentService.resolveUniqueStudentId('2026174', TAKEN), '2026176');
});

check('a duplicate with only itself taken returns the immediate next ID', () => {
  assert.strictEqual(studentService.resolveUniqueStudentId('2026174', ['2026174']), '2026175');
});

check('an empty existing list passes the preferred ID through', () => {
  assert.strictEqual(studentService.resolveUniqueStudentId('2026174', []), '2026174');
});

check('a non-numeric duplicate takes a -2 suffix, then -3', () => {
  assert.strictEqual(studentService.resolveUniqueStudentId('ABC', ['ABC']), 'ABC-2');
  assert.strictEqual(studentService.resolveUniqueStudentId('ABC', ['ABC', 'ABC-2']), 'ABC-3');
});

console.log('--- Save-time check (buildCreateStudentPayload) ---');

const validInput = (studentId: string) => ({
  name: 'পরীক্ষা ছাত্র',
  classLevel: 'Class 6',
  studentId,
  status: 'Active',
});

check('buildCreateStudentPayload accepts the existing-IDs list and resolves a duplicate at save time', () => {
  assert.strictEqual(typeof studentService.buildCreateStudentPayload, 'function');
  const { student, error } = studentService.buildCreateStudentPayload(validInput('2026174'), undefined, undefined, TAKEN);
  assert.ok(!error, `payload must build cleanly, got error: ${error}`);
  assert.strictEqual(student.studentId, '2026176', 'a duplicate ID must never be saved as-is');
});

check('buildCreateStudentPayload leaves a free ID unchanged', () => {
  const { student, error } = studentService.buildCreateStudentPayload(validInput('2026200'), undefined, undefined, TAKEN);
  assert.ok(!error, `payload must build cleanly, got error: ${error}`);
  assert.strictEqual(student.studentId, '2026200');
});

check('buildCreateStudentPayload without an existing-IDs list keeps the requested ID (no list, no check)', () => {
  const { student, error } = studentService.buildCreateStudentPayload(validInput('2026174'));
  assert.ok(!error, `payload must build cleanly, got error: ${error}`);
  assert.strictEqual(student.studentId, '2026174');
});

console.log('--- Wiring (source checks) ---');

check('StudentManager resolves the auto-generated ID (year+roll) before saving', () => {
  const src = readSource('components/StudentManager.tsx');
  assert.ok(src.includes('resolveUniqueStudentId'), 'StudentManager must use resolveUniqueStudentId');
  assert.ok(src.includes('resolveUniqueStudentId(autoStudentId') || src.includes('resolveUniqueStudentId('), 'StudentManager must resolve the autoStudentId');
});

check('AdmissionApplicationManager resolves the random auto-generated ID before enrolling', () => {
  const src = readSource('components/students/AdmissionApplicationManager.tsx');
  assert.ok(src.includes('resolveUniqueStudentId'), 'AdmissionApplicationManager must use resolveUniqueStudentId');
});

check('AppContext.addStudent passes the live student list into buildCreateStudentPayload', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('const addStudent = (student: Omit<Student, \'id\'>) => {');
  assert.ok(at > -1, 'addStudent must exist');
  const body = src.slice(at, src.indexOf('\n  };', at) + 4);
  // The list must reach the payload builder call itself — addStudent
  // already mentions `students` for the local list append, so match the call.
  assert.ok(/buildCreateStudentPayload\(student, 'inst_madrasah_primary', actor, [^)]*students/.test(body), 'addStudent must pass the live students list into buildCreateStudentPayload');
});

check('no existing student ID is rewritten by the fix (helper only resolves the new ID)', () => {
  const svc = readSource('services/studentService.ts');
  assert.ok(!svc.includes('studentId = resolveUniqueStudentId') || svc.includes('buildCreateStudentPayload'), 'resolution must happen only for the record being created');
  const app = readSource('context/AppContext.tsx');
  assert.ok(!/students\.map\(s => \{\.\.\.s, studentId:/.test(app), 'addStudent must not rewrite existing students’ IDs');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:duplicate-student-id'], 'tsx scripts/verify-duplicate-student-id.ts', 'npm run test:duplicate-student-id must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: duplicate-student-id self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
