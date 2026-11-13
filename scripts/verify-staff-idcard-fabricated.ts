/**
 * verify-staff-idcard-fabricated.ts — scripted proof for the staff ID
 * card fabricated-code fix (Fix master #3).
 *
 * Bug: staff ID cards printed a fabricated `MDR-T{list position}`
 * code and the directory card showed an `EMP-{id fragment}` code,
 * because the users-complement branch of unifiedStaffList copied
 * assignedClasses but dropped employeeCode and assignedSubjects —
 * so staff existing only as a users record hit both fallbacks and
 * showed no subjects.
 *
 * Rule under test: the complement push copies employeeCode and
 * assignedSubjects from the users record (AppUser carries an
 * optional employeeCode for legacy records); both display fallbacks
 * show '—' when no code exists instead of inventing one.
 *
 * Run: npx tsx scripts/verify-staff-idcard-fabricated.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const staff = readFileSync('components/staff/StaffManager.tsx', 'utf8');
const types = readFileSync('types.ts', 'utf8');

const compStart = staff.indexOf('users.forEach(u => {');
const compEnd = staff.indexOf('});', compStart);
const complement = compStart === -1 || compEnd === -1 ? '' : staff.slice(compStart, compEnd);
check('complement branch found', complement.length > 0);
check('complement copies employeeCode',
  complement.includes('employeeCode: u.employeeCode'));
check('complement copies assignedSubjects',
  complement.includes('assignedSubjects: u.assignedSubjects'));
check("AppUser carries optional employeeCode (legacy records)",
  /export interface AppUser \{[\s\S]*?employeeCode\?: string;/.test(types));
check("no fabricated 'MDR-T${idx + 1}' ID-card fallback",
  !staff.includes('MDR-T${idx + 1}'));
check("no fabricated 'EMP-${staff.id.slice(0, 6)}' directory fallback",
  !staff.includes('EMP-${staff.id.slice(0, 6)}'));
check("both displays fall back to '—' when no code exists",
  (staff.match(/staff\.employeeCode \|\| '—'/g) || []).length >= 2);

console.log(failures === 0 ? '\nALL STAFF-IDCARD-FABRICATED CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
