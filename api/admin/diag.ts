/**
 * TEMPORARY diagnostic endpoint (to be removed after diagnosis).
 * Uses LITERAL dynamic imports (not variables) so Vercel's file tracer
 * includes the targets, and each stage is try/caught so one failure
 * doesn't kill the report. No secrets, no user data, no writes.
 */
import type { IncomingMessage, ServerResponse } from 'http';

type Stage = { stage: string; ok: boolean; error?: string };

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const stages: Stage[] = [];
  try {
    await import('firebase-admin/app');
    stages.push({ stage: 'firebase-admin/app', ok: true });
  } catch (e: any) {
    stages.push({ stage: 'firebase-admin/app', ok: false, error: String((e && e.message) || e) });
  }
  try {
    await import('firebase-admin/auth');
    stages.push({ stage: 'firebase-admin/auth', ok: true });
  } catch (e: any) {
    stages.push({ stage: 'firebase-admin/auth', ok: false, error: String((e && e.message) || e) });
  }
  try {
    await import('../../services/appConfig.js');
    stages.push({ stage: 'services/appConfig', ok: true });
  } catch (e: any) {
    stages.push({ stage: 'services/appConfig', ok: false, error: String((e && e.message) || e) });
  }
  try {
    await import('../../server/adminApi.js');
    stages.push({ stage: 'server/adminApi', ok: true });
  } catch (e: any) {
    stages.push({ stage: 'server/adminApi', ok: false, error: String((e && e.message) || e) });
  }
  try {
    await import('../../server/staffSyncPolicy.js');
    stages.push({ stage: 'server/staffSyncPolicy', ok: true });
  } catch (e: any) {
    stages.push({ stage: 'server/staffSyncPolicy', ok: false, error: String((e && e.message) || e) });
  }
  try {
    await import('../../server/staffPasswordApi.js');
    stages.push({ stage: 'server/staffPasswordApi', ok: true });
  } catch (e: any) {
    stages.push({ stage: 'server/staffPasswordApi', ok: false, error: String((e && e.message) || e) });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ node: process.version, stages }));
}
