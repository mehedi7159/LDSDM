/**
 * Student-add cloud badge — self-check (20 Nov 2026, base commit 39351fb).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-student-add-cloud-badge.ts
 * (or npm run test:student-add-cloud-badge).
 *
 * Bug (15 Nov 2026 audit): the amber 'cloud-এ যায়নি' badge appears
 * on teacher add and self-clears in ~20s, but never appears when
 * adding a student, although the green banner works in both cases.
 *
 * Root cause — the save/queue paths differ at the moment of the
 * local save:
 *  - addTeacher queues the new record OPTIMISTICALLY, in the same
 *    step as setTeachers (and the users record in the same step as
 *    setUsers), before its slow provisioning await — so the record
 *    is pending (badged) from the instant of save until
 *    confirmStaffCloudSync succeeds and clears the field.
 *  - addStudent queued NOTHING at apply time. The only student
 *    queueing lived downstream inside confirmStudentsCloudSync
 *    (a delta pre-queue, conditional on diffRecords vs
 *    lastConfirmedRef being non-empty, and only when the caller
 *    remembers to run the confirm at all). So the student-add path
 *    never marked the record pending at save time the way the
 *    teacher path does.
 *
 * Fix contract (mirror addTeacher, same Bug-2 pattern):
 *  - addStudent queues the full new record optimistically, in the
 *    same step as setStudents, and refreshes the pending-payload
 *    badge mirror — so isRecordUnconfirmed('students', id) is true
 *    from the instant of save until cloud confirmation clears it.
 *  - Idempotent with the confirm's own pre-queue: queuePendingPayload
 *    merges same-field upserts by key, so the apply-time queue and
 *    the confirm-time queue can never produce two entries or a
 *    duplicate write; confirmUpsertSuccess still clears the field
 *    on success, and the auto-sync diff still skips queued fields.
 *  - No other save path changes: confirmStudentsCloudSync,
 *    updateStudent, the delete path and the retry are untouched.
 *
 * payloadQueue is a pure module; AppContext is React, so the
 * add-time queueing is covered by source-order assertions (the
 * repo's established grep-proof style, same as
 * verify-users-queue-at-add.ts) plus real unit checks on the queue.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- in-memory localStorage (payloadQueue reads it directly) ----
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const resetQueue = () => store.clear();

const {
  queuePendingPayload,
  readPendingPayloads,
  queuedKeysForField,
  pruneQueueAgainstRemoteData,
  mergeQueuedIntoList,
} = await import('../services/payloadQueue');

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

const STUDENT = { id: 'std-test-001', studentId: '2026177', name: 'Test Student', nameBn: 'টেস্ট ছাত্র', classLevel: 'Class 4', roll: '1', status: 'Active' };
const STUDENT_EDITED = { ...STUDENT, name: 'Test Student Updated' };

function addStudentBody() {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const addStudent = (student');
  assert.ok(start > -1, 'addStudent must exist');
  const end = src.indexOf('const updateStudent = (', start);
  assert.ok(end > start, 'updateStudent must follow addStudent');
  return src.slice(start, end);
}

console.log('--- addStudent queues at apply time, like addTeacher (source checks) ---');

check('addStudent queues the new student record optimistically in the same step as setStudents', () => {
  const body = addStudentBody();
  const setAt = body.indexOf('setStudents(nextStudents)');
  assert.ok(setAt > -1, 'addStudent must setStudents(nextStudents)');
  const queueAt = body.indexOf("queuePendingPayload({ field: 'students', op: 'upsert', records: [finalStudent]");
  assert.ok(queueAt > -1, 'addStudent must queue the new student record at apply time');
  assert.ok(queueAt > setAt, 'students queue call must come after setStudents(nextStudents)');
});

check('addStudent refreshes the pending-payload badge mirror after queueing', () => {
  const body = addStudentBody();
  const queueAt = body.indexOf("queuePendingPayload({ field: 'students', op: 'upsert', records: [finalStudent]");
  assert.ok(queueAt > -1, 'students queue call must exist');
  const refreshAt = body.indexOf('refreshPendingPayloads()', queueAt);
  assert.ok(refreshAt > -1, 'refreshPendingPayloads must follow the students queue call');
});

check('addTeacher still queues teachers at apply time (the pattern being mirrored)', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const addTeacher = async (');
  assert.ok(start > -1, 'addTeacher must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes("queuePendingPayload({ field: 'teachers', op: 'upsert', records: [teacherWithCredentials]"), 'addTeacher must still queue teachers at apply time');
});

console.log('--- Queued student entry behaves like the teacher entry (queue unit checks) ---');

check('a student queued at apply time is pending immediately (before any confirm resolves)', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [STUDENT] });
  assert.ok(queuedKeysForField('students', readPendingPayloads()).has('std-test-001'), 'isRecordUnconfirmed(students, new id) must be true right after the local save');
});

check('apply-time queue + confirm-time pre-queue of the same record merge into ONE entry (no duplicate write)', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [STUDENT] });
  queuePendingPayload({ field: 'students', op: 'upsert', records: [STUDENT] });
  const items = readPendingPayloads();
  assert.strictEqual(items.length, 1, 'same-field upserts must merge, never duplicate');
  assert.strictEqual(items[0].records!.length, 1, 'the merged entry must carry the record once');
});

check('queued student record survives a boot snapshot that lacks it', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [STUDENT] });
  const merged = mergeQueuedIntoList([] as any, 'students');
  assert.ok(merged.some((r: any) => r.id === 'std-test-001'), 'snapshot merge must restore the unconfirmed student record');
  pruneQueueAgainstRemoteData({ students: [], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'queue entry must survive the snapshot that lacks the student');
});

check('queued student record survives a snapshot holding DIFFERENT content for the same id (key alone must not prune)', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [STUDENT_EDITED] });
  pruneQueueAgainstRemoteData({ students: [STUDENT], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'different content must stay queued');
  assert.strictEqual(readPendingPayloads()[0].records![0].name, 'Test Student Updated', 'queued edit content must survive');
});

check('queued student record IS pruned when remote content is equal', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [STUDENT] });
  pruneQueueAgainstRemoteData({ students: [{ ...STUDENT }], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 0, 'equal content means landed');
});

console.log('--- Badge render + confirm-clear paths unchanged ---');

check('StudentManager still badges a row whose id is queued', () => {
  const src = readSource('components/StudentManager.tsx');
  // 21 Nov 2026 v2: rows badge via the isStudentRowBadged predicate
  // (queue check OR recent-save window) instead of the raw queue check.
  assert.ok(src.includes('isStudentRowBadged(student.id)'), 'student rows must badge via isStudentRowBadged');
  const at = src.indexOf('isStudentRowBadged');
  assert.ok(src.slice(at, at + 300).includes("isRecordUnconfirmed('students', id)"), 'the predicate must still badge on the queued key');
  assert.ok(src.includes('<UnconfirmedBadge'), 'UnconfirmedBadge must still render');
});

check('confirmStudentsCloudSync still clears the field on success', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const confirmStudentsCloudSync = async (');
  assert.ok(start > -1, 'confirmStudentsCloudSync must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes("confirmUpsertSuccess('students', list, 'students')"), 'confirm success must still clear the students queue entry');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:student-add-cloud-badge'], 'tsx scripts/verify-student-add-cloud-badge.ts', 'npm run test:student-add-cloud-badge must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: student-add-cloud-badge self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
