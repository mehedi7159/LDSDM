/**
 * Phase 1 (sync hardening, 4 Nov 2026) — SINGLE WRITE CHOKE POINT.
 *
 * Every main_store write passes through a validator here (confirmed
 * writers in cloudConfirm.ts, the diff auto-sync, and the restore
 * services). A violation FAILS CLOSED: the write throws before any
 * setDoc, the caller queues the payload and surfaces an error — never
 * a silent partial write.
 *
 * The checks, and the incident each one closes:
 *
 *  1. Full-payload writes must carry `teachers` + `users` keys, and
 *     must not be the clobber signature (students present while
 *     teachers AND users are both empty). Closes the 4 Nov 11:17 class:
 *     a public-subset state (no staff keys at all) can never again be
 *     written to main_store as if it were the full store.
 *
 *  2. Per-record id assertion: a record without its field's stable key
 *     (id; studentId+examId for remarks; classLevel for feeStructures)
 *     is REJECTED, loudly. The old merge silently skipped id-less
 *     records — a save that looked successful while the record never
 *     landed.
 *
 *  3. Public-shape degradation: a student record whose keys are a
 *     subset of the public-portal field list, replacing a fuller cloud
 *     record, is REJECTED. Same-count field degradation is invisible
 *     to Firestore rules (they cannot loop over records), so the
 *     client must refuse it. Legitimate edits always spread the
 *     existing record, so a strict-subset public-shaped replacement
 *     is degradation, not an edit.
 *
 *  4. Delete ops name their ids and (for list deletes) the trash
 *     entries appended in the same write. An empty delete (no ids, no
 *     trash) is a caller bug and throws.
 *
 *  5. Client tripwire (Phase 2, plan §5 count condition, CLIENT-SIDE
 *     FIRST — it must see >= 1 week of real use before any server
 *     enforcement): a normal write may shrink a protected array only
 *     up to the trash growth in the SAME write. Restores are a
 *     separate write class and never shrink a protected list, so they
 *     pass trivially. A violation throws before any setDoc.
 *
 * What this module deliberately does NOT do: strip unknown top-level
 * fields. Restores legitimately carry extras (version, recoveryMeta,
 * restoredFromSnapshotAt), and the pre-existing `test: true` field in
 * main_store (writer unknown — see the Phase 1 report) must not be
 * silently scrubbed by a validator.
 */

import { PUBLIC_STUDENT_FIELDS } from './publicPortal';

export interface FieldRemoval {
  field: string;
  ids: string[];
}

const PUBLIC_STUDENT_SET = new Set<string>(PUBLIC_STUDENT_FIELDS);

/** True when a student record carries ONLY public-portal fields. */
export function isPublicShapedStudent(record: Record<string, any>): boolean {
  if (!record || typeof record !== 'object') return false;
  const keys = Object.keys(record);
  return keys.length > 0 && keys.every((k) => PUBLIC_STUDENT_SET.has(k));
}

/**
 * Staff password assertion (Step 1). Throws naming the field and index
 * if any teacher or user record contains a plain-text password. Passwords
 * belong strictly in Firebase Auth, never in Firestore main_store.
 */
export function assertNoPasswordInStaff(
  field: string,
  records: Record<string, any>[]
): void {
  if (field !== 'teachers' && field !== 'users') return;
  for (let i = 0; i < (records || []).length; i++) {
    const rec = records[i];
    if (rec && typeof rec === 'object' && 'password' in rec && rec.password !== undefined) {
      throw new Error(
        `Phase 1 choke point: ${field} write rejected — record at index ${i} contains plain-text 'password' field. ` +
          `Passwords must never be stored in Firestore main_store.`
      );
    }
  }
}

/**
 * Id assertion (check 2). Throws naming the field and the offending
 * record index. Never silently skip.
 */
export function assertUpsertRecords(
  field: string,
  records: Record<string, any>[],
  keyFn: (r: Record<string, any>) => string,
  keyName = 'id'
): void {
  assertNoPasswordInStaff(field, records);
  for (let i = 0; i < (records || []).length; i++) {
    const key = keyFn(records[i]);
    if (!key) {
      throw new Error(
        `Phase 1 choke point: ${field} write rejected — record at index ${i} has no ${keyName}. ` +
          `Records without a stable key can never be confirmed in cloud, so the write was refused instead of silently dropping the record.`
      );
    }
  }
}

/**
 * Public-shape degradation (check 3). Returns the ids of incoming
 * student records that would degrade a fuller cloud record: the
 * incoming keys are public-only AND a strict subset of the cloud
 * record's keys.
 */
export function findDegradingStudentIds(
  existing: Record<string, any>[],
  incoming: Record<string, any>[]
): string[] {
  const byId = new Map<string, Record<string, any>>();
  (existing || []).forEach((r) => {
    if (r && r.id) byId.set(String(r.id), r);
  });
  const degrading: string[] = [];
  (incoming || []).forEach((rec) => {
    if (!rec || !rec.id) return;
    if (!isPublicShapedStudent(rec)) return;
    const cloud = byId.get(String(rec.id));
    if (!cloud) return;
    const incomingKeys = new Set(Object.keys(rec));
    const cloudHasExtra = Object.keys(cloud).some((k) => !incomingKeys.has(k));
    if (cloudHasExtra) degrading.push(String(rec.id));
  });
  return degrading;
}

/**
 * Full-payload validation (check 1). `op` distinguishes a live
 * full-payload write ('full' — must carry staff keys, must not match
 * the clobber signature) from an explicit user-confirmed restore
 * ('restore' — subset restores legitimately lack staff keys, e.g. the
 * local-recovery path restores academic data only; the restore path
 * gets its degradation check separately in assertRestorePayloadSafe).
 */
export function validateFullPayload(
  payload: Record<string, any>,
  op: 'full' | 'restore'
): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Phase 1 choke point: main_store write rejected — payload is not an object.');
  }
  if (op === 'full') {
    const teachers = (payload as any).teachers;
    const users = (payload as any).users;
    if (!Array.isArray(teachers) || !Array.isArray(users)) {
      throw new Error(
        'Phase 1 choke point: full main_store write rejected — payload lacks teachers/users keys. ' +
          'A state without staff keys is a partial (e.g. public-portal) state, never the full store.'
      );
    }
    assertNoPasswordInStaff('teachers', teachers);
    assertNoPasswordInStaff('users', users);
    const students = (payload as any).students;
    if (teachers.length === 0 && users.length === 0 && Array.isArray(students) && students.length > 0) {
      throw new Error(
        'Phase 1 choke point: full main_store write rejected — students present while teachers and users are both empty. ' +
          'That is the 4 Nov 11:17 clobber signature; the write was refused.'
      );
    }
  }
}

/**
 * Restore safety (Phase 1 routing for restore flows; previews and
 * retention are Phase 3). Throws when the restore payload would
 * degrade fuller cloud student records (check 3, compared against the
 * CURRENT cloud doc, not a fixed list). Warns — but does not block,
 * because a restore is an explicit user action — when the payload
 * shrinks staff/student lists relative to the cloud.
 */
export function assertRestorePayloadSafe(
  payload: Record<string, any>,
  existing: Record<string, any> | null
): void {
  validateFullPayload(payload, 'restore');
  if (existing && Array.isArray((payload as any).students) && Array.isArray(existing.students)) {
    const degrading = findDegradingStudentIds(existing.students, (payload as any).students);
    if (degrading.length > 0) {
      throw new Error(
        `Phase 1 choke point: restore refused — ${degrading.length} student record(s) in this snapshot carry only public fields ` +
          `while the cloud holds fuller records for them. Restoring would degrade those records, so the restore was refused.`
      );
    }
  }
  if (existing) {
    for (const field of ['teachers', 'users', 'students']) {
      const next = (payload as any)[field];
      const prev = existing[field];
      if (Array.isArray(next) && Array.isArray(prev) && next.length === 0 && prev.length > 0) {
        console.warn(
          `[Phase 1 choke point] restore shrinks ${field} from ${prev.length} to 0 — explicit restore, allowed, but verify the snapshot is the intended one.`
        );
      }
    }
  }
}

/** Protected arrays for the Phase 2 client tripwire (plan §5). */
export const TRIPWIRE_FIELDS = ['teachers', 'users', 'students', 'marks', 'subjects', 'exams', 'transactions'];

/**
 * Phase 2 client tripwire (plan §5 count condition, client-side
 * first). `oldSizes`/`newSizes` are per-field array lengths
 * before/after the write; `oldTrashSize`/`newTrashSize` are the
 * trashBin lengths in the SAME write. Throws naming the field and
 * the counts when a protected array would shrink beyond the trash
 * growth in that write:
 *   newA >= oldA - max(0, newTrash - oldTrash)
 * A clobber (teachers -4, trash +0) is refused; a trash-bound delete
 * (students -1, trash +1) passes. Fields absent from both maps are
 * untouched by the write and skipped. Never silently applied.
 */
export function assertTripwire(
  oldSizes: Record<string, number>,
  newSizes: Record<string, number>,
  oldTrashSize: number,
  newTrashSize: number
): void {
  const trashGrowth = Math.max(0, newTrashSize - oldTrashSize);
  for (const field of TRIPWIRE_FIELDS) {
    const oldSize = oldSizes[field];
    const newSize = newSizes[field];
    if (typeof oldSize !== 'number' || typeof newSize !== 'number') continue;
    if (newSize < oldSize - trashGrowth) {
      throw new Error(
        `Phase 2 tripwire: ${field} write rejected — list would shrink from ${oldSize} to ${newSize} ` +
          `while trash grows by only ${trashGrowth} in the same write. ` +
          `A list may shrink only up to the trash growth in the same write; the write was refused.`
      );
    }
  }
}

/** Delete-op validation (check 4). */
export function validateDeleteOp(
  removals: FieldRemoval[],
  trashEntries: Record<string, any>[]
): void {
  const allIds: string[] = [];
  (removals || []).forEach((r) => {
    if (!r || typeof r.field !== 'string' || r.field.length === 0) {
      throw new Error('Phase 1 choke point: delete write rejected — a removal has no field name.');
    }
    (r.ids || []).forEach((id) => {
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error(`Phase 1 choke point: delete write rejected — an empty id in the ${r.field} removal.`);
      }
      allIds.push(id);
    });
  });
  (trashEntries || []).forEach((t) => {
    if (!t || !t.id) {
      throw new Error('Phase 1 choke point: delete write rejected — a trash entry has no id.');
    }
  });
  if (allIds.length === 0 && (trashEntries || []).length === 0) {
    throw new Error('Phase 1 choke point: delete write rejected — no ids and no trash entries (empty delete).');
  }
}
