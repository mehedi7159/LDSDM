/**
 * Truthful-save cloud confirmation (25 Oct 2026).
 *
 * Problem (code-proven by the role-input audit): teacher attendance saves
 * and accountant fee collections show success on LOCAL save, before any
 * cloud write. The real cloud write lives in the debounced auto-sync
 * (1200 ms full-payload setDoc) which fails silently (console.warn only,
 * no retry) when the session has no Firebase identity or is offline — so
 * a teacher/accountant is told "saved" for data that never left the phone.
 *
 * This module follows the proven deleteTeacher template (awaited targeted
 * setDoc + UI-surfaced result), scoped to exactly two paths:
 *   1. teacher student-attendance saves (dailyStudentAttendance field)
 *   2. accountant fee collections (transactions field)
 *
 * Each targeted write is a read-modify-write of ONE field: the current
 * cloud array is read, unioned by record id (local records win on
 * conflict), and written back with { merge: true }. No other field is
 * touched, and receipt numbering, dues calculations, RBAC, firestore
 * rules, and the auto-sync behavior for other operations are unchanged.
 *
 * A failed confirmation never drops local data: the records stay in the
 * device's local store/state, the failure is queued in localStorage, and
 * the caller shows an honest failure notice with a retry action. The
 * queue is retried automatically on app start, on returning to the
 * foreground, and when the device comes back online (AppContext effect).
 * The queue holds only the KIND ('attendance' | 'fee' | 'marks' |
 * 'students' | 'studentDelete' | 'staff' | 'notices' | 'schedule') —
 * the retry always re-reads the current local data, so it can never
 * push a stale snapshot.
 *
 * STEP 2 (25 Oct 2026) extends the same pattern to the remaining save
 * paths: teacher marks, student admission/edits, student delete (students
 * + trashBin in one write), staff create/edit (teachers + users in one
 * write), notices, and routine/calendar/syllabus (three fields in one
 * write, read from academicScheduleService — the same service-singleton
 * pattern as attendance). The localStorage→bridge hop for schedule saves
 * is synchronous (the service emits and the AppContext subscription
 * mirrors immediately), so by confirm time the service data is the
 * source of truth; a failed localStorage write itself has no
 * confirmation and would surface as the confirm writing stale data —
 * that hop is NOT covered here, only the bridge→cloud hop is.
 *
 * Honest limits (do not paper over these):
 * - A 15 s timeout bounds the confirmation: a write that never settles
 *   (e.g. a hung offline write) is reported as failure, not success.
 * - Receipt NUMBER collisions across offline devices are NOT fixed here:
 *   numbers are still generated from local data. Server-generated
 *   numbering is a separate, bigger change.
 * - Two devices writing the same field at the same instant can still
 *   lose each other's records (last-write-wins on the array) — the union
 *   only protects sequential writes. This matches the existing auto-sync
 *   behavior; it is not made worse.
 *
 * PHASE 1 (sync hardening, 4 Nov 2026): the kind-only queue above is
 * now LEGACY — AppContext drains it once (migration) and new failures
 * queue the full PAYLOAD instead (services/payloadQueue.ts). The
 * writers below also gained: id assertion (loud, never silent skip),
 * public-shape degradation refusal for students, a non-union delete
 * writer (student deletes no longer resurrect via union), a trash-op
 * writer, scalar writers (schoolProfile, markEntryEnabled), and
 * confirmed writers for every field that previously depended on the
 * wholesale auto-sync (exams, assignments, promotion, remarks,
 * subjects, classes, academic years, sections). The wholesale
 * auto-sync itself is replaced by a diff/union propagator in
 * AppContext — no writer in this module can shrink a list.
 */
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { CANONICAL_PRIMARY_INSTITUTION_ID } from './dataAdapter';
import type { DailyStudentAttendanceRecord, DailyStaffAttendanceRecord } from './dailyAttendanceService';
import type { FinanceTransaction, MarkRecord, Student, AcademicTeacher, AppUser, NoticeItem, StaffLeaveRecord, Exam, Subject, SchoolClass, RemarkRecord, TrashItem } from '../types';
import type { ClassRoutineItem, SyllabusItem, AcademicCalendarEvent, AcademicYear, Section, ClassSubjectAssignment, TeacherSubjectAssignment, ClassTeacherAssignment, ExamSubjectAssignment } from '../types/academic';
import type { PromotionHistoryRecord } from '../types/promotion';
import {
  assertTripwire,
  assertUpsertRecords,
  findDegradingStudentIds,
  validateDeleteOp,
} from './mainStoreWrite';
import { fieldKeyFn } from './payloadQueue';

export const ATTENDANCE_CLOUD_FAILURE_MESSAGE =
  'হাজিরা এই ফোনে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const FEE_CLOUD_FAILURE_MESSAGE =
  'ফি এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

// Step 2 failure messages — same honest shape as Step 1: saved locally,
// NOT yet in cloud, retry action. Never "saved" without confirmation.
export const MARKS_CLOUD_FAILURE_MESSAGE =
  'নম্বর এই ফোনে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const STUDENTS_CLOUD_FAILURE_MESSAGE =
  'শিক্ষার্থীর তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const STUDENT_DELETE_CLOUD_FAILURE_MESSAGE =
  'শিক্ষার্থী এই ডিভাইসে ট্র্যাশে গেছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const STAFF_CLOUD_FAILURE_MESSAGE =
  'শিক্ষক/কর্মচারীর তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const NOTICES_CLOUD_FAILURE_MESSAGE =
  'নোটিশ এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const NOTICE_DELETE_CLOUD_FAILURE_MESSAGE =
  'নোটিশ এই ডিভাইসে মুছে গেছে, কিন্তু cloud-এ যায়নি — আবার চেষ্টা না করলে পরের বার ফিরে আসতে পারে। ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const SCHEDULE_CLOUD_FAILURE_MESSAGE =
  'রুটিন/সিলেবাস/ক্যালেন্ডার এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

// Fee Setup (2 Nov 2026): fee-structure saves use the same truthful-save
// pattern. A failed confirmation never drops local data: the structures
// stay in local state, the failure is queued, and the caller shows an
// honest failure notice with a retry action.
export const FEE_STRUCTURES_CLOUD_FAILURE_MESSAGE =
  'ফি কাঠামো এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const FEE_TYPES_CLOUD_FAILURE_MESSAGE =
  'ফি-র ধরন এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';
export const LEAVE_CLOUD_FAILURE_MESSAGE =
  'ছুটির আবেদন এই ফোনে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

// Phase 1 (sync hardening, 4 Nov 2026): failure texts for the fields
// that had no confirmed writer before. Same honest shape: saved
// locally, NOT yet in cloud, retry action. Never "saved" without
// confirmation.
export const EXAMS_CLOUD_FAILURE_MESSAGE =
  'পরীক্ষার তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

// 7 Nov 2026 Job 2: the class/section/subject confirms used to reuse
// the exam message above, so a failed class save blamed the exam.
// Each field now reports itself.
export const CLASSES_CLOUD_FAILURE_MESSAGE =
  'শ্রেণির তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const SECTIONS_CLOUD_FAILURE_MESSAGE =
  'শাখার তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const SUBJECTS_CLOUD_FAILURE_MESSAGE =
  'বিষয়ের তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const ASSIGNMENTS_CLOUD_FAILURE_MESSAGE =
  'অ্যাসাইনমেন্টের তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const PROMOTION_CLOUD_FAILURE_MESSAGE =
  'প্রমোশনের তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const REMARKS_CLOUD_FAILURE_MESSAGE =
  'মন্তব্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const SCHOOL_PROFILE_CLOUD_FAILURE_MESSAGE =
  'প্রতিষ্ঠানের তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const MARK_ENTRY_CLOUD_FAILURE_MESSAGE =
  'মার্ক এন্ট্রি সেটিং এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const DELETE_CLOUD_FAILURE_MESSAGE =
  'মোছা তথ্য এই ডিভাইসে আপডেট হয়েছে, কিন্তু cloud-এ যায়নি — আবার চেষ্টা না করলে পরের বার ফিরে আসতে পারে। ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const TRASH_CLOUD_FAILURE_MESSAGE =
  'ট্র্যাশের তথ্য এই ডিভাইসে আপডেট হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

// HR Phase 5: payroll salary saves reuse the transactions-field confirm
// (confirmFeeCloudSync) with their own failure text — the voucher is
// local-only until the confirm lands, so no receipt may print before it.
export const SALARY_CLOUD_FAILURE_MESSAGE =
  'বেতনের রেকর্ড এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — রসিদ ছাপার আগে ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const feeCloudFailureMessage = (voucherNo: string): string =>
  `রসিদ নং ${voucherNo} এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — প্রিন্সিপালের খাতায় এখনো ওঠেনি। আবার চেষ্টা করুন।`;

export const RECEIPT_LOCAL_ONLY_NOTE =
  'এই রসিদ এখনো শুধু এই ডিভাইসে আছে — cloud-এ যায়নি।';

export const RETRY_LABEL = 'আবার চেষ্টা করুন';

const CONFIRM_TIMEOUT_MS = 40000;

// Student saves carry the largest single field (~341 KB full-doc read +
// full-list write). On a slow phone connection the shared 40s cap can
// expire before the round-trip finishes, so the students writer gets a
// longer cap. See 7 Nov 2026 emergency (student add/edit Save doing
// nothing on the phone).
const STUDENTS_CONFIRM_TIMEOUT_MS = 90000;

// 7 Nov 2026 Job 3 (staff save): the staff confirm reads the same full
// ~341 KB main_store (getDoc) and writes the teachers + users lists, so
// it carries the same timeout risk as students — same 90s cap.
const STAFF_CONFIRM_TIMEOUT_MS = 90000;
const PENDING_KEY = 'ldsdm_pending_cloud_confirms';

export type PendingConfirmKind =
  | 'attendance'
  | 'staffAttendance'
  | 'fee'
  | 'marks'
  | 'students'
  | 'studentDelete'
  | 'staff'
  | 'notices'
  | 'schedule'
  | 'leaves'
  | 'feeStructures'
  | 'feeTypes';

export type CloudConfirmResult = { success: boolean; message?: string; rawMessage?: string };

/** Union by record key; incoming (local) records win on key conflict. */
export function mergeRecordsByKey<T>(
  existing: T[],
  incoming: T[],
  keyFn: (r: T) => string
): T[] {
  const map = new Map<string, T>();
  (existing || []).forEach((r) => {
    const k = r ? keyFn(r) : '';
    if (k) map.set(k, r);
  });
  (incoming || []).forEach((r) => {
    const k = r ? keyFn(r) : '';
    if (k) map.set(k, r);
  });
  return Array.from(map.values());
}

/** Union by record id; incoming (local) records win on id conflict. */
export function mergeRecordsById<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  return mergeRecordsByKey(existing, incoming, (r) => (r && r.id ? r.id : ''));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Defense in depth for the same Firestore rule: setDoc rejects explicit
 * `undefined` field values anywhere in the document, so every record is
 * shallow-stripped of undefined-valued top-level keys before the write.
 * This is the shared choke point for ALL confirmed writers (students,
 * staff, marks, notices, schedule, leaves, fee structures/types,
 * attendance, transactions, deletes), so it also covers paths that
 * bypass the per-domain builders (e.g. updateStudent when the existing
 * record is not found, bulkUpdateStudents). ONLY `undefined` is removed
 * — '', 0, false and null are valid Firestore values and are kept.
 * Records without undefined keys pass through untouched (same object).
 */
export function stripUndefinedRecord<T>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  let dirty = false;
  for (const value of Object.values(record as Record<string, unknown>)) {
    if (value === undefined) { dirty = true; break; }
  }
  if (!dirty) return record;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

/**
 * Step 1 password removal: strip plain-text password from staff/user
 * records before writing to Firestore. Passwords belong strictly in
 * Firebase Auth.
 */
export function stripStaffPassword<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  if (!('password' in record)) return record;
  const { password, ...rest } = record;
  return rest as T;
}

/**
 * Phase 1 choke-point routing (4 Nov 2026): every confirmed writer
 * passes through here, so no writer can bypass the validators.
 *  - Id assertion: a record without its field's stable key throws
 *    (the old merge silently skipped id-less records — a save that
 *    looked successful while the record never landed).
 *  - Students degradation: an incoming public-shaped student record
 *    replacing a fuller cloud record throws the WHOLE write (fail
 *    closed) — the 11:17 degradation class, at one-record blast
 *    radius instead of whole-store.
 *  - Empty incoming lists are skipped, never written: a union write
 *    of [] is a no-op anyway, and skipping keeps an empty local list
 *    from ever being mistaken for an instruction to clear the field.
 *    Deletions never flow through here — they use the delete writers.
 */
async function writeFieldsToCloud(
  fields: Record<string, Record<string, any>[]>,
  updatedBy: string,
  keyFns?: Record<string, (r: Record<string, any>) => string>
): Promise<void> {
  const ref = doc(db, 'institution', 'main_store');
  const snap = await getDoc(ref);
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = { updatedBy, updatedAt: new Date().toISOString() };
  const cloudTrash = (data.trashBin as any[] | undefined) || [];
  const cloudTrashedIds = new Set<string>();
  cloudTrash.forEach((t) => {
    if (t?.data?.id) cloudTrashedIds.add(String(t.data.id));
    if (t?.id) cloudTrashedIds.add(String(t.id));
  });

  for (const [field, localRecords] of Object.entries(fields)) {
    let records = localRecords || [];
    if (field === 'teachers' || field === 'users') {
      records = records.map(stripStaffPassword);
    }
    if (records.length === 0) continue;
    const keyFn = (keyFns && keyFns[field]) || fieldKeyFn(field);
    assertUpsertRecords(field, records, keyFn, field === 'remarks' ? 'studentId+examId' : field === 'feeStructures' ? 'classLevel' : 'id');
    const existing = data[field] as Record<string, any>[] | undefined;
    if (field === 'students') {
      const degrading = findDegradingStudentIds(existing || [], records);
      if (degrading.length > 0) {
        throw new Error(
          `Phase 1 choke point: students write rejected — ${degrading.length} record(s) carry only public fields while the cloud holds fuller records for them. ` +
            `Writing them would degrade those records, so the whole write was refused.`
        );
      }
    }
    // Choke point guard (A6): refuse to resurrect records that exist in trashBin
    const unTrashedRecords = records.filter(r => !cloudTrashedIds.has(keyFn(r)));
    const merged = mergeRecordsByKey(existing || [], unTrashedRecords, keyFn).map(stripUndefinedRecord);
    // Ensure any previously trashed record lingering in cloud existing is also pruned
    payload[field] = merged.filter(r => !cloudTrashedIds.has(keyFn(r)));
  }
  if (Object.keys(payload).length <= 2) return;
  await setDoc(ref, payload, { merge: true });
}

async function writeFieldToCloud(
  field: string,
  localRecords: Record<string, any>[],
  updatedBy: string,
  keyFn?: (r: Record<string, any>) => string
): Promise<void> {
  await writeFieldsToCloud({ [field]: localRecords }, updatedBy, keyFn ? { [field]: keyFn } : undefined);
}

/**
 * Job 9 (attendance split): the new home of daily student + staff
 * attendance. One collection per field, paths built from
 * CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape as
 * Job 2's schedule collections. Doc id is the record id, which is
 * already in date_id form (`2026-11-07_ST-12`).
 */
export type AttendanceSplitField = 'dailyStudentAttendance' | 'dailyStaffAttendance';

export function attendanceCollectionRef(field: AttendanceSplitField) {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, field);
}

export function dailyStudentAttendanceCollectionRef() {
  return attendanceCollectionRef('dailyStudentAttendance');
}

export function dailyStaffAttendanceCollectionRef() {
  return attendanceCollectionRef('dailyStaffAttendance');
}

/** Write attendance records into their new collection (setDoc merge by id). */
export async function writeAttendanceRecordsToCollection(field: AttendanceSplitField, records: any[]): Promise<void> {
  const col = attendanceCollectionRef(field);
  for (const r of records || []) {
    if (!r || !r.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(r.id)), stripUndefinedRecord(r), { merge: true });
  }
}

/** Read all docs of one attendance field from its new collection (empty array when none). */
export async function readAttendanceFieldFromCollection(field: AttendanceSplitField): Promise<any[]> {
  const snap = await getDocs(attendanceCollectionRef(field));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return { ...data, id: data.id || d.id };
  });
}

export async function writeAttendanceFieldToCloud(
  records: DailyStudentAttendanceRecord[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = records || [];
    if (list.length > 0) {
      // Job 9 dual-write: same id assertion as the main_store leg, then
      // the new collection first. A failure anywhere fails the whole
      // write, so the payload queue + retry replay both legs.
      assertUpsertRecords('dailyStudentAttendance', list as any, fieldKeyFn('dailyStudentAttendance'));
      await writeAttendanceRecordsToCollection('dailyStudentAttendance', list as any);
    }
    // The old main_store write stays — stopping it is a separate push
    // after one week of dual-write, never this job.
    await writeFieldToCloud('dailyStudentAttendance', records, updatedBy);
  };
  await withTimeout(
    write(),
    CONFIRM_TIMEOUT_MS,
    'attendance cloud confirm'
  );
}

export async function writeStaffAttendanceFieldToCloud(
  records: DailyStaffAttendanceRecord[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = records || [];
    if (list.length > 0) {
      // Job 9 dual-write: same shape as the student leg above.
      assertUpsertRecords('dailyStaffAttendance', list as any, fieldKeyFn('dailyStaffAttendance'));
      await writeAttendanceRecordsToCollection('dailyStaffAttendance', list as any);
    }
    // The old main_store write stays — stopping it is a separate push
    // after one week of dual-write, never this job.
    await writeFieldToCloud('dailyStaffAttendance', records, updatedBy);
  };
  await withTimeout(
    write(),
    CONFIRM_TIMEOUT_MS,
    'staff attendance cloud confirm'
  );
}

/**
 * Job 10 (transactions split): the new home of fee transactions. One
 * collection, path built from CANONICAL_PRIMARY_INSTITUTION_ID, never
 * hardcoded — same shape as Job 1's notices collection.
 */
export function transactionsCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'transactions');
}

/** Read all transaction docs from the new collection (empty array when none). */
export async function readTransactionsFromCollection(): Promise<FinanceTransaction[]> {
  const snap = await getDocs(transactionsCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as FinanceTransaction;
    return { ...data, id: data.id || d.id };
  });
}

/** Write transaction docs into the new collection (setDoc merge by id). */
export async function writeTransactionsToCollection(transactions: FinanceTransaction[]): Promise<void> {
  const col = transactionsCollectionRef();
  for (const t of transactions || []) {
    if (!t || !t.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(t.id)), stripUndefinedRecord(t), { merge: true });
  }
}

/** Delete transaction docs from the new collection (missing docs are a no-op). */
export async function deleteTransactionsFromCollection(ids: string[]): Promise<void> {
  const col = transactionsCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

export async function writeTransactionsFieldToCloud(
  transactions: FinanceTransaction[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = transactions || [];
    if (list.length > 0) {
      // Job 10 dual-write: same id assertion as the main_store leg, then
      // the new collection first. A failure anywhere fails the whole
      // write, so the payload queue + retry replay both legs. The first
      // fee transaction creates the (currently empty) collection.
      assertUpsertRecords('transactions', list as any, fieldKeyFn('transactions'));
      await writeTransactionsToCollection(list);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new transactions go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted transaction.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'fee cloud confirm');
}

// --- Step 2 field writers (same one-write, union-by-id, merge:true shape) ---
// Every record type here carries a stable `id` (marks, students, staff,
// users, notices, trash entries, routine/syllabus/calendar items), so the
// union never drops a record. A record without an id is skipped by
// mergeRecordsById — that invariant is what the verify script pins.

/**
 * Job 11 (marks split): the new home of marks. One collection, path
 * built from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded —
 * same shape as Job 1's notices collection.
 */
export function marksCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'marks');
}

/** Read all mark docs from the new collection (empty array when none). */
export async function readMarksFromCollection(): Promise<MarkRecord[]> {
  const snap = await getDocs(marksCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as MarkRecord;
    return { ...data, id: data.id || d.id };
  });
}

/**
 * Write mark docs into the new collection (setDoc merge by id).
 * Batched 500 at a time (Firestore limit): the full marks list is
 * 2,601 docs, and a sequential setDoc loop over it would blow the
 * 40 s confirm timeout — same batch shape as the backfill.
 */
export async function writeMarksToCollection(marks: MarkRecord[]): Promise<void> {
  const col = marksCollectionRef();
  const list = marks || [];
  for (let i = 0; i < list.length; i += 500) {
    const batch = writeBatch(db);
    for (const m of list.slice(i, i + 500)) {
      if (!m || !m.id) continue; // id assertion happens in the caller
      batch.set(doc(col, String(m.id)), stripUndefinedRecord(m), { merge: true });
    }
    await batch.commit();
  }
}

/** Delete mark docs from the new collection (missing docs are a no-op). */
export async function deleteMarksFromCollection(ids: string[]): Promise<void> {
  const col = marksCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

export async function writeMarksFieldToCloud(
  marks: MarkRecord[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = marks || [];
    if (list.length > 0) {
      // Job 11 dual-write: same id assertion as the main_store leg, then
      // the new collection first. A failure anywhere fails the whole
      // write, so the payload queue + retry replay both legs.
      assertUpsertRecords('marks', list as any, fieldKeyFn('marks'));
      await writeMarksToCollection(list);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new marks go to the collection
    // only. This ends the whole-list rewrite on every marks save:
    // the old leg rewrote the full 2,601-record list into main_store
    // each time; now only the marks collection docs are written.
    // Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted mark.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'marks cloud confirm');
}

export async function writeStudentsFieldToCloud(
  students: Student[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = students || [];
    if (list.length > 0) {
      assertUpsertRecords('students', list as any, fieldKeyFn('students'));
      // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
      // frozen copy stays untouched, new students go to the collection
      // only. The degradation guard stays, now checked against the
      // collection (the new source of truth) instead of main_store:
      // a public-shaped record must never overwrite a fuller
      // collection record. Delete + restore still prune/union
      // main_store (see the delete/trash-op writers), so the frozen
      // copy can never resurrect a deleted student. The tripwire
      // lives in writeDeleteFieldsToCloud, where the SAME
      // assertTripwire runs before any students collection doc is
      // deleted.
      const existing = await readStudentsFromCollection();
      const degrading = findDegradingStudentIds(existing as any, list as any);
      if (degrading.length > 0) {
        throw new Error(
          `Phase 1 choke point: students write rejected — ${degrading.length} record(s) carry only public fields while the cloud holds fuller records for them. ` +
            `Writing them would degrade those records, so the whole write was refused.`
        );
      }
      await writeStudentsToCollection(list);
    }
  };
  await withTimeout(
    write(),
    STUDENTS_CONFIRM_TIMEOUT_MS,
    'students cloud confirm'
  );
}

/**
 * Job 12 (students split): the new home of students. The path is built
 * from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape
 * as Job 1's notices collection.
 */
export function studentsCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'students');
}

/** Read all student docs from the new collection (empty array when none). */
export async function readStudentsFromCollection(): Promise<Student[]> {
  const snap = await getDocs(studentsCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as Student;
    return { ...data, id: data.id || d.id };
  });
}

/** Write student docs into the new collection (setDoc merge by id). */
export async function writeStudentsToCollection(students: Student[]): Promise<void> {
  const col = studentsCollectionRef();
  for (const s of students || []) {
    if (!s || !s.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(s.id)), stripUndefinedRecord(s), { merge: true });
  }
}

/** Delete student docs from the new collection (missing docs are a no-op). */
export async function deleteStudentsFromCollection(ids: string[]): Promise<void> {
  const col = studentsCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

/**
 * Phase 1 (sync hardening) — student-delete derivation, shared by the
 * writer and by AppContext's failure path (so the queued payload names
 * exactly the same ids the write would have removed).
 *
 * The removed ids come ONLY from trash entries: a student-type trash
 * entry whose data.id is missing from the post-delete student list.
 * Deriving from "cloud students minus local students" would be WRONG
 * for a stale local list — it would delete newer cloud students the
 * device had never seen. Trash entries are the explicit delete
 * evidence, so they are the only safe source.
 */
export function deriveStudentDeleteOp(
  students: Student[],
  trashBin: { id: string; type?: string; data?: any }[]
): { deletedIds: string[]; trashEntries: { id: string }[] } {
  const studentIds = new Set((students || []).map((s) => s.id));
  // Reload-race fix (25 Nov 2026): the bin can hold two entries for
  // one student (minted before the PR #72 delete dedupe). Carry one
  // id and one entry per student — the writer merges trash entries
  // by entry id, so carrying both would re-add the duplicate to the
  // cloud bin on every delete write.
  const deletedIds: string[] = [];
  (trashBin || []).forEach((t) => {
    if (t && t.type === 'student' && t.data && t.data.id && !studentIds.has(t.data.id) && !deletedIds.includes(String(t.data.id))) {
      deletedIds.push(String(t.data.id));
    }
  });
  if (deletedIds.length === 0) {
    throw new Error(
      'Phase 1 choke point: student delete refused — no trashed student id found in the delete payload. ' +
        'Refusing instead of guessing which students to remove.'
    );
  }
  // Carry ONLY the deleted students' entries — the writer merges them
  // into the cloud bin by id, so older entries already there stay.
  // Carrying the whole bin made every student delete re-write every
  // trash entry (one sequential setDoc each) inside the 40 s confirm
  // timeout; the teacher path carries only its new entries.
  const deletedSet = new Set(deletedIds);
  const seenTrashFor = new Set<string>();
  return {
    deletedIds,
    trashEntries: (trashBin || []).filter((t) => {
      if (!t || !t.id || t.type !== 'student' || !t.data?.id || !deletedSet.has(String(t.data.id))) return false;
      const k = String(t.data.id);
      if (seenTrashFor.has(k)) return false;
      seenTrashFor.add(k);
      return true;
    }) as { id: string }[],
  };
}

/**
 * Student delete (Phase 1 fix for audit rank 3): the old version
 * unioned students + trashBin, so the deleted student — absent
 * locally — was MERGED BACK from the cloud existing list and the
 * delete never stuck via this path (it depended on a later wholesale
 * auto-sync). Now the write REMOVES exactly the trashed ids and
 * appends the trash entries in the SAME write — no resurrection, no
 * half-deleted state.
 */
export async function writeStudentDeleteFieldsToCloud(
  students: Student[],
  trashBin: { id: string; type?: string; data?: any }[],
  updatedBy: string
): Promise<void> {
  const { deletedIds, trashEntries } = deriveStudentDeleteOp(students, trashBin);
  await withTimeout(
    writeDeleteFieldsToCloud([{ field: 'students', ids: deletedIds }], trashEntries as any, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'student delete cloud confirm'
  );
}

/** Staff create/edit touches teachers + users at once (deleteTeacher template) — one write carries both. */
export async function writeStaffFieldsToCloud(
  teachers: AcademicTeacher[],
  users: AppUser[],
  updatedBy: string
): Promise<void> {
  const safeTeachers = (teachers || []).map(stripStaffPassword);
  const safeUsers = (users || []).map(stripStaffPassword);
  await withTimeout(
    writeFieldsToCloud({ teachers: safeTeachers, users: safeUsers }, updatedBy),
    STAFF_CONFIRM_TIMEOUT_MS,
    'staff cloud confirm'
  );
}

/**
 * Job 1 (notices split): the new home of notices. The path is built
 * from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded.
 */
export function noticesCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'notices');
}

/** Read all notice docs from the new collection (empty array when none). */
export async function readNoticesFromCollection(): Promise<NoticeItem[]> {
  const snap = await getDocs(noticesCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as NoticeItem;
    return { ...data, id: data.id || d.id };
  });
}

/** Write notice docs into the new collection (setDoc merge by id). */
export async function writeNoticesToCollection(notices: NoticeItem[]): Promise<void> {
  const col = noticesCollectionRef();
  for (const n of notices || []) {
    if (!n || !n.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(n.id)), stripUndefinedRecord(n), { merge: true });
  }
}

/** Delete notice docs from the new collection (missing docs are a no-op). */
export async function deleteNoticesFromCollection(ids: string[]): Promise<void> {
  const col = noticesCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

export async function writeNoticesFieldToCloud(
  notices: NoticeItem[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = notices || [];
    if (list.length > 0) {
      // Job 1 dual-write: same id assertion as the main_store leg, then
      // the new collection first. A failure anywhere fails the whole
      // write, so the payload queue + retry replay both legs.
      assertUpsertRecords('notices', list as any, fieldKeyFn('notices'));
      await writeNoticesToCollection(list);
    }
    // Step 5 (21 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new notices go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted notice.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'notices cloud confirm');
}

/**
 * Job 2 (schedule split): the new home of routines + syllabus +
 * calendar. One collection per field, paths built from
 * CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape as
 * Job 1's notices collection.
 */
export type ScheduleSplitField = 'classRoutines' | 'syllabusItems' | 'calendarEvents';

export function scheduleCollectionRef(field: ScheduleSplitField) {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, field);
}

export function classRoutinesCollectionRef() {
  return scheduleCollectionRef('classRoutines');
}

export function syllabusItemsCollectionRef() {
  return scheduleCollectionRef('syllabusItems');
}

export function calendarEventsCollectionRef() {
  return scheduleCollectionRef('calendarEvents');
}

/** Write schedule records into their new collection (setDoc merge by id). */
export async function writeScheduleRecordsToCollection(field: ScheduleSplitField, records: any[]): Promise<void> {
  const col = scheduleCollectionRef(field);
  for (const r of records || []) {
    if (!r || !r.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(r.id)), stripUndefinedRecord(r), { merge: true });
  }
}

/** Delete schedule docs from their new collection (missing docs are a no-op). */
export async function deleteScheduleRecordsFromCollection(field: ScheduleSplitField, ids: string[]): Promise<void> {
  const col = scheduleCollectionRef(field);
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

/** Read all docs of one schedule field from its new collection (empty array when none). */
export async function readScheduleFieldFromCollection(field: ScheduleSplitField): Promise<any[]> {
  const snap = await getDocs(scheduleCollectionRef(field));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return { ...data, id: data.id || d.id };
  });
}

/**
 * Job 5 (fees split): the new home of feeTypes + feeStructures. One
 * collection per field, paths built from
 * CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape as
 * Job 2's schedule collections. feeStructures is keyed by classLevel,
 * NOT by id: the document id IS the class name (e.g. 'Class 6'), one
 * structure per class — today's union rule, kept.
 */
export type FeesSplitField = 'feeTypes' | 'feeStructures';

export function feesCollectionRef(field: FeesSplitField) {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, field);
}

export function feeTypesCollectionRef() {
  return feesCollectionRef('feeTypes');
}

export function feeStructuresCollectionRef() {
  return feesCollectionRef('feeStructures');
}

/** Write fee records into their new collection (setDoc merge, doc id = field key: id for feeTypes, classLevel for feeStructures). */
export async function writeFeeRecordsToCollection(field: FeesSplitField, records: any[]): Promise<void> {
  const col = feesCollectionRef(field);
  const keyFn = fieldKeyFn(field);
  for (const r of records || []) {
    const key = r ? keyFn(r) : '';
    if (!key) continue; // key assertion happens in the caller
    await setDoc(doc(col, String(key)), stripUndefinedRecord(r), { merge: true });
  }
}

/** Delete fee docs from their new collection (missing docs are a no-op). Ids are field keys: id for feeTypes, classLevel for feeStructures. */
export async function deleteFeeRecordsFromCollection(field: FeesSplitField, ids: string[]): Promise<void> {
  const col = feesCollectionRef(field);
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

/** Read all docs of one fees field from its new collection (empty array when none). */
export async function readFeesFieldFromCollection(field: FeesSplitField): Promise<any[]> {
  const snap = await getDocs(feesCollectionRef(field));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return { ...data, id: data.id || d.id };
  });
}

/** Routine + syllabus + calendar travel together (one editor save can touch all three via the bridge) — one write carries all three. */
export async function writeScheduleFieldsToCloud(
  routines: ClassRoutineItem[],
  syllabusItems: SyllabusItem[],
  calendarEvents: AcademicCalendarEvent[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const lists = {
      classRoutines: routines || [],
      syllabusItems: syllabusItems || [],
      calendarEvents: calendarEvents || [],
    } as Record<ScheduleSplitField, any[]>;
    for (const field of Object.keys(lists) as ScheduleSplitField[]) {
      const list = lists[field];
      if (list.length > 0) {
        // Job 2 dual-write: same id assertion as the main_store leg,
        // then the new collection first. A failure anywhere fails the
        // whole write, so the payload queue + retry replay both legs.
        assertUpsertRecords(field, list as any, fieldKeyFn(field));
        await writeScheduleRecordsToCollection(field, list as any);
      }
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new schedule records go to the
    // collections only. Delete + restore still prune/union main_store
    // (see the delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted record.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'schedule cloud confirm');
}

/**
 * Job 3 (classes split): the new home of classes + sections +
 * academicYears. One collection per field, paths built from
 * CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape as
 * Job 2's schedule collections.
 */
export type ClassesSplitField = 'classes' | 'sections' | 'academicYears';

export function classesCollectionRef(field: ClassesSplitField) {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, field);
}

export function schoolClassesCollectionRef() {
  return classesCollectionRef('classes');
}

export function sectionsCollectionRef() {
  return classesCollectionRef('sections');
}

export function academicYearsCollectionRef() {
  return classesCollectionRef('academicYears');
}

/** Write class/section/year records into their new collection (setDoc merge by id). */
export async function writeClassesRecordsToCollection(field: ClassesSplitField, records: any[]): Promise<void> {
  const col = classesCollectionRef(field);
  for (const r of records || []) {
    if (!r || !r.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(r.id)), stripUndefinedRecord(r), { merge: true });
  }
}

/**
 * Job 4 (academic split): the new home of subjects + exams + the four
 * assignment lists. One collection per field, paths built from
 * CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape as
 * Job 2's schedule collections and Job 3's classes collections.
 * subjects + exams are TRIPWIRE_FIELDS: the collection writes below
 * are setDoc merge per record, so they can never shrink a list — a
 * shrink only ever happens through writeDeleteFieldsToCloud, where
 * the SAME assertTripwire runs before any doc is deleted.
 */
export type AcademicSplitField = 'subjects' | 'exams' | 'examSubjectAssignments' | 'classSubjectAssignments' | 'teacherSubjectAssignments' | 'classTeacherAssignments';

export function academicCollectionRef(field: AcademicSplitField) {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, field);
}

export function subjectsCollectionRef() {
  return academicCollectionRef('subjects');
}

export function examsCollectionRef() {
  return academicCollectionRef('exams');
}

export function examSubjectAssignmentsCollectionRef() {
  return academicCollectionRef('examSubjectAssignments');
}

export function classSubjectAssignmentsCollectionRef() {
  return academicCollectionRef('classSubjectAssignments');
}

export function teacherSubjectAssignmentsCollectionRef() {
  return academicCollectionRef('teacherSubjectAssignments');
}

export function classTeacherAssignmentsCollectionRef() {
  return academicCollectionRef('classTeacherAssignments');
}

/** Write academic records into their new collection (setDoc merge by id). */
export async function writeAcademicRecordsToCollection(field: AcademicSplitField, records: any[]): Promise<void> {
  const col = academicCollectionRef(field);
  for (const r of records || []) {
    if (!r || !r.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(r.id)), stripUndefinedRecord(r), { merge: true });
  }
}

/** Delete class/section/year docs from their new collection (missing docs are a no-op). */
export async function deleteClassesRecordsFromCollection(field: ClassesSplitField, ids: string[]): Promise<void> {
  const col = classesCollectionRef(field);
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

/** Delete academic docs from their new collection (missing docs are a no-op). */
export async function deleteAcademicRecordsFromCollection(field: AcademicSplitField, ids: string[]): Promise<void> {
  const col = academicCollectionRef(field);
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

/** Read all docs of one classes field from its new collection (empty array when none). */
export async function readClassesFieldFromCollection(field: ClassesSplitField): Promise<any[]> {
  const snap = await getDocs(classesCollectionRef(field));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return { ...data, id: data.id || d.id };
  });
}
/** Read all docs of one academic field from its new collection (empty array when none). */
export async function readAcademicFieldFromCollection(field: AcademicSplitField): Promise<any[]> {
  const snap = await getDocs(academicCollectionRef(field));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return { ...data, id: data.id || d.id };
  });
}

/**
 * Job 8 (staffLeaves split): the new home of staff leave records. One
 * collection, path built from CANONICAL_PRIMARY_INSTITUTION_ID, never
 * hardcoded — same shape as Job 1's notices collection.
 */
export function staffLeavesCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'staffLeaves');
}

/** Read all leave docs from the new collection (empty array when none). */
export async function readStaffLeavesFromCollection(): Promise<StaffLeaveRecord[]> {
  const snap = await getDocs(staffLeavesCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as StaffLeaveRecord;
    return { ...data, id: data.id || d.id };
  });
}

/** Write leave docs into the new collection (setDoc merge by id). */
export async function writeStaffLeavesToCollection(leaves: StaffLeaveRecord[]): Promise<void> {
  const col = staffLeavesCollectionRef();
  for (const l of leaves || []) {
    if (!l || !l.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(l.id)), stripUndefinedRecord(l), { merge: true });
  }
}

/** Delete leave docs from the new collection (missing docs are a no-op). */
export async function deleteStaffLeavesFromCollection(ids: string[]): Promise<void> {
  const col = staffLeavesCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}
/** Step 4 (25 Oct 2026): staff leave records (staffLeaves field only). */
export async function writeStaffLeavesFieldToCloud(
  leaves: StaffLeaveRecord[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = leaves || [];
    if (list.length > 0) {
      // Step 5: collection-only — same id assertion as before, then
      // the new collection. A failure anywhere fails the whole
      // write, so the payload queue + retry replay it.
      assertUpsertRecords('staffLeaves', list as any, fieldKeyFn('staffLeaves'));
      await writeStaffLeavesToCollection(list);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new leaves go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted leave.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'leaves cloud confirm');
}

/**
 * Fee Setup (2 Nov 2026): fee-structure saves.
 * Union by classLevel (NOT by id): the setup UI seeds ids as `fs-<classId>`
 * while older records may carry generated ids, so id-union would keep
 * duplicate rows for one class. Incoming (local) rows win per class.
 * A structure save is always an upsert, never a delete, so union is safe.
 */
export async function writeFeeStructuresFieldToCloud(
  structures: { id: string; classLevel: string }[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    // Phase 1: classLevel assertion is now loud (was silently skipped
    // by the old map loop) — a structure without a classLevel can
    // never be keyed, so the write is refused instead of dropped.
    assertUpsertRecords('feeStructures', structures as any, (r) => (r.classLevel ? String(r.classLevel) : ''), 'classLevel');
    if (structures.length === 0) return;
    // Job 5 dual-write: the new collection first (doc id = classLevel).
    await writeFeeRecordsToCollection('feeStructures', structures as any);
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new structures go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted structure.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'fee structures cloud confirm');
}

/**
 * Fee Setup (2 Nov 2026): fee-type list saves. Type defs carry stable ids,
 * so the standard id-union applies; there is no delete-type action in the
 * UI (only add + enable/disable), so union cannot resurrect anything.
 */
export async function writeFeeTypesFieldToCloud(
  types: { id: string }[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = types || [];
    if (list.length > 0) {
      // Job 5: same id assertion as the old main_store leg, then the
      // new collection. A failure anywhere fails the whole write, so
      // the payload queue + retry replay the collection leg.
      assertUpsertRecords('feeTypes', list as any, fieldKeyFn('feeTypes'));
      await writeFeeRecordsToCollection('feeTypes', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new types go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted fee type.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'fee types cloud confirm');
}

// --- Phase 1 writers (4 Nov 2026): every field that previously had
// NO confirmed writer and therefore depended on the wholesale
// auto-sync. Same union-by-key, merge:true shape as the Step 2
// writers; each write names exactly the records it touches.
// Remarks key by studentId+examId (RemarkRecord carries no id);
// feeStructures keeps classLevel keying (above); everything else by id.

export async function writeExamsFieldToCloud(
  exams: Exam[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = exams || [];
    if (list.length > 0) {
      // Job 4 dual-write: same id assertion as the main_store leg,
      // then the new collection first. A failure anywhere fails the
      // whole write, so the payload queue + retry replay both legs.
      assertUpsertRecords('exams', list as any, fieldKeyFn('exams'));
      await writeAcademicRecordsToCollection('exams', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new exams go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted exam.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'exams cloud confirm');
}

export async function writeExamSubjectAssignmentsFieldToCloud(
  assignments: ExamSubjectAssignment[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = assignments || [];
    if (list.length > 0) {
      // Job 4 dual-write: same shape as exams above.
      assertUpsertRecords('examSubjectAssignments', list as any, fieldKeyFn('examSubjectAssignments'));
      await writeAcademicRecordsToCollection('examSubjectAssignments', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new exam-subject assignments go to
    // the collection only. Delete + restore still prune/union
    // main_store (see the delete/trash-op writers), so the frozen
    // copy can never resurrect a deleted assignment.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'exam subject assignments cloud confirm');
}

export async function writeClassSubjectAssignmentsFieldToCloud(
  assignments: ClassSubjectAssignment[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = assignments || [];
    if (list.length > 0) {
      // Job 4 dual-write: same shape as exams above.
      assertUpsertRecords('classSubjectAssignments', list as any, fieldKeyFn('classSubjectAssignments'));
      await writeAcademicRecordsToCollection('classSubjectAssignments', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new class-subject assignments go to
    // the collection only. Delete + restore still prune/union
    // main_store (see the delete/trash-op writers), so the frozen
    // copy can never resurrect a deleted assignment.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'class subject assignments cloud confirm');
}

export async function writeTeacherSubjectAssignmentsFieldToCloud(
  assignments: TeacherSubjectAssignment[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = assignments || [];
    if (list.length > 0) {
      // Job 4 dual-write: same shape as exams above.
      assertUpsertRecords('teacherSubjectAssignments', list as any, fieldKeyFn('teacherSubjectAssignments'));
      await writeAcademicRecordsToCollection('teacherSubjectAssignments', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new teacher-subject assignments go
    // to the collection only. Delete + restore still prune/union
    // main_store (see the delete/trash-op writers), so the frozen
    // copy can never resurrect a deleted assignment.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'teacher subject assignments cloud confirm');
}

export async function writeClassTeacherAssignmentsFieldToCloud(
  assignments: ClassTeacherAssignment[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = assignments || [];
    if (list.length > 0) {
      // Job 4 dual-write: same shape as exams above.
      assertUpsertRecords('classTeacherAssignments', list as any, fieldKeyFn('classTeacherAssignments'));
      await writeAcademicRecordsToCollection('classTeacherAssignments', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new class-teacher assignments go to
    // the collection only. Delete + restore still prune/union
    // main_store (see the delete/trash-op writers), so the frozen
    // copy can never resurrect a deleted assignment.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'class teacher assignments cloud confirm');
}

/**
 * Job 7 (promotionHistory split): the new home of promotion history.
 * The path is built from CANONICAL_PRIMARY_INSTITUTION_ID, never
 * hardcoded — same shape as Job 1's notices collection.
 */
export function promotionHistoryCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'promotionHistory');
}

/** Read all promotion history docs from the new collection (empty array when none). */
export async function readPromotionHistoryFromCollection(): Promise<PromotionHistoryRecord[]> {
  const snap = await getDocs(promotionHistoryCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as PromotionHistoryRecord;
    return { ...data, id: data.id || d.id };
  });
}

/** Write promotion history docs into the new collection (setDoc merge by id). */
export async function writePromotionHistoryToCollection(records: PromotionHistoryRecord[]): Promise<void> {
  const col = promotionHistoryCollectionRef();
  for (const r of records || []) {
    if (!r || !r.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(r.id)), stripUndefinedRecord(r), { merge: true });
  }
}

/** Delete promotion history docs from the new collection (missing docs are a no-op). */
export async function deletePromotionHistoryFromCollection(ids: string[]): Promise<void> {
  const col = promotionHistoryCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

export async function writePromotionHistoryFieldToCloud(
  records: PromotionHistoryRecord[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = records || [];
    if (list.length > 0) {
      // Job 7 dual-write: same id assertion as the main_store leg, then
      // the new collection first. A failure anywhere fails the whole
      // write, so the payload queue + retry replay both legs.
      assertUpsertRecords('promotionHistory', list as any, fieldKeyFn('promotionHistory'));
      await writePromotionHistoryToCollection(list);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new history goes to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a cleared record.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'promotion history cloud confirm');
}

/**
 * Job 6 (remarks split): the new home of remarks. The path is built
 * from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape
 * as Job 1's notices collection. RemarkRecord has NO id field — the
 * doc id is studentId__examId (fieldKeyFn('remarks')).
 */
export function remarksCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'remarks');
}

/** Read all remark docs from the new collection (empty array when none). */
export async function readRemarksFromCollection(): Promise<RemarkRecord[]> {
  const snap = await getDocs(remarksCollectionRef());
  return snap.docs.map((d) => {
    const data = d.data() as RemarkRecord;
    return { ...data, studentId: data.studentId || d.id.split('__')[0], examId: data.examId || d.id.split('__')[1] };
  });
}

/** Write remark docs into the new collection (setDoc merge by studentId__examId). */
export async function writeRemarksToCollection(remarks: RemarkRecord[]): Promise<void> {
  const col = remarksCollectionRef();
  const keyFn = fieldKeyFn('remarks'); // studentId__examId
  for (const r of remarks || []) {
    const key = r ? keyFn(r as any) : '';
    if (!key) continue; // key assertion happens in the caller
    await setDoc(doc(col, key), stripUndefinedRecord(r), { merge: true });
  }
}

/** Delete remark docs from the new collection (missing docs are a no-op). */
export async function deleteRemarksFromCollection(ids: string[]): Promise<void> {
  const col = remarksCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

export async function writeRemarksFieldToCloud(
  remarks: RemarkRecord[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = remarks || [];
    if (list.length > 0) {
      // Job 6 dual-write: same key assertion as the main_store leg, then
      // the new collection first. A failure anywhere fails the whole
      // write, so the payload queue + retry replay both legs.
      assertUpsertRecords('remarks', list as any, fieldKeyFn('remarks'), 'studentId+examId');
      await writeRemarksToCollection(list);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new remarks go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted remark.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'remarks cloud confirm');
}

export async function writeSubjectsFieldToCloud(
  subjects: Subject[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = subjects || [];
    if (list.length > 0) {
      // Job 4 dual-write: same shape as exams above. subjects is a
      // tripwire field, but this leg only ever ADDS/updates docs
      // (setDoc merge) — it can never shrink the collection.
      assertUpsertRecords('subjects', list as any, fieldKeyFn('subjects'));
      await writeAcademicRecordsToCollection('subjects', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new subjects go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted subject.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'subjects cloud confirm');
}

export async function writeClassesFieldToCloud(
  classes: SchoolClass[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = classes || [];
    if (list.length > 0) {
      // Job 3 dual-write: same id assertion as the main_store leg,
      // then the new collection first. A failure anywhere fails the
      // whole write, so the payload queue + retry replay both legs.
      assertUpsertRecords('classes', list as any, fieldKeyFn('classes'));
      await writeClassesRecordsToCollection('classes', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new classes go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted class.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'classes cloud confirm');
}

export async function writeAcademicYearsFieldToCloud(
  years: AcademicYear[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = years || [];
    if (list.length > 0) {
      // Job 3 dual-write: same shape as classes above.
      assertUpsertRecords('academicYears', list as any, fieldKeyFn('academicYears'));
      await writeClassesRecordsToCollection('academicYears', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new academic years go to the
    // collection only. Delete + restore still prune/union main_store
    // (see the delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted academic year.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'academic years cloud confirm');
}

export async function writeSectionsFieldToCloud(
  sections: Section[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const list = sections || [];
    if (list.length > 0) {
      // Job 3 dual-write: same shape as classes above.
      assertUpsertRecords('sections', list as any, fieldKeyFn('sections'));
      await writeClassesRecordsToCollection('sections', list as any);
    }
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, new sections go to the collection
    // only. Delete + restore still prune/union main_store (see the
    // delete/trash-op writers), so the frozen copy can never
    // resurrect a deleted section.
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'sections cloud confirm');
}

/**
 * Job 14 (settings split): the new home of schoolProfile +
 * markEntryEnabled. ONE document — institutions/<CANONICAL>/
 * settings/main — holding both fields. The path is built from
 * CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded. Writes use
 * setDoc merge, so a profile write never wipes the switch and a
 * switch write never wipes the profile.
 */
export function settingsDocRef() {
  return doc(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'settings', 'main');
}

/** Read the settings doc (empty object when it does not exist yet). */
export async function readSettingsFromCollection(): Promise<{ schoolProfile?: Record<string, any>; markEntryEnabled?: boolean }> {
  const snap = await getDoc(settingsDocRef());
  return snap.exists() ? (snap.data() as any) : {};
}

/** Write one or both settings fields (setDoc merge — one never wipes the other). */
export async function writeSettingsToCollection(patch: Record<string, any>): Promise<void> {
  await setDoc(settingsDocRef(), stripUndefinedRecord(patch), { merge: true });
}

/**
 * Pure: a settings doc snapshot -> applyRemoteData payload. Only
 * fields actually present are carried — a missing markEntryEnabled
 * is NEVER invented as false, so the read keeps its default-open
 * rule (only a real boolean closes the switch). A non-object
 * profile is dropped, so the feed's completeness gate sees it as
 * an incomplete doc and falls back to main_store.
 */
export function settingsDocToRemoteData(data: any): { schoolProfile?: Record<string, any>; markEntryEnabled?: boolean } {
  if (!data || typeof data !== 'object') return {};
  const out: { schoolProfile?: Record<string, any>; markEntryEnabled?: boolean } = {};
  if (data.schoolProfile && typeof data.schoolProfile === 'object' && !Array.isArray(data.schoolProfile)) out.schoolProfile = data.schoolProfile;
  if (typeof data.markEntryEnabled === 'boolean') out.markEntryEnabled = data.markEntryEnabled;
  return out;
}

/**
 * Scalar writers: schoolProfile is an object (not an array) and
 * markEntryEnabled is a boolean. Both are single-field setDoc merge
 * writes — they touch nothing else. A non-boolean markEntryEnabled or
 * a non-object profile is refused loudly, never written.
 */
export async function writeSchoolProfileFieldToCloud(
  profile: Record<string, any>,
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new Error('Phase 1 choke point: schoolProfile write rejected — profile is not an object.');
    }
    const updatedAt = new Date().toISOString();
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, the profile goes to settings/main
    // only. These scalars are never deleted or trashed, so no
    // delete/restore prune/union exists for them.
    await writeSettingsToCollection({ schoolProfile: stripUndefinedRecord(profile), updatedBy, updatedAt });
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'school profile cloud confirm');
}

export async function writeMarkEntryEnabledFieldToCloud(
  enabled: boolean,
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    if (typeof enabled !== 'boolean') {
      throw new Error('Phase 1 choke point: markEntryEnabled write rejected — value is not a boolean.');
    }
    const updatedAt = new Date().toISOString();
    // Step 5 (26 Nov 2026): the old main_store leg is stopped — the
    // frozen copy stays untouched, the switch goes to settings/main
    // only. Same shape as the profile writer above.
    await writeSettingsToCollection({ markEntryEnabled: enabled, updatedBy, updatedAt });
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'mark entry cloud confirm');
}

/**
 * Job 13 (trash split): the new home of trashBin. The path is built
 * from CANONICAL_PRIMARY_INSTITUTION_ID, never hardcoded — same shape
 * as Job 1's notices collection. Doc id = TrashItem.id.
 */
export function trashCollectionRef() {
  return collection(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, 'trash');
}

/** Write trash entries into the new collection (setDoc merge by id). */
export async function writeTrashRecordsToCollection(entries: TrashItem[]): Promise<void> {
  const col = trashCollectionRef();
  for (const e of entries || []) {
    if (!e || !e.id) continue; // id assertion happens in the caller
    await setDoc(doc(col, String(e.id)), stripUndefinedRecord(e), { merge: true });
  }
}

/** Delete trash docs from the new collection (missing docs are a no-op). */
export async function deleteTrashRecordsFromCollection(ids: string[]): Promise<void> {
  const col = trashCollectionRef();
  for (const id of ids || []) {
    if (!id) continue;
    await deleteDoc(doc(col, String(id)));
  }
}

/**
 * Job 13 (plan §6 Job 13 point 2): a deleteDoc under
 * institutions/{id}/{document=**} succeeds only for the super admin —
 * firestore.rules isSuperAdmin() checks the owner EMAIL only
 * (mehedihasansagor26@gmail.com); the principal's {role:'admin'}
 * custom claim never grants it. Anyone else gets permission-denied
 * and the doc STAYS; the trash filter hides it from lists, so on
 * screen nothing changes. Swallow ONLY that error, so the trash
 * write itself still lands; any other failure fails the whole write
 * and queues a retry, as today.
 */
async function deleteSplitDocsBestEffort(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn('Collection delete skipped (not super admin — record stays, hidden by the trash filter):', err?.message || err);
      return;
    }
    throw err;
  }
}

/**
 * Phase 1 DELETE writer (upsert/delete split): removes EXACTLY the
 * named ids from their fields AND appends the given trash entries in
 * the SAME write, failing closed if the write itself fails. An id
 * that is already absent from the cloud is treated as already gone
 * (idempotent success for that id) — a local-only record's delete
 * must not fail forever just because the cloud never had it. This is
 * the writer the plan's "fail closed if the ids are not found" means:
 * the WRITE fails closed, not the id lookup. Trash-first UI (which
 * deletes gain trash entries) is Phase 2; this writer accepts an
 * empty trash list so today's no-trash deletes (teacher/user,
 * notice) keep their current behavior while gaining confirmation.
 */
export async function writeDeleteFieldsToCloud(
  removals: { field: string; ids: string[] }[],
  trashEntries: { id: string }[],
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const cleanRemovals = (removals || []).filter((r) => r && r.ids && r.ids.length > 0);
    const cleanTrash = (trashEntries || []).filter((t) => t && t.id);
    if (cleanRemovals.length === 0 && cleanTrash.length === 0) return;
    validateDeleteOp(cleanRemovals, cleanTrash);
    const ref = doc(db, 'institution', 'main_store');
    const snap = await getDoc(ref);
    const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = { updatedBy, updatedAt: new Date().toISOString() };
    const oldSizes: Record<string, number> = {};
    const newSizes: Record<string, number> = {};
    for (const removal of cleanRemovals) {
      const existing = data[removal.field] as Record<string, any>[] | undefined;
      const keyFn = fieldKeyFn(removal.field);
      const ids = new Set(removal.ids);
      payload[removal.field] = (existing || []).filter((r) => !ids.has(keyFn(r)));
      oldSizes[removal.field] = (existing || []).length;
      newSizes[removal.field] = (payload[removal.field] as any[]).length;
    }
    if (cleanTrash.length > 0) {
      const existingTrash = (data.trashBin as { id: string }[] | undefined) || [];
      payload.trashBin = mergeRecordsByKey(existingTrash, cleanTrash as any, (r: any) => (r.id ? String(r.id) : '')).map(stripUndefinedRecord);
    }
    // Phase 2 client tripwire (plan §5, client-side first): this is
    // the only normal write site that shrinks protected lists, so the
    // check lives here — a shrink beyond the same-write trash growth
    // throws before setDoc. Restores never reach this writer.
    // Job 4: the check runs BEFORE any new-collection doc is deleted
    // (it used to run after) — subjects + exams are tripwire fields,
    // so a refused shrink must delete nothing anywhere, not even in
    // a collection the read-switch already treats as the source.
    // Job 10: transactions is a tripwire field too.
    // Job 11: marks is a tripwire field too.
    const oldTrashSize = ((data.trashBin as { id: string }[] | undefined) || []).length;
    const newTrashSize = cleanTrash.length > 0 ? (payload.trashBin as { id: string }[]).length : oldTrashSize;
    assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize);
    // Job 13 (trash split): the trash entries go to the new trash
    // collection FIRST (plan point 1) — same id assertion as the
    // main_store leg. A failure here fails the whole write, so the
    // payload queue + retry replay both legs.
    if (cleanTrash.length > 0) {
      assertUpsertRecords('trashBin', cleanTrash as any, fieldKeyFn('trashBin'));
      await writeTrashRecordsToCollection(cleanTrash as TrashItem[]);
    }
    // Job 1 (notices split): notices also live in the new collection —
    // delete their docs there too, so a deleted notice can never be
    // resurrected by the notices feed. deleteDoc of a missing doc
    // succeeds, so a retry replays this idempotently.
    // Job 13 point 2: the delete is best-effort — the super admin's
    // deleteDoc succeeds; anyone else gets permission-denied, the doc
    // stays, and the trash filter hides it (see the notices/schedule
    // branches in applyRemoteData).
    for (const removal of cleanRemovals) {
      if (removal.field === 'notices') {
        await deleteSplitDocsBestEffort(() => deleteNoticesFromCollection(removal.ids));
      } else if (removal.field === 'classRoutines' || removal.field === 'syllabusItems' || removal.field === 'calendarEvents') {
        // Job 2 (schedule split): schedule records also live in the new
        // collections — delete their docs there too, so a deleted
        // routine can never be resurrected by a schedule feed.
        await deleteSplitDocsBestEffort(() => deleteScheduleRecordsFromCollection(removal.field as ScheduleSplitField, removal.ids));
      } else if (removal.field === 'classes' || removal.field === 'sections' || removal.field === 'academicYears') {
        // Job 3 (classes split): class/section/year records also live
        // in the new collections — delete their docs there too, so a
        // deleted class can never be resurrected by a classes feed.
        await deleteSplitDocsBestEffort(() => deleteClassesRecordsFromCollection(removal.field as ClassesSplitField, removal.ids));
      } else if (removal.field === 'subjects' || removal.field === 'exams' || removal.field === 'examSubjectAssignments' || removal.field === 'classSubjectAssignments' || removal.field === 'teacherSubjectAssignments' || removal.field === 'classTeacherAssignments') {
        // Job 4 (academic split): academic records also live in the
        // new collections — delete their docs there too, so a deleted
        // subject/exam/assignment can never be resurrected by an
        // academic feed.
        await deleteSplitDocsBestEffort(() => deleteAcademicRecordsFromCollection(removal.field as AcademicSplitField, removal.ids));
      } else if (removal.field === 'feeTypes' || removal.field === 'feeStructures') {
        // Job 5 (fees split): fee records also live in the new
        // collections — delete their docs there too, so a deleted fee
        // type/structure can never be resurrected by a fees feed.
        // Removal ids are field keys: id for feeTypes, classLevel for
        // feeStructures.
        await deleteSplitDocsBestEffort(() => deleteFeeRecordsFromCollection(removal.field as FeesSplitField, removal.ids));
      } else if (removal.field === 'remarks') {
        // Job 6 (remarks split): remarks also live in the new
        // collection — delete their docs there too, so a deleted remark
        // can never be resurrected by the remarks feed. Ids here are
        // studentId__examId keys, which are the collection doc ids.
        await deleteSplitDocsBestEffort(() => deleteRemarksFromCollection(removal.ids));
      } else if (removal.field === 'promotionHistory') {
        // Job 7 (promotionHistory split): history records also live in
        // the new collection — delete their docs there too, so a
        // cleared record can never be resurrected by the promotion feed.
        await deleteSplitDocsBestEffort(() => deletePromotionHistoryFromCollection(removal.ids));
      } else if (removal.field === 'staffLeaves') {
        // Job 8 (staffLeaves split): leave records also live in the new
        // collection — delete their docs there too, so a deleted leave
        // can never be resurrected by the leaves feed.
        await deleteSplitDocsBestEffort(() => deleteStaffLeavesFromCollection(removal.ids));
      } else if (removal.field === 'transactions') {
        // Job 10 (transactions split): transaction records also live
        // in the new collection — delete their docs there too, so a
        // deleted transaction can never be resurrected by the
        // transactions feed.
        await deleteSplitDocsBestEffort(() => deleteTransactionsFromCollection(removal.ids));
      } else if (removal.field === 'marks') {
        // Job 11 (marks split): mark records also live in the new
        // collection — delete their docs there too, so a deleted mark
        // can never be resurrected by the marks feed.
        await deleteSplitDocsBestEffort(() => deleteMarksFromCollection(removal.ids));
      } else if (removal.field === 'students') {
        // Job 12 (students split): students also live in the new
        // collection — delete their docs there too, so a trashed student
        // can never be resurrected by the students feed.
        await deleteSplitDocsBestEffort(() => deleteStudentsFromCollection(removal.ids));
      }
    }
    await setDoc(ref, payload, { merge: true });
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'delete cloud confirm');
}

/**
 * Phase 1 TRASH-OP writer (non-union, by id): restore, permanent
 * delete, restore-all and empty all flow through one read-modify-
 * write. The trash list itself is computed from the CURRENT cloud
 * trash minus the named ids (never from a stale local list), so a
 * newer trash entry added by another device is never dropped; the
 * restored records are unioned into their lists in the same write,
 * so a restore can never leave a record in neither list nor trash.
 */
export async function writeTrashOpToCloud(
  removeTrashIds: string[],
  upserts: Record<string, Record<string, any>[]>,
  updatedBy: string
): Promise<void> {
  const write = async (): Promise<void> => {
    const ids = (removeTrashIds || []).filter((id) => typeof id === 'string' && id.length > 0);
    const upsertFields = Object.entries(upserts || {}).filter(([, recs]) => recs && recs.length > 0);
    if (ids.length === 0 && upsertFields.length === 0) return;
    const ref = doc(db, 'institution', 'main_store');
    const snap = await getDoc(ref);
    const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = { updatedBy, updatedAt: new Date().toISOString() };
    const existingTrash = (data.trashBin as { id: string }[] | undefined) || [];
    const idSet = new Set(ids);
    payload.trashBin = existingTrash.filter((t) => !t.id || !idSet.has(String(t.id)));
    // RC (13 Nov 2026 live audit): tombstone guard — a restore
    // replayed after its record was trashed again (stale queued
    // payload, another tab, in-flight confirm) must not resurrect
    // it. The record's OWN trash entry is removed by THIS call, so
    // it never blocks its own restore; any OTHER trash entry for
    // the same record does.
    const trashedDataIds = new Set<string>();
    existingTrash.forEach((t: any) => {
      if (t?.id && !idSet.has(String(t.id)) && t?.data?.id) trashedDataIds.add(String(t.data.id));
    });
    const writtenFields: [string, Record<string, any>[]][] = [];
    for (const [field, records] of upsertFields) {
      const keyFn = fieldKeyFn(field);
      assertUpsertRecords(field, records, keyFn);
      const liveRecords = records.filter((r) => !trashedDataIds.has(keyFn(r)));
      if (liveRecords.length === 0) continue;
      const existing = data[field] as Record<string, any>[] | undefined;
      payload[field] = mergeRecordsByKey(existing || [], liveRecords, keyFn).map(stripUndefinedRecord);
      writtenFields.push([field, liveRecords]);
      // Job 1: a restored notice must also return to the new collection,
      // which is now the read source — otherwise the restore would stay
      // invisible until a main_store read.
      if (field === 'notices') {
        await writeNoticesToCollection(liveRecords as NoticeItem[]);
      } else if (field === 'classRoutines' || field === 'syllabusItems' || field === 'calendarEvents') {
        // Job 2: same for a restored schedule record — otherwise the
        // restore would stay invisible until a main_store read.
        await writeScheduleRecordsToCollection(field as ScheduleSplitField, liveRecords);
      } else if (field === 'classes' || field === 'sections' || field === 'academicYears') {
        // Job 3: same for a restored class/section/year record —
        // otherwise the restore would stay invisible until a
        // main_store read.
        await writeClassesRecordsToCollection(field as ClassesSplitField, liveRecords);
      } else if (field === 'subjects' || field === 'exams' || field === 'examSubjectAssignments' || field === 'classSubjectAssignments' || field === 'teacherSubjectAssignments' || field === 'classTeacherAssignments') {
        // Job 4: same for a restored academic record — otherwise the
        // restore would stay invisible until a main_store read.
        await writeAcademicRecordsToCollection(field as AcademicSplitField, liveRecords);
      } else if (field === 'feeTypes' || field === 'feeStructures') {
        // Job 5: same for a restored fee record — otherwise the
        // restore would stay invisible until a main_store read.
        await writeFeeRecordsToCollection(field as FeesSplitField, liveRecords);
      } else if (field === 'remarks') {
        // Job 6: same for a restored remark — otherwise the restore
        // would stay invisible until a main_store read.
        await writeRemarksToCollection(liveRecords as RemarkRecord[]);
      } else if (field === 'promotionHistory') {
        // Job 7: same for a restored promotion record — otherwise the
        // restore would stay invisible until a main_store read.
        await writePromotionHistoryToCollection(liveRecords as PromotionHistoryRecord[]);
      } else if (field === 'staffLeaves') {
        // Job 8: same for a restored leave record — otherwise the
        // restore would stay invisible until a main_store read.
        await writeStaffLeavesToCollection(liveRecords as StaffLeaveRecord[]);
      } else if (field === 'transactions') {
        // Job 10: same for a restored transaction — otherwise the
        // restore would stay invisible until a main_store read.
        await writeTransactionsToCollection(liveRecords as FinanceTransaction[]);
      } else if (field === 'marks') {
        // Job 11: same for a restored mark record — otherwise the
        // restore would stay invisible until a main_store read.
        await writeMarksToCollection(liveRecords as MarkRecord[]);
      } else if (field === 'students') {
        // Job 12: same for a restored student — otherwise the restore
        // would stay invisible until a main_store read.
        await writeStudentsToCollection(liveRecords as Student[]);
      }
    }
    // Phase 2 tripwire (defense in depth — trash ops never shrink a
    // protected list in practice: restores grow them, permanent
    // deletes touch only trash, so this passes trivially unless a
    // future caller misuses the writer).
    {
      const trashOldSizes: Record<string, number> = {};
      const trashNewSizes: Record<string, number> = {};
      for (const [field] of writtenFields) {
        trashOldSizes[field] = ((data[field] as any[] | undefined) || []).length;
        trashNewSizes[field] = (payload[field] as any[]).length;
      }
      assertTripwire(
        trashOldSizes,
        trashNewSizes,
        ((data.trashBin as { id: string }[] | undefined) || []).length,
        (payload.trashBin as { id: string }[]).length
      );
    }
    // Job 13 (trash split): the removed trash entries also leave the
    // new trash collection. Best-effort (plan point 3): the super
    // admin's deleteDoc removes them; anyone else gets
    // permission-denied and the docs stay as orphans — the trash
    // feed's exact-match gate then keeps main_store as the source, so
    // a principal's restore still shows. Permanent delete from trash
    // stays super-admin-only by the rules, never by this code.
    if (ids.length > 0) {
      await deleteSplitDocsBestEffort(() => deleteTrashRecordsFromCollection(ids));
    }
    await setDoc(ref, payload, { merge: true });
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'trash op cloud confirm');
}

/** Runs a caller-supplied write and maps its outcome (deleteTeacher template).
 * By default the specific error is logged and a generic failure message is
 * returned. Callers that must SHOW the reason (e.g. the student form, where
 * a timeout looks exactly like a dead button) pass { includeRawError: true }
 * and get the raw message in `rawMessage` — the record stays queued either
 * way; only the diagnosis becomes visible. */
export async function confirmCloudWrite(
  write: () => Promise<void>,
  failureMessage: string,
  opts?: { includeRawError?: boolean }
): Promise<CloudConfirmResult> {
  try {
    await write();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Cloud confirm failed:', message);
    return opts?.includeRawError
      ? { success: false, message: failureMessage, rawMessage: message }
      : { success: false, message: failureMessage };
  }
}

export function readPendingConfirms(): PendingConfirmKind[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is PendingConfirmKind =>
        k === 'attendance' ||
        k === 'fee' ||
        k === 'marks' ||
        k === 'students' ||
        k === 'studentDelete' ||
        k === 'staff' ||
        k === 'notices' ||
        k === 'schedule' ||
        k === 'leaves' ||
        k === 'feeStructures' ||
        k === 'feeTypes'
    );
  } catch {
    return [];
  }
}

export function queuePendingConfirm(kind: PendingConfirmKind): void {
  try {
    const pending = readPendingConfirms();
    if (!pending.includes(kind)) {
      pending.push(kind);
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    }
  } catch {}
}

export function clearPendingConfirm(kind: PendingConfirmKind): void {
  try {
    const pending = readPendingConfirms().filter(k => k !== kind);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {}
}
