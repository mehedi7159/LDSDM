/**
 * Teacher add/edit form has no subject picker — self-check (13 Nov 2026, base 1ae40db).
 *
 * Bug (2026-11-13 morning audit): adding a teacher in Staff Hub has nowhere
 * to set the subject (e.g. গণিত), so the teacher is added with no subject.
 * Root cause, read from the code (not assumed): the teacher record already
 * carries `assignedSubjects: string[]` (types.ts AcademicTeacher), the add
 * form state starts with `assignedSubjects: []`, the edit flow prefills it
 * via `{...teacher}`, and BOTH save branches pass it through
 * (`assignedSubjects: teacherFormData.assignedSubjects || []`) — but the
 * add/edit modal form itself has no picker for it. Only the sibling
 * Assigned Classes chip picker exists; the approval dialog (same file)
 * already has the subjects chip pattern, but the direct-add path never
 * offers it, so a directly added teacher always lands with `[]`.
 *
 * Why the Academic page is NOT the fix: SubjectManager's teacher_assignment
 * tab writes per-class TeacherSubjectAssignment records
 * ({classId, subjectId, teacherId}) — "গণিত in Play" — and never writes
 * `teacher.assignedSubjects`. It cannot fill the staff card's
 * "দায়িত্বপ্রাপ্ত বিষয়" line, and it needs a class picked first. The
 * teacher-level subject belongs in the Staff Hub add/edit form, mirroring
 * the approval dialog's chip picker (same stored format: subject names).
 *
 * One wrinkle the approval dialog ignores: `subjects` holds one record per
 * class, so one name (e.g. গণিত) repeats across classes. The form picker
 * must iterate a name-deduped list, or the same chip renders twice.
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-teacher-add-subject-field.ts
 * (or npm run test:teacher-add-subject).
 *
 * Covers (static, source-level):
 *  - The add/edit modal form contains an Assigned Subjects chip picker
 *    that toggles subject names into teacherFormData.assignedSubjects.
 *  - The picker iterates a name-deduped subjects list (no duplicate chips
 *    for one subject taught in several classes).
 *  - Regression guards, already true before the fix: add + edit save
 *    branches pass assignedSubjects through, edit prefills it, the
 *    approval-dialog subjects picker is untouched, and the Academic page
 *    still owns per-class TeacherSubjectAssignment (not this field).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

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

const STAFF = 'components/staff/StaffManager.tsx';
const src = readSource(STAFF);

/** The add/edit modal form: from its marker to the delete-confirm modal. */
function formRegion(): string {
  const start = src.indexOf('{/* Add / Edit Staff Modal */}');
  const end = src.indexOf('{/* Delete Staff Confirm Modal */}', start);
  assert.ok(start !== -1, 'add/edit modal marker missing');
  assert.ok(end !== -1 && end > start, 'delete-confirm modal marker missing');
  return src.slice(start, end);
}
const form = formRegion();

console.log('--- Add/edit form: subject picker present ---');

check('form has an Assigned Subjects section writing teacherFormData.assignedSubjects', () => {
  assert.ok(form.includes('assignedSubjects'), 'form must mention assignedSubjects');
  assert.ok(
    /setTeacherFormData\(\{\s*\.\.\.teacherFormData,\s*assignedSubjects:/.test(form),
    'form must toggle teacherFormData.assignedSubjects via setTeacherFormData'
  );
});

check('picker chips come from the subjects list and toggle by subject name', () => {
  // The picker maps a subjects-derived list and toggles s.name in/out.
  assert.ok(/\.map\(s => \{/.test(form), 'form must map over a subjects list with chip buttons');
  assert.ok(form.includes("approveSubjects") === false, 'form picker must use its own state, not the approval dialog state');
  assert.ok(
    /\.filter\(\w+ => \w+ !== s\.name\)/.test(form),
    'deselect must remove s.name from assignedSubjects'
  );
  assert.ok(
    /\[\.\.\.\w+, s\.name\]/.test(form),
    'select must append s.name to assignedSubjects'
  );
});

check('picker iterates a name-deduped subjects list, not raw subjects', () => {
  // `subjects` repeats one name per class — the picker must not map it raw.
  assert.ok(
    !/subjects\.map\(s => \{/.test(form),
    'form must NOT map raw subjects (one record per class = duplicate chips)'
  );
  // Anchor on the memo body itself: a lazy `[\s\S]*?` from an earlier
  // useMemo would span across memos and name the wrong one.
  const m = src.match(/const (\w+) = useMemo\(\(\) => \{\s*const byName = new Map<string, Subject>\(\);\s*subjects\.forEach/);
  assert.ok(m, 'a useMemo deduping subjects by name must exist');
  assert.ok(form.includes(`${m[1]}.map(`), `form picker must iterate the deduped list (${m[1]})`);
});

console.log('--- Regression guards (true before and after the fix) ---');

check('add branch still saves assignedSubjects', () => {
  assert.ok(
    src.includes('assignedSubjects: teacherFormData.assignedSubjects || []'),
    'add/edit save must pass teacherFormData.assignedSubjects through'
  );
});

check('edit flow still prefills assignedSubjects from the stored teacher', () => {
  const editStart = src.indexOf('const handleOpenEditModal');
  const editEnd = src.indexOf('const handleSaveTeacher', editStart);
  const edit = src.slice(editStart, editEnd);
  assert.ok(edit.includes('...teacher'), 'edit open must spread the stored teacher (carries assignedSubjects)');
});

check('approval dialog subjects picker untouched', () => {
  assert.ok(src.includes('approveSubjects.includes(s.name)'), 'approval dialog must keep its subjects picker');
  assert.ok(src.includes('assignedSubjects: approveSubjects'), 'approval must keep saving assignedSubjects');
});

check('Academic page still owns per-class assignment (not this field)', () => {
  const subj = readSource('components/SubjectManager.tsx');
  assert.ok(subj.includes('assignTeacherToSubject'), 'SubjectManager must keep per-class teacher assignment');
  assert.ok(!subj.includes('assignedSubjects'), 'SubjectManager must not write teacher.assignedSubjects');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:teacher-add-subject'], 'tsx scripts/verify-teacher-add-subject-field.ts');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: teacher add/edit form still has no subject picker.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
