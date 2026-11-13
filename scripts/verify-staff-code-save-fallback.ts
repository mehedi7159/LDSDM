/**
 * verify-staff-code-save-fallback.ts — scripted proof for the staff
 * save timestamp-code fix (Fix master #9).
 *
 * Bug: the staff save fell back to `MDR-T${Date.now().toString()
 * .slice(-3)}` — the last 3 digits of the millisecond clock,
 * repeating every second and unchecked — so two saves in the same
 * second minted the same code. The duplicate check only validated
 * a non-empty TYPED code.
 *
 * Rule under test: the save fallback is the shared trash-aware
 * nextEmployeeCode() (max live + trashed code + 1, from
 * services/staffCode.ts — the Fix #15 helper), never a timestamp;
 * the final code is duplicate-checked before saving; and the
 * helper itself never repeats a code within a second (two
 * back-to-back calls advance the sequence).
 *
 * Run: npx tsx scripts/verify-staff-code-save-fallback.ts
 */
import { readFileSync } from 'fs';
import { nextEmployeeCode } from '../services/staffCode';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const staff = readFileSync('components/staff/StaffManager.tsx', 'utf8');

// Source rules: the save path must not mint timestamp codes.
check("no timestamp fallback 'Date.now().toString().slice(-3)' in StaffManager",
  !staff.includes('Date.now().toString().slice(-3)'));
check('StaffManager uses the shared nextEmployeeCode helper',
  staff.includes("import { nextEmployeeCode } from '../../services/staffCode'"));
check('save fallback calls nextEmployeeCode(unifiedStaffList, trashBin)',
  staff.includes('nextEmployeeCode(unifiedStaffList, trashBin)'));
check('final code is duplicate-checked before saving',
  staff.includes('finalEmployeeCode') && staff.includes('finalEmployeeCode.toLowerCase()'));
check('save stores the checked final code',
  staff.includes('employeeCode: finalEmployeeCode'));

// Helper rules: sequential, trash-aware, never timestamp-based.
const live = [{ employeeCode: 'MDR-T001' }, { employeeCode: 'MDR-T002' }, { employeeCode: 'MDR-T003' }];
const trash = [{ data: { employeeCode: 'MDR-T004' } }];
eq('(1) Reported shape: live T001-T003 + trashed T004 -> T005',
  nextEmployeeCode(live as any, trash as any), 'MDR-T005');
eq('(2) Two back-to-back fallbacks advance, never repeat',
  nextEmployeeCode([...live, { employeeCode: nextEmployeeCode(live as any, trash as any) }] as any, trash as any), 'MDR-T006');
eq('(3) Empty live + empty trash -> T001',
  nextEmployeeCode([], []), 'MDR-T001');
check('(4) Fallback code is not time-derived (stable across calls)',
  nextEmployeeCode(live as any, trash as any) === nextEmployeeCode(live as any, trash as any));

console.log(failures === 0 ? '\nALL STAFF-CODE-SAVE-FALLBACK CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
