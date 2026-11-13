/**
 * Master audit F9 — default class list skips Class 4 — self-check.
 * Run: npx tsx scripts/verify-master-default-classes-4.ts
 *
 * defaultClasses must list the full ladder Play, Class 1–10 in
 * order (Class 4 was missing; live data has Class 4 students).
 * Nursery/KG are NOT added — no such level exists anywhere in the
 * codebase or the madrasa's ladder, which starts at Play.
 * Latent only: the live cloud class list overrides these defaults.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

check('defaultClasses lists Play + Class 1–10 in sequence', () => {
  const src = readSource('context/AppContext.tsx');
  const start = src.indexOf('const defaultClasses: SchoolClass[] = [');
  assert.ok(start > -1, 'defaultClasses must exist');
  const body = src.slice(start, src.indexOf('];', start));
  const names = [...body.matchAll(/name: '(Play|Class \d+)'/g)].map(m => m[1]);
  assert.deepStrictEqual(names, ['Play', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10']);
  const orders = [...body.matchAll(/order: (\d+)/g)].map(m => Number(m[1]));
  assert.deepStrictEqual(orders, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F9 default-classes-4 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
