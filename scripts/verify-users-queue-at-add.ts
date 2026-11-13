/**
 * Users-record queue at staff add — self-check (12 Nov 2026, base commit fba1bb8).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-users-queue-at-add.ts
 * (or npm run test:users-queue-at-add).
 *
 * Covers the role-add audit finding 3 (10 Nov 2026): when a staff
 * member is added, the `users` (login) record was NOT queued at add
 * time — only `teachers` was — so a close mid-save lost it until the
 * person logged in and it self-healed.
 *
 *  - addTeacher queues the new users record optimistically, in the
 *    same step as setUsers — mirroring the teachers queue — so the
 *    entry already sits in localStorage before the provisioning await
 *    and the background confirm.
 *  - The queued users entry survives a boot snapshot that lacks it
 *    (mergeQueuedIntoList restores it) and prune-on-content-match
 *    still applies: it survives a snapshot holding different content
 *    for the same id, and is pruned only when the remote content is
 *    equal (or the id is trashed).
 *  - The retry replays a users upsert through writeStaffFieldsToCloud
 *    (fieldWriter entry already present in retryPendingCloudConfirms).
 *
 * payloadQueue is a pure module; AppContext is React, so the add-time
 * queueing is covered by source-order assertions (the repo's
 * established grep-proof style) plus real unit checks on the queue.
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

const USER = { id: 'MDR-T004', name: 'Test Staff', nameBn: 'টেস্ট কর্মী', phone: '01700000000', email: 'test@madrasha.local', role: 'teacher', designation: 'সহকারী শিক্ষক', assignedClasses: [], status: 'active', createdAt: '2026-11-12T10:00:00.000Z' };
const USER_EDITED = { ...USER, name: 'Test Staff Updated', nameBn: 'টেস্ট কর্মী আপডেট' };

console.log('--- addTeacher queues users alongside teachers (source checks) ---');

check('addTeacher queues the teachers record optimistically (pre-existing pattern)', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const addTeacher = async (');
  assert.ok(start > -1, 'addTeacher must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes("queuePendingPayload({ field: 'teachers', op: 'upsert', records: [teacherWithCredentials]"), 'teachers must be queued at add time');
});

check('addTeacher queues the new users record in the same step as setUsers', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const addTeacher = async (');
  assert.ok(start > -1, 'addTeacher must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  const setUsersAt = body.indexOf('setUsers(nextUsers)');
  assert.ok(setUsersAt > -1, 'addTeacher must setUsers(nextUsers)');
  const queueAt = body.indexOf("queuePendingPayload({ field: 'users', op: 'upsert', records: [userObj]");
  assert.ok(queueAt > -1, 'addTeacher must queue the users record at add time');
  assert.ok(queueAt > setUsersAt, 'users queue call must come after setUsers(nextUsers)');
  // Before the provisioning await: the queue must already sit in
  // localStorage while the (slow) Firebase provisioning is pending.
  const provisionAt = body.indexOf('provisionStaffFirebaseUser');
  assert.ok(provisionAt > -1, 'addTeacher must still provision the Firebase user');
  assert.ok(queueAt < provisionAt, 'users queue call must come BEFORE the provisioning await');
});

check('addTeacher refreshes the pending-payload badge after queueing users', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const addTeacher = async (');
  const body = src.slice(start, src.indexOf('\n  };', start));
  const queueAt = body.indexOf("queuePendingPayload({ field: 'users', op: 'upsert', records: [userObj]");
  assert.ok(queueAt > -1, 'users queue call must exist');
  const refreshAt = body.indexOf('refreshPendingPayloads()', queueAt);
  assert.ok(refreshAt > -1, 'refreshPendingPayloads must follow the users queue call');
});

console.log('--- updateTeacher queues users alongside teachers (source checks) ---');

check('updateTeacher queues the changed users record in the same step as setUsers', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const updateTeacher = async (');
  assert.ok(start > -1, 'updateTeacher must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  const setUsersAt = body.indexOf('setUsers(nextUsers)');
  assert.ok(setUsersAt > -1, 'updateTeacher must setUsers(nextUsers)');
  const queueAt = body.indexOf("queuePendingPayload({ field: 'users', op: 'upsert', records: changedUsers");
  assert.ok(queueAt > -1, 'updateTeacher must queue the changed users record at edit time');
  assert.ok(queueAt > setUsersAt, 'users queue call must come after setUsers(nextUsers)');
});

console.log('--- Queued users entry survives a mid-close boot (queue unit checks) ---');

check('users + teachers entries sit side by side after an add', () => {
  resetQueue();
  queuePendingPayload({ field: 'teachers', op: 'upsert', records: [{ id: 'MDR-T004', name: 'Test Staff' }] });
  queuePendingPayload({ field: 'users', op: 'upsert', records: [USER] });
  const items = readPendingPayloads();
  assert.strictEqual(items.length, 2, 'both fields must have a queue entry');
  assert.ok(items.some((i: any) => i.field === 'teachers'), 'teachers entry must exist');
  assert.ok(items.some((i: any) => i.field === 'users' && i.records![0].id === 'MDR-T004'), 'users entry must carry the new login record');
});

check('queued users record survives a boot snapshot that lacks it', () => {
  resetQueue();
  queuePendingPayload({ field: 'users', op: 'upsert', records: [USER] });
  assert.strictEqual(readPendingPayloads().length, 1, 'queue entry must exist synchronously, before any confirm resolves');
  const merged = mergeQueuedIntoList([] as any, 'users');
  assert.ok(merged.some((r: any) => r.id === 'MDR-T004'), 'snapshot merge must restore the unconfirmed login record');
  pruneQueueAgainstRemoteData({ users: [], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'queue entry must survive the snapshot that lacks the user');
});

check('queued users record survives a snapshot holding DIFFERENT content for the same id (key alone must not prune)', () => {
  resetQueue();
  queuePendingPayload({ field: 'users', op: 'upsert', records: [USER_EDITED] });
  pruneQueueAgainstRemoteData({ users: [USER], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 1, 'different content must stay queued');
  assert.strictEqual(readPendingPayloads()[0].records![0].name, 'Test Staff Updated', 'queued edit content must survive');
});

check('queued users record IS pruned when remote content is equal', () => {
  resetQueue();
  queuePendingPayload({ field: 'users', op: 'upsert', records: [USER] });
  pruneQueueAgainstRemoteData({ users: [{ ...USER }], trashBin: [] });
  assert.strictEqual(readPendingPayloads().length, 0, 'equal content means landed');
});

check('queued users record IS pruned when its id is in the remote trashBin', () => {
  resetQueue();
  queuePendingPayload({ field: 'users', op: 'upsert', records: [USER] });
  pruneQueueAgainstRemoteData({ users: [USER], trashBin: [{ id: 't1', data: { id: 'MDR-T004' } }] });
  assert.strictEqual(readPendingPayloads().length, 0, 'trashed means genuinely resolved');
});

console.log('--- Retry replays a users upsert (source check) ---');

check('retryPendingCloudConfirms replays users through writeStaffFieldsToCloud', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const retryPendingCloudConfirms = async (');
  assert.ok(start > -1, 'retryPendingCloudConfirms must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes("users: (recs, actor) => writeStaffFieldsToCloud([], recs, actor)"), 'retry must have a users fieldWriter into writeStaffFieldsToCloud');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:users-queue-at-add'], 'tsx scripts/verify-users-queue-at-add.ts', 'npm run test:users-queue-at-add must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: users-queue-at-add self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
