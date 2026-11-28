/**
 * Attendance Cleanup (28 Nov 2026, path খ of the
 * attendance-data-delete plan).
 *
 * SCOPE (confirmed by the principal 28 Nov 07:31): BOTH student
 * and staff attendance are demo/test data — no real attendance has
 * been input yet ("staff hajiraw demo ba test original nai") — so
 * BOTH fields are deleted, all dates:
 *  - dailyStudentAttendance
 *  - dailyStaffAttendance
 *
 * What gets deleted (both fields, every date):
 *  1. the attendance collections
 *     (institutions/<id>/dailyStudentAttendance and
 *      institutions/<id>/dailyStaffAttendance, every doc)
 *  2. institution/main_store dailyStudentAttendance[] and
 *     dailyStaffAttendance[] (both set to [])
 *  3. this device's local mirrors (service maps + localStorage
 *     madrasah_daily_student_attendance /
 *     madrasah_daily_staff_attendance)
 *  4. payload-queue upsert items for both fields
 *  5. a marker (attendanceClearedAt) in the settings doc, so every
 *     other device self-clears its own local mirrors on next boot
 *     instead of re-uploading the records (see AppContext).
 *
 * Nothing else is deleted: students, teachers, fees, marks,
 * notices, routine, syllabus, calendar, transactions, snapshots,
 * vault and JSON backups are untouched.
 *
 * This module NEVER deletes anything by itself on import — every
 * delete runs only when the Backup Hub cleanup action calls
 * runAttendanceCleanup() from the principal's signed-in admin
 * session. Data-never-lost: the action takes a pinned cloud
 * snapshot (+ vault copy) BEFORE deleting, shows both fields'
 * counts, and requires two confirmations. The snapshot payload
 * carries both attendance arrays, so a restore puts them back into
 * main_store and the backfill copies them into the collections
 * again — note the restore read-back does NOT count-verify
 * attendance (it is not in RESTORE_COUNT_FIELDS), so the backup
 * counts shown by the action are the verification for these fields.
 *
 * ONE-TIME (28 Nov 2026, the principal's decision): the cleanup
 * action is a single-use tool, not a permanent button. The marker
 * is written ONLY after the delete verifies (all four counts 0);
 * from then on the Backup Hub hides the action forever — even
 * after real attendance is entered later — so a stray tap can
 * never wipe real data. The service also refuses to run twice:
 * runAttendanceCleanup() throws when a marker already exists.
 * Marker-last ordering is deliberate: if a run fails midway (no
 * marker written yet), the button stays visible and the principal
 * can retry; a marker-first order would have locked out the retry
 * while leaving data half-deleted.
 *
 * NEW ATTENDANCE IS NEVER RE-DELETED (28 Nov 2026, his correction
 * — "আমি হাজিরা নিলে কি daily daily আমি এগুলা delete করবো?").
 * The marker is a timestamp, and the self-clear it triggers is
 * guarded twice: (1) TIMESTAMP-SCOPED — only records dated on or
 * before the marker's date are cleared; the real attendance he
 * takes every day after the delete is dated after the marker and
 * is never touched (anything created/modified after the marker
 * survives too); (2) ONCE-PER-DEVICE — each device self-clears
 * once (local flag `ldsdm_attendance_self_cleared_at`) and never
 * again, even though the marker stays forever. Delete once; new
 * daily attendance is never re-deleted by any device, ever.
 */
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import {
  dailyStudentAttendanceCollectionRef,
  dailyStaffAttendanceCollectionRef,
  readAttendanceFieldFromCollection,
  settingsDocRef,
  writeSettingsToCollection,
  type AttendanceSplitField,
} from './cloudConfirm';
import { dailyAttendanceService } from './dailyAttendanceService';
import { clearPendingPayloadsForField, readPendingPayloads } from './payloadQueue';
import {
  readCurrentLocalStoragePayload,
  saveCloudSnapshotToFirestore,
  saveToIndexedDbVault,
} from './multiStorePersistence';

// The settings-doc field that marks an attendance cleanup.
// Other devices read it from the settings feed and clear their own
// local attendance mirrors once (see AppContext).
export const ATTENDANCE_CLEARED_MARKER_FIELD = 'attendanceClearedAt';

// localStorage: the once-per-device self-clear flag. A device
// that has already self-cleared for a marker never runs the
// self-clear again — even though the marker stays in the settings
// doc forever. The value is the marker timestamp it applied, so a
// newer marker (a later cleanup) could still apply once.
export const ATTENDANCE_SELF_CLEARED_FLAG_KEY = 'ldsdm_attendance_self_cleared_at';

export function getAppliedAttendanceClearMarker(): number {
  try {
    const raw = localStorage.getItem(ATTENDANCE_SELF_CLEARED_FLAG_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setAppliedAttendanceClearMarker(ts: number): void {
  try {
    localStorage.setItem(ATTENDANCE_SELF_CLEARED_FLAG_KEY, String(ts));
  } catch {}
}

/** Read the clear marker from the settings doc (null when none). */
export async function readAttendanceClearMarkerFromCloud(): Promise<number | null> {
  const snap = await getDoc(settingsDocRef());
  if (!snap.exists()) return null;
  const v = (snap.data() as any)?.[ATTENDANCE_CLEARED_MARKER_FIELD];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

interface LocalClearOutcome {
  cleared: number;
  kept: number;
}

/** The marker timestamp as a local calendar date (YYYY-MM-DD). */
function markerDateString(markerTs: number): string {
  const d = new Date(markerTs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** An attendance record's date (YYYY-MM-DD) — from its date field, or from its id (`${date}_${who}`). */
function recordDateOf(r: any): string {
  if (typeof r?.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.date)) return r.date.slice(0, 10);
  if (typeof r?.id === 'string') {
    const head = r.id.split('_')[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(head)) return head.slice(0, 10);
  }
  return '';
}

/**
 * Clear this device's local attendance mirror for one field.
 *
 * TWO protections guard the principal's real attendance (28 Nov
 * 2026, his correction — "আমি হাজিরা নিলে কি daily daily আমি
 * এগুলা delete করবো?"):
 *  (1) TIMESTAMP-SCOPED: only records dated ON OR BEFORE the
 *      marker's date are cleared. A record dated AFTER the marker
 *      — the new real attendance he takes every day after the
 *      delete — is NEVER cleared. Anything created or modified
 *      after the marker timestamp (updatedAt > marker) survives
 *      too, even if its date is old.
 *  (2) ONCE-PER-DEVICE: the caller (applyAttendanceClearMarker in
 *      AppContext) checks the self-clear flag first — a device that
 *      already applied this marker never runs this again.
 * Together: the delete happens once; new daily attendance is never
 * re-deleted by any device, ever.
 *
 * A record with no usable date and no updatedAt after the marker
 * is still cleared: the app always dates new attendance, so an
 * undatable record cannot be new real attendance — and leaving it
 * would let it resurrect into the cloud on the next backfill.
 * Also drops the field's queued upserts and records the marker as
 * applied on this device.
 */
function clearLocalFieldBefore(
  field: AttendanceSplitField,
  markerTs: number
): LocalClearOutcome {
  const isStudent = field === 'dailyStudentAttendance';
  const all = isStudent
    ? dailyAttendanceService.getAllStudentRecords()
    : dailyAttendanceService.getAllStaffRecords();
  const markerDate = markerDateString(markerTs);
  const kept = (all || []).filter((r) => {
    // Protection 1 — dated after the marker: new attendance, keep.
    const d = recordDateOf(r);
    if (d && d > markerDate) return true;
    // Protection 1b — created/modified after the marker: keep.
    // (Only student records carry updatedAt; staff records rely
    // on the date rule above — they always carry a date.)
    const t = (r as { updatedAt?: string })?.updatedAt
      ? Date.parse((r as { updatedAt?: string }).updatedAt as string)
      : NaN;
    if (Number.isFinite(t) && t > markerTs) return true;
    // Dated on/before the marker (or undatable): old test data.
    return false;
  });
  if (isStudent) dailyAttendanceService.replaceStudentRecords(kept as any);
  else dailyAttendanceService.replaceStaffRecords(kept as any);
  clearPendingPayloadsForField(field);
  setAppliedAttendanceClearMarker(markerTs);
  return { cleared: all.length - kept.length, kept: kept.length };
}

export function clearLocalStudentAttendanceBefore(markerTs: number): LocalClearOutcome {
  return clearLocalFieldBefore('dailyStudentAttendance', markerTs);
}

export function clearLocalStaffAttendanceBefore(markerTs: number): LocalClearOutcome {
  return clearLocalFieldBefore('dailyStaffAttendance', markerTs);
}

/** Clear BOTH local attendance mirrors (student + staff). */
export function clearLocalAttendanceBefore(markerTs: number): {
  student: LocalClearOutcome;
  staff: LocalClearOutcome;
} {
  return {
    student: clearLocalStudentAttendanceBefore(markerTs),
    staff: clearLocalStaffAttendanceBefore(markerTs),
  };
}

export interface AttendanceFieldCleanupCounts {
  /** Docs in the attendance collection. */
  collectionDocs: number;
  /** Records in institution/main_store <field>[]. */
  mainStoreRecords: number;
  /** Records in this device's local mirror. */
  localRecords: number;
  /** Queued payload items touching this field. */
  queuedItems: number;
}

export interface AttendanceCleanupCounts {
  student: AttendanceFieldCleanupCounts;
  staff: AttendanceFieldCleanupCounts;
}

function countQueuedItemsForField(field: AttendanceSplitField): number {
  return readPendingPayloads().filter((item) => {
    if (item.op === 'upsert') return item.field === field;
    if (item.op === 'delete') return (item.removals || []).some((r) => r.field === field);
    if (item.op === 'trashOp') return !!(item.upserts && (item.upserts as any)[field]);
    return false;
  }).length;
}

async function countFieldForCleanup(field: AttendanceSplitField): Promise<AttendanceFieldCleanupCounts> {
  const [collectionRecords, mainSnap] = await Promise.all([
    readAttendanceFieldFromCollection(field),
    getDoc(doc(db, 'institution', 'main_store')),
  ]);
  const mainData = mainSnap.exists() ? (mainSnap.data() as any) : {};
  const mainList = Array.isArray(mainData?.[field]) ? mainData[field] : [];
  const isStudent = field === 'dailyStudentAttendance';
  const localRecords = isStudent
    ? dailyAttendanceService.getAllStudentRecords().length
    : dailyAttendanceService.getAllStaffRecords().length;
  return {
    collectionDocs: (collectionRecords || []).length,
    mainStoreRecords: mainList.length,
    localRecords,
    queuedItems: countQueuedItemsForField(field),
  };
}

/** Count attendance everywhere it lives (read-only, both fields). */
export async function countAttendanceForCleanup(): Promise<AttendanceCleanupCounts> {
  const [student, staff] = await Promise.all([
    countFieldForCleanup('dailyStudentAttendance'),
    countFieldForCleanup('dailyStaffAttendance'),
  ]);
  return { student, staff };
}

export interface AttendanceCleanupBackup {
  snapshotId: string;
  /** Student attendance records inside the backup payload. */
  backupStudent: number;
  /** Staff attendance records inside the backup payload. */
  backupStaff: number;
  /** Student attendance docs in the cloud collection at backup time. */
  cloudStudent: number;
  /** Staff attendance docs in the cloud collection at backup time. */
  cloudStaff: number;
}

/**
 * Take the pre-delete safety backup: a PINNED cloud snapshot plus a
 * pinned vault copy, both from this device's local payload. Returns
 * both fields' backup counts so the action can compare them with
 * the cloud counts — a backup that holds fewer records than the
 * cloud for either field is incomplete (this device never pulled
 * them) and the action must refuse to delete on it.
 */
export async function takeAttendanceCleanupBackup(adminEmail: string): Promise<AttendanceCleanupBackup> {
  const payload = readCurrentLocalStoragePayload();
  const backupStudent = Array.isArray((payload as any)?.dailyStudentAttendance)
    ? (payload as any).dailyStudentAttendance.length
    : 0;
  const backupStaff = Array.isArray((payload as any)?.dailyStaffAttendance)
    ? (payload as any).dailyStaffAttendance.length
    : 0;
  const [cloudStudentList, cloudStaffList] = await Promise.all([
    readAttendanceFieldFromCollection('dailyStudentAttendance'),
    readAttendanceFieldFromCollection('dailyStaffAttendance'),
  ]);
  const snapshotId = await saveCloudSnapshotToFirestore(
    payload,
    'ছাত্র + staff হাজিরা পরিষ্কার করার আগের সেফটি স্ন্যাপশট (পিন করা)',
    'Safety snapshot before student + staff attendance cleanup (pinned)',
    adminEmail,
    { pinned: true, trigger: 'pre_restore' }
  );
  // Second copy in this device's vault (pre_mutation is always pinned).
  await saveToIndexedDbVault(
    payload,
    'pre_mutation',
    'ছাত্র + staff হাজিরা পরিষ্কার করার আগের সেফটি স্ন্যাপশট',
    'Safety snapshot before student + staff attendance cleanup'
  );
  return {
    snapshotId,
    backupStudent,
    backupStaff,
    cloudStudent: cloudStudentList.length,
    cloudStaff: cloudStaffList.length,
  };
}

export interface AttendanceCleanupResult {
  clearedAt: number;
  deletedStudentDocs: number;
  deletedStaffDocs: number;
  mainStoreCleared: boolean;
  localClearedStudent: number;
  localClearedStaff: number;
  localKeptStudent: number;
  localKeptStaff: number;
  queueItemsCleared: number;
  /** Post-delete verification: docs left in the student collection (must be 0). */
  remainingStudentDocs: number;
  /** Post-delete verification: docs left in the staff collection (must be 0). */
  remainingStaffDocs: number;
  /** Post-delete verification: records left in main_store student array (must be 0). */
  remainingMainStoreStudent: number;
  /** Post-delete verification: records left in main_store staff array (must be 0). */
  remainingMainStoreStaff: number;
}

async function deleteCollectionDocs(field: AttendanceSplitField): Promise<number> {
  const docs = await readAttendanceFieldFromCollection(field);
  const col = field === 'dailyStudentAttendance'
    ? dailyStudentAttendanceCollectionRef()
    : dailyStaffAttendanceCollectionRef();
  let deleted = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const r of docs.slice(i, i + 500)) {
      if (!r || !r.id) continue;
      batch.delete(doc(col, String(r.id)));
      deleted += 1;
    }
    await batch.commit();
  }
  return deleted;
}

/**
 * Delete ALL attendance records — student AND staff, every date.
 * Admin-only — the caller must pass isAdmin from the signed-in
 * session; the service refuses otherwise. ONE-TIME: throws when a
 * clear marker already exists (the cleanup was already done once).
 * Order matters (plan §5, marker-last per the one-time design):
 *  1. one-time guard (marker already set → refuse),
 *  2. queue items first, both fields (no retry can resurrect),
 *  3. this device's local mirrors, both fields (no local source
 *     can re-upload),
 *  4. both collections' docs, batched 500 at a time,
 *  5. both main_store arrays ([]) — explicit setDoc merge, never
 *     the normal sync path, which never writes a deletion),
 *  6. verify by re-reading (all four counts must be 0, else throw
 *     so the UI reports failure and the principal can retry),
 *  7. the clear marker — written ONLY after verification, so other
 *     devices self-clear instead of backfilling, and the Backup Hub
 *     hides this one-time action forever after.
 * Nothing besides the two attendance fields is touched.
 */
export async function runAttendanceCleanup(opts: {
  updatedBy: string;
  isAdmin: boolean;
  onProgress?: (message: string) => void;
}): Promise<AttendanceCleanupResult> {
  if (!opts.isAdmin) {
    throw new Error('শুধু অ্যাডমিন (প্রিন্সিপাল / সুপার অ্যাডমিন) হাজিরা পরিষ্কার করতে পারবেন।');
  }
  // 1. One-time guard — the cleanup runs once, ever.
  try {
    const existing = await readAttendanceClearMarkerFromCloud();
    if (typeof existing === 'number' && existing > 0) {
      throw new Error('হাজিরা আগেই একবার পরিষ্কার করা হয়েছে — এই কাজ একবারই করা যায়।');
    }
  } catch (err: any) {
    if (err?.message?.includes('আগেই একবার')) throw err;
    console.warn('Attendance clear-marker check notice:', err?.message || err);
  }
  const progress = opts.onProgress || (() => {});
  const clearedAt = Date.now();

  // 2. Queue first.
  progress('সিঙ্কের সারি থেকে হাজিরা পরিষ্কার হচ্ছে…');
  const queuedBefore =
    countQueuedItemsForField('dailyStudentAttendance') +
    countQueuedItemsForField('dailyStaffAttendance');
  clearPendingPayloadsForField('dailyStudentAttendance');
  clearPendingPayloadsForField('dailyStaffAttendance');

  // 3. This device's local mirrors (keeps anything recorded after
  // the marker timestamp — practically nothing, but never wipe a
  // fresh entry taken while the cleanup runs).
  progress('এই ডিভাইসের হাজিরা পরিষ্কার হচ্ছে…');
  const local = clearLocalAttendanceBefore(clearedAt);

  // 4. Collection docs, batched 500 at a time (Firestore limit).
  progress('ক্লাউড থেকে ছাত্র হাজিরা মুছে ফেলা হচ্ছে…');
  const deletedStudentDocs = await deleteCollectionDocs('dailyStudentAttendance');
  progress('ক্লাউড থেকে staff হাজিরা মুছে ফেলা হচ্ছে…');
  const deletedStaffDocs = await deleteCollectionDocs('dailyStaffAttendance');

  // 5. main_store arrays — explicit setDoc merge, never the sync path.
  progress('মূল ডেটা থেকে হাজিরা মুছে ফেলা হচ্ছে…');
  await setDoc(
    doc(db, 'institution', 'main_store'),
    { dailyStudentAttendance: [], dailyStaffAttendance: [] },
    { merge: true }
  );

  // 6. Verify by re-reading — all four must be 0.
  progress('মুছে গেছে কি না যাচাই করা হচ্ছে…');
  const [remainingStudent, remainingStaff, mainSnap] = await Promise.all([
    readAttendanceFieldFromCollection('dailyStudentAttendance'),
    readAttendanceFieldFromCollection('dailyStaffAttendance'),
    getDoc(doc(db, 'institution', 'main_store')),
  ]);
  const mainData = mainSnap.exists() ? (mainSnap.data() as any) : {};
  const remainingMainStoreStudent = Array.isArray(mainData?.dailyStudentAttendance)
    ? mainData.dailyStudentAttendance.length
    : 0;
  const remainingMainStoreStaff = Array.isArray(mainData?.dailyStaffAttendance)
    ? mainData.dailyStaffAttendance.length
    : 0;
  if (
    remainingStudent.length > 0 ||
    remainingStaff.length > 0 ||
    remainingMainStoreStudent > 0 ||
    remainingMainStoreStaff > 0
  ) {
    throw new Error(
      `পরিষ্কার সম্পূর্ণ হয়নি — ক্লাউডে এখনো ছাত্র ${remainingStudent.length}টি ও staff ${remainingStaff.length}টি ডকুমেন্ট, মূল ডেটায় ছাত্র ${remainingMainStoreStudent}টি ও staff ${remainingMainStoreStaff}টি রেকর্ড বাকি আছে। আবার চেষ্টা করুন।`
    );
  }

  // 7. Marker LAST, only after verification — other devices
  // self-clear on seeing it, and the Backup Hub hides this
  // one-time action forever after.
  progress('পরিষ্কার সম্পূর্ণ — চিহ্ন লেখা হচ্ছে…');
  await writeSettingsToCollection({ [ATTENDANCE_CLEARED_MARKER_FIELD]: clearedAt });

  return {
    clearedAt,
    deletedStudentDocs,
    deletedStaffDocs,
    mainStoreCleared: true,
    localClearedStudent: local.student.cleared,
    localClearedStaff: local.staff.cleared,
    localKeptStudent: local.student.kept,
    localKeptStaff: local.staff.kept,
    queueItemsCleared: queuedBefore,
    remainingStudentDocs: 0,
    remainingStaffDocs: 0,
    remainingMainStoreStudent: 0,
    remainingMainStoreStaff: 0,
  };
}
