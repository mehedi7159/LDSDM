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
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { DailyStudentAttendanceRecord } from './dailyAttendanceService';
import type { FinanceTransaction, MarkRecord, Student, AcademicTeacher, AppUser, NoticeItem } from '../types';
import type { ClassRoutineItem, SyllabusItem, AcademicCalendarEvent } from '../types/academic';

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

export const feeCloudFailureMessage = (voucherNo: string): string =>
  `রসিদ নং ${voucherNo} এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — প্রিন্সিপালের খাতায় এখনো ওঠেনি। আবার চেষ্টা করুন।`;

export const RECEIPT_LOCAL_ONLY_NOTE =
  'এই রসিদ এখনো শুধু এই ডিভাইসে আছে — cloud-এ যায়নি।';

export const RETRY_LABEL = 'আবার চেষ্টা করুন';

const CONFIRM_TIMEOUT_MS = 15000;
const PENDING_KEY = 'ldsdm_pending_cloud_confirms';

export type PendingConfirmKind =
  | 'attendance'
  | 'fee'
  | 'marks'
  | 'students'
  | 'studentDelete'
  | 'staff'
  | 'notices'
  | 'schedule';

export type CloudConfirmResult = { success: boolean; message?: string };

/** Union by record id; incoming (local) records win on id conflict. */
export function mergeRecordsById<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>();
  (existing || []).forEach(r => {
    if (r && r.id) map.set(r.id, r);
  });
  (incoming || []).forEach(r => {
    if (r && r.id) map.set(r.id, r);
  });
  return Array.from(map.values());
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

async function writeFieldsToCloud(
  fields: Record<string, { id: string }[]>,
  updatedBy: string
): Promise<void> {
  const ref = doc(db, 'institution', 'main_store');
  const snap = await getDoc(ref);
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = { updatedBy, updatedAt: new Date().toISOString() };
  for (const [field, localRecords] of Object.entries(fields)) {
    const existing = data[field] as { id: string }[] | undefined;
    payload[field] = mergeRecordsById(existing || [], localRecords);
  }
  await setDoc(ref, payload, { merge: true });
}

async function writeFieldToCloud(
  field: string,
  localRecords: { id: string }[],
  updatedBy: string
): Promise<void> {
  await writeFieldsToCloud({ [field]: localRecords }, updatedBy);
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
    CONFIRM_TIMEOUT_MS,
    'students cloud confirm'
  );
}

/** Student delete touches two fields at once (students + trashBin), so one write carries both — never a half-deleted state. */
export async function writeStudentDeleteFieldsToCloud(
  students: Student[],
  trashBin: { id: string }[],
  updatedBy: string
): Promise<void> {
  await withTimeout(
    writeFieldsToCloud({ students, trashBin }, updatedBy),
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
    CONFIRM_TIMEOUT_MS,
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

/** Runs a caller-supplied write and maps its outcome (deleteTeacher template). */
export async function confirmCloudWrite(
  write: () => Promise<void>,
  failureMessage: string
): Promise<CloudConfirmResult> {
  try {
    await write();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Cloud confirm failed:', message);
    return { success: false, message: failureMessage };
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
        k === 'schedule'
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
