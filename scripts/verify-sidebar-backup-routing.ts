/**
 * verify-sidebar-backup-routing.ts — scripted proof for the sidebar §10
 * "ডাটা সুরক্ষা ও ব্যাকআপ" routing fix (components/Layout.tsx + App.tsx).
 *
 * Bug (morning audits 15–16 Nov 2026): clicking sidebar item 10
 * returns to Dashboard, while Settings > Backup opens the backup
 * centre fine.
 *
 * Root cause (read, not guessed): the §10 shortcut navigates to the
 * standalone tab 'backup_recovery', whose gate in App.tsx denies the
 * principal — isTabAllowedForUser returns false for the principal for
 * backup_recovery / superadmin_audit / recycle_bin, and the render
 * guard needs isAdmin — so the navigation effect bounces the tab back
 * to 'dashboard'. The §10 menu row itself is VISIBLE to the principal
 * because its isMenuVisible admin-only check uses the permission
 * 'institution.settings.view', which the principal holds. The backup
 * SCREEN itself is not gated for the principal: the 'settings' tab
 * opens with the same permission, and its Backup sub-tab
 * (ReportsSettingsManager, no extra gate) renders the very same
 * DataSecurityBackupCenter — that is why Settings > Backup works.
 *
 * Fix (NO permission gate is touched — see the gate checks below):
 * the §10 shortcut now opens the Settings tab with the Backup sub-tab
 * selected, i.e. the same screen the principal already reaches via
 * Settings > Backup. Layout carries a `settingsSubTab` on the menu
 * item; App holds the requested settings sub-tab in state and renders
 * ReportsSettingsManager with it. Clicking §9 (Settings) resets to
 * the profile sub-tab, so the shortcut cannot leak into later visits.
 *
 * Cases (all source-level — the routing is React state + props):
 *   (1) §10 menu item carries settingsSubTab 'backup'
 *   (2) Layout routes a settingsSubTab item via onOpenSettingsSubTab,
 *       never via setActiveTab('backup_recovery')
 *   (3) App passes onOpenSettingsSubTab to Layout, opening 'settings'
 *       with the backup sub-tab
 *   (4) App renders Settings with initialSubTab from that state
 *   (5) §9 Settings resets the sub-tab to profile
 *   (6) The §10 row highlights while the backup sub-tab is open
 *   (7) GATES UNTOUCHED: the principal-deny line for backup_recovery
 *       in isTabAllowedForUser still exists; the backup_recovery render
 *       guard still requires isAdmin; the §10 menu item is still
 *       isAdminOnly with 'institution.settings.view'
 *   (8) ReportsSettingsManager still syncs its internal tab when
 *       initialSubTab changes (the mechanism the shortcut relies on)
 *
 * Run: npx tsx scripts/verify-sidebar-backup-routing.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const layout = read('components/Layout.tsx');
const app = read('App.tsx');
const settingsMgr = read('components/settings/ReportsSettingsManager.tsx');

// (1) §10 menu item carries settingsSubTab 'backup'.
{
  const m = layout.match(/id: 'backup'[\s\S]*?},?\n    \{/);
  check("(1) §10 menu item carries settingsSubTab 'backup'",
    !!m && /settingsSubTab: 'backup'/.test(m[0]));
}

// (2) Layout routes a settingsSubTab item via onOpenSettingsSubTab.
check('(2) Layout has an onOpenSettingsSubTab prop',
  /onOpenSettingsSubTab\?: \(subTab: string\) => void/.test(layout));
check('(2) handleTabClick routes settingsSubTab items through it',
  /settingsSubTab[\s\S]*?onOpenSettingsSubTab/.test(layout));
check("(2) §10 click no longer navigates to 'backup_recovery' directly",
  /if \(menu\?\.settingsSubTab/.test(layout));

// (3) App passes onOpenSettingsSubTab to Layout.
check('(3) App passes onOpenSettingsSubTab to Layout',
  /<Layout[^>]*onOpenSettingsSubTab/.test(app) || /onOpenSettingsSubTab=\{openSettingsSubTab\}/.test(app));
check("(3) The handler opens the 'settings' tab with the backup sub-tab",
  /openSettingsSubTab[\s\S]{0,300}setActiveTab\('settings'\)[\s\S]{0,200}setSettingsSubTab\(subTab/.test(app));

// (4) App renders Settings with initialSubTab from that state.
check("(4) App 'settings' case uses the requested sub-tab",
  /case 'settings':[\s\S]*?initialSubTab=\{settingsSubTab \?\? 'profile'\}/.test(app));

// (5) §9 Settings resets the sub-tab to profile.
check('(5) Opening Settings directly resets the sub-tab',
  /if \(tab === 'settings'\) setSettingsSubTab\(null\)/.test(app));

// (6) The §10 row highlights while the backup sub-tab is open.
check('(6) Active-row check honours the settings sub-tab',
  /menu\.settingsSubTab.{0,40}activeTab === 'settings' && activeSettingsSubTab === menu\.settingsSubTab/.test(layout));

// (7) GATES UNTOUCHED — no permission was changed by this fix.
check("(7) Principal-deny line for backup_recovery still in isTabAllowedForUser",
  /if \(tab === 'backup_recovery' \|\| tab === 'superadmin_audit' \|\| tab === 'recycle_bin'\) return false/.test(app));
check("(7) backup_recovery render guard still requires isAdmin",
  /case 'backup_recovery':[\s\S]{0,200}isAdmin/.test(app));
check("(7) §10 menu item still isAdminOnly with institution.settings.view",
  /id: 'backup'[\s\S]{0,700}isAdminOnly: true[\s\S]{0,80}permissions: \['institution\.settings\.view'\]/.test(layout));

// (8) The sync mechanism the shortcut relies on still exists.
check('(8) ReportsSettingsManager syncs internal tab on initialSubTab change',
  /useEffect\(\(\) => \{\s*if \(initialSubTab\) \{\s*setActiveTab\(initialSubTab\);\s*\}\s*\}, \[initialSubTab\]\)/.test(settingsMgr));

console.log(failures === 0 ? '\nALL SIDEBAR-BACKUP-ROUTING CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
