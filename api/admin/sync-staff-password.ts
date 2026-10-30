/**
 * Vercel Serverless Function: POST /api/admin/sync-staff-password
 *
 * Thin wrapper: the request handling logic lives in
 * server/staffPasswordApi.ts and is shared with the Vite dev middleware
 * and the standalone server route, mirroring api/admin/bootstrap-owner.ts.
 */
import { handleStaffPasswordSyncApi } from '../../server/staffPasswordApi.ts';

export default handleStaffPasswordSyncApi;
