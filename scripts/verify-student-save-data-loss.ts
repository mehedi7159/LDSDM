/**
 * Student-save data-loss fix — self-check (9 Nov 2026, commit 1671906c).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-student-save-data-loss.ts
 * (or npm run test:student-save-loss).
 *
 * Covers the v2 spec:
 *  - Bug 1: pruneQueueAgainstRemoteData must prune a queued upsert ONLY
 *    on equal content, a newer remote updatedAt, or a trashed id — never
 *    on key presence alone.
 *  - Bug 2: the funnel (confirmStudentsCloudSync) queues the delta
 *    SYNCHRONOUSLY before the confirm starts; the queue then survives a
 *    tab-close + fresh boot (snapshot without the student) via
 *    mergeQueuedIntoList, and the prune keeps it. The funnel itself lives
 *    in the AppContext React component, so it is covered by a
 *    source-order assertion (queue call before confirmCloudWrite) plus
 *    the module-level boot simulation below.
 *  - Admission path: same mechanism, with a fresh enrolment record.
 *  - findDegradingStudentIds must NOT reject the full merged record
 *    from buildUpdateStudentPayload; it must still reject a raw
 *    public-shaped record.
 *  - updateStudent must refuse loudly (throw) when the student id is
 *    not in the local list, instead of handing back raw form data.
 *  - StudentManager's modal success banner must use the honest wording
 *    (saved on this device, syncing to cloud), not "Saved successfully!".
 *
 * payloadQueue/mainStoreWrite are pure modules; AppContext/StudentManager
 * are React, so the funnel, beforeunload and updateStudent checks read
 * the source (the repo's established grep-proof style) instead of
 * rendering components.
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
  pruneQueueAgainstRemoteData,
  mergeQueuedIntoList,
} = await import('../services/payloadQueue');
const { findDegradingStudentIds } = await import('../services/mainStoreWrite');
const { buildUpdateStudentPayload } = await import('../services/studentService');

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

const OLD = { id: 's1', name: 'Rahim', classLevel: '6', status: 'Active', updatedAt: '2026-11-09T07:00:00.000Z' };
const EDITED = { id: 's1', name: 'Rahim Uddin', classLevel: '6', status: 'Active', updatedAt: '2026-11-09T08:00:00.000Z' };
const NEWER = { id: 's1', name: 'Rahim Cloud', classLevel: '6', status: 'Active', updatedAt: '2026-11-09T09:00:00.000Z' };

console.log('--- Bug 1: prune only on content / newer remote / trash ---');

check('queued EDIT survives a snapshot holding the OLD version (key alone must not prune)', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [EDITED] });
  pruneQueueAgainstRemoteData({ students: [OLD], trashBin: [] });
  const items = readPendingPayloads();
  assert.strictEqual(items.length, 1, 'queue entry must survive');
  assert.strictEqual(items[0].records![0].name, 'Rahim Uddin', 'queued edit content must survive');
});

check('queued edit with different content and NO updatedAt on either side survives', () => {
  resetQueue();
  const { updatedAt: _a, ...editedNoTs } = EDITED as any;
  const { updatedAt: _b, ...oldNoTs } = OLD as any;
  queuePendingPayload({ field: 'students', op: 'upsert', records: [editedNoTs] });
  pruneQueueAgainstRemoteData({ students: [oldNoTs], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'without timestamps only content equality may prune');
});

check('queued edit IS pruned when remote content is equal', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [EDITED] });
  // Same content, keys in a different order — must still count as equal.
  pruneQueueAgainstRemoteData({ students: [{ status: 'Active', classLevel: '6', name: 'Rahim Uddin', updatedAt: '2026-11-09T08:00:00.000Z', id: 's1' }], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 0, 'equal content means landed');
});

check('queued edit IS pruned when remote updatedAt is newer (cloud has a fresher write)', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [EDITED] });
  pruneQueueAgainstRemoteData({ students: [NEWER], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 0, 'newer remote supersedes the queued edit');
});

check('queued edit IS pruned when its id is in the remote trashBin', () => {
  resetQueue();
  queuePendingPayload({ field: 'students', op: 'upsert', records: [EDITED] });
  pruneQueueAgainstRemoteData({ students: [OLD], trashBin: [{ id: 't1', data: { id: 's1' } }] });
  assert.strictEqual(readPendingPayloads().length, 0, 'trashed means genuinely resolved');
});

check('scalar upsert IS pruned when content is equal despite key order', () => {
  resetQueue();
  queuePendingPayload({ field: 'schoolProfile', op: 'upsert', scalarValue: { name: 'LDSDM', phone: '01' }, hasScalar: true });
  pruneQueueAgainstRemoteData({ schoolProfile: { phone: '01', name: 'LDSDM' }, trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 0, 'stable compare must ignore key order');
});

check('scalar upsert survives when content differs', () => {
  resetQueue();
  queuePendingPayload({ field: 'schoolProfile', op: 'upsert', scalarValue: { name: 'LDSDM', phone: '01' }, hasScalar: true });
  pruneQueueAgainstRemoteData({ schoolProfile: { name: 'LDSDM', phone: '02' }, trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'different scalar content must stay queued');
});

console.log('--- Bug 2: save -> tab close -> fresh boot (queue is the lifeline) ---');

check('new student queued synchronously survives a boot snapshot that lacks it', () => {
  resetQueue();
  const fresh = { id: 's2', name: 'New Student', classLevel: '6', status: 'Active', updatedAt: '2026-11-09T08:30:00.000Z' };
  // The funnel queues the delta BEFORE the confirm starts — so a tab
  // close mid-confirm leaves the entry in localStorage.
  queuePendingPayload({ field: 'students', op: 'upsert', records: [fresh] });
  assert.strictEqual(readPendingPayloads().length, 1, 'queue entry must exist synchronously, before any confirm resolves');
  // Fresh boot: server snapshot has no s2 yet.
  const bootSnapshot = [OLD];
  const merged = mergeQueuedIntoList(bootSnapshot as any, 'students');
  assert.ok(merged.some((r: any) => r.id === 's2'), 'snapshot merge must restore the unconfirmed student');
  // And the prune must not drop the queue entry for a key the snapshot lacks.
  pruneQueueAgainstRemoteData({ students: bootSnapshot, trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'queue entry must survive the snapshot that lacks the student');
});

check('admission enrolment queued synchronously survives a boot snapshot that lacks it', () => {
  resetQueue();
  const enrolled = { id: 's3', name: 'Admission Student', classLevel: 'Play', status: 'Active', updatedAt: '2026-11-09T08:35:00.000Z' };
  queuePendingPayload({ field: 'students', op: 'upsert', records: [enrolled] });
  const merged = mergeQueuedIntoList([OLD] as any, 'students');
  assert.ok(merged.some((r: any) => r.id === 's3'), 'enrolled student must survive via the queue');
  pruneQueueAgainstRemoteData({ students: [OLD], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'enrolment queue entry must survive');
});

console.log('--- findDegradingStudentIds: full merged edit must pass, raw public shape must fail ---');

check('full merged record from buildUpdateStudentPayload is NOT degrading', () => {
  const cloud = { ...OLD, guardianPhone: '01700000000', feePayableAmount: 700, updatedBy: 'admin' };
  const { student: merged, error } = buildUpdateStudentPayload(cloud as any, { name: 'Rahim Uddin' } as any);
  assert.strictEqual(error, undefined, 'builder must accept the edit');
  assert.deepStrictEqual(findDegradingStudentIds([cloud], [merged as any]), [], 'full merged edit must not be rejected');
});

check('raw public-shaped record for the same id IS degrading (choke still works)', () => {
  const cloud = { ...OLD, guardianPhone: '01700000000', feePayableAmount: 700, updatedBy: 'admin' };
  // Genuine public shape: ONLY fields from PUBLIC_STUDENT_FIELDS
  // (status/updatedAt are NOT public fields — a record carrying them
  // is not public-shaped, so the fixture must not include them).
  const publicShaped = { id: 's1', name: 'Rahim Uddin', classLevel: '6' };
  assert.deepStrictEqual(findDegradingStudentIds([cloud], [publicShaped]), ['s1'], 'public-shaped replacement must still be caught');
});

console.log('--- Funnel / beforeunload / updateStudent refusal (source checks) ---');

check('confirmStudentsCloudSync queues the delta BEFORE confirmCloudWrite starts', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const confirmStudentsCloudSync = async (');
  assert.ok(start > -1, 'confirmStudentsCloudSync must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  const queueAt = body.indexOf('queuePendingPayload');
  const confirmAt = body.indexOf('confirmCloudWrite');
  assert.ok(queueAt > -1, 'funnel must queue the delta synchronously at the top');
  assert.ok(confirmAt > -1, 'funnel must still call confirmCloudWrite');
  assert.ok(queueAt < confirmAt, 'queue call must come BEFORE confirmCloudWrite');
  assert.ok(body.includes("diffRecords('students'"), 'funnel must use the same diffRecords as the failure path');
});

check('confirmUpsertFailure still queues as a safety net', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const confirmUpsertFailure = (field: string, list: any[]) => {');
  assert.ok(start > -1, 'confirmUpsertFailure must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes('queuePendingPayload'), 'failure path must keep its queue call');
});

check('beforeunload warns when unconfirmed payloads exist', () => {
  const src = readSource('context/AppContext.tsx');
  const at = src.indexOf('beforeunload');
  assert.ok(at > -1, 'a beforeunload listener must be registered');
  // Handler is defined just above the addEventListener call — check
  // the window around it, not only the text after it.
  const window_ = src.slice(Math.max(0, at - 900), at + 300);
  assert.ok(window_.includes('readPendingPayloads()'), 'listener must check readPendingPayloads()');
  assert.ok(window_.includes('preventDefault') || window_.includes('returnValue'), 'listener must block the close');
});

check('updateStudent refuses loudly when the student id is not in the local list', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const updateStudent = (updatedStudent: Student) => {');
  assert.ok(start > -1, 'updateStudent must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes('throw new Error'), 'updateStudent must throw instead of returning raw form data');
  assert.ok(!body.includes(': { student: updatedStudent }'), 'raw-form-data fallback must be gone');
});

check('StudentManager modal banner uses honest wording, not "Saved successfully!"', () => {
  const src = readSource('components/StudentManager.tsx');
  assert.ok(!src.includes('savedSuccessfully'), 'modal banner must not show a false success message');
  assert.ok(src.includes('এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…'), 'modal banner must say saved on this device, syncing to cloud');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: student-save data-loss self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
