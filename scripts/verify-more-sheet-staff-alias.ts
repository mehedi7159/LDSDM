/**
 * More-sheet 'staff' nav alias — self-check
 * (13 Nov 2026, base commit 7c5f07c; Sagor approved adding 'staff' to Fix #13).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-more-sheet-staff-alias.ts
 * (or npm run test:more-sheet-staff-alias).
 *
 * Root cause: the More sheet (MobileMoreSheet.tsx) navigates with the
 * short id 'staff' (handleSelect -> onNavigateTab(id) -> setActiveTab),
 * and the desktop target is 'user_roles'. App.tsx had no case for
 * 'staff' anywhere, so the switch fell through to
 * `default: return <Dashboard />` — same bug Fix #13 fixed for
 * 'notices' / 'routine' / 'portals_hub'.
 *
 * The fix adds 'staff' as a fall-through alias case before
 * 'user_roles' in App.tsx, plus the mirrors the file's own
 * conventions already demand for a tab id: the permission gate
 * (isTabAllowedForUser) and the server-data gate name
 * (SERVER_DATA_TAB_NAMES). 'user_roles' is a gated tab, so 'staff'
 * needs NO entry in the universal-allow list or in
 * SERVER_DATA_UNGATED_TABS. The callers are deliberately NOT
 * renamed — only the router-side alias fixes every caller at once.
 *
 * Verified mapping:
 *  - 'staff' -> 'user_roles' (StaffManager, directory)
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const app = readSource('App.tsx');
const layout = readSource('components/Layout.tsx');
const moreSheet = readSource('components/ui/MobileMoreSheet.tsx');

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

// --- The alias case exists in renderContentInner, falling through
// to the canonical case (nothing between the alias label and the target).
console.log('--- Render switch: alias case falls through to the real screen ---');
check("'staff' falls through to 'user_roles'", () => {
  assert.ok(/case 'staff':\s*\n\s*case 'user_roles':/.test(app), "no 'staff' alias before 'user_roles'");
});

// --- The alias can no longer reach the Dashboard default.
console.log('--- Alias no longer falls through to default Dashboard ---');
check("render switch still ends in 'default: return <Dashboard />'", () => {
  assert.ok(/default: return <Dashboard \/>;/.test(app), 'default case changed unexpectedly');
});
check("no stray 'staff' case after the default", () => {
  const defIdx = app.indexOf('default: return <Dashboard />;');
  assert.ok(defIdx > 0, 'default case not found');
  const afterDefault = app.slice(defIdx);
  assert.ok(!/case 'staff':/.test(afterDefault), 'alias case placed after default (dead code)');
});

// --- Permission gate mirrors the alias (same convention as every other tab).
console.log('--- Permission gate (isTabAllowedForUser) mirrors the alias ---');
check("'staff' is grouped with 'user_roles' in the gate", () => {
  assert.ok(/case 'staff':\s*\n\s*case 'user_roles':/.test(app), "'staff' not grouped with 'user_roles' in the gate");
});

// --- Server-data gate parity: same loading label as the canonical tab.
console.log('--- Server-data gate parity ---');
check("'staff' has the same server-data name as 'user_roles'", () => {
  assert.ok(/^\s*staff: \{ bn: 'স্টাফ তথ্য', en: 'Staff data' \}/m.test(app), "'staff' missing from SERVER_DATA_TAB_NAMES");
});

// --- Callers still use the short id (fix lives in the router, not the call sites).
console.log('--- Callers unchanged (short id still used) ---');
check("More sheet still lists 'staff' with targetTab 'user_roles'", () => {
  assert.ok(/id: 'staff'/.test(moreSheet), "More sheet no longer lists 'staff'");
  assert.ok(/id: 'staff'[\s\S]{0,200}targetTab: 'user_roles'/.test(layout), "Layout menu no longer maps 'staff' to 'user_roles'");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
