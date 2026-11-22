/**
 * verify-dashboard-arrange.ts — scripted proof for the "ড্যাশবোর্ড
 * সাজান" panel (Branch 2: fix/dashboard-arrange-settings, 22 Nov 2026).
 *
 * Before: there was no way to arrange the dashboard — no on/off, no
 * reorder, no reset — and the layout model had no UI.
 *
 * After: components/DashboardArrangePanel.tsx renders inside
 * components/SettingsPage.tsx ("আমার সেটিংস", ungated, every role):
 * the reference wording, visible sections with up/down + red hide,
 * "লুকানো অংশ" with green show, and "আগের মতো সাজানোতে ফেরান"
 * reset. Every change saves IMMEDIATELY through the shared model
 * (saveDashboardLayout — cloud first, local fallback); there is no
 * separate save button for the dashboard. LDSDM's own design (flat
 * teal, Anek Bangla) — the reference's purple is NOT copied.
 *
 * What must NOT change: SettingsPage's existing draft/save model for
 * language/appearance/notifications; every Dashboard section's
 * content/numbers/handlers; no result/marksheet file, no Firestore
 * rules, no auth/login, no public portal.
 *
 * Checks:
 *   (1) Panel file exists with the reference intro wording
 *       ("কোন অংশ কোথায় থাকবে আর কোনটা দেখাবে না — নিজের মতো
 *       সাজিয়ে নিন। বদলালেই সেভ হয়ে যাবে।").
 *   (2) Visible rows have up + down buttons; hidden rows have a
 *       green show (+) button; visible rows have a red hide (−)
 *       button.
 *   (3) Reset button "আগের মতো সাজানোতে ফেরান" exists and calls
 *       resetLayout.
 *   (4) The panel saves immediately: it calls saveDashboardLayout on
 *       every change and has NO separate dashboard save button.
 *   (5) The panel is model-driven: moveSection / toggleSectionHidden
 *       / arrangeableSections from services/dashboardLayout.ts, and
 *       the model file is present.
 *   (6) SettingsPage mounts the panel (inside "আমার সেটিংস", not in
 *       ReportsSettingsManager).
 *   (7) Honest save status: the panel shows whether the layout went
 *       to the cloud or stayed on this device only.
 *   (8) Mobile-safe: big tap targets (min 44px), no sideways-scroll
 *       row, titles truncate instead of overflowing.
 *   (9) Teal LDSDM styling, not the reference purple: no purple
 *       background/gradient in the panel.
 *   (10) The chain works end to end through the model: hide a section
 *       -> it disappears from the resolved Dashboard order; move one
 *       up -> the order changes; reset -> default order returns.
 *   (11) Dashboard.tsx still renders from the layout (branch 1 wiring
 *       is included byte-identical so this branch verifies standalone).
 *   (12) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-dashboard-arrange.ts
 * (or npm run test:dashboard-arrange).
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
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; }
};

const model = await import('../services/dashboardLayout.ts');
const panel = readSource('components/DashboardArrangePanel.tsx');
const settings = readSource('components/SettingsPage.tsx');
const dashboard = readSource('components/Dashboard.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) Intro wording (reference, adapted to LDSDM).
check('(1) panel title is ড্যাশবোর্ড সাজান', panel.includes('ড্যাশবোর্ড সাজান'));
check('(1) panel intro wording matches the reference',
  panel.includes('কোন অংশ কোথায় থাকবে আর কোনটা দেখাবে না — নিজের মতো সাজিয়ে নিন। বদলালেই সেভ হয়ে যাবে।'));

// (2) Up/down + hide/show controls.
check('(2) visible rows have an up button', /ChevronUp|aria-label="[^"]*উপরে[^"]*"/.test(panel));
check('(2) visible rows have a down button', /ChevronDown|aria-label="[^"]*নিচে[^"]*"/.test(panel));
check('(2) visible rows have a red hide button', /Minus/.test(panel) && /red/.test(panel));
check('(2) hidden rows have a green show button', /Plus/.test(panel) && /emerald|green/.test(panel));
check('(2) hidden section heading লুকানো অংশ exists', panel.includes('লুকানো অংশ'));

// (3) Reset.
check('(3) reset button exists', panel.includes('আগের মতো সাজানোতে ফেরান'));
check('(3) reset calls resetLayout', panel.includes('resetLayout('));

// (4) Immediate save, no separate save button.
check('(4) panel calls saveDashboardLayout on change', panel.includes('saveDashboardLayout('));
check('(4) panel has no separate dashboard save button',
  !/<button[\s\S]{0,400}সংরক্ষণ/.test(panel) && !/type="submit"/.test(panel) && !panel.includes('handleSave'),
  'the dashboard saves as soon as it changes — no save button');

// (5) Model-driven.
for (const fn of ['moveSection', 'toggleSectionHidden', 'arrangeableSections', 'loadDashboardLayout', 'dashboardRoleKey']) {
  check(`(5) panel uses ${fn}`, panel.includes(fn));
}
check('(5) model file is present', (() => { try { readSource('services/dashboardLayout.ts'); return true; } catch { return false; } })());

// (6) SettingsPage mounts the panel.
check('(6) SettingsPage mounts DashboardArrangePanel', settings.includes('DashboardArrangePanel'));
check('(6) SettingsPage imports the panel', /import.*DashboardArrangePanel/.test(settings));
check('(6) panel is NOT in ReportsSettingsManager',
  !fs.existsSync(path.join(__dirname, '..', 'components/settings/ReportsSettingsManager.tsx')) || !readSource('components/settings/ReportsSettingsManager.tsx').includes('DashboardArrangePanel'));

// (7) Honest save status.
check('(7) panel shows cloud-saved status', /ক্লাউডে সংরক্ষিত/.test(panel));
check('(7) panel shows local-only status honestly', /এই ডিভাইসে/.test(panel) && /ক্লাউড/.test(panel));

// (8) Mobile-safe.
check('(8) tap targets are at least 44px', /min-h-\[44px\]|h-11/.test(panel));
check('(8) no sideways-scrolling row', !/overflow-x-auto/.test(panel) && !/flex-nowrap/.test(panel));
check('(8) titles truncate instead of overflowing', /truncate/.test(panel) && /min-w-0/.test(panel));

// (9) Teal LDSDM styling, not reference purple.
check('(9) panel uses teal, not purple', /teal/.test(panel) && !/bg-purple|purple-500|from-purple|via-purple/.test(panel));
check('(9) no gradient or glass in the panel', !/bg-gradient|backdrop-blur/.test(panel));

// (10) End-to-end chain through the model.
const def = model.defaultLayout();
const hidden = model.toggleSectionHidden(def, 'tasks');
check('(10) hide in settings -> section disappears from the Dashboard',
  !model.resolveVisibleSections(hidden, 'teacher', 'desktop').includes('tasks'));
const moved = model.moveSection(def, 'finance', 'up');
check('(10) move up in settings -> Dashboard order changes',
  model.resolveVisibleSections(moved, 'admin', 'desktop').indexOf('finance')
  < model.resolveVisibleSections(def, 'admin', 'desktop').indexOf('finance'));
check('(10) reset restores the default order',
  JSON.stringify(model.resetLayout().order) === JSON.stringify(def.order)
  && model.resetLayout().hidden.length === 0);
check('(10) a second user layout is independent',
  (() => {
    store.clear();
    model.saveDashboardLayoutLocal('user-A', hidden);
    return !(model.loadDashboardLayoutLocal('user-B')?.hidden || []).includes('tasks');
  })());

// (11) Dashboard wiring (branch 1, included so this branch verifies standalone).
check('(11) Dashboard renders from the layout', /resolveVisibleSections\(/.test(dashboard)
  && dashboard.includes('data-dashboard-section="tasks"')
  && dashboard.includes('data-dashboard-section="academic"'));

// (12) package.json exposes this verify script.
check('(12) package.json exposes test:dashboard-arrange',
  pkg.scripts && pkg.scripts['test:dashboard-arrange'] === 'tsx scripts/verify-dashboard-arrange.ts');

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll dashboard-arrange checks passed.');
