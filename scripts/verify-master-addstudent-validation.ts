/**
 * Master audit F2 — addStudent must not save unvalidated records —
 * self-check. Run: npx tsx scripts/verify-master-addstudent-validation.ts
 *
 *  - buildCreateStudentPayload refuses a nameless / classless student
 *    with { student: null, error } (pure check).
 *  - addStudent / updateStudent in AppContext read that error and
 *    return it (Job 2 pattern, like addClass/addSubject) instead of
 *    falling back to the raw input — nothing is saved on refusal.
 *  - The three callers surface the error instead of showing success:
 *    StudentManager (add + edit), AdmissionApplicationManager
 *    (approve & enrol), PortalsServicesManager (admit applicant).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { buildCreateStudentPayload, buildUpdateStudentPayload } = await import('../services/studentService');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

// AppContext function bodies (React, so source assertions).
const fnBody = (src: string, startMarker: string) => {
  const start = src.indexOf(startMarker);
  assert.ok(start > -1, `${startMarker} must exist`);
  return src.slice(start, src.indexOf('\n  };', start));
};

check('builder refuses a nameless, classless student', () => {
  const res = buildCreateStudentPayload({ name: '', classLevel: '' } as any);
  assert.strictEqual(res.student, null, 'student must be null on refusal');
  assert.ok(res.error && res.error.length > 0, 'an error message must be returned');
  const res2 = buildCreateStudentPayload({ name: 'Test', classLevel: '' } as any);
  assert.strictEqual(res2.student, null, 'classless student must also be refused');
  assert.ok(res2.error);
});

check('builder refuses an invalid update, returning the unchanged record', () => {
  const existing = { id: 's1', name: 'A', classLevel: 'Class 1', status: 'Active' } as any;
  const res = buildUpdateStudentPayload(existing, { ...existing, name: '' } as any);
  assert.strictEqual(res.student, existing, 'refused update must return the unchanged record');
  assert.ok(res.error);
});

check('addStudent returns the builder error, no raw fallback', () => {
  const src = readSource('context/AppContext.tsx');
  const body = fnBody(src, 'const addStudent = (student: Omit<Student, \'id\'>) => {');
  assert.ok(body.includes('error'), 'addStudent must read the builder error');
  assert.ok(body.includes('return { student: null, students, error'), 'addStudent must return the error like addClass');
  assert.ok(!body.includes('finalStudent = newStudent ||'), 'raw-input fallback must be gone');
  assert.ok(!body.includes('id: generateId()'), 'addStudent must not mint an id for an unvalidated record');
});

check('updateStudent returns the builder error instead of silently no-oping', () => {
  const src = readSource('context/AppContext.tsx');
  const body = fnBody(src, 'const updateStudent = (updatedStudent: Student) => {');
  assert.ok(body.includes('const { student: finalStudent, error } = buildUpdateStudentPayload'), 'updateStudent must read the builder error');
  assert.ok(body.includes('return { student: existing, students, error }'), 'refused update must return the error like updateSubject');
});

check('StudentManager surfaces add/edit errors instead of success', () => {
  const src = readSource('components/StudentManager.tsx');
  assert.ok(src.includes('res.error'), 'StudentManager must check the returned error');
  assert.ok(src.includes('setError'), 'StudentManager must show the error in the modal');
});

check('AdmissionApplicationManager refuses a failed enrolment visibly', () => {
  const src = readSource('components/students/AdmissionApplicationManager.tsx');
  const start = src.indexOf('const added = addStudent({');
  assert.ok(start > -1, 'approve & enrol must call addStudent');
  const body = src.slice(start, src.indexOf('enrollingRef.current.add(app.id);', start));
  assert.ok(body.includes('added.error'), 'approve & enrol must check added.error');
  assert.ok(body.includes("type: 'error'"), 'a failed enrolment must toast an error, not success');
});

check('PortalsServicesManager refuses a failed admit visibly', () => {
  const src = readSource('components/portals/PortalsServicesManager.tsx');
  const start = src.indexOf('const added = addStudent(newStudentData as any);');
  assert.ok(start > -1, 'admit path must call addStudent');
  const body = src.slice(start, src.indexOf('const updated = admissions.map', start));
  assert.ok(body.includes('added.error'), 'admit path must check added.error');
  assert.ok(body.includes('showError'), 'a failed admit must show the error');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F2 addStudent-validation self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
