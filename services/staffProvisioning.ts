/**
 * Staff Firebase Auth auto-provisioning (25 Oct 2026).
 *
 * Problem it solves: staff accounts created in the Staff form are AppUsers
 * (member docs + users list) with NO Firebase Auth identity, so their
 * attendance / marks / fee writes are denied by the Firestore rule
 * (write requires request.auth != null) and never leave their phones —
 * even though the app-level RBAC permissions (attendance.*, marks.*,
 * fees.*) allow the work. Provisioning gives each staff account a real
 * Firebase Auth user with the SAME email + password, so the session
 * becomes authed and cloud sync passes the rule.
 *
 * Two paths (both best-effort, never break creation or login):
 *  1. Creation-time: after addTeacher creates a staff record, the caller
 *     fire-and-forgets provisionStaffFirebaseUser() on a SECONDARY app
 *     instance, so the admin's own session is never disturbed.
 *  2. Login-time self-heal: when a staff login falls through to the local
 *     fallback (Firebase sign-in failed) but the local password check
 *     passes, the caller creates the Firebase user on the PRIMARY auth
 *     (createPrimaryFirebaseUser) and the session becomes authed.
 *
 * Security notes:
 *  - Passwords are NEVER logged, stored, or printed here. They only pass
 *    through to the Firebase SDK call.
 *  - Only real emails are provisioned. Phone-only staff (no email, or a
 *    synthetic @madrasha.local member-doc address) are skipped — an email
 *    is never invented.
 *  - A Firebase password always equals the app password stored for that
 *    account, so staff keep the exact same credentials.
 *  - firestore.rules is untouched: read-open / write-auth-only still
 *    blocks everyone without an account. Provisioning only gives the
 *    already-authorized staff the key they were meant to have.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  type Auth
} from 'firebase/auth';
import { firebaseConfig } from './firebase';

export type ProvisionResult = 'created' | 'already-exists' | 'skipped' | 'failed';

/** Staff roles eligible for auto-provisioning (bare role keys only). */
export type StaffProvisioningRole = 'teacher' | 'accountant' | 'staff';

export function isStaffProvisioningRole(role: string | undefined | null): role is StaffProvisioningRole {
  return role === 'teacher' || role === 'accountant' || role === 'staff';
}

/**
 * True only for a real, usable email. Rejects empty values, strings
 * without '@', and the synthetic @madrasha.local addresses the member
 * store assigns to phone-only staff (those are not mailboxes the staff
 * member can use, so provisioning with one would create an account
 * nobody can sign in to).
 */
export function isProvisionableEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return false;
  if (e.endsWith('@madrasha.local')) return false;
  return true;
}

/** Maps a Firebase Auth error code to a provisioning outcome. */
export function classifyProvisionError(code: string | undefined | null): 'already-exists' | 'failed' {
  return code === 'auth/email-already-in-use' ? 'already-exists' : 'failed';
}

/**
 * The secondary app instance used for creation-time provisioning. It
 * shares the project's config but is a DIFFERENT app object, so creating
 * a user on it never signs the admin out of (or into) anything on the
 * primary app — the admin's session is untouched.
 */
function getSecondaryAuth(): Auth {
  const name = 'staff-provisioning';
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp(firebaseConfig, name);
  return getAuth(app);
}

/**
 * Creation-time path: create the Firebase user for a newly created staff
 * account via the secondary app. Never throws: every failure is logged
 * (code only, never credentials) and reported as 'failed' so the caller
 * can continue — the staff member's next login self-heals instead.
 */
export async function provisionStaffFirebaseUser(
  email: string,
  password: string
): Promise<ProvisionResult> {
  if (!isProvisionableEmail(email) || !password) return 'skipped';
  const secondaryAuth = getSecondaryAuth();
  try {
    await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), password);
    return 'created';
  } catch (err: any) {
    const outcome = classifyProvisionError(err?.code);
    if (outcome === 'already-exists') return 'already-exists';
    console.warn('[StaffProvisioning] Creation-time provisioning notice:', err?.code);
    return 'failed';
  } finally {
    // Leave no stray session behind on the secondary app. Best-effort:
    // a sign-out failure changes nothing about the created account.
    try {
      await signOut(secondaryAuth);
    } catch {}
  }
}

/**
 * Login-time self-heal path: create the Firebase user on the PRIMARY
 * auth. createUserWithEmailAndPassword also signs the SDK session in as
 * the new user, which is exactly what the caller wants (the session
 * becomes authed). Never throws.
 */
export async function createPrimaryFirebaseUser(
  primaryAuth: Auth,
  email: string,
  password: string
): Promise<'created' | 'already-exists' | 'failed'> {
  if (!isProvisionableEmail(email) || !password) return 'failed';
  try {
    await createUserWithEmailAndPassword(primaryAuth, email.trim().toLowerCase(), password);
    return 'created';
  } catch (err: any) {
    const outcome = classifyProvisionError(err?.code);
    if (outcome === 'already-exists') return 'already-exists';
    console.warn('[StaffProvisioning] Login-time self-heal notice:', err?.code);
    return 'failed';
  }
}
