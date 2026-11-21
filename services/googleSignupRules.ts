/**
 * Pure decision rules kept for the live login paths (22 Nov 2026).
 *
 * These functions carry NO Firebase / React / storage side effects.
 * The sign-up helpers used to live here too — they went with the
 * sign-up functions in AppContext (L2 dead-auth cleanup). What stays
 * is what live code still uses: the password-login deny message, the
 * Google-only check (approval + login gates) and approvalPasswordFor
 * (Step-1 guard, tested by scripts/verify-step1-password-removal.ts).
 */

/** Message shown when a Google-only account tries password-login. */
export const GOOGLE_PASSWORD_LOGIN_DENIED =
  'এই অ্যাকাউন্ট Google দিয়ে তৈরি — পাসওয়ার্ড দিয়ে লগইন হবে না, Google দিয়ে লগইন করুন।';

/** True when the record is a Google-only account (no password exists). */
export function isGoogleOnlyAccount(
  record: { authProvider?: string } | null | undefined
): boolean {
  return !!record && record.authProvider === 'google';
}

/**
 * Password to stamp on an approved account record, if any.
 * Step 1 password removal: passwords are never stored in plain text
 * on account or staff records. Real authentication credentials live
 * strictly in Firebase Auth. Returns undefined always.
 */
export function approvalPasswordFor(_member: {
  password?: string;
  authProvider?: string;
}): string | undefined {
  return undefined;
}
