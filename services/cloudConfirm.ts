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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { DailyStudentAttendanceRecord, DailyStaffAttendanceRecord } from './dailyAttendanceService';
import type { FinanceTransaction, MarkRecord, Student, AcademicTeacher, AppUser, NoticeItem, StaffLeaveRecord, Exam, Subject, SchoolClass, RemarkRecord } from '../types';
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
function stripUndefinedRecord<T>(record: T): T {
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
    const records = localRecords || [];
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

export async function writeAttendanceFieldToCloud(
  records: DailyStudentAttendanceRecord[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('dailyStudentAttendance', records, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'attendance cloud confirm'
  );
}

export async function writeStaffAttendanceFieldToCloud(
  records: DailyStaffAttendanceRecord[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('dailyStaffAttendance', records, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'staff attendance cloud confirm'
  );
}

export async function writeTransactionsFieldToCloud(
  transactions: FinanceTransaction[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('transactions', transactions, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'fee cloud confirm'
  );
}

// --- Step 2 field writers (same one-write, union-by-id, merge:true shape) ---
// Every record type here carries a stable `id` (marks, students, staff,
// users, notices, trash entries, routine/syllabus/calendar items), so the
// union never drops a record. A record without an id is skipped by
// mergeRecordsById — that invariant is what the verify script pins.

export async function writeMarksFieldToCloud(
  marks: MarkRecord[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('marks', marks, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'marks cloud confirm'
  );
}

export async function writeStudentsFieldToCloud(
  students: Student[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('students', students, updatedBy),
    STUDENTS_CONFIRM_TIMEOUT_MS,
    'students cloud confirm'
  );
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
  const deletedIds: string[] = [];
  (trashBin || []).forEach((t) => {
    if (t && t.type === 'student' && t.data && t.data.id && !studentIds.has(t.data.id)) {
      deletedIds.push(String(t.data.id));
    }
  });
  if (deletedIds.length === 0) {
    throw new Error(
      'Phase 1 choke point: student delete refused — no trashed student id found in the delete payload. ' +
        'Refusing instead of guessing which students to remove.'
    );
  }
  return { deletedIds, trashEntries: (trashBin || []).filter((t) => t && t.id) as { id: string }[] };
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
  await withTimeout(
    writeFieldsToCloud({ teachers, users }, updatedBy),
    STAFF_CONFIRM_TIMEOUT_MS,
    'staff cloud confirm'
  );
}

export async function writeNoticesFieldToCloud(
  notices: NoticeItem[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('notices', notices, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'notices cloud confirm'
  );
}

/** Routine + syllabus + calendar travel together (one editor save can touch all three via the bridge) — one write carries all three. */
export async function writeScheduleFieldsToCloud(
  routines: ClassRoutineItem[],
  syllabusItems: SyllabusItem[],
  calendarEvents: AcademicCalendarEvent[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldsToCloud({ classRoutines: routines, syllabusItems, calendarEvents }, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'schedule cloud confirm'
  );
}

/** Step 4 (25 Oct 2026): staff leave records (staffLeaves field only). */
export async function writeStaffLeavesFieldToCloud(
  leaves: StaffLeaveRecord[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldToCloud('staffLeaves', leaves, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'leaves cloud confirm'
  );
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
    const ref = doc(db, 'institution', 'main_store');
    const snap = await getDoc(ref);
    const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
    const existing = (data.feeStructures as { id: string; classLevel: string }[] | undefined) || [];
    await setDoc(ref, {
      feeStructures: mergeRecordsByKey(existing, structures, (r) => (r.classLevel ? r.classLevel : '')),
      updatedBy,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
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
  await withTimeout(
    writeFieldToCloud('feeTypes', types, updatedBy),
    CONFIRM_TIMEOUT_MS,
    'fee types cloud confirm'
  );
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
  await withTimeout(writeFieldToCloud('exams', exams as any, updatedBy), CONFIRM_TIMEOUT_MS, 'exams cloud confirm');
}

export async function writeExamSubjectAssignmentsFieldToCloud(
  assignments: ExamSubjectAssignment[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('examSubjectAssignments', assignments as any, updatedBy), CONFIRM_TIMEOUT_MS, 'exam subject assignments cloud confirm');
}

export async function writeClassSubjectAssignmentsFieldToCloud(
  assignments: ClassSubjectAssignment[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('classSubjectAssignments', assignments as any, updatedBy), CONFIRM_TIMEOUT_MS, 'class subject assignments cloud confirm');
}

export async function writeTeacherSubjectAssignmentsFieldToCloud(
  assignments: TeacherSubjectAssignment[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('teacherSubjectAssignments', assignments as any, updatedBy), CONFIRM_TIMEOUT_MS, 'teacher subject assignments cloud confirm');
}

export async function writeClassTeacherAssignmentsFieldToCloud(
  assignments: ClassTeacherAssignment[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('classTeacherAssignments', assignments as any, updatedBy), CONFIRM_TIMEOUT_MS, 'class teacher assignments cloud confirm');
}

export async function writePromotionHistoryFieldToCloud(
  records: PromotionHistoryRecord[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('promotionHistory', records as any, updatedBy), CONFIRM_TIMEOUT_MS, 'promotion history cloud confirm');
}

export async function writeRemarksFieldToCloud(
  remarks: RemarkRecord[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('remarks', remarks as any, updatedBy), CONFIRM_TIMEOUT_MS, 'remarks cloud confirm');
}

export async function writeSubjectsFieldToCloud(
  subjects: Subject[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('subjects', subjects as any, updatedBy), CONFIRM_TIMEOUT_MS, 'subjects cloud confirm');
}

export async function writeClassesFieldToCloud(
  classes: SchoolClass[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('classes', classes as any, updatedBy), CONFIRM_TIMEOUT_MS, 'classes cloud confirm');
}

export async function writeAcademicYearsFieldToCloud(
  years: AcademicYear[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('academicYears', years as any, updatedBy), CONFIRM_TIMEOUT_MS, 'academic years cloud confirm');
}

export async function writeSectionsFieldToCloud(
  sections: Section[],
  updatedBy: string
): Promise<void> {
  await withTimeout(writeFieldToCloud('sections', sections as any, updatedBy), CONFIRM_TIMEOUT_MS, 'sections cloud confirm');
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
    const ref = doc(db, 'institution', 'main_store');
    await setDoc(ref, {
      schoolProfile: stripUndefinedRecord(profile),
      updatedBy,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
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
    const ref = doc(db, 'institution', 'main_store');
    await setDoc(ref, {
      markEntryEnabled: enabled,
      updatedBy,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  };
  await withTimeout(write(), CONFIRM_TIMEOUT_MS, 'mark entry cloud confirm');
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
    const oldTrashSize = ((data.trashBin as { id: string }[] | undefined) || []).length;
    const newTrashSize = cleanTrash.length > 0 ? (payload.trashBin as { id: string }[]).length : oldTrashSize;
    assertTripwire(oldSizes, newSizes, oldTrashSize, newTrashSize);
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
    for (const [field, records] of upsertFields) {
      const keyFn = fieldKeyFn(field);
      assertUpsertRecords(field, records, keyFn);
      const existing = data[field] as Record<string, any>[] | undefined;
      payload[field] = mergeRecordsByKey(existing || [], records, keyFn).map(stripUndefinedRecord);
    }
    // Phase 2 tripwire (defense in depth — trash ops never shrink a
    // protected list in practice: restores grow them, permanent
    // deletes touch only trash, so this passes trivially unless a
    // future caller misuses the writer).
    {
      const trashOldSizes: Record<string, number> = {};
      const trashNewSizes: Record<string, number> = {};
      for (const [field] of upsertFields) {
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
