/**
 * verify-hardcoded-year.ts — scripted proof for the hardcoded
 * academic-year fix (Fix master #7).
 *
 * Bug: the routine print header always said "শিক্ষাবর্ষ: ২০২৬"
 * whatever year is set, and the staff ID card fell back to a stale
 * '২০২৫-২০২৬' when schoolProfile.academicYear was empty.
 *
 * Rule under test: the routine header uses
 * schoolProfile.academicYear from context with a '—' fallback, and
 * the staff ID card shows '—' (no invented year) when the profile
 * year is unset.
 *
 * Run: npx tsx scripts/verify-hardcoded-year.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const routine = readFileSync('components/academic/ClassRoutineBuilder.tsx', 'utf8');
const staff = readFileSync('components/staff/StaffManager.tsx', 'utf8');

check('routine takes schoolProfile from context',
  routine.includes('schoolProfile') && /const \{[^}]*schoolProfile[^}]*\} = useApp\(\)/.test(routine));
check('routine header uses schoolProfile.academicYear',
  routine.includes('schoolProfile.academicYear'));
check("routine header has no hardcoded 'শিক্ষাবর্ষ: ২০২৬'",
  !routine.includes('শিক্ষাবর্ষ: ২০২৬'));
check("routine header has no hardcoded 'Academic Year: 2026'",
  !routine.includes('Academic Year: 2026'));
check("routine header falls back to '—' when unset",
  routine.includes("schoolProfile.academicYear || '—'"));
check("staff ID card drops the stale '২০২৫-২০২৬' fallback",
  !staff.includes('২০২৫-২০২৬'));
check("staff ID card shows '—' when the year is unset",
  staff.includes("schoolProfile.academicYear || '—'"));

console.log(failures === 0 ? '\nALL HARDCODED-YEAR CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
