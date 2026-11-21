/**
 * displayNames.ts — ONE rule for "print the second (Bangla) name?".
 *
 * Why: stored records carry name and nameBn as the IDENTICAL Bangla
 * string for most students/subjects (143/173 students, 108/109 subjects
 * in the 20 Nov 2026 backup — the Bangla name was typed into both form
 * fields), so any view printing both shows the name twice. Each view
 * used to decide that on its own with a bare trim() compare, which
 * misses near-duplicates (double space inside, NBSP) and was missing
 * from several views entirely. Every name + nameBn render uses
 * showSecondName() — nothing keeps its own ad-hoc check.
 */

// NFC + collapse every whitespace run (space, NBSP, tab, newline) to one
// space + trim — so 'মোঃ  নাজিম', 'মোঃ নাজিম' and 'মোঃ নাজিম ' compare
// equal. Bare trim() only strips the ends and misses the middle spaces.
export const normalizeNameForCompare = (value: string | undefined | null): string =>
  (value || '').normalize('NFC').replace(/\s+/g, ' ').trim();

export const isSameName = (a: string | undefined | null, b: string | undefined | null): boolean => {
  const na = normalizeNameForCompare(a);
  const nb = normalizeNameForCompare(b);
  return na !== '' && na === nb;
};

// Show the second name only when it is present and really different.
// Same name (exact, whitespace-only or Unicode-variant difference) =>
// the first name already says it; genuinely different names (English
// name + Bangla nameBn) still show both.
export const showSecondName = (name: string | undefined | null, nameBn: string | undefined | null): boolean =>
  !!name && !!nameBn && !isSameName(name, nameBn);
