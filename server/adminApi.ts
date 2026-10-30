/**
 * Vercel Serverless Function: POST /api/admin/bootstrap-owner
 *
 * Production counterpart of the Vite dev middleware / standalone server
 * route. The request handling logic lives here and is shared unchanged
 * between all three environments (Vite dev, server.ts, Vercel). The
 * strict owner-email check inside this handler is NOT weakened: only
 * the designated owner account, verified with a real Firebase ID token,
 * can receive the admin custom claim.
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
 */
import { SUPER_ADMIN_EMAIL } from '../services/appConfig.ts';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  TokenVerificationError,
  getServiceAccountCredential,
  resolveProjectId,
  getServiceAccountAccessToken,
  verifyFirebaseIdToken,
  lookupUserByUid,
  updateRestUser,
} from './firebaseRestAuth.ts';

const PRIMARY_OWNER_EMAIL = SUPER_ADMIN_EMAIL;

export async function handleAdminBootstrapApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
      const { idToken } = data;

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

      // Strict Security Check: Only the authorized owner email can be granted admin claims via this endpoint
      if (!userEmail || userEmail.toLowerCase() !== PRIMARY_OWNER_EMAIL.toLowerCase()) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'UNAUTHORIZED_EMAIL',
          message: `Only the designated owner email (${PRIMARY_OWNER_EMAIL}) is permitted for bootstrap.`
        }));
        return;
      }

      // Assign Custom Claim { role: 'admin', isSuperAdmin: true }
      await updateRestUser(accessToken, projectId, decoded.uid, {
        customAttributes: JSON.stringify({ role: 'admin', isSuperAdmin: true }),
      });

      console.log(`[Admin API] Successfully granted role: 'admin' (isSuperAdmin: true) to ${userEmail} (UID: ${decoded.uid})`);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        uid: decoded.uid,
        email: userEmail,
        role: 'admin',
        isSuperAdmin: true,
        message: `Custom claim { role: 'admin', isSuperAdmin: true } has been assigned to ${userEmail}.`
      }));
    } catch (err: any) {
      console.error('[Admin API] Error in bootstrap handler:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Internal server error while setting admin claim.'
      }));
    }
  });
}
