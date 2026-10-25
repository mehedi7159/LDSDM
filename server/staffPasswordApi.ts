/**
 * Vercel Serverless handler: POST /api/admin/sync-staff-password
 * (25 Oct 2026 follow-up).
 *
 * Problem it solves: the Firebase client SDK lets a user change only
 * their OWN password, so an admin editing a staff member's password or
 * email in updateTeacher cannot sync the Firebase Auth user from the
 * app. This endpoint does it server-side with the Firebase Admin SDK.
 *
 * Pattern mirrors server/adminApi.ts (bootstrap-owner): same method +
 * body handling, same getAdminApp() credential source (FIREBASE_SERVICE_ACCOUNT
 * env or local key file), same ID-token verification. Authorization is
 * bootstrap-owner's model extended for admins: the caller must be the
 * designated owner email OR hold an admin custom claim (role 'admin'
 * or isSuperAdmin true). The owner/super_admin account itself can never
 * be changed through this endpoint.
 *
 * Passwords are never logged (email/uid/action only). If
 * FIREBASE_SERVICE_ACCOUNT is not configured, the handler returns a
 * clear SERVICE_ACCOUNT_REQUIRED error instead of crashing.
 */
import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import type { IncomingMessage, ServerResponse } from 'http';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './adminApi';
import {
  isSyncCallerAuthorized,
  isProtectedTargetEmail,
  isUsableStaffEmail,
} from './staffSyncPolicy';

const OWNER_EMAIL = SUPER_ADMIN_EMAIL;

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function handleStaffPasswordSyncApi(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const data = body ? JSON.parse(body) : {};
      const { idToken, oldEmail, email, password } = data as {
        idToken?: string;
        oldEmail?: string;
        email?: string;
        password?: string;
      };

      if (!idToken) {
        sendJson(res, 400, {
          success: false,
          code: 'ID_TOKEN_REQUIRED',
          message: 'Firebase user ID token is required.',
        });
        return;
      }

      const adminApp = getAdminApp();
      if (!adminApp) {
        sendJson(res, 400, {
          success: false,
          code: 'SERVICE_ACCOUNT_REQUIRED',
          message: 'Firebase Service Account is not configured on the server environment.',
        });
        return;
      }

      const adminAuth = getAuth(adminApp);

      // Verify caller's ID token using Firebase Admin SDK.
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      if (!isSyncCallerAuthorized(decoded, OWNER_EMAIL)) {
        sendJson(res, 403, {
          success: false,
          code: 'UNAUTHORIZED_CALLER',
          message: 'Only the designated owner or an admin account may sync staff credentials.',
        });
        return;
      }

      // The owner/super_admin account can never be changed here.
      if (isProtectedTargetEmail(oldEmail, OWNER_EMAIL) || isProtectedTargetEmail(email, OWNER_EMAIL)) {
        sendJson(res, 403, {
          success: false,
          code: 'TARGET_PROTECTED',
          message: 'The owner account cannot be changed through this endpoint.',
        });
        return;
      }

      const lookupEmail = isUsableStaffEmail(oldEmail) ? oldEmail!.trim().toLowerCase() : undefined;
      const newEmail = isUsableStaffEmail(email) ? email!.trim().toLowerCase() : undefined;
      const newPassword = typeof password === 'string' && password.length > 0 ? password : undefined;

      if (!lookupEmail && !newEmail) {
        sendJson(res, 400, {
          success: false,
          code: 'INVALID_EMAIL',
          message: 'A usable staff email is required.',
        });
        return;
      }

      // Nothing to change: no new email and no new password.
      if (!newPassword && (!newEmail || newEmail === lookupEmail)) {
        sendJson(res, 200, { success: true, action: 'no-change' });
        return;
      }

      try {
        const target = await adminAuth.getUserByEmail(lookupEmail ?? newEmail!);
        const update: { email?: string; password?: string } = {};
        if (newEmail && newEmail !== target.email?.toLowerCase()) update.email = newEmail;
        if (newPassword) update.password = newPassword;
        if (Object.keys(update).length === 0) {
          sendJson(res, 200, { success: true, action: 'no-change', uid: target.uid });
          return;
        }
        await adminAuth.updateUser(target.uid, update);
        console.log(`[StaffPasswordSync] Updated Firebase user ${target.uid} (${target.email})`);
        sendJson(res, 200, { success: true, action: 'updated', uid: target.uid });
      } catch (lookupErr: any) {
        if (lookupErr?.code === 'auth/user-not-found') {
          // Email added later (or never provisioned): create the user so
          // the staff member's cloud sync starts working immediately.
          if (newEmail && newPassword) {
            try {
              const created = await adminAuth.createUser({ email: newEmail, password: newPassword });
              console.log(`[StaffPasswordSync] Created Firebase user ${created.uid} (${newEmail})`);
              sendJson(res, 200, { success: true, action: 'created', uid: created.uid });
              return;
            } catch (createErr: any) {
              if (createErr?.code === 'auth/invalid-password') {
                sendJson(res, 400, {
                  success: false,
                  code: 'INVALID_PASSWORD',
                  message: 'Password must be at least 6 characters.',
                });
                return;
              }
              throw createErr;
            }
          }
          sendJson(res, 404, {
            success: false,
            code: 'USER_NOT_FOUND',
            message: 'No Firebase user exists for this staff member.',
          });
          return;
        }
        if (lookupErr?.code === 'auth/invalid-password') {
          sendJson(res, 400, {
            success: false,
            code: 'INVALID_PASSWORD',
            message: 'Password must be at least 6 characters.',
          });
          return;
        }
        throw lookupErr;
      }
    } catch (err: any) {
      console.error('[StaffPasswordSync] Error in sync handler:', err?.code || err);
      sendJson(res, 500, {
        success: false,
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Internal server error while syncing staff credentials.',
      });
    }
  });
}
