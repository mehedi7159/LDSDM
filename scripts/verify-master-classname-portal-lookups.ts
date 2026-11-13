/**
 * Master audit F4 — Play/শিশু class-name mismatch in portal lookups —
 * self-check. Run: npx tsx scripts/verify-master-classname-portal-lookups.ts
 *
 *  - classNamesMatch('শিশু', 'Play') is true; exact === is false.
 *  - The five exact-match filters use classNamesMatch (filter-only,
 *    same narrow exception the principal accepted for
 *    WebResultView/BlankMarksheetView lookups):
 *    WebResultView subjects + class students, StudentIDCardGenerator
 *    students, PublicResultSearch class match, GuardianPortal subjects,
 *    AuthPage subjects.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { canonicalClassName, classNamesMatch } = await import('../services/classNames');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

check('classNamesMatch bridges Bangla and English spellings', () => {
  assert.strictEqual(classNamesMatch('শিশু', 'Play'), true);
  assert.strictEqual(classNamesMatch('Play', 'শিশু'), true);
  assert.strictEqual(classNamesMatch('১ম শ্রেণী', 'Class 1'), true);
  assert.strictEqual(classNamesMatch('Class 1', 'Class 2'), false);
  assert.strictEqual(canonicalClassName('শিশু'), 'Play');
});

const usesNormalizer = (rel: string, snippet: string) => {
  const src = readSource(rel);
  assert.ok(src.includes("from '../services/classNames'") || src.includes("from '../../services/classNames'"), `${rel} must import the classNames normalizer`);
  assert.ok(src.includes(snippet), `${rel} must use classNamesMatch in the filter: ${snippet}`);
};

check('WebResultView subjects + class students use classNamesMatch', () => {
  usesNormalizer('components/WebResultView.tsx', 'classNamesMatch(s.classLevel, selectedClass)');
});

check('StudentIDCardGenerator students use classNamesMatch', () => {
  usesNormalizer('components/StudentIDCardGenerator.tsx', 'classNamesMatch(s.classLevel, selectedClass)');
});

check('PublicResultSearch class match uses classNamesMatch', () => {
  usesNormalizer('components/PublicResultSearch.tsx', 'classNamesMatch(s.classLevel, selectedClass)');
});

check('GuardianPortal subjects use classNamesMatch', () => {
  usesNormalizer('components/GuardianPortal.tsx', 'classNamesMatch(s.classLevel, linkedStudent.classLevel)');
});

check('AuthPage subjects use classNamesMatch', () => {
  usesNormalizer('components/AuthPage.tsx', 'classNamesMatch(s.classLevel, searchedStudent.classLevel)');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F4 classname-portal-lookups self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
