/**
 * Student-add cloud badge, visible window — self-check (21 Nov 2026, base 0b7c9dd).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-student-add-badge-visible.ts
 * (or npm run test:student-add-badge-visible).
 *
 * Bug (21 Nov 2026 morning audit): adding a student never shows the
 * amber 'cloud-এ যায়নি' badge, while adding a teacher shows it for a
 * few seconds and then it fades. The v1 fix (PR #27) IS in main and its
 * data layer passes 11/11 — addStudent queues the record at apply time
 * exactly like addTeacher. The real root cause is timing, not a missing
 * queue:
 *  - Teacher: addTeacher queues, then AWAITS provisionStaffFirebaseUser
 *    (Auth user creation, seconds) BEFORE returning; StaffManager only
 *    then starts confirmStaffCloudSync. Badge lifetime = provisioning
 *    (seconds) + confirm (~1s) — long enough for a human to see.
 *  - Student: addStudent is synchronous and handleSave fires
 *    confirmStudentsCloudSync in the same tick. The confirm is one
 *    getDoc+setDoc round trip (~1s online) and confirmUpsertSuccess
 *    clears the queue at once — the badge lifetime is ~1s, elapsing
 *    while the modal closes, and the new row sits mid-list (roll sort),
 *    so no human ever catches it. Diagnostics reads the same
 *    pendingPayloads mirror, so it correctly shows nothing either.
 *
 * Fix contract (UI-local, StudentManager only — queue/confirm truth
 * untouched, cloud write NOT delayed):
 *  - The just-added student's id is kept in a recent-save list for a
 *    minimum visible window (STUDENT_BADGE_MIN_VISIBLE_MS = 5000).
 *  - Both row badge spots (cards + table) badge when the record is
 *    unconfirmed OR in the recent-save list.
 *  - The recent-save id clears itself after the window via setTimeout.
 *  - confirmStudentsCloudSync still fires immediately in handleSave
 *    (no setTimeout around it) and still clears the queue on success.
 *  - The badge may show up to the window after the record already
 *    landed — it errs toward "not yet confirmed", never toward a false
 *    success; a failed confirm still badges via the queue until it
 *    really lands.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const sm = () => readSource('components/StudentManager.tsx');
const ctx = () => readSource('context/AppContext.tsx');

function handleSaveBody() {
  const src = sm();
  const start = src.indexOf('const handleSave = ');
  assert.ok(start > -1, 'handleSave must exist');
  const end = src.indexOf('const retryStudentSave = ', start);
  assert.ok(end > start, 'retryStudentSave must follow handleSave');
  return src.slice(start, end);
}

console.log('--- Minimum visible window exists ---');

check('a minimum badge window constant is defined (5s, like the teacher badge lifetime)', () => {
  const src = sm();
  const m = src.match(/STUDENT_BADGE_MIN_VISIBLE_MS\s*=\s*(\d+)/);
  assert.ok(m, 'STUDENT_BADGE_MIN_VISIBLE_MS must be defined');
  assert.strictEqual(Number(m![1]), 5000, 'window must be 5000ms');
});

check('the just-added student id is recorded in a recent-save list in the add branch', () => {
  const body = handleSaveBody();
  const addAt = body.indexOf('const res = addStudent(dataToSave);');
  assert.ok(addAt > -1, 'add branch must call addStudent');
  const markAt = body.indexOf('setRecentStudentSaveIds', addAt);
  assert.ok(markAt > -1, 'add branch must record the saved id in the recent-save list');
  const confirmAt = body.indexOf('void confirmStudentsCloudSync(nextStudents)', addAt);
  assert.ok(confirmAt > markAt, 'the id must be recorded before the background confirm starts');
});

check('the recent-save id clears itself after the window via setTimeout', () => {
  const body = handleSaveBody();
  const markAt = body.indexOf('setRecentStudentSaveIds');
  assert.ok(markAt > -1, 'recent-save marking must exist');
  const timeoutAt = body.indexOf('setTimeout(', markAt);
  assert.ok(timeoutAt > -1, 'a setTimeout must clear the recent-save id');
  const windowAt = body.indexOf('STUDENT_BADGE_MIN_VISIBLE_MS', timeoutAt);
  assert.ok(windowAt > -1 && windowAt - timeoutAt < 300, 'the timeout must use STUDENT_BADGE_MIN_VISIBLE_MS');
});

console.log('--- Both row badge spots use the recent-save list ---');

check('a shared row-badge predicate covers unconfirmed OR recently saved', () => {
  const src = sm();
  const at = src.indexOf('isStudentRowBadged');
  assert.ok(at > -1, 'isStudentRowBadged must exist');
  const def = src.slice(at, at + 300);
  assert.ok(def.includes("isRecordUnconfirmed('students', id)"), 'predicate must keep the queue check');
  assert.ok(def.includes('recentStudentSaveIds'), 'predicate must include the recent-save list');
});

check('cards view badges the row via the shared predicate', () => {
  const src = sm();
  assert.ok(src.includes('isStudentRowBadged(student.id)'), 'row badge must use isStudentRowBadged(student.id)');
  const count = src.split('isStudentRowBadged(student.id)').length - 1;
  assert.ok(count >= 2, `both row spots (cards + table) must use the predicate, found ${count}`);
});

check('no row render still badges on the raw queue check alone', () => {
  const src = sm();
  const count = src.split("isRecordUnconfirmed('students', student.id)").length - 1;
  assert.strictEqual(count, 0, `row renders must not use the raw queue check alone, found ${count}`);
});

console.log('--- Cloud write timing + queue truth untouched ---');

check('the background confirm still fires immediately (not inside a setTimeout)', () => {
  const body = handleSaveBody();
  const confirmAt = body.indexOf('void confirmStudentsCloudSync(nextStudents)');
  assert.ok(confirmAt > -1, 'handleSave must still fire confirmStudentsCloudSync');
  const before = body.slice(Math.max(0, confirmAt - 200), confirmAt);
  assert.ok(!before.includes('setTimeout('), 'the confirm call must not sit inside a setTimeout');
});

check('addStudent still queues the new record at apply time (v1 behaviour kept)', () => {
  const src = ctx();
  const start = src.indexOf('const addStudent = (student');
  assert.ok(start > -1, 'addStudent must exist');
  const body = src.slice(start, src.indexOf('const updateStudent = (', start));
  assert.ok(body.includes("queuePendingPayload({ field: 'students', op: 'upsert', records: [finalStudent]"), 'addStudent must still queue at apply time');
});

check('confirmStudentsCloudSync still clears the field on success', () => {
  const src = ctx();
  const start = src.indexOf('const confirmStudentsCloudSync = async (');
  assert.ok(start > -1, 'confirmStudentsCloudSync must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes("confirmUpsertSuccess('students', list, 'students')"), 'confirm success must still clear the students queue entry');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:student-add-badge-visible'], 'tsx scripts/verify-student-add-badge-visible.ts', 'npm run test:student-add-badge-visible must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.log('--- CHECKS FAILED ---');
  process.exit(1);
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
