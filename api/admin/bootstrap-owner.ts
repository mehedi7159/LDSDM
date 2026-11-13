/**
 * Vercel Serverless Function: POST /api/admin/bootstrap-owner
 *
 * Production counterpart of the Vite dev middleware / standalone server
 * route. The request handling logic lives in server/adminApi.ts and is
 * shared unchanged between all three environments (Vite dev, server.ts,
 * Vercel). The strict owner-email check inside that handler is NOT
 * weakened: only the designated owner account, verified with a real
 * Firebase ID token, can receive the admin custom claim.
 *
 * Required environment variable (set in the Vercel project settings):
 *   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (single line)
 *   for the Firebase project. On Vercel there are no local key files, so
 *   this env var is the supported credential source; the handler also
 *   accepts it being a path, which only applies to the standalone server.
 */
import { handleAdminBootstrapApi } from '../../server/adminApi.js';

export default handleAdminBootstrapApi;
