/**
 * verify-student-delete-cloud-confirm.ts — scripted proof for the
 * student delete/edit cloud-confirm fix
 * (Branch: fix/student-delete-cloud-confirm, 24 Nov 2026).
 *
 * 24 Nov 2026 morning audit (principal, fresh profile, desktop):
 *   - Today's TEST student was deleted 3 times. Each time it vanished
 *     from the list, then came back within 10-30 seconds (174 -> 175
 *     again). The recycle bin collected 3 duplicate trash entries for
 *     the same student.
 *   - Deleting yesterday's TEST student showed: the student went to
 *     trash on this device but did not reach the cloud. Retry (twice)
 *     did not help. Yesterday's TEST student was STILL ACTIVE this
 *     morning (baseline 174, not 173).
 *   - The first edit of today's TEST student was lost on reload: the
 *     green "saved" banner showed, but the name reverted after reload.
 *     The same edit worked the second time.
 *   - The teacher delete worked normally on the first try.
 *
 * Diagnosis (code-read, main c9eb099a):
 *   (1) ROOT CAUSE, delete: deleteStudent (AppContext) is SYNCHRONOUS
 *       — it removes the student from local state and returns at once,
 *       never confirming the cloud delete. The only confirm lives in
 *       the two UI dialogs, AFTER the local delete, and on failure the
 *       dialog shows the error but the local state is never restored.
 *       The screen shows the student deleted while the cloud still
 *       has it. Contrast deleteTeacher, which AWAITS
 *       confirmDeleteRecordsCloudSync and returns {success, message}.
 *   (2) ROOT CAUSE, resurrection: applyRemoteData's trash filter reads
 *       the render-time `trashBin` closure — but the listener effect
 *       has [] deps, so it is the FIRST render's trashBin forever.
 *       After a failed delete the new trash entry is invisible to the
 *       filter, so the next cloud snapshot re-applies the student.
 *       trashBinRef (fresh, updated on every trashBin change) exists
 *       but is not used there. Fix: collectTrashedIds(data.trashBin,
 *       trashBinRef.current).
 *   (3) Duplicates: deleteStudent mints a fresh trash entry on every
 *       delete without deduping (deleteTeacher uses dedupeTrashEntries
 *       for exactly this reason). Re-deleting a resurrected student
 *       stacks duplicate bin items.
 *   (4) Heavy write: deriveStudentDeleteOp returns the WHOLE trash bin
 *       as trashEntries, so every student delete re-writes every trash
 *       entry to the trash collection (one sequential setDoc each)
 *       inside the 40 s confirm timeout. The teacher path writes only
 *       its new entries. Fix: carry only the deleted students' entries.
 *   (5) Edit: handleSave (StudentManager) shows the green "saved"
 *       banner and closes the modal BEFORE the cloud confirm runs;
 *       the confirm is fire-and-forget. On failure the banner already
 *       said saved; on reload the cloud's old value returns. Contrast
 *       the teacher edit (handleSaveProfileEdit), which awaits
 *       confirmStaffCloudSync and shows success ONLY on success.
 *
 * What must NOT change: no auth/login, no Firestore rules, no
 * result/marksheet files, no real data; trash-first stays (no
 * permanent delete); the queue's Discard path is untouched.
 *
 * Checks:
 *   (1) deriveStudentDeleteOp carries only the deleted students'
 *       trash entries (not the whole bin).
 *   (2) deriveStudentDeleteOp still throws when no trashed student
 *       id is found (existing guard preserved).
 *   (3) mergeQueuedIntoList with a queued delete payload filters the
 *       deleted id out of a snapshot list (snapshot-side protection).
 *   (4) removePendingDeletePayload drops the delete payload for the
 *       given student id and keeps other payloads.
 *   (5) collectTrashedIds carries entry ids AND deleted record ids.
 *   (6) deleteStudent is async, returns {success, message}, and
 *       awaits the student-delete cloud confirm before returning
 *       success.
 *   (7) On confirm failure deleteStudent restores the student to the
 *       local list and drops the queued delete payload for it.
 *   (8) deleteStudent dedupes trash entries (reuses an existing
 *       entry for the same student).
 *   (9) applyRemoteData's trash filter reads trashBinRef.current
 *       (fresh), not the stale trashBin closure.
 *  (10) The delete dialogs use the new async deleteStudent result
 *       (no separate confirmStudentDeleteCloudSync call in the
 *       delete path).
 *  (11) handleSave awaits the cloud confirm for EDITS before any
 *       success is shown, and reverts the local edit on failure
 *       (old value stays visible, no false "saved" banner).
 *  (12) retryStudentSave re-applies the pending list on success.
 *  (13) Teacher delete regression: deleteTeacher still awaits
 *       confirmDeleteRecordsCloudSync and returns {success, message}.
 *  (14) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-student-delete-cloud-confirm.ts
 * (or npm run test:student-delete-cloud-confirm).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const payloadQueue: any = await import('../services/payloadQueue').catch(() => ({}));
const trashRestore: any = await import('../services/trashRestore').catch(() => ({}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// In-memory localStorage stand-in (same as verify-dashboard-layout.ts).
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

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

const appContextSrc = readSource('context/AppContext.tsx');
const studentManagerSrc = readSource('components/StudentManager.tsx');
const staffMobileSrc = readSource('components/StaffMobileApp.tsx');

// Minimal fixtures (only the fields the checks need).
const S1: any = { id: 'std-1', studentId: '2026001', nameBn: 'আবদুল্লাহ', classLevel: 'Class 3' };
const S2: any = { id: 'std-2', studentId: '2026002', nameBn: 'ফাতিমা', classLevel: 'Class 4' };
const S3: any = { id: 'std-3', studentId: '2026003', nameBn: 'মিম', classLevel: 'Class 10' };
const OLD_ENTRY: any = { id: 'trash-old-1', type: 'student', data: S3, deletedAt: '2026-11-20' };
const NEW_ENTRY: any = { id: 'trash-new-1', type: 'student', data: S2, deletedAt: '2026-11-24' };

console.log('--- deriveStudentDeleteOp: carry only the deleted students\' entries ---');

check('(1) trashEntries carries ONLY the deleted students\' entries, not the whole bin', () => {
  assert.strictEqual(typeof cloudConfirm.deriveStudentDeleteOp, 'function', 'deriveStudentDeleteOp must be exported from cloudConfirm');
  // S2 is deleted (not in the list); S3's old entry is for a student still active.
  const op = cloudConfirm.deriveStudentDeleteOp([S1, S3], [OLD_ENTRY, NEW_ENTRY]);
  assert.deepStrictEqual(op.deletedIds, ['std-2'], 'deletedIds must be exactly the trashed student missing from the list');
  assert.strictEqual(op.trashEntries.length, 1, 'trashEntries must carry only the deleted student\'s entry — not the whole bin');
  assert.strictEqual(op.trashEntries[0].id, 'trash-new-1', 'the carried entry must be the new one for the deleted student');
});

check('(2) deriveStudentDeleteOp still throws when no trashed student id is found', () => {
  assert.throws(
    () => cloudConfirm.deriveStudentDeleteOp([S1, S2, S3], [OLD_ENTRY]),
    /no trashed student id/i,
    'with no deleted student the op must refuse instead of guessing'
  );
});

console.log('--- queue: delete payloads protect snapshots, and can be dropped on restore ---');

check('(3) mergeQueuedIntoList with a queued delete payload filters the deleted id out of a snapshot list', () => {
  assert.strictEqual(typeof payloadQueue.mergeQueuedIntoList, 'function', 'mergeQueuedIntoList must be exported from payloadQueue');
  const queued = [{ id: 'q1', op: 'delete', removals: [{ field: 'students', ids: ['std-2'] }], trashEntries: [NEW_ENTRY] }];
  const merged = payloadQueue.mergeQueuedIntoList([S1, S2, S3], 'students', queued);
  assert.deepStrictEqual(merged.map((s: any) => s.id), ['std-1', 'std-3'], 'a snapshot arriving after a failed delete must not resurrect the deleted student while its delete payload is queued');
});

check('(4) removePendingDeletePayload drops the delete payload for the student and keeps other payloads', () => {
  assert.strictEqual(typeof payloadQueue.removePendingDeletePayload, 'function', 'removePendingDeletePayload must be exported from payloadQueue');
  store.clear();
  const del = { id: 'q-del', op: 'delete', removals: [{ field: 'students', ids: ['std-2'] }], trashEntries: [NEW_ENTRY] };
  const up = { id: 'q-up', field: 'students', op: 'upsert', records: [S1] };
  localStorage.setItem('ldsdm_pending_cloud_payloads', JSON.stringify([del, up]));
  payloadQueue.removePendingDeletePayload('students', ['std-2']);
  const remaining = JSON.parse(localStorage.getItem('ldsdm_pending_cloud_payloads') || '[]');
  assert.strictEqual(remaining.length, 1, 'only the delete payload for std-2 must go');
  assert.strictEqual(remaining[0].id, 'q-up', 'the unrelated upsert payload must survive');
  // A second call with no matching payload is a no-op, not a crash.
  payloadQueue.removePendingDeletePayload('students', ['std-2']);
  const still = JSON.parse(localStorage.getItem('ldsdm_pending_cloud_payloads') || '[]');
  assert.strictEqual(still.length, 1, 'removing a non-existent delete payload must change nothing');
});

check('(5) collectTrashedIds carries entry ids AND deleted record ids', () => {
  assert.strictEqual(typeof trashRestore.collectTrashedIds, 'function', 'collectTrashedIds must be exported from trashRestore');
  const ids = trashRestore.collectTrashedIds([NEW_ENTRY]);
  assert.ok(ids.has('trash-new-1'), 'the trash entry id must be collected');
  assert.ok(ids.has('std-2'), 'the deleted record id must be collected');
});

console.log('--- deleteStudent: async, confirmed, restores on failure, dedupes ---');

const deleteStudentStart = appContextSrc.indexOf('const deleteStudent = ');
assert.ok(deleteStudentStart > -1, 'deleteStudent must exist in AppContext');
const deleteStudentBody = appContextSrc.slice(deleteStudentStart, appContextSrc.indexOf('\n  };', deleteStudentStart) + 5);

check('(6) deleteStudent is async, returns {success, message}, and awaits the student-delete cloud confirm', () => {
  assert.ok(/const deleteStudent = async \(/.test(appContextSrc), 'deleteStudent must be async');
  assert.ok(deleteStudentBody.includes('await confirmStudentDeleteCloudSync('), 'deleteStudent must await the cloud confirm before returning success');
  assert.ok(/deleteStudent: \(id: string\) => Promise<\{ success: boolean; message\?: string/.test(appContextSrc), 'the context type must be the async {success, message} shape');
  assert.ok(!/deleteStudent: \(id: string\) => \{ students: Student\[\]; trashBin: TrashItem\[\] \} \| null/.test(appContextSrc), 'the old synchronous signature must be gone');
});

check('(7) on confirm failure deleteStudent restores the student locally and drops the queued delete payload', () => {
  assert.ok(/if \(!result\.success\)/.test(deleteStudentBody), 'deleteStudent must branch on confirm failure');
  const failBranch = deleteStudentBody.slice(deleteStudentBody.indexOf('if (!result.success)'));
  assert.ok(failBranch.includes('removePendingDeletePayload('), 'a failed delete must drop its queued delete payload, or the next snapshot hides the restored record again');
  // Restore: the pre-delete record goes back into the local list.
  assert.ok(/setStudents\(prev =>/.test(failBranch) && /\[\.\.\.prev, st\]/.test(failBranch), 'a failed delete must put the student back in the local list');
  assert.ok(/setTrashBin\(/.test(failBranch), 'a failed delete must also take its trash entry back out of the local bin');
});

check('(8) deleteStudent dedupes trash entries (reuses an existing entry for the same student)', () => {
  assert.ok(
    /existingEntry|dedupeTrashEntries/.test(deleteStudentBody),
    'deleteStudent must not mint a second trash entry when one already exists for the same student'
  );
});

check('(9) applyRemoteData trash filter reads trashBinRef.current (fresh), not the stale trashBin closure', () => {
  const applyStart = appContextSrc.indexOf('const trashedIds = collectTrashedIds(');
  assert.ok(applyStart > -1, 'applyRemoteData must build trashedIds via collectTrashedIds');
  const line = appContextSrc.slice(applyStart, appContextSrc.indexOf('\n', applyStart));
  assert.ok(line.includes('trashBinRef.current'), `trashedIds must read trashBinRef.current, got: ${line.trim()}`);
  assert.ok(!line.includes(', trashBin)'), 'trashedIds must not read the stale render-time trashBin closure');
});

console.log('--- callers: dialogs use the async deleteStudent result ---');

check('(10) the delete dialogs use the new async deleteStudent result (no separate confirm call in the delete path)', () => {
  assert.ok(/await deleteStudent\(/.test(studentManagerSrc), 'StudentManager delete dialog must await deleteStudent');
  assert.ok(!studentManagerSrc.includes('confirmStudentDeleteCloudSync('), 'StudentManager must not call confirmStudentDeleteCloudSync separately — deleteStudent confirms internally');
  assert.ok(/await deleteStudent\(/.test(staffMobileSrc), 'StaffMobileApp delete handler must await deleteStudent');
  assert.ok(!staffMobileSrc.includes('confirmStudentDeleteCloudSync(pendingStudentDelete'), 'StaffMobileApp must not re-confirm a stored pending delete — the retry is a fresh deleteStudent call');
});

console.log('--- edit: no false "saved" before the cloud confirm ---');

const handleSaveStart = studentManagerSrc.indexOf('const handleSave = ');
assert.ok(handleSaveStart > -1, 'handleSave must exist in StudentManager');
const handleSaveBody = studentManagerSrc.slice(handleSaveStart, studentManagerSrc.indexOf('\n  // Retry re-confirms', handleSaveStart));

check('(11) handleSave awaits the cloud confirm for EDITS before any success, and reverts the local edit on failure', () => {
  assert.ok(handleSaveBody.includes('await confirmStudentsCloudSync(nextStudents)'), 'the edit path must await the cloud confirm');
  // The edit branch must not show success before the await.
  const editBranch = handleSaveBody.slice(handleSaveBody.indexOf('if (editingId)'));
  const awaitPos = editBranch.indexOf('await confirmStudentsCloudSync');
  assert.ok(awaitPos > -1, 'the edit branch must contain the awaited confirm');
  assert.ok(!editBranch.slice(0, awaitPos).includes('setSuccess(true)'), 'no "saved" banner may show before the confirm resolves');
  // Failure path: revert + clear the queued upsert so the revert sticks.
  assert.ok(handleSaveBody.includes('bulkUpdateStudents('), 'a failed edit must revert the local list (old value stays visible)');
  assert.ok(handleSaveBody.includes('removePendingPayloadRecords('), 'a failed edit must drop its queued upsert, or the next snapshot re-applies the unconfirmed new value');
});

check('(12) retryStudentSave re-applies the pending list on success', () => {
  const retryStart = studentManagerSrc.indexOf('const retryStudentSave = ');
  assert.ok(retryStart > -1, 'retryStudentSave must exist');
  const retryBody = studentManagerSrc.slice(retryStart, studentManagerSrc.indexOf('\n  const handleSubmit', retryStart));
  assert.ok(retryBody.includes('bulkUpdateStudents('), 'a successful retry must re-apply the pending (reverted) list locally');
});

console.log('--- teacher delete regression ---');

check('(13) deleteTeacher still awaits confirmDeleteRecordsCloudSync and returns {success, message}', () => {
  const teacherStart = appContextSrc.indexOf('const deleteTeacher = async (');
  assert.ok(teacherStart > -1, 'deleteTeacher must exist and stay async');
  const teacherBody = appContextSrc.slice(teacherStart, appContextSrc.indexOf('\n  };', teacherStart) + 5);
  assert.ok(teacherBody.includes('await confirmDeleteRecordsCloudSync('), 'deleteTeacher must still await the delete writer');
  assert.ok(teacherBody.includes('return { success: false, message: cloudSync.message }'), 'deleteTeacher must still report a failed confirm instead of a false success');
});

console.log('--- wiring ---');

check('(14) package.json exposes test:student-delete-cloud-confirm', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts?.['test:student-delete-cloud-confirm'], 'tsx scripts/verify-student-delete-cloud-confirm.ts');
});

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
