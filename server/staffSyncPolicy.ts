/**
 * Pure authorization/validation decisions for the staff credential sync
 * endpoint (25 Oct 2026 follow-up). Dependency-free on purpose: the
 * verify script imports this module without pulling in firebase-admin.
 *
 * Authorization model (mirrors bootstrap-owner, extended for admins):
 * the caller must present a valid Firebase ID token AND be either the
 * designated owner email or hold an admin custom claim (role 'admin'
 * or isSuperAdmin true, the claims bootstrap-owner assigns). Anything
 * else is rejected — never accept an unauthenticated or non-admin call.
 *
 * Target protection: the owner/super_admin account can never be changed
 * through this endpoint, even by an admin caller.
 */

export interface SyncCallerClaims {
  email?: string;
  role?: unknown;
  isSuperAdmin?: unknown;
}

export function isSyncCallerAuthorized(
  decoded: SyncCallerClaims,
  ownerEmail: string
): boolean {
  if (decoded.email && decoded.email.toLowerCase() === ownerEmail.toLowerCase()) return true;
  if (decoded.role === 'admin' || decoded.isSuperAdmin === true) return true;
  return false;
}

export function isProtectedTargetEmail(
  email: string | undefined | null,
  ownerEmail: string
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ownerEmail.toLowerCase();
}

/**
 * Mirror of the client's isProvisionableEmail (kept local so this module
 * stays dependency-free): a real mailbox only — rejects empty values,
 * strings without '@', and synthetic @madrasha.local member addresses.
 */
export function isUsableStaffEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return false;
  if (e.endsWith('@madrasha.local')) return false;
  return true;
}
