/**
 * Client side of the staff credential sync (25 Oct 2026 follow-up).
 *
 * When an admin changes a staff member's password/email in updateTeacher,
 * the app record changes immediately, but the Firebase Auth user still
 * holds the old credentials — the client SDK cannot change another
 * user's password. So the client calls the server endpoint
 * /api/admin/sync-staff-password, which verifies the admin's ID token
 * and performs the update with the Firebase Admin SDK.
 *
 * This module never throws: every failure maps to a 'failed' status so
 * the local change is never blocked. Passwords pass through to the
 * fetch body and are never logged.
 */

export type StaffCredentialSyncStatus =
  | { status: 'synced'; action: 'updated' | 'created' }
  | { status: 'not-needed' }
  | { status: 'skipped'; reason: 'no-prior-record' | 'non-staff-role' | 'no-email' }
  | { status: 'failed'; reason: string };

export type SyncFailureReason =
  | 'admin-not-signed-in'
  | 'service-account-missing'
  | 'not-authorized'
  | 'target-protected'
  | 'user-not-found'
  | 'invalid-input'
  | 'network'
  | 'server-error';

/** Maps a server error code to a client failure reason (pure). */
export function mapSyncErrorCode(code: string | undefined | null): SyncFailureReason {
  switch (code) {
    case 'SERVICE_ACCOUNT_REQUIRED':
      return 'service-account-missing';
    case 'UNAUTHORIZED_CALLER':
      return 'not-authorized';
    case 'TARGET_PROTECTED':
      return 'target-protected';
    case 'USER_NOT_FOUND':
      return 'user-not-found';
    case 'ID_TOKEN_REQUIRED':
    case 'INVALID_EMAIL':
    case 'INVALID_PASSWORD':
    case 'NOTHING_TO_UPDATE':
      return 'invalid-input';
    default:
      return 'server-error';
  }
}

export interface StaffCredentialSyncRequest {
  idToken: string;
  oldEmail?: string;
  email?: string;
  password?: string;
}

/**
 * Calls the server sync endpoint. Never throws: network/parse failures
 * become { status: 'failed', reason: 'network' }.
 */
export async function syncStaffCredentialToFirebase(
  req: StaffCredentialSyncRequest
): Promise<StaffCredentialSyncStatus> {
  try {
    const res = await fetch('/api/admin/sync-staff-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    if (res.ok && data?.success) {
      return { status: 'synced', action: data.action === 'created' ? 'created' : 'updated' };
    }
    return { status: 'failed', reason: mapSyncErrorCode(data?.code) };
  } catch {
    return { status: 'failed', reason: 'network' };
  }
}
