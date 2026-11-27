/**
 * verify-student-edit-reload-race.ts — scripted proof for the student
 * EDIT reload-race fix (Branch: fix/student-edit-reload-race, 26 Nov 2026).
 *
 * 26 Nov 2026 morning audit (principal, fresh profile, desktop):
 *   - PR #73's delete fix works (delete + immediate reload → the
 *     student does NOT return).
 *   - But a name EDIT + immediate reload still reverts the name
 *     (TEST-Audit-1126-edited → TEST-Audit-1126).
 *
 * Diagnosis (code-read, main dcc44ee5; full note:
 *   files/LDSDM-student-edit-reload-race-diagnosis-2026-11-26.md):
 *   The edit's queue entry EXISTS, but when the ADD's background
 *   confirm succeeds, clearPendingPayloadsForField('students') wipes
 *   the WHOLE field's queue — including the edit's new-name entry,
 *   which the ADD confirm never wrote. A reload then has nothing to
 *   retry, and the collection (Job 12 takeover source) still holds
 *   the old name, so the name is lost permanently.
 *
 * Fix: content-aware clear — clearConfirmedUpsertRecords(field,
 * confirmedList) drops only queued records whose key+content matches
 * the confirmed list; a newer value under the same key stays queued.
 * confirmUpsertSuccess uses it instead of the field-wide wipe.
 * confirmStaffCloudSync pre-queues its teachers+users delta before
 * the write (same pattern as confirmStudentsCloudSync).
 *
 * What must NOT change: no auth/login, no Firestore rules, no
 * result/marksheet files, no real data; trash-first stays; the
 * queue's Discard path is untouched; PR #73's delete behaviour
 * (queue-before-write, restore cancels a queued delete) stays.
 *
 * Checks:
 *   (1) A newer edit survives a concurrent older confirm: queue
 *       [K-new, M], clear with confirmed [K-old, M] → K-new stays,
 *       M is dropped.
 *   (2) The surviving entry is still there for the retry after a
 *       simulated reload (readPendingPayloads holds K-new).
 *   (3) Delete/trashOp items are never touched by the helper.
 *   (4) Normal case: a queued record identical to the confirmed
 *       list is dropped (the badge-clearing behaviour stays).
 *   (5) confirmUpsertSuccess uses the helper (source check).
 *   (6) confirmStaffCloudSync pre-queues its delta (source check).
 *   (7) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-student-edit-reload-race.ts
 * (or npm run test:student-edit-reload-race).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    console.log(`ok - ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`FAIL - ${name}: ${e?.message || e}`);
  }
}

const reset = () => store.clear();
const queuedStudents = () => {
  const items = payloadQueue.readPendingPayloads();
  const up = items.find((i: any) => i.op === 'upsert' && i.field === 'students');
  return up?.records || [];
};

console.log('--- content-aware clear ---');

check('(1) a newer edit survives a concurrent older confirm', () => {
  reset();
  assert.strictEqual(typeof payloadQueue.clearConfirmedUpsertRecords, 'function', 'clearConfirmedUpsertRecords must exist');
  const kNew = { id: 's1', name: 'TEST-Audit-1126-edited', roll: 1 };
  const m = { id: 's2', name: 'Mim', roll: 2 };
  payloadQueue.queuePendingPayload({ field: 'students', op: 'upsert', records: [kNew, m] });
  const kOld = { id: 's1', name: 'TEST-Audit-1126', roll: 1 };
  payloadQueue.clearConfirmedUpsertRecords('students', [kOld, m]);
  const left = queuedStudents();
  assert.strictEqual(left.length, 1, 'only the newer edit must remain');
  assert.strictEqual(left[0].name, 'TEST-Audit-1126-edited', 'the remaining record must be the new name');
});

check('(2) the surviving entry is still there for the retry after a simulated reload', () => {
  const items = payloadQueue.readPendingPayloads();
  const up = items.find((i: any) => i.op === 'upsert' && i.field === 'students');
  assert.ok(up, 'a queued upsert must survive for the mount retry to replay');
  assert.ok((up.records || []).some((r: any) => r.name === 'TEST-Audit-1126-edited'), 'the retry must replay the new name');
});

check('(3) delete/trashOp items are never touched by the helper', () => {
  reset();
  payloadQueue.queuePendingPayload({ op: 'delete', removals: [{ field: 'students', ids: ['s9'] }], trashEntries: [{ id: 't1' }] });
  payloadQueue.queuePendingPayload({ op: 'trashOp', removeTrashIds: ['t2'], upserts: { students: [{ id: 's9', name: 'Old' }] } });
  payloadQueue.clearConfirmedUpsertRecords('students', [{ id: 's9', name: 'Old' }]);
  const items = payloadQueue.readPendingPayloads();
  assert.ok(items.some((i: any) => i.op === 'delete'), 'the queued delete must survive');
  assert.ok(items.some((i: any) => i.op === 'trashOp'), 'the queued restore must survive');
});

check('(4) normal case: a queued record identical to the confirmed list is dropped', () => {
  reset();
  const x = { id: 's3', name: 'Rumman', roll: 3 };
  payloadQueue.queuePendingPayload({ field: 'students', op: 'upsert', records: [x] });
  payloadQueue.clearConfirmedUpsertRecords('students', [{ id: 's3', name: 'Rumman', roll: 3 }]);
  assert.strictEqual(queuedStudents().length, 0, 'the confirmed record must be cleared (badge goes away)');
  assert.strictEqual(payloadQueue.readPendingPayloads().length, 0, 'the empty upsert item must be removed');
});

console.log('--- wiring ---');

check('(5) confirmUpsertSuccess uses the content-aware clear', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const confirmUpsertSuccess = (');
  assert.ok(start > -1, 'confirmUpsertSuccess must exist');
  const body = src.slice(start, src.indexOf('\n  };', start) + 5);
  assert.ok(body.includes('clearConfirmedUpsertRecords('), 'confirmUpsertSuccess must call clearConfirmedUpsertRecords');
  assert.ok(!body.includes('clearPendingPayloadsForField('), 'confirmUpsertSuccess must not wipe the whole field queue anymore');
});

check('(6) confirmStaffCloudSync pre-queues its delta before the write', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const confirmStaffCloudSync = async (');
  assert.ok(start > -1, 'confirmStaffCloudSync must exist');
  const body = src.slice(start, src.indexOf('\n  };', start) + 5);
  const queuePos = body.indexOf('queuePendingPayload(');
  const writePos = body.indexOf('confirmCloudWrite(');
  assert.ok(queuePos > -1 && queuePos < writePos, 'the staff delta must be queued BEFORE the cloud write starts');
  assert.ok(body.includes("diffRecords('teachers'"), 'teachers delta must be diffed');
  assert.ok(body.includes("diffRecords('users'"), 'users delta must be diffed');
});

check('(7) package.json exposes test:student-edit-reload-race', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts?.['test:student-edit-reload-race'], 'tsx scripts/verify-student-edit-reload-race.ts');
});

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
