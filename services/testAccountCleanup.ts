/**
 * Force test-account cleanup (25 Oct 2026) — NEW files only.
 *
 * User-confirmed scope (25 Oct ~20:59, tap): keep ONLY the principal /
 * owner account; force-delete every other teacher/staff account because
 * they are all test accounts (Sulayman, Arafat, Rana x3, anik, sagor1).
 *
 * KEEP RULE — the one rule this whole tool stands on, and it is
 * deliberately narrow:
 *   keep a record ONLY if its email matches the owner email
 *   (case-insensitive) OR its id/uid/userId equals the signed-in admin's
 *   Firebase uid.
 * Phone is NEVER used for a keep/delete decision. That is what makes
 * Arafat deletable here: his record carries the owner's phone number
 * (01700000000, a dummy/wrong entry), which is exactly why the normal
 * deleteTeacher guard blocks him (its matches() is id OR email OR
 * phone, and the phone hit on super_admin aborts the delete). Under
 * this rule Arafat is deleted and the owner is still provably safe,
 * because no phone comparison happens at all.
 *
 * WHAT IS DELETED, in one cloud-confirmed write (deleteTeacher
 * template): the kept teachers/users arrays are written verbatim to
 * institution/main_store (NOT unioned — a union would resurrect the
 * deleted records), plus matching member docs in
 * institutions/{institutionId}/members. "Matching" for members means
 * only: uid in the deleted teacher/user ids, or email equal to a
 * deleted record's email — and an owner-linked member is never deleted
 * even if it somehow matches. Members that do not match a deleted staff
 * record (e.g. guardians) are never touched.
 *
 * WHAT IS NOT DELETED, stated honestly in the UI: Firebase Auth users.
 * No service account is set, so this tool cannot delete them. An
 * orphaned Auth account (today: sagor1@gmail.com, email/password) can
 * still sign in afterwards — see the report — and the principal should
 * remove it in Firebase Console -> Authentication -> Users, or its
 * next login re-stamps a teacher user entry (see onAuthStateChanged).
 *
 * NO tombstone/version enforcement: without every other session closed,
 * a stale session can still resurrect deleted records (the 20:45
 * incident). The UI says so plainly instead of pretending otherwise.
 *
 * This module has NO Firebase import on purpose: performCleanup takes
 * its write/delete functions as injected dependencies, so the verify
 * script can prove the keep rule, the delete-set computation, and the
 * failure honesty without any live call. The component supplies the
 * real Firestore deps.
 */
import type { AcademicTeacher } from '../types/academic';
import type { AppUser } from '../types';
import type { InstitutionMember } from '../types/rbac';

export const CLEANUP_CLOUD_FAILURE_MESSAGE =
  'মোছা cloud-এ যায়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন। স্থানীয় তথ্য অপরিবর্তিত আছে।';

export const CLEANUP_TIMEOUT_MS = 15000;

export interface CleanupCandidate {
  id?: string;
  uid?: string;
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  nameBn?: string;
  designation?: string;
  role?: string;
}

/**
 * The keep rule. Email match is case-insensitive; id/uid/userId must
 * equal the signed-in admin's uid exactly. Phone is intentionally
 * absent from this function — grep for "phone" here and you will find
 * it only in this comment.
 */
export function isOwnerLinked(
  record: CleanupCandidate,
  ownerEmail: string,
  adminUid: string
): boolean {
  const normalizedOwnerEmail = (ownerEmail || '').trim().toLowerCase();
  if (normalizedOwnerEmail && (record.email || '').trim().toLowerCase() === normalizedOwnerEmail) {
    return true;
  }
  if (adminUid) {
    if (record.id && record.id === adminUid) return true;
    if (record.uid && record.uid === adminUid) return true;
    if (record.userId && record.userId === adminUid) return true;
  }
  return false;
}

export interface CleanupPlan {
  keepTeachers: AcademicTeacher[];
  deleteTeachers: AcademicTeacher[];
  keepUsers: AppUser[];
  deleteUsers: AppUser[];
  /** Member docs matching a deleted staff identity (uid or email) — never owner-linked, never unrelated. */
  deleteMembers: InstitutionMember[];
  deleteTeacherCount: number;
  deleteUserCount: number;
  deleteMemberCount: number;
  /** Distinct people/records the UI lists (teachers + users + members). */
  totalDeleteCount: number;
}

export function computeCleanupPlan(
  teachers: AcademicTeacher[],
  users: AppUser[],
  members: InstitutionMember[],
  ownerEmail: string,
  adminUid: string
): CleanupPlan {
  const keepTeachers = (teachers || []).filter(t => isOwnerLinked(t, ownerEmail, adminUid));
  const deleteTeachers = (teachers || []).filter(t => !isOwnerLinked(t, ownerEmail, adminUid));
  const keepUsers = (users || []).filter(u => isOwnerLinked(u, ownerEmail, adminUid));
  const deleteUsers = (users || []).filter(u => !isOwnerLinked(u, ownerEmail, adminUid));

  const deletedIds = new Set<string>();
  for (const t of deleteTeachers) {
    if (t.id) deletedIds.add(t.id);
    if (t.userId) deletedIds.add(t.userId);
  }
  for (const u of deleteUsers) {
    if (u.id) deletedIds.add(u.id);
  }
  const deletedEmails = new Set<string>();
  for (const t of deleteTeachers) {
    if (t.email) deletedEmails.add(t.email.trim().toLowerCase());
  }
  for (const u of deleteUsers) {
    if (u.email) deletedEmails.add(u.email.trim().toLowerCase());
  }

  const deleteMembers = (members || []).filter(m => {
    // Owner-linked members are never deleted, even on an email match.
    if (isOwnerLinked(m, ownerEmail, adminUid)) return false;
    if (m.uid && deletedIds.has(m.uid)) return true;
    if (m.email && deletedEmails.has(m.email.trim().toLowerCase())) return true;
    return false;
  });

  return {
    keepTeachers,
    deleteTeachers,
    keepUsers,
    deleteUsers,
    deleteMembers,
    deleteTeacherCount: deleteTeachers.length,
    deleteUserCount: deleteUsers.length,
    deleteMemberCount: deleteMembers.length,
    totalDeleteCount: deleteTeachers.length + deleteUsers.length + deleteMembers.length,
  };
}

export interface MemberDeleteResult {
  uid: string;
  ok: boolean;
  error?: string;
}

export interface CleanupDeps {
  /** Writes the kept teachers/users arrays verbatim to main_store (merge:true, metadata included by the caller). */
  writeMainStore: (keepTeachers: AcademicTeacher[], keepUsers: AppUser[]) => Promise<void>;
  /** Deletes one member doc; must throw on failure so per-doc reporting is honest. */
  deleteMemberDoc: (uid: string) => Promise<void>;
}

export interface CleanupResult {
  success: boolean;
  message?: string;
  deletedTeacherCount: number;
  deletedUserCount: number;
  deletedMemberCount: number;
  failedMembers: MemberDeleteResult[];
}

/**
 * Orchestration with the deleteTeacher failure contract: the main_store
 * write goes first and must succeed, or NOTHING is reported as deleted
 * and no local state is touched by the caller. Member deletes are
 * best-effort after the confirmed main write, each reported honestly.
 * Inputs are never mutated — the caller only applies the kept arrays
 * to local state after success.
 */
export async function performCleanup(
  plan: CleanupPlan,
  deps: CleanupDeps
): Promise<CleanupResult> {
  const failed: MemberDeleteResult[] = [];
  try {
    await withTimeout(
      deps.writeMainStore(plan.keepTeachers, plan.keepUsers),
      CLEANUP_TIMEOUT_MS,
      'test account cleanup cloud write'
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Test account cleanup cloud write failed:', message);
    return {
      success: false,
      message: CLEANUP_CLOUD_FAILURE_MESSAGE,
      deletedTeacherCount: 0,
      deletedUserCount: 0,
      deletedMemberCount: 0,
      failedMembers: [],
    };
  }

  let deletedMemberCount = 0;
  for (const member of plan.deleteMembers) {
    try {
      await deps.deleteMemberDoc(member.uid);
      deletedMemberCount += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ uid: member.uid, ok: false, error: message });
    }
  }

  return {
    success: true,
    deletedTeacherCount: plan.deleteTeacherCount,
    deletedUserCount: plan.deleteUserCount,
    deletedMemberCount,
    failedMembers: failed,
  };
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
