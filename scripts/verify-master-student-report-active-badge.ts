/**
 * Master audit F7 — student report mislabels 'Active' students —
 * self-check. Run: npx tsx scripts/verify-master-student-report-active-badge.ts
 *
 * StudentReportView compared status against lowercase 'active' only,
 * so canonical 'Active' students counted as inactive and wore the
 * rose Inactive badge. Both the count and the badge must use the
 * same case-insensitive check Fix #6 used (toLowerCase()).
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

check('activeCount is case-insensitive', () => {
  const src = readSource('components/StudentReportView.tsx');
  assert.ok(src.includes("s.status?.toLowerCase() === 'active'"), 'activeCount must use toLowerCase()');
  assert.ok(!src.includes("filter(s => s.status === 'active')"), 'exact lowercase status comparison must be gone');
});

check('status badge is case-insensitive', () => {
  const src = readSource('components/StudentReportView.tsx');
  const badgeUses = (src.match(/s\.status\?\.toLowerCase\(\) === 'active'/g) || []).length;
  assert.ok(badgeUses >= 2, `badge + count need at least 2 case-insensitive checks, found ${badgeUses}`);
  assert.ok(!src.includes("s.status === 'active' ?"), 'badge ternary must not use the exact lowercase comparison');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F7 student-report-active-badge self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
