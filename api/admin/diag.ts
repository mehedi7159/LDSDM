/**
 * TEMPORARY diagnostic endpoint (to be removed after diagnosis).
 * It statically imports nothing (types only), then dynamically imports
 * each piece of the admin API chain inside try/catch and reports which
 * stage fails. No secrets, no user data, no writes.
 */
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const tries: Array<[string, string]> = [
    ['firebase-admin/app', 'firebase-admin/app'],
    ['firebase-admin/auth', 'firebase-admin/auth'],
    ['services/appConfig', '../../services/appConfig.js'],
    ['server/adminApi', '../../server/adminApi.js'],
    ['server/staffSyncPolicy', '../../server/staffSyncPolicy.js'],
    ['server/staffPasswordApi', '../../server/staffPasswordApi.js'],
  ];
  const stages: Array<{ stage: string; ok: boolean; error?: string }> = [];
  for (const [name, spec] of tries) {
    try {
      await import(spec);
      stages.push({ stage: name, ok: true });
    } catch (e: any) {
      stages.push({ stage: name, ok: false, error: String((e && e.message) || e) });
    }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ stages }));
}
