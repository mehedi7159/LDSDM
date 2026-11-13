/**
 * verify-routine-touch-actions.ts — scripted proof for the routine
 * grid touch-actions fix (Fix master #8).
 *
 * Bug: the edit/delete buttons on a filled routine cell were
 * `opacity-0 group-hover:opacity-100` — hover-only, so on phones
 * and tablets (no hover) the actions were unreachable.
 *
 * Rule under test: the filled-cell action row stays visible on
 * small screens (max-md:opacity-100) and when keyboard-focused
 * (focus-within:opacity-100), while desktop keeps its hover-reveal
 * (group-hover:opacity-100) and the row stays hidden on print.
 *
 * Run: npx tsx scripts/verify-routine-touch-actions.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const src = readFileSync('components/academic/ClassRoutineBuilder.tsx', 'utf8');
const marker = 'Action buttons (hidden on print)';
const start = src.indexOf(marker);
const row = start === -1 ? '' : src.slice(start, src.indexOf('handleOpenEdit', start) + 40);
check('filled-cell action row found', row.length > 0);
check('actions always visible on small screens (max-md:opacity-100)',
  row.includes('max-md:opacity-100'));
check('actions visible when keyboard-focused (focus-within:opacity-100)',
  row.includes('focus-within:opacity-100'));
check('desktop keeps hover-reveal (group-hover:opacity-100)',
  row.includes('group-hover:opacity-100'));
check('row still hidden on print (print:hidden)',
  row.includes('print:hidden'));
check('no hover-only opacity-0 without a small-screen override',
  !/opacity-0 group-hover:opacity-100/.test(row));

console.log(failures === 0 ? '\nALL ROUTINE-TOUCH-ACTIONS CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
