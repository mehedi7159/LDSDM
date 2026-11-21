/**
 * verify-sidebar-backup-v2.ts — scripted proof for the sidebar §10
 * "ডাটা সুরক্ষা ও ব্যাকআপ" bounce, round 2 (App.tsx only).
 *
 * Bug (morning audit 21 Nov 2026): the v1 routing fix
 * (scripts/verify-sidebar-backup-routing.ts, 13/13 PASS at HEAD) is
 * intact in source, yet clicking §10 still returns to Dashboard live.
 *
 * Root cause (read, not guessed): the bounce does not come from the
 * route — it comes from the debounced navigation-guard effect in
 * App.tsx (the ONLY place that sends a tab back to 'dashboard').
 * That effect calls isTabAllowedForUser(activeTab), which reads the
 * principal's role through currentUser (a useMemo over the async
 * `users` collection), userRole and effectiveRoles — but NONE of
 * those is in the effect's dependency array. Early in a session,
 * while `users` is still hydrating from the cloud, the principal's
 * role is unresolved, so isTabAllowedForUser('settings') is false and
 * the effect schedules its 300ms redirect; the timeout callback
 * closes over those stale values, and because a later `users`
 * hydration does NOT re-run the effect (currentUser / userRole /
 * effectiveRoles are not deps, and isNonAdminRole/homeTab do not
 * change value for the principal), the stale timer fires
 * setActiveTab('dashboard') even though the role resolved a moment
 * later. Settings (§9) clicked later in the same session works,
 * because by then the role has settled — which is why the audit
 * kept reporting "Settings > Backup opens, §10 bounces".
 *
 * Fix (NO permission gate is touched — see the gate checks below):
 * add the missing reactive inputs — currentUser, userRole,
 * effectiveRoles, institutionRoles (the CustomRole layer behind
 * hasPermission) — to the guard effect's dependency array, so the
 * guard re-evaluates the moment the role settles and the stale
 * 300ms timer is cleared instead of firing. The gate logic, the
 * 300ms debounce and the dashboard fallback are all unchanged.
 *
 * Cases (all source-level — the guard is React state + an effect):
 *   (1) guard effect deps include currentUser
 *   (2) guard effect deps include userRole
 *   (3) guard effect deps include effectiveRoles
 *   (4) guard effect deps include institutionRoles
 *   (5) the 300ms debounce + timeout cleanup are unchanged
 *   (6) GATES UNTOUCHED: the principal-deny line for
 *       backup_recovery still exists; the 'settings' gate still
 *       uses institution.settings.view; the backup_recovery render
 *       guard still requires isAdmin
 *   (7) v1 ROUTING UNTOUCHED: §10 still opens Settings with the
 *       Backup sub-tab (settingsSubTab 'backup' + openSettingsSubTab)
 *
 * Run: npx tsx scripts/verify-sidebar-backup-v2.ts
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
const app = read('App.tsx');
const layout = read('components/Layout.tsx');

// The guard effect is the one that logs the [Navigation] redirect.
// Its dependency array is the first `}, [...]` after that log line.
const guardDepsMatch = app.match(/\[Navigation\] Redirecting[\s\S]*?\}, \[([^\]]+)\]\)/);
const guardDeps = guardDepsMatch ? guardDepsMatch[1] : '';
check('(0) navigation-guard effect found (dep array readable)', guardDeps.length > 0);

// (1)–(4) the guard re-runs when the role signals settle.
for (const dep of ['currentUser', 'userRole', 'effectiveRoles', 'institutionRoles']) {
  check(`guard effect deps include ${dep}`,
    new RegExp(`\\b${dep}\\b`).test(guardDeps),
    `deps now: [${guardDeps}]`);
}

// (5) debounce design unchanged: 300ms window + cleanup clears it.
check('(5) 300ms debounce still schedules the redirect',
  /debounceRedirectRef\.current = setTimeout\(\(\) => \{[\s\S]*?\}, 300\)/.test(app));
check('(5) effect cleanup still clears the pending timeout',
  /return \(\) => \{\s*if \(debounceRedirectRef\.current\) \{\s*clearTimeout\(debounceRedirectRef\.current\);/.test(app));

// (6) GATES UNTOUCHED — no permission was changed by this fix.
check("(6) Principal-deny line for backup_recovery still in isTabAllowedForUser",
  /if \(tab === 'backup_recovery' \|\| tab === 'superadmin_audit' \|\| tab === 'recycle_bin'\) return false/.test(app));
check("(6) 'settings' gate still uses institution.settings.view",
  /case 'settings':[\s\S]{0,120}hasPermission\('institution\.settings\.view'\)/.test(app));
check("(6) backup_recovery render guard still requires isAdmin",
  /case 'backup_recovery':[\s\S]{0,200}isAdmin/.test(app));

// (7) v1 ROUTING UNTOUCHED.
check("(7) §10 menu item still carries settingsSubTab 'backup'",
  /id: 'backup'[\s\S]{0,700}settingsSubTab: 'backup'/.test(layout));
check("(7) openSettingsSubTab still opens 'settings' with the backup sub-tab",
  /openSettingsSubTab[\s\S]{0,300}setActiveTab\('settings'\)[\s\S]{0,200}setSettingsSubTab\(subTab/.test(app));

console.log(failures === 0 ? '\nALL SIDEBAR-BACKUP-V2 CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
