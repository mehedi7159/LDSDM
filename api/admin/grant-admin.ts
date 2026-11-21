/**
 * Vercel Serverless Function: POST /api/admin/grant-admin
 *
 * Lets the designated owner grant { role: 'admin' } to another account
 * (the principal) — bootstrap-owner only grants the claim to the caller.
 * The request handling logic lives in server/grantAdminApi.ts and is
 * shared unchanged between all three environments (Vite dev, server.ts,
 * Vercel). The strict owner-email check inside that handler is NOT
 * weakened: only the designated owner account, verified with a real
 * Firebase ID token, can grant the claim, and the granted claim is
 * exactly { role: 'admin' } — never isSuperAdmin.
 *
 * Required environment variable (set in the Vercel project settings):
 *   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (single line)
 *   for the Firebase project. On Vercel there are no local key files, so
 *   this env var is the supported credential source; the handler also
 *   accepts it being a path, which only applies to the standalone server.
 */
import { handleAdminGrantApi } from '../../server/grantAdminApi.js';

export default handleAdminGrantApi;
