/**
 * verify-roll-v2.ts — scripted proof for the Mim roll flip, round 2
 * (morning audit 21 Nov 2026: ID card still "রোল: ০", student table "—").
 *
 * The v1 fix (PR #26, getStudentRoll) covered only 3 files and had a hole:
 *
 * (A) Helper hole — getStudentRoll() is `s?.roll || s?.rollNumber || ''`.
 *     A NUMBER 0 is falsy and falls through, but the STRING "0" is truthy,
 *     so it is returned as a real roll. And the string "0" is exactly what
 *     gets stored: a teacher types Bengali "০" in the roll field and the
 *     save path runs toAsciiDigits("০") = "0" into BOTH roll and rollNumber
 *     (buildCreateStudentPayload, StudentManager save) — no validation
 *     anywhere rejects roll 0 (studentValidation.ts never mentions roll).
 *     So even with v1 merged, the ID card still shows "রোল: ০".
 *
 * (B) Missed reader — the student table (StudentManager.tsx, the ছাত্র
 *     টেবিল) was never migrated: its roll cell still reads
 *     `student.roll || student.rollNumber` directly, plus the profile
 *     header, dropdown, form prefill, CSV export, search and sort. With a
 *     stored NUMBER 0 the table shows "-" (0 is falsy) while the old ID
 *     card showed "০" (raw {student.roll} renders 0) — the exact "০ vs —"
 *     pair from the audit. One record, two answers.
 *
 * Fix: getStudentRoll() treats any zero roll ("0", "০", 0, "00") as
 * missing; StudentManager reads through the helper; both studentService
 * builders store a zero roll as missing, so no new "0" can be minted.
 * A missing/invalid roll shows "—" (table) / "" (helper) — never invented.
 *
 * Checks:
 *   (1) getStudentRoll unit cases (imported from services/utils).
 *   (2) StudentManager uses the helper; no bare record .roll read left
 *       (formData.roll — the form input state — is not a record read).
 *   (3) Builders never store a zero roll (imported, real functions).
 *   (4) v1 regression: ID card / WebResultView / portal still use the
 *       helper; BlankMarksheetView untouched (protected).
 *   (5) package.json exposes the verify script.
 *
 * Run: npx tsx scripts/verify-roll-v2.ts (or npm run test:roll-v2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStudentRoll } from '../services/utils';
import { buildCreateStudentPayload, buildUpdateStudentPayload } from '../services/studentService';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const studentManager = readSource('components/StudentManager.tsx');
const idCard = readSource('components/StudentIDCardGenerator.tsx');
const webResult = readSource('components/WebResultView.tsx');
const portal = readSource('components/portals/PortalsServicesManager.tsx');
const blankMarksheet = readSource('components/BlankMarksheetView.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) Helper — a zero roll in ANY form is missing, never a real roll.
check('(1) string "0" is not a roll', getStudentRoll({ roll: '0' }) === '', `got ${JSON.stringify(getStudentRoll({ roll: '0' }))}`);
check('(1) Bengali "০" is not a roll', getStudentRoll({ roll: '০' }) === '', `got ${JSON.stringify(getStudentRoll({ roll: '০' }))}`);
check('(1) number 0 is not a roll', getStudentRoll({ roll: 0 as any }) === '', `got ${JSON.stringify(getStudentRoll({ roll: 0 as any }))}`);
check('(1) "00" is not a roll', getStudentRoll({ roll: '00' }) === '', `got ${JSON.stringify(getStudentRoll({ roll: '00' }))}`);
check('(1) zero roll falls through to a real rollNumber',
  getStudentRoll({ roll: '0', rollNumber: '5' }) === '5', `got ${JSON.stringify(getStudentRoll({ roll: '0', rollNumber: '5' }))}`);
check('(1) zero rollNumber falls through to a real roll',
  getStudentRoll({ roll: '5', rollNumber: '0' }) === '5', `got ${JSON.stringify(getStudentRoll({ roll: '5', rollNumber: '0' }))}`);
check('(1) real roll still reads', getStudentRoll({ roll: '5' }) === '5', 'roll 5 must read as 5');
check('(1) Bengali roll preserved, not zero', getStudentRoll({ roll: '০৭' }) === '০৭', `got ${JSON.stringify(getStudentRoll({ roll: '০৭' }))}`);
check('(1) both missing stays empty — no invented roll',
  getStudentRoll({}) === '' && getStudentRoll(null) === '' && getStudentRoll(undefined) === '',
  'missing roll must stay missing');

// (2) StudentManager — every record .roll read goes through the helper.
// formData.roll is the form's own input state, not a student-record read.
const recordReads = (src: string) => {
  const lines = src.split('\n').filter(l => !l.includes('formData.roll'));
  const joined = lines.join('\n');
  return (joined.match(/\.(roll)(?![A-Za-z])/g) || []).length;
};
const helperUses = (src: string) => (src.match(/getStudentRoll\(/g) || []).length;
check('(2) StudentManager uses the helper (table, header, dropdown, prefill, CSV, search, sort)',
  helperUses(studentManager) >= 7, `found ${helperUses(studentManager)} uses`);
check('(2) StudentManager has no bare record .roll read left',
  recordReads(studentManager) === 0, `found ${recordReads(studentManager)} bare .roll reads`);

// (3) Builders — a zero roll typed in the form is stored as missing.
const createdZeroBn = buildCreateStudentPayload({ name: 'Test', classLevel: 'Class 10', roll: '০' } as any);
check('(3) create: Bengali "০" stored as missing',
  createdZeroBn.student?.roll === undefined && createdZeroBn.student?.rollNumber === undefined,
  `got roll=${JSON.stringify(createdZeroBn.student?.roll)} rollNumber=${JSON.stringify(createdZeroBn.student?.rollNumber)}`);
const createdZero = buildCreateStudentPayload({ name: 'Test', classLevel: 'Class 10', roll: '0' } as any);
check('(3) create: "0" stored as missing',
  createdZero.student?.roll === undefined && createdZero.student?.rollNumber === undefined,
  `got roll=${JSON.stringify(createdZero.student?.roll)} rollNumber=${JSON.stringify(createdZero.student?.rollNumber)}`);
const createdReal = buildCreateStudentPayload({ name: 'Test', classLevel: 'Class 10', roll: '5' } as any);
check('(3) create: real roll "5" still stored',
  createdReal.student?.roll === '5' && createdReal.student?.rollNumber === '5',
  `got roll=${JSON.stringify(createdReal.student?.roll)} rollNumber=${JSON.stringify(createdReal.student?.rollNumber)}`);
const base = buildCreateStudentPayload({ name: 'Test', classLevel: 'Class 10', roll: '5' } as any).student;
const updatedZero = buildUpdateStudentPayload(base, { roll: '0', rollNumber: '0' } as any);
check('(3) update: "0" stored as missing',
  updatedZero.student?.roll === undefined && updatedZero.student?.rollNumber === undefined,
  `got roll=${JSON.stringify(updatedZero.student?.roll)} rollNumber=${JSON.stringify(updatedZero.student?.rollNumber)}`);

// (4) v1 regression — the three migrated files still use the helper.
check('(4) ID card still uses the helper (6 spots)', helperUses(idCard) >= 6, `found ${helperUses(idCard)} uses`);
check('(4) WebResultView still uses the helper (6 spots)', helperUses(webResult) >= 6, `found ${helperUses(webResult)} uses`);
check('(4) portal still uses the helper (9 spots)', helperUses(portal) >= 9, `found ${helperUses(portal)} uses`);
check('(4) BlankMarksheetView untouched (protected, still rollNumber-only)',
  !blankMarksheet.includes('getStudentRoll') && blankMarksheet.includes('rollNumber ?? 999999'),
  'BlankMarksheetView must not be touched');

// (5) Script wired up.
check('(5) package.json exposes the verify script',
  pkg.scripts['test:roll-v2'] === 'tsx scripts/verify-roll-v2.ts',
  'npm run test:roll-v2 must run this script');

console.log(failures === 0 ? '\nALL ROLL-V2 CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
