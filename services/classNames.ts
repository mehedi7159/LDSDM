/**
 * Class-name canonicalization.
 *
 * A class carries both an English `name` ('Play', 'Class 1' … 'Class 10')
 * and a Bangla `nameBn` ('শিশু', '১ম শ্রেণী' …), but subjects/students
 * store only one string in `classLevel` — and records exist under either
 * spelling. Strict `===` against the selected class name therefore drops
 * whole classes (blank marksheet showed 0 subjects for Play while the
 * Academic page showed its 5). Canonical form is the English name.
 */

// Bangla display names (services/translations.ts cls_*), both spellings
// of শ্রেণী/শ্রেণি — live data uses either.
const CLASS_NAME_ALIASES: Record<string, string> = {
  'শিশু': 'Play',
  '১ম শ্রেণী': 'Class 1',
  '১ম শ্রেণি': 'Class 1',
  '২য় শ্রেণী': 'Class 2',
  '২য় শ্রেণি': 'Class 2',
  '৩য় শ্রেণী': 'Class 3',
  '৩য় শ্রেণি': 'Class 3',
  '৪র্থ শ্রেণী': 'Class 4',
  '৪র্থ শ্রেণি': 'Class 4',
  '৫ম শ্রেণী': 'Class 5',
  '৫ম শ্রেণি': 'Class 5',
  '৬ষ্ঠ শ্রেণী': 'Class 6',
  '৬ষ্ঠ শ্রেণি': 'Class 6',
  '৭ম শ্রেণী': 'Class 7',
  '৭ম শ্রেণি': 'Class 7',
  '৮ম শ্রেণী': 'Class 8',
  '৮ম শ্রেণি': 'Class 8',
  '৯ম শ্রেণী': 'Class 9',
  '৯ম শ্রেণি': 'Class 9',
  '১০ম শ্রেণী': 'Class 10',
  '১০ম শ্রেণি': 'Class 10',
};

/** Map a stored/selected class name to its canonical English form. */
export function canonicalClassName(raw?: string | null): string {
  const value = (raw || '').trim();
  return CLASS_NAME_ALIASES[value] || value;
}

/** True when two class-name spellings name the same class. */
export function classNamesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return canonicalClassName(a).toLowerCase() === canonicalClassName(b).toLowerCase();
}
