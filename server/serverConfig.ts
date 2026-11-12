/**
 * Server-only owner config (12 Nov 2026, /api/admin 500 fix).
 *
 * services/appConfig.ts reads the owner email from `import.meta.env`,
 * which is fine for the Vite client bundle but a load-time SyntaxError
 * when Vercel compiles these server functions to CommonJS
 * (`import.meta` does not exist in CJS) — that is what made
 * GET /api/admin/bootstrap-owner and /api/admin/sync-staff-password
 * return 500 FUNCTION_INVOCATION_FAILED. Server code must therefore
 * never import services/appConfig.ts; it reads the same value from
 * process.env here instead. Same fallback address as before, so
 * behaviour is unchanged when no env var is set.
 */
const envOwnerEmail = process.env.SUPER_ADMIN_EMAIL || process.env.VITE_SUPER_ADMIN_EMAIL;

export const SUPER_ADMIN_EMAIL: string =
  typeof envOwnerEmail === 'string' && envOwnerEmail.trim()
    ? envOwnerEmail.trim()
    : 'mehedihasansagor26@gmail.com';
