/**
 * verify-student-delete-reload-race.ts — scripted proof for the
 * student delete reload-race fix
 * (Branch: fix/student-delete-reload-race, 25 Nov 2026).
 *
 * 25 Nov 2026 morning audit (principal, fresh profile, desktop):
 *   - Deleting a TEST student then reloading IMMEDIATELY brought the
 *     student back; editing a name then reloading immediately reverted
 *     it. Waiting 30 s kept both.
 *   - The delete/edit itself was fine — the write just never landed
 *     before the reload killed it.
 *
 * Diagnosis (code-read, main c4761fbd):
 *   (1) ROOT CAUSE: confirmStudentDeleteCloudSync queues the delete
 *       payload ONLY in its failure branch — AFTER the cloud write
 *       fails. While the write runs (up to 90 s for students) nothing
 *       is queued, so a reload mid-write aborts it and leaves no
 *       trace: the next boot's snapshot resurrects the student.
 *       Contrast confirmStudentsCloudSync (upserts): it queues the
 *       delta SYNCHRONOUSLY before the confirm starts, with the
 *       comment "queueing only on failure leaves nothing behind".
 *   (2) Trash-duplicate edge case: deriveStudentDeleteOp carries
 *       EVERY bin entry for the deleted student. A bin holding two
 *       entries for one student (minted before the PR #72 delete
 *       dedupe, or via another path) re-adds the duplicate to the
 *       cloud bin on every delete write — the writer merges trash
 *       entries by entry id, so both survive.
 *   (3) Restore hole the pre-queue opens: restoreFromTrash /
 *       restoreAllFromTrash never void a queued delete for the
 *       restored record. Once deletes are pre-queued, a restore
 *       followed by a retry would replay the delete and undo the
 *       restore silently. The mirror guard already exists the other
 *       way (voidQueuedRestoreUpsertsForKeys on re-trash /
 *       permanent delete) — restores need the same treatment via
 *       removePendingDeletePayload.
 *
 * What must NOT change: no auth/login, no Firestore rules, no
 * result/marksheet files, no real data; trash-first stays; the
 * success path still clears the queued delete; a failed delete
 * still restores the record visibly and drops its queued delete.
 *
 * Checks:
 *   (1) confirmStudentDeleteCloudSync queues the delete BEFORE the
 *       cloud write runs (same op the failure branch re-queues).
 *   (2) The pre-queued payload carries exactly the derived op
 *       (students removals + trashEntries + actor).
 *   (3) The failure branch still re-queues the same delete
 *       (regression — merged by key, no duplicate write).
 *   (4) deriveStudentDeleteOp dedupes trash entries: two bin
 *       entries for one deleted student carry ONE entry, ONE id.
 *   (5) deriveStudentDeleteOp single-entry regression (carry only
 *       the deleted students' entries; still throws when none).
 *   (6) restoreFromTrash voids the queued delete for the restored
 *       record, before the restore write fires.
 *   (7) restoreAllFromTrash voids queued deletes for every
 *       restored record.
 *   (8) removePendingDeletePayload is per-id: voiding std-2 leaves
 *       std-3's queued delete untouched.
 *   (9) mergeQueuedIntoList with a queued delete filters the id
 *       from a students snapshot AND re-appends its trash entry to
 *       a trashBin snapshot (the reload case).
 *  (10) retryPendingCloudConfirms replays queued delete items via
 *       writeDeleteFieldsToCloud (the pre-queued delete lands).
 *  (11) package.json exposes test:student-delete-reload-race.
 *
 * Run: npx tsx scripts/verify-student-delete-reload-race.ts
 * (or npm run test:student-delete-reload-race).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudConfirm: any = await import('../services/cloudConfirm').catch(() => ({}));
const payloadQueue: any = await import('../services/payloadQueue').catch(() => ({}));

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

// Minimal fixtures (only the fields the checks need).
const S1: any = { id: 'std-1', studentId: '2026001', nameBn: 'আবদুল্লাহ', classLevel: 'Class 3' };
const S2: any = { id: 'std-2', studentId: '2026002', nameBn: 'ফাতিমা', classLevel: 'Class 4' };
const S3: any = { id: 'std-3', studentId: '2026003', nameBn: 'মিম', classLevel: 'Class 10' };
const OLD_ENTRY: any = { id: 'trash-old-1', type: 'student', data: S3, deletedAt: '2026-11-20' };
const NEW_ENTRY: any = { id: 'trash-new-1', type: 'student', data: S2, deletedAt: '2026-11-24' };
const DUP_ENTRY: any = { id: 'trash-new-2', type: 'student', data: S2, deletedAt: '2026-11-25' };

// confirmStudentDeleteCloudSync body (function slice, same technique as
// verify-student-delete-cloud-confirm.ts).
const confirmStart = appContextSrc.indexOf('const confirmStudentDeleteCloudSync = async (');
assert.ok(confirmStart > -1, 'confirmStudentDeleteCloudSync must exist in AppContext');
const confirmBody = appContextSrc.slice(confirmStart, appContextSrc.indexOf('\n  };', confirmStart) + 5);
const writePos = confirmBody.indexOf('confirmCloudWrite(');
assert.ok(writePos > -1, 'confirmStudentDeleteCloudSync must call confirmCloudWrite');

console.log('--- pre-queue: the delete is queued BEFORE the cloud write ---');

check("(1) confirmStudentDeleteCloudSync queues the delete BEFORE the cloud write runs", () => {
  const queuePos = confirmBody.indexOf("queuePendingPayload({ op: 'delete'");
  assert.ok(queuePos > -1, 'confirmStudentDeleteCloudSync must queue a delete payload');
  assert.ok(queuePos < writePos, 'the delete must be queued BEFORE confirmCloudWrite runs — queueing only on failure leaves nothing behind when the tab reloads mid-write');
});

check('(2) the pre-queued payload carries exactly the derived op', () => {
  const preQueue = confirmBody.slice(0, writePos);
  assert.ok(preQueue.includes("removals: [{ field: 'students', ids: op.deletedIds }]"), 'the pre-queued removals must name the derived deleted ids');
  assert.ok(preQueue.includes('trashEntries: op.trashEntries'), 'the pre-queued payload must carry the derived trash entries');
  assert.ok(preQueue.includes('updatedBy: confirmActorName()'), 'the pre-queued payload must carry the actor');
  assert.ok(preQueue.includes('refreshPendingPayloads()'), 'the pre-queue must refresh the pending list so the badge/retry sees it at once');
});

check('(3) the failure branch still re-queues the same delete (merged by key)', () => {
  const failBranch = confirmBody.slice(writePos);
  assert.ok(failBranch.includes("queuePendingPayload({ op: 'delete'"), 'the failure branch must still queue the delete — a confirm that fails after the tab stayed open still needs the retry entry');
  assert.ok(failBranch.includes('trashEntries: op.trashEntries'), 'the failure re-queue must carry the same trash entries (queuePendingPayload merges by key, so no duplicate write)');
});

console.log('--- deriveStudentDeleteOp: one trash entry per deleted student ---');

check('(4) deriveStudentDeleteOp dedupes trash entries for one deleted student', () => {
  assert.strictEqual(typeof cloudConfirm.deriveStudentDeleteOp, 'function', 'deriveStudentDeleteOp must be exported from cloudConfirm');
  // S2 is deleted (not in the list); the bin holds TWO entries for S2
  // (legacy duplicate) plus S3's old entry for a still-active student.
  const op = cloudConfirm.deriveStudentDeleteOp([S1, S3], [OLD_ENTRY, NEW_ENTRY, DUP_ENTRY]);
  assert.deepStrictEqual(op.deletedIds, ['std-2'], 'deletedIds must name the deleted student once, not once per bin entry');
  assert.strictEqual(op.trashEntries.length, 1, 'trashEntries must carry ONE entry per deleted student — carrying both re-adds the duplicate to the cloud bin on every delete write');
  assert.strictEqual(op.trashEntries[0].id, 'trash-new-1', 'the kept entry must be the first one for the deleted student');
});

check('(5) deriveStudentDeleteOp single-entry regression (carry only the deleted entries; throw when none)', () => {
  const op = cloudConfirm.deriveStudentDeleteOp([S1, S3], [OLD_ENTRY, NEW_ENTRY]);
  assert.deepStrictEqual(op.deletedIds, ['std-2'], 'deletedIds must be exactly the trashed student missing from the list');
  assert.strictEqual(op.trashEntries.length, 1, 'trashEntries must carry only the deleted student\'s entry — not the whole bin');
  assert.strictEqual(op.trashEntries[0].id, 'trash-new-1', 'the carried entry must be the new one for the deleted student');
  assert.throws(
    () => cloudConfirm.deriveStudentDeleteOp([S1, S2, S3], [OLD_ENTRY]),
    /no trashed student id/i,
    'with no deleted student the op must refuse instead of guessing'
  );
});

console.log('--- restore: a restore voids the queued delete for that record ---');

const restoreStart = appContextSrc.indexOf('const restoreFromTrash = ');
assert.ok(restoreStart > -1, 'restoreFromTrash must exist in AppContext');
const restoreBody = appContextSrc.slice(restoreStart, appContextSrc.indexOf('\n  };', restoreStart) + 5);

check('(6) restoreFromTrash voids the queued delete for the restored record, before the restore write', () => {
  assert.ok(restoreBody.includes('removePendingDeletePayload('), 'a restore must cancel the queued delete for the restored record, or the next retry replays it and deletes a record the user was told is back');
  const voidPos = restoreBody.indexOf('removePendingDeletePayload(');
  const writeCall = restoreBody.indexOf('confirmTrashOpCloudSync(');
  assert.ok(voidPos > -1 && writeCall > -1 && voidPos < writeCall, 'the queued delete must be voided BEFORE the restore write fires');
});

const restoreAllStart = appContextSrc.indexOf('const restoreAllFromTrash = ');
assert.ok(restoreAllStart > -1, 'restoreAllFromTrash must exist in AppContext');
const restoreAllBody = appContextSrc.slice(restoreAllStart, appContextSrc.indexOf('\n  };', restoreAllStart) + 5);

check('(7) restoreAllFromTrash voids queued deletes for every restored record', () => {
  assert.ok(restoreAllBody.includes('removePendingDeletePayload('), 'a restore-all must cancel the queued deletes for the restored records, or the next retry deletes them again');
});

console.log('--- queue: voiding is per-id, and a queued delete protects the snapshot ---');

check('(8) removePendingDeletePayload is per-id: voiding std-2 leaves std-3\'s queued delete untouched', () => {
  assert.strictEqual(typeof payloadQueue.removePendingDeletePayload, 'function', 'removePendingDeletePayload must be exported from payloadQueue');
  store.clear();
  const del = { id: 'q-del', op: 'delete', removals: [{ field: 'students', ids: ['std-2', 'std-3'] }], trashEntries: [NEW_ENTRY] };
  localStorage.setItem('ldsdm_pending_cloud_payloads', JSON.stringify([del]));
  payloadQueue.removePendingDeletePayload('students', ['std-2']);
  const remaining = JSON.parse(localStorage.getItem('ldsdm_pending_cloud_payloads') || '[]');
  assert.strictEqual(remaining.length, 1, 'the delete item must survive while it still covers std-3');
  assert.deepStrictEqual(remaining[0].removals[0].ids, ['std-3'], 'only std-2 must be voided — std-3\'s delete must still replay');
});

check('(9) mergeQueuedIntoList with a queued delete filters the id from a students snapshot AND re-appends its trash entry', () => {
  assert.strictEqual(typeof payloadQueue.mergeQueuedIntoList, 'function', 'mergeQueuedIntoList must be exported from payloadQueue');
  const queued = [{ id: 'q1', op: 'delete', removals: [{ field: 'students', ids: ['std-2'] }], trashEntries: [NEW_ENTRY] }];
  // Snapshot arriving after the reload still holds the student (the
  // delete write died mid-flight) and no trash entry yet.
  const mergedStudents = payloadQueue.mergeQueuedIntoList([S1, S2, S3], 'students', queued);
  assert.deepStrictEqual(mergedStudents.map((s: any) => s.id), ['std-1', 'std-3'], 'the snapshot must not resurrect the deleted student while its delete payload is queued');
  const mergedBin = payloadQueue.mergeQueuedIntoList([], 'trashBin', queued);
  assert.strictEqual(mergedBin.length, 1, 'the queued trash entry must be re-appended to the bin snapshot');
  assert.strictEqual((mergedBin[0] as any).id, 'trash-new-1', 'the re-appended entry must be the delete\'s trash entry');
});

console.log('--- retry: a pre-queued delete is replayed ---');

check("(10) retryPendingCloudConfirms replays queued delete items via writeDeleteFieldsToCloud", () => {
  const retryStart = appContextSrc.indexOf('const retryPendingCloudConfirms = async (');
  assert.ok(retryStart > -1, 'retryPendingCloudConfirms must exist in AppContext');
  const retryBody = appContextSrc.slice(retryStart, appContextSrc.indexOf('\n  };', retryStart) + 5);
  assert.ok(retryBody.includes("item.op === 'delete'"), 'the retry must handle queued delete items');
  assert.ok(retryBody.includes('writeDeleteFieldsToCloud(item.removals'), 'the retry must replay the queued delete through the delete writer, with its trash entries');
});

console.log('--- wiring ---');

check('(11) package.json exposes test:student-delete-reload-race', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts?.['test:student-delete-reload-race'], 'tsx scripts/verify-student-delete-reload-race.ts');
});

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
