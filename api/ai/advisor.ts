/**
 * Vercel Serverless Function: POST /api/ai/advisor
 *
 * Production counterpart of the Vite dev middleware / standalone server
 * route. The request handling logic lives in server/aiAssistantApi.ts and
 * is shared unchanged between all three environments (Vite dev, server.ts,
 * Vercel) so behaviour — including the super_admin / principal role gate —
 * stays identical everywhere.
 *
 * Required environment variable (set in the Vercel project settings):
 *   GEMINI_API_KEY  (fallback name: API_KEY)
 * Without a key the endpoint still responds, using its built-in heuristic
 * engine — exactly like the dev/server behaviour.
 */
import { handleAiAdvisorApi } from '../../server/aiAssistantApi.ts';

export default handleAiAdvisorApi;
