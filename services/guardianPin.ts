/**
 * Guardian PIN login — pure logic (22 Nov 2026, Job L7).
 *
 * Guardians mostly have no email, so they log in with the child's
 * Student ID + a 4-digit PIN. The PIN is a per-student field
 * (Student.guardianPin, set by the admin in Student Manager);
 * blank = default last 4 digits of the student ID, exactly what the
 * portal already displayed. 5 wrong tries lock that student ID for
 * 15 minutes (client-side counter + timestamp in localStorage).
 * A correct PIN opens a session scoped to THAT student only.
 *
 * HONEST LIMIT: the public portal ALREADY shows results/fees by
 * student ID with NO login (by design), so this PIN is ease + light
 * gating, not hiding data the portal already shows. It also lives
 * client-side: a wrong PIN is denied in the app, but the PIN value
 * itself sits in the student record the office can read — the same
 * place the old display read it from. Do not claim stronger
 * security than that.
 *
 * No imports except the Student type, so this module runs in node
 * for the verify script. Storage falls back to an in-memory Map
 * when localStorage is unavailable.
 */
import type { Student } from '../types/student';

export const GUARDIAN_PIN_LENGTH = 4;
export const GUARDIAN_PIN_MAX_FAILS = 5;
export const GUARDIAN_PIN_LOCK_MS = 15 * 60 * 1000;
export const GUARDIAN_PIN_DEFAULT_FALLBACK = '7890';

const SESSION_KEY = 'madrasha_guardian_pin_session';
// The lock is keyed by the PUBLIC student ID — the identity typed at
// login ("lock that student ID for 15 minutes"). The internal student
// id is an implementation detail and must not leak into the lock key.
const lockKey = (publicStudentId: string) => `madrasha_guardian_pin_lock_${(publicStudentId || '').trim().toLowerCase()}`;

// localStorage when available, in-memory Map fallback (node / private
// mode) — keeps this module testable without a browser.
const memoryStore = new Map<string, string>();
function lsGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch { /* fall through to memory */ }
  return memoryStore.get(key) ?? null;
}
function lsSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch { /* fall through to memory */ }
  memoryStore.set(key, value);
}
function lsRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch { /* fall through to memory */ }
  memoryStore.delete(key);
}

/** Digits only, at most 4. */
export function normalizeGuardianPin(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, GUARDIAN_PIN_LENGTH);
}

/**
 * The PIN for one student: the stored 4-digit PIN when the admin set
 * one, otherwise the last 4 digits of the student ID (the old display
 * showed exactly this), otherwise '7890'.
 */
export function getStudentPin(student: Student): string {
  const stored = normalizeGuardianPin(student.guardianPin || '');
  if (stored.length === GUARDIAN_PIN_LENGTH) return stored;
  const id = (student.studentId || '').trim();
  if (id.length >= GUARDIAN_PIN_LENGTH) return id.slice(-GUARDIAN_PIN_LENGTH);
  return GUARDIAN_PIN_DEFAULT_FALLBACK;
}

interface PinLockRecord {
  fails: number;
  lockedUntil: number;
}

function readLock(publicStudentId: string): PinLockRecord {
  try {
    const raw = lsGet(lockKey(publicStudentId));
    if (!raw) return { fails: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return { fails: Number(parsed.fails) || 0, lockedUntil: Number(parsed.lockedUntil) || 0 };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}

function writeLock(publicStudentId: string, rec: PinLockRecord): void {
  lsSet(lockKey(publicStudentId), JSON.stringify(rec));
}

export function clearGuardianPinAttempts(publicStudentId: string): void {
  lsRemove(lockKey(publicStudentId));
}

export interface GuardianPinVerifyResult {
  success: boolean;
  message: string;
  student?: Student;
  lockedUntil?: number;
}

/**
 * Check a Student ID + PIN. Wrong ID and wrong PIN give the SAME
 * generic message (no leak about which part was wrong). A locked
 * student ID stays locked even for the right PIN until the 15
 * minutes pass. On success the session is saved (scoped to that
 * student only) and the fail counter is cleared.
 */
export function verifyGuardianPin(
  studentIdInput: string,
  pinInput: string,
  students: Student[]
): GuardianPinVerifyResult {
  const cleanId = (studentIdInput || '').trim().toLowerCase();
  const pin = normalizeGuardianPin(pinInput);
  const student = students.find(s => (s.studentId || '').trim().toLowerCase() === cleanId);
  if (!student || pin.length !== GUARDIAN_PIN_LENGTH) {
    return { success: false, message: 'ভুল আইডি বা PIN। আবার চেষ্টা করুন।' };
  }

  const now = Date.now();
  const lock = readLock(student.studentId);
  if (lock.lockedUntil > now) {
    return {
      success: false,
      message: '৫ বার ভুল PIN দেওয়া হয়েছে — ১৫ মিনিট পর আবার চেষ্টা করুন।',
      lockedUntil: lock.lockedUntil
    };
  }

  if (pin !== getStudentPin(student)) {
    // A past lock that already expired resets the counter.
    const fails = lock.lockedUntil > 0 && lock.lockedUntil <= now ? 0 : lock.fails;
    const next = fails + 1;
    if (next >= GUARDIAN_PIN_MAX_FAILS) {
      const lockedUntil = now + GUARDIAN_PIN_LOCK_MS;
      writeLock(student.studentId, { fails: next, lockedUntil });
      return {
        success: false,
        message: '৫ বার ভুল PIN দেওয়া হয়েছে — ১৫ মিনিট পর আবার চেষ্টা করুন।',
        lockedUntil
      };
    }
    writeLock(student.studentId, { fails: next, lockedUntil: 0 });
    return { success: false, message: 'ভুল PIN। আবার চেষ্টা করুন।' };
  }

  clearGuardianPinAttempts(student.studentId);
  saveGuardianPinSession(student.id);
  return { success: true, message: 'লগইন সফল হয়েছে!', student };
}

export interface GuardianPinSession {
  studentId: string;
  createdAt: number;
}

export function saveGuardianPinSession(studentInternalId: string): void {
  lsSet(SESSION_KEY, JSON.stringify({ studentId: studentInternalId, createdAt: Date.now() }));
}

export function readGuardianPinSession(): GuardianPinSession | null {
  try {
    const raw = lsGet(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.studentId) return null;
    return { studentId: String(parsed.studentId), createdAt: Number(parsed.createdAt) || 0 };
  } catch {
    return null;
  }
}

export function clearGuardianPinSession(): void {
  lsRemove(SESSION_KEY);
}
