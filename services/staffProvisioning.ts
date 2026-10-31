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
 *  - Staff without a usable email are provisioned under a canonical
 *    address (getStaffCanonicalEmail): phone -> staff.<digits>@
 *    madrashasystem.com, id -> staff.<id>@madrashasystem.com, and a
 *    synthetic @madrasha.local address converts to @madrashasystem.com.
 *    The canonical address is only a Firebase Auth login name, never
 *    presented as the person's real mailbox.
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
/**
 * True for any valid email format usable with Firebase Auth.
 */
export function isProvisionableEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return false;
  return true;
}

/**
 * Resolves a reliable, valid Firebase Auth email for any staff member.
 * If a real email is available (e.g. teacher@gmail.com), returns it.
 * If the staff member has a phone number (e.g. 01712345678), maps it to a canonical
 * valid email: staff.{cleanPhone}@madrashasystem.com.
 * If email ends with @madrasha.local, converts to @madrashasystem.com.
 * If only an ID exists, maps to staff.{cleanId}@madrashasystem.com.
 */
export function getStaffCanonicalEmail(
  email?: string | null,
  phone?: string | null,
  id?: string | null
): string | null {
  if (email && email.trim()) {
    const e = email.trim().toLowerCase();
    if (e.includes('@')) {
      if (e.endsWith('@madrasha.local')) {
        return e.replace('@madrasha.local', '@madrashasystem.com');
      }
      return e;
    }
  }
  if (phone && phone.trim()) {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length >= 6) {
      return `staff.${digits}@madrashasystem.com`;
    }
  }
  if (id && id.trim()) {
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanId.length >= 3) {
      return `staff.${cleanId}@madrashasystem.com`;
    }
  }
  return null;
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
 * account via the secondary app.
 */
export async function provisionStaffFirebaseUser(
  emailOrIdentifier: string,
  password: string,
  phone?: string,
  id?: string
): Promise<ProvisionResult> {
  const targetEmail = getStaffCanonicalEmail(emailOrIdentifier, phone, id);
  if (!targetEmail || !password) return 'skipped';
  const secondaryAuth = getSecondaryAuth();
  try {
    await createUserWithEmailAndPassword(secondaryAuth, targetEmail.trim().toLowerCase(), password);
    return 'created';
  } catch (err: any) {
    const outcome = classifyProvisionError(err?.code);
    if (outcome === 'already-exists') return 'already-exists';
    console.warn('[StaffProvisioning] Creation-time provisioning notice:', err?.code);
    return 'failed';
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {}
  }
}

/**
 * Portal-login heal gate: checks if staff member is eligible for Firebase Auth self-heal.
 * Supports both real emails and phone numbers.
 */
export function shouldHealPortalLogin(
  role: string | undefined | null,
  email: string | undefined | null,
  storedPassword: string | undefined | null,
  typedPassword: string,
  phone?: string | null,
  id?: string | null
): boolean {
  if (!storedPassword || storedPassword !== typedPassword) return false;
  if (!isStaffProvisioningRole(role)) return false;
  const canonical = getStaffCanonicalEmail(email, phone, id);
  return Boolean(canonical);
}

export type CredentialSyncNeed =
  | 'sync'
  | 'not-needed'
  | 'skipped-no-prior'
  | 'skipped-non-staff'
  | 'skipped-no-email';

/**
 * Admin-edit sync decision.
 */
export function resolveCredentialSyncNeed(
  existing: { password?: string; email?: string; phone?: string; id?: string } | undefined,
  rawPassword: string,
  cleanEmail: string | undefined,
  role: string,
  phone?: string
): CredentialSyncNeed {
  if (!existing) return 'skipped-no-prior';
  if (!isStaffProvisioningRole(role)) return 'skipped-non-staff';
  const passwordChanged = !!rawPassword && existing.password !== rawPassword;
  const emailChanged = (existing.email?.toLowerCase() || undefined) !== cleanEmail;
  const phoneChanged = !!phone && existing.phone !== phone;
  if (!passwordChanged && !emailChanged && !phoneChanged) return 'not-needed';
  const target = getStaffCanonicalEmail(cleanEmail, phone, existing.id);
  if (!target) return 'skipped-no-email';
  return 'sync';
}

/**
 * Login-time self-heal path: create the Firebase user on the PRIMARY auth.
 */
export async function createPrimaryFirebaseUser(
  primaryAuth: Auth,
  emailOrIdentifier: string,
  password: string,
  phone?: string,
  id?: string
): Promise<'created' | 'already-exists' | 'failed'> {
  const targetEmail = getStaffCanonicalEmail(emailOrIdentifier, phone, id);
  if (!targetEmail || !password) return 'failed';
  try {
    await createUserWithEmailAndPassword(primaryAuth, targetEmail.trim().toLowerCase(), password);
    return 'created';
  } catch (err: any) {
    const outcome = classifyProvisionError(err?.code);
    if (outcome === 'already-exists') return 'already-exists';
    console.warn('[StaffProvisioning] Login-time self-heal notice:', err?.code);
    return 'failed';
  }
}

