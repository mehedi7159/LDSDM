/**
 * Central application configuration — single source of truth for values
 * that were previously hardcoded as literals across the codebase.
 *
 * SUPER_ADMIN_EMAIL: the platform owner's email address. It can be
 * overridden per-deployment with the VITE_SUPER_ADMIN_EMAIL environment
 * variable; when the variable is not set, the historical address is used
 * as the fallback so behaviour is identical to the previous hardcoded
 * value everywhere.
 *
 * The env access is deliberately guarded (`?.`): this module is also
 * imported from Node/tsx contexts (test scripts, server helpers) where
 * `import.meta.env` does not exist. In those contexts the fallback value
 * applies, exactly as before.
 */
const metaEnv = import.meta?.env;
const envSuperAdminEmail = metaEnv?.VITE_SUPER_ADMIN_EMAIL;
export const SUPER_ADMIN_EMAIL = typeof envSuperAdminEmail === 'string' && envSuperAdminEmail.trim()
    ? envSuperAdminEmail.trim()
    : 'mehedihasansagor26@gmail.com';
