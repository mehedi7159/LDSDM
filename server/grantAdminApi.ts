/**
 * Vercel Serverless Function: POST /api/admin/grant-admin
 *
 * Lets the designated owner grant { role: 'admin' } to another account
 * (the principal). bootstrap-owner only grants the claim to the CALLER,
 * and the in-app bootstrap cannot be opened by the owner at all (the
 * AdminAuthModal opens only for non-admins, and its "অন্য অ্যাকাউন্ট"
 * switch logs out and closes the modal) — so without this endpoint the
 * principal would stay in Viewer Mode forever.
 *
 * The caller must be the owner email, verified with a real Firebase ID
 * token; the target is looked up by email. The granted claim is exactly
 * { role: 'admin' } — never isSuperAdmin (only the owner holds that).
 * The owner account itself can never be changed through this endpoint:
 * accounts:update replaces the whole custom-attributes object, so
 * granting here would strip the owner's isSuperAdmin.
 *
 * Required environment variable (set in the Vercel project settings):
 *   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (single line)
 *   for the Firebase project. On Vercel there are no local key files, so
 *   this env var is the supported credential source; the handler also
 *   accepts it being a path, which only applies to the standalone server.
 *
 * NOTE (25 Oct 2026): this handler no longer imports firebase-admin.
 * Vercel compiles these functions to CommonJS, and firebase-admin/auth
 * crashes there (jwks-rsa requires the ESM-only jose package). Token
 * verification and user management now go through Google REST APIs
 * (server/firebaseRestAuth.ts, node:crypto + fetch only). Behaviour,
 * codes, and response shapes are unchanged.
 *
 * Tokens are never logged (uid/email/action only).
 */
import { SUPER_ADMIN_EMAIL } from './serverConfig.js';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  TokenVerificationError,
  IdentityToolkitError,
  getServiceAccountCredential,
  resolveProjectId,
  getServiceAccountAccessToken,
  verifyFirebaseIdToken,
  lookupUserByEmail,
  lookupUserByUid,
  updateRestUser,
} from './firebaseRestAuth.js';

const OWNER_EMAIL = SUPER_ADMIN_EMAIL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleAdminGrantApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const data = body ? JSON.parse(body) : {};
      const { idToken, targetEmail } = data;

      if (!idToken) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'ID_TOKEN_REQUIRED',
          message: 'Firebase user ID token is required.'
        }));
        return;
      }

      const target = typeof targetEmail === 'string' ? targetEmail.trim().toLowerCase() : '';
      if (!target) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'TARGET_EMAIL_REQUIRED',
          message: 'The email of the account to grant admin to is required.'
        }));
        return;
      }
      if (!EMAIL_RE.test(target)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'TARGET_EMAIL_INVALID',
          message: 'The target email address is not valid.'
        }));
        return;
      }

      const cred = getServiceAccountCredential();
      if (!cred) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'SERVICE_ACCOUNT_REQUIRED',
          message: 'Firebase Service Account is not configured on the server environment.'
        }));
        return;
      }
      const projectId = resolveProjectId(cred);
      const accessToken = await getServiceAccountAccessToken(cred);

      // Verify caller's ID token (signature + aud/iss/exp + revocation).
      let decoded;
      try {
        decoded = await verifyFirebaseIdToken(idToken, projectId, {
          lookupValidSince: async (uid: string) => {
            const user = await lookupUserByUid(accessToken, projectId, uid);
            return user ? (user.validSince ?? null) : null;
          },
        });
      } catch (err: any) {
        if (err instanceof TokenVerificationError) {
          res.statusCode = err.statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            code: err.code,
            message: err.message,
          }));
          return;
        }
        throw err;
      }
      const userEmail = decoded.email;

      // Strict Security Check: only the designated owner email may grant admin.
      if (!userEmail || userEmail.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'UNAUTHORIZED_EMAIL',
          message: `Only the designated owner email (${OWNER_EMAIL}) may grant admin.`
        }));
        return;
      }

      // The owner account can never be changed here (would strip isSuperAdmin).
      if (target === OWNER_EMAIL.toLowerCase()) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'TARGET_PROTECTED',
          message: 'The owner account cannot be changed through this endpoint.'
        }));
        return;
      }

      // Look the target up by email; 404 when no Auth user exists.
      let targetUser;
      try {
        targetUser = await lookupUserByEmail(accessToken, projectId, target);
      } catch (err: any) {
        if (err instanceof IdentityToolkitError && err.restCode === 'USER_NOT_FOUND') {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            code: 'TARGET_NOT_FOUND',
            message: `No Firebase user exists for ${target}.`
          }));
          return;
        }
        throw err;
      }

      // Assign Custom Claim { role: 'admin' } — never isSuperAdmin.
      await updateRestUser(accessToken, projectId, targetUser.localId, {
        customAttributes: JSON.stringify({ role: 'admin' }),
      });

      console.log(`[Admin API] Granted role: 'admin' to ${target} (UID: ${targetUser.localId}) by owner ${userEmail}`);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        uid: targetUser.localId,
        email: targetUser.email ?? target,
        role: 'admin',
        message: `Custom claim { role: 'admin' } has been assigned to ${target}.`
      }));
    } catch (err: any) {
      console.error('[Admin API] Error in grant handler:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Internal server error while granting admin claim.'
      }));
    }
  });
}
