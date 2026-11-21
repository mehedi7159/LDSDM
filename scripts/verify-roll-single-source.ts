/**
 * verify-roll-single-source.ts — scripted proof for the Mim roll
 * instability (morning audits 18–19 Nov 2026).
 *
 * Symptom: Class 10 Mim's Roll flipped "0" → empty → "0" across days
 * with no code change, and on the same day the ID card showed
 * "রোল: ০" while the portal showed "—".
 *
 * Root cause (code): a student record carries TWO roll fields —
 * legacy `roll` and standardized `rollNumber` (types/student.ts) —
 * and readers split three ways:
 *   - majority: `roll || rollNumber || '—'` (StudentManager, attendance…)
 *   - `roll` ONLY: StudentIDCardGenerator (6 spots), WebResultView
 *     (6 spots), PortalsServicesManager (9 spots)
 *   - `rollNumber` ONLY: BlankMarksheetView (protected — untouched)
 * A record whose roll lives in only one field (or as a falsy number 0:
 * `0 || '—'` → '—' in the portal, raw `{student.roll}` → '0' on the
 * ID card) therefore shows differently in different places.
 *
 * Fix: one helper, getStudentRoll(), in services/utils.ts — legacy
 * `roll` wins, then `rollNumber`, else '' — and all 21 `roll`-only
 * reader spots in the three files read through it. No roll is ever
 * invented: both fields missing stays '' (data repair, not code).
 *
 * Data repair (NOT code — still open, needs a live Firestore read to
 * name every student): Class 10, 7 of 8 students have no roll in
 * either field; Mim's stored roll is 0 (invalid — needs a real roll
 * 1–8); Play rolls 07, 10, 11 are missing.
 *
 * Checks:
 *   (1) getStudentRoll unit cases (imported from services/utils).
 *   (2) ID card: 6 spots use the helper; no bare `.roll` read left.
 *   (3) WebResultView: 6 spots use the helper; no bare `.roll` read left.
 *   (4) Portal: 9 spots use the helper; no bare `.roll` read left.
 *   (5) BlankMarksheetView untouched (protected, still rollNumber-only).
 *   (6) No invented rolls (helper never falls back to index/count).
 *
 * Run: npx tsx scripts/verify-roll-single-source.ts
 * (or npm run test:roll-single-source).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStudentRoll } from '../services/utils';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const idCard = readSource('components/StudentIDCardGenerator.tsx');
const webResult = readSource('components/WebResultView.tsx');
const portal = readSource('components/portals/PortalsServicesManager.tsx');
const blankMarksheet = readSource('components/BlankMarksheetView.tsx');
const utils = readSource('services/utils.ts');
const pkg = JSON.parse(readSource('package.json'));

// (1) Helper behaviour — the single source of truth, on real shapes.
check('(1) roll-only record', getStudentRoll({ roll: '5' }) === '5', 'roll 5 must read as 5');
check('(1) rollNumber-only record', getStudentRoll({ rollNumber: '7' }) === '7', 'rollNumber 7 must read as 7');
check('(1) both set: legacy roll wins', getStudentRoll({ roll: '3', rollNumber: '9' }) === '3', 'roll must win over rollNumber');
check('(1) falsy number 0 falls through to rollNumber (Mim case)',
  getStudentRoll({ roll: 0 as any, rollNumber: '5' }) === '5', 'roll 0 must not hide rollNumber 5');
check('(1) number 0 alone reads empty, never "0" as a real roll',
  getStudentRoll({ roll: 0 as any }) === '', 'roll 0 alone is not a valid roll');
check('(1) both missing stays empty — no invented roll',
  getStudentRoll({}) === '' && getStudentRoll(null) === '' && getStudentRoll(undefined) === '',
  'missing roll must stay missing');
check('(1) whitespace trimmed', getStudentRoll({ roll: ' 07 ' }) === '07', 'roll must be trimmed');
check('(1) Bengali digits preserved', getStudentRoll({ roll: '০৭' }) === '০৭', 'Bengali-digit roll must pass through');

// Bare `.roll` reads (not `.rollNumber`): any left means a reader still
// bypasses the helper.
const bareRollReads = (src: string) => (src.match(/\.roll(?![A-Za-z])/g) || []).length;
const helperUses = (src: string) => (src.match(/getStudentRoll\(/g) || []).length;

// (2) ID card — sort, search, dropdown, card, admit card, TC text.
check('(2) ID card uses the helper (6 spots)', helperUses(idCard) >= 6, `found ${helperUses(idCard)} uses`);
check('(2) ID card has no bare .roll read left', bareRollReads(idCard) === 0, `found ${bareRollReads(idCard)} bare .roll reads`);

// (3) WebResultView — sort, two searches, dropdown, card header, merit.
check('(3) WebResultView uses the helper (6 spots)', helperUses(webResult) >= 6, `found ${helperUses(webResult)} uses`);
check('(3) WebResultView has no bare .roll read left', bareRollReads(webResult) === 0, `found ${bareRollReads(webResult)} bare .roll reads`);

// (4) Portal — search, QR lookup x2, SMS template, list, header, profile, x2 rows.
check('(4) portal uses the helper (9 spots)', helperUses(portal) >= 9, `found ${helperUses(portal)} uses`);
check('(4) portal has no bare .roll read left', bareRollReads(portal) === 0, `found ${bareRollReads(portal)} bare .roll reads`);

// (5) BlankMarksheetView is protected and untouched.
check('(5) BlankMarksheetView untouched (no helper, still rollNumber-only)',
  !blankMarksheet.includes('getStudentRoll') && blankMarksheet.includes('rollNumber ?? 999999'),
  'BlankMarksheetView must not be touched');

// (6) The helper never invents a roll (no index/count fallback).
check('(6) helper has no invented-roll fallback',
  !/idx \+ 1|students\.length \+ 1/.test(utils.split('getStudentRoll')[1]?.split('};')[0] || ''),
  'getStudentRoll must not fall back to an index or count');

check('(7) package.json exposes the verify script',
  pkg.scripts['test:roll-single-source'] === 'tsx scripts/verify-roll-single-source.ts',
  'npm run test:roll-single-source must run this script');

console.log(failures === 0 ? '\nALL ROLL-SINGLE-SOURCE CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
