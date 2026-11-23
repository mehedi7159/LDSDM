/**
 * Topbar identity button: Gmail photo or initials (23 Nov 2026).
 *
 * Sagor's word: show the MAIL's profile pic in the topbar button
 * when available, otherwise nothing extra — the old teal box +
 * first letter stays. The pic is the Firebase Auth user's photoURL
 * (the Google account's profile pic, present only after a Google
 * sign-in); email+password sign-in leaves it empty.
 */
export function topbarAvatarKind(
  photoURL: string | null | undefined,
  photoFailed: boolean,
): 'photo' | 'initial' {
  if (photoFailed) return 'initial';
  if (!photoURL || !photoURL.trim()) return 'initial';
  return 'photo';
}
