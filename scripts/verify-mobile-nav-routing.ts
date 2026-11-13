/**
 * Fix #13 (mobile nav: Notices / Routine / Portal open Dashboard) — self-check
 * (13 Nov 2026, base commit 1ae40db).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-mobile-nav-routing.ts
 * (or npm run test:mobile-nav-routing).
 *
 * Root cause: the mobile bottom nav (Layout.tsx) and the More sheet
 * (MobileMoreSheet.tsx) navigate with short ids — 'notices', 'routine',
 * 'portals_hub' — and the Dashboard quick-action card does the same
 * (ExecutiveInstitutionalDashboard.tsx onNavigate('notices')). App.tsx
 * renderContentInner had no case for any of them, so the switch fell
 * through to `default: return <Dashboard />`. Desktop worked because
 * the sidebar rail navigates with the canonical targetTab ids
 * ('notice_board', 'class_routine', 'guardian_portal').
 *
 * The fix adds the three short ids as fall-through alias cases in
 * App.tsx renderContentInner, plus the mirrors the file's own
 * conventions already demand for a tab id: the permission gate
 * (isTabAllowedForUser), the server-data gate names
 * (SERVER_DATA_TAB_NAMES) and the ungated set
 * (SERVER_DATA_UNGATED_TABS). The callers are deliberately NOT
 * renamed — the Dashboard card calls setActiveTab('notices') directly
 * and bypasses Layout, so only the router-side alias fixes every
 * caller at once.
 *
 * Verified mappings:
 *  - 'notices'     -> 'notice_board'   (ReportsSettingsManager, notices)
 *  - 'routine'     -> 'class_routine'  (AcademicManager, routine)
 *  - 'portals_hub' -> 'guardian_portal' (PortalsServicesManager / GuardianPortal)
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
const dashboard = readSource('components/ExecutiveInstitutionalDashboard.tsx');

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

// --- The three alias cases exist in renderContentInner, falling through
// to the canonical case (nothing between the alias label and the target).
console.log('--- Render switch: alias cases fall through to the real screens ---');
check("'notices' falls through to 'notice_board'", () => {
  assert.ok(/case 'notices':\s*\n\s*case 'notice_board':/.test(app), "no 'notices' alias before 'notice_board'");
});
check("'routine' falls through to 'class_routine'", () => {
  assert.ok(/case 'routine':\s*\n\s*case 'class_routine':/.test(app), "no 'routine' alias before 'class_routine'");
});
check("'portals_hub' falls through to 'guardian_portal'", () => {
  assert.ok(/case 'portals_hub':\s*\n\s*case 'guardian_portal':/.test(app), "no 'portals_hub' alias before 'guardian_portal'");
});

// --- The aliases can no longer reach the Dashboard default.
console.log('--- Aliases no longer fall through to default Dashboard ---');
check("render switch still ends in 'default: return <Dashboard />'", () => {
  assert.ok(/default: return <Dashboard \/>;/.test(app), 'default case changed unexpectedly');
});
check("no stray 'notices'/'routine'/'portals_hub' case after the default", () => {
  const defIdx = app.indexOf('default: return <Dashboard />;');
  assert.ok(defIdx > 0, 'default case not found');
  const afterDefault = app.slice(defIdx);
  assert.ok(!/case '(notices|routine|portals_hub)':/.test(afterDefault), 'alias case placed after default (dead code)');
});

// --- Permission gate mirrors the aliases (same convention as every other tab).
console.log('--- Permission gate (isTabAllowedForUser) mirrors the aliases ---');
check("'notices' is in the universal-allow list with 'notice_board'", () => {
  assert.ok(/tab === 'notice_board'/.test(app) && /tab === 'notices'/.test(app), "'notices' missing from the universal-allow list");
});
check("'routine' is grouped with 'class_routine' in the gate", () => {
  assert.ok(/case 'class_routine':\s*\n\s*case 'routine':/.test(app), "'routine' not grouped with 'class_routine' in the gate");
});
check("'portals_hub' is grouped with 'guardian_portal' in the gate", () => {
  assert.ok(/case 'guardian_portal':\s*\n\s*case 'portals_hub':/.test(app), "'portals_hub' not grouped with 'guardian_portal' in the gate");
});

// --- Server-data gate parity: same loading label / ungated behaviour as the canonical tab.
console.log('--- Server-data gate parity ---');
check("'notices' is ungated like 'notice_board'", () => {
  const m = app.match(/const SERVER_DATA_UNGATED_TABS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(m && /'notice_board'/.test(m[1]) && /'notices'/.test(m[1]), "'notices' missing from SERVER_DATA_UNGATED_TABS");
});
check("'routine' has the same server-data name as 'class_routine'", () => {
  assert.ok(/^\s*routine: \{ bn: 'একাডেমিক তথ্য', en: 'Academic data' \}/m.test(app), "'routine' missing from SERVER_DATA_TAB_NAMES");
});
check("'portals_hub' has the same server-data name as 'guardian_portal'", () => {
  assert.ok(/^\s*portals_hub: \{ bn: 'পোর্টাল তথ্য', en: 'Portal data' \}/m.test(app), "'portals_hub' missing from SERVER_DATA_TAB_NAMES");
});

// --- Callers still use the short ids (fix lives in the router, not the call sites).
console.log('--- Callers unchanged (short ids still used) ---');
check("mobile bottom nav still navigates with 'notices'", () => {
  assert.ok(/handleTabClick\('notices'\)/.test(layout), "bottom nav no longer uses 'notices'");
});
check("More sheet still lists 'routine', 'notices', 'portals_hub'", () => {
  assert.ok(/id: 'routine'/.test(moreSheet) && /id: 'notices'/.test(moreSheet) && /id: 'portals_hub'/.test(moreSheet), 'More sheet ids changed');
});
check("Dashboard quick action still navigates with 'notices'", () => {
  assert.ok(/onNavigate\('notices'\)/.test(dashboard), "Dashboard card no longer uses 'notices'");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
