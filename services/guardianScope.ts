/**
 * Guardian scoping — ONE place that decides which students a guardian
 * session may see: their OWN child(ren), nobody else's.
 *
 * Why this exists: a guardian account used to be able to browse every
 * student in the institution — the desktop "guardian portal" tab was
 * the office's all-student guardian directory, the mobile parent home
 * deep-linked into the shared all-student modules, and the
 * self-service portal component fell back to `students[0]` ("first
 * student as demo") when no link matched, presenting a stranger's
 * child as the guardian's own. This module is the single source of
 * truth for the linkage so every guardian surface resolves the same
 * child set.
 *
 * Linkage model (union of all signals, deduplicated by student id):
 *   1. The account's explicit link — AppUser.studentId, captured at
 *      signup (signUpUser) — matched against the student's internal
 *      id, legacy studentId and studentCode. When the account also
 *      carries studentRoll + studentClass, a roll+class match is
 *      accepted as an explicit link too.
 *   2. Guardian phone — the account's phone (AppUser.phone, falling
 *      back to the member document's phone) matched against the
 *      student's guardianPhone. Comparison is canonicalized, so
 *      '01712345678' and '+8801712345678' are the same number. This
 *      is what links SIBLINGS: every child whose record carries the
 *      family's guardian phone resolves.
 *   3. Guardian email — the account email matched case-insensitively
 *      against the student's guardianEmail.
 *
 * Contract:
 *   - Sessions WITHOUT the guardian role are unscoped:
 *     `isGuardianSession` is false for them and callers must not apply
 *     any filtering (staff keep their full, role-permitted views).
 *   - A guardian session with NO matching student resolves to an
 *     EMPTY set. Callers must render the "no student linked" state —
 *     never a fallback student and never the full directory.
 */
import type { Student } from '../types/student';
import type { UserRole } from '../types';

/** Minimal account shape the linkage needs (AppUser satisfies it). */
export interface GuardianAccountLike {
  studentId?: string | null;
  studentRoll?: string | null;
  studentClass?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Extra contact signals from the member document / auth record. */
export interface GuardianContactSources {
  phones?: Array<string | null | undefined>;
  emails?: Array<string | null | undefined>;
}

/** True when the session holds the guardian role (primary or additional). */
export function hasGuardianRole(
  effectiveRoles: Array<string | null | undefined> | null | undefined
): boolean {
  return (effectiveRoles || []).some(r => r === 'guardian');
}

/**
 * True when guardian is the session's ONLY role. Menu/gate removal for
 * institutional surfaces applies to these sessions: a teacher who is
 * also a guardian keeps their teacher surfaces (union semantics),
 * while a pure guardian gets the portal + notice board only.
 */
export function isGuardianOnlySession(
  effectiveRoles: Array<string | null | undefined> | null | undefined
): boolean {
  const roles = (effectiveRoles || []).filter(Boolean) as string[];
  return roles.length > 0 && roles.every(r => r === 'guardian');
}

/**
 * Canonical phone form for comparison: digits only, with a leading
 * Bangladeshi country code folded back to the local trunk form
 * ('8801712345678' -> '01712345678').
 */
export function canonicalPhone(value?: string | null): string {
  let digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('880') && digits.length === 13) {
    digits = '0' + digits.slice(3);
  }
  return digits;
}

const MIN_PHONE_DIGITS = 6;

/**
 * Resolve the guardian's own child(ren) from the linkage signals.
 * Returns the matched Student records ( possibly empty — never a
 * fallback). Non-guardian callers should not use this for filtering;
 * gate on hasGuardianRole / isGuardianOnlySession first.
 */
export function resolveGuardianChildren(
  account: GuardianAccountLike | null | undefined,
  students: Student[],
  extra?: GuardianContactSources
): Student[] {
  const out = new Map<string, Student>();
  const add = (s: Student | null | undefined) => {
    if (s && !out.has(s.id)) out.set(s.id, s);
  };

  // 1. Explicit account link (studentId captured at signup).
  const linkId = String(account?.studentId || '').trim();
  if (linkId) {
    for (const s of students) {
      if (s.id === linkId || s.studentId === linkId || s.studentCode === linkId) add(s);
    }
  }

  // 1b. Roll + class link (signup records the class; some guardian
  // accounts carry the roll instead of / alongside the student id).
  const roll = String(account?.studentRoll || '').trim();
  const cls = String(account?.studentClass || '').trim();
  if (roll && cls) {
    for (const s of students) {
      if ((s.roll === roll || s.rollNumber === roll) && s.classLevel === cls) add(s);
    }
  }

  // 2. Guardian phone match (canonicalized; links all siblings whose
  // records carry the family phone).
  const phones = new Set<string>();
  for (const raw of [account?.phone, ...(extra?.phones || [])]) {
    const c = canonicalPhone(raw);
    if (c.length >= MIN_PHONE_DIGITS) phones.add(c);
  }
  if (phones.size > 0) {
    for (const s of students) {
      if (s.guardianPhone && phones.has(canonicalPhone(s.guardianPhone))) add(s);
    }
  }

  // 3. Guardian email match (case-insensitive).
  const emails = new Set<string>();
  for (const raw of [account?.email, ...(extra?.emails || [])]) {
    const e = String(raw || '').trim().toLowerCase();
    if (e) emails.add(e);
  }
  if (emails.size > 0) {
    for (const s of students) {
      if (s.guardianEmail && emails.has(s.guardianEmail.trim().toLowerCase())) add(s);
    }
  }

  return [...out.values()];
}

/** The linked student-id set (same resolution, ids only). */
export function resolveGuardianStudentIds(
  account: GuardianAccountLike | null | undefined,
  students: Student[],
  extra?: GuardianContactSources
): string[] {
  return resolveGuardianChildren(account, students, extra).map(s => s.id);
}

export type { UserRole };
