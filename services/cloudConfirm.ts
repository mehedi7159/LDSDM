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
 * The queue holds only the KIND ('attendance' | 'fee') — the retry always
 * re-reads the current local data, so it can never push a stale snapshot.
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
import type { FinanceTransaction } from '../types';

export const ATTENDANCE_CLOUD_FAILURE_MESSAGE =
  'হাজিরা এই ফোনে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const FEE_CLOUD_FAILURE_MESSAGE =
  'ফি এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export const feeCloudFailureMessage = (voucherNo: string): string =>
  `রসিদ নং ${voucherNo} এই ডিভাইসে সংরক্ষিত হয়েছে, কিন্তু cloud-এ যায়নি — প্রিন্সিপালের খাতায় এখনো ওঠেনি। আবার চেষ্টা করুন।`;

export const RECEIPT_LOCAL_ONLY_NOTE =
  'এই রসিদ এখনো শুধু এই ডিভাইসে আছে — cloud-এ যায়নি।';

export const RETRY_LABEL = 'আবার চেষ্টা করুন';

const CONFIRM_TIMEOUT_MS = 15000;
const PENDING_KEY = 'ldsdm_pending_cloud_confirms';

export type PendingConfirmKind = 'attendance' | 'fee';

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

async function writeFieldToCloud(
  field: 'dailyStudentAttendance' | 'transactions',
  localRecords: { id: string }[],
  updatedBy: string
): Promise<void> {
  const ref = doc(db, 'institution', 'main_store');
  const snap = await getDoc(ref);
  const existing = (snap.exists() ? (snap.data() as Record<string, unknown>)[field] : undefined) as
    | { id: string }[]
    | undefined;
  const merged = mergeRecordsById(existing || [], localRecords);
  await setDoc(
    ref,
    { [field]: merged, updatedBy, updatedAt: new Date().toISOString() },
    { merge: true }
  );
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
      (k): k is PendingConfirmKind => k === 'attendance' || k === 'fee'
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
