/**
 * Pure decision rules for Google sign-up (25 Oct 2026).
 *
 * These functions carry NO Firebase / React / storage side effects, so
 * scripts/verify-google-signup.ts tests the REAL rules (not copies).
 * AppContext imports them for signUpWithGoogle, approveMember and the
 * password-login deny paths.
 */

/** Message shown when a Google-only account tries password-login. */
export const GOOGLE_PASSWORD_LOGIN_DENIED =
  'এই অ্যাকাউন্ট Google দিয়ে তৈরি — পাসওয়ার্ড দিয়ে লগইন হবে না, Google দিয়ে লগইন করুন।';

/**
 * Builds the member record for a Google sign-up. Used by AppContext's
 * signUpWithGoogle AND tested directly by scripts/verify-google-signup.ts.
 * Invariants, all load-bearing:
 * - doc id (uid) = the Firebase uid (boot lookup uses authUser.uid);
 * - status is ALWAYS 'pending' (approval is the only activator);
 * - NO password field (Google-only accounts must never gain one);
 * - NO teachers-list entry is created here (approval creates it);
 * - authProvider 'google' marks the record for the password-login deny.
 */
export function buildGoogleSignupMember(input: {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  requestedRole: string;
}): {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  authProvider: 'google';
  roleId: string;
  requestedRole: string;
  status: 'pending';
  assignedClasses: string[];
  assignedSubjects: string[];
  createdAt: string;
  updatedAt: string;
} {
  const now = new Date().toISOString();
  return {
    uid: input.uid,
    email: input.email,
    displayName: input.displayName,
    phone: input.phone || '',
    authProvider: 'google',
    roleId: mapRequestedRoleToRoleId(input.requestedRole),
    requestedRole: input.requestedRole,
    status: 'pending',
    assignedClasses: [],
    assignedSubjects: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Message shown when the email already has a member record. */
export const GOOGLE_SIGNUP_EXISTING_MEMBER =
  'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে — লগইন করুন।';

/**
 * Maps the register form's picked role label to a member roleId.
 * Byte-identical logic to the email sign-up path in AppContext, so a
 * Google sign-up and an email sign-up for the same picked role land
 * on the same roleId (and the same approval flow).
 */
export function mapRequestedRoleToRoleId(requestedRole: string): string {
  const r = (requestedRole || '').toLowerCase();
  if (r.includes('account') || r.includes('ক্যাশ')) {
    return 'role_accountant';
  }
  if (
    r.includes('principal') ||
    r.includes('অধ্যক্ষ') ||
    r.includes('সুপার') ||
    r.includes('মুহতামিম')
  ) {
    return 'role_principal';
  }
  if (r.includes('staff') || r.includes('অফিস')) {
    return 'role_office_staff';
  }
  if (r.includes('guardian') || r.includes('অভিভাবক')) {
    return 'role_guardian';
  }
  return 'role_teacher';
}

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

/**
 * Bangla message for a Google sign-up/sign-in popup failure.
 * account-exists-with-different-credential gets its own clear message
 * (e.g. sagor1@gmail.com already has an email/password account);
 * popup-closed-by-user gets its own retry message; everything else
 * falls back to the generic failure message.
 */
export function googlePopupErrorMessage(code?: string): string {
  if (code === 'auth/account-exists-with-different-credential') {
    return 'এই ইমেইলে পাসওয়ার্ড-অ্যাকাউন্ট আছে — পাসওয়ার্ড দিয়ে লগইন করুন।';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google উইন্ডো বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।';
  }
  return 'Google নিবন্ধন সম্পন্ন হয়নি। আবার চেষ্টা করুন।';
}
