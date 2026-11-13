/**
 * verify-diagnostics-tiles.ts — scripted proof for the diagnostics
 * tiles fix (Fix master #6).
 *
 * Bug: Diagnostics claimed "৯টি মূল কালেকশন" but showed 8 tiles —
 * notices + users were never counted.
 *
 * Rule under test: the Record Count Matrix has a tile for notices
 * and a tile for users (from the same AppContext state as the other
 * tiles), and the header computes its count from the tiled
 * collections instead of hardcoding ৯টি / 9.
 *
 * Run: npx tsx scripts/verify-diagnostics-tiles.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const src = readFileSync('components/settings/ReportsSettingsManager.tsx', 'utf8');
const gridStart = src.indexOf('Record Count Matrix');
const gridEnd = src.indexOf('Storage & Cloud Sync Card', gridStart);
const grid = gridStart === -1 || gridEnd === -1 ? '' : src.slice(gridStart, gridEnd);
check('record-count grid found', grid.length > 0);

check('users comes from AppContext state', src.includes('users = [],'));
check('notices tile shows notices.length', grid.includes('notices.length'));
check('users tile shows users.length', grid.includes('users.length'));
check('notices tile labelled', grid.includes('নোটিশ') || grid.includes('Notices'));
check('users tile labelled', grid.includes('লগইন অ্যাকাউন্ট') || grid.includes('Users'));
check('header no longer hardcodes ৯টি', !src.includes('৯টি মূল কালেকশন'));
check('header no longer hardcodes 9', !src.includes('all 9 core collections'));
check('header computes the count from the tiled collections',
  src.includes('diagnosticTileCollections.length'));
check('count list covers all 10 tiled collections',
  /const diagnosticTileCollections = \[[\s\S]*?students[\s\S]*?teachers[\s\S]*?classes[\s\S]*?subjects[\s\S]*?exams[\s\S]*?marks[\s\S]*?transactions[\s\S]*?trashBin[\s\S]*?notices[\s\S]*?users[\s\S]*?\]/.test(src));

console.log(failures === 0 ? '\nALL DIAGNOSTICS-TILES CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
