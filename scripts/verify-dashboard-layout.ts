/**
 * verify-dashboard-layout.ts — scripted proof for the shared dashboard
 * layout model (Branch 1: fix/dashboard-layout-model, 22 Nov 2026).
 *
 * Before: the Dashboard rendered its sections in one fixed order and
 * StaffMobileApp rendered its home cards in one fixed order; a user
 * could not hide or reorder anything, and there was no per-user layout
 * stored anywhere.
 *
 * After: services/dashboardLayout.ts holds one shared section registry
 * (ids + Bengali titles + which roles may see each section + which
 * surface it belongs to), a per-user layout (ordered ids + hidden set),
 * pure helpers (normalize / move / hide / resolve), and cloud-first
 * persistence (new collection `userDashboardLayouts`, doc id = the
 * signed-in user's id, setDoc merge) with a per-user localStorage
 * fallback. components/Dashboard.tsx renders its sections from the
 * layout (order + hide) and StaffMobileApp applies the same layout to
 * its hero + stat cards.
 *
 * What must NOT change: every section's content, numbers, definitions
 * and handlers; the 4 stat cards stay out (owner removed them,
 * commit 2673e89); no result/marksheet file, no Firestore rules, no
 * auth/login, no public portal.
 *
 * Checks:
 *   (1) Registry lists every desktop section + the mobile-only stat
 *       cards, each with a Bengali title and role list.
 *   (2) Default layout: all sections in order, nothing hidden.
 *   (3) normalizeLayout drops unknown ids, appends missing ids,
 *       dedupes, and prunes hidden to known ids.
 *   (4) moveSection swaps neighbours; the first item cannot move up,
 *       the last cannot move down.
 *   (5) toggleSectionHidden hides, then shows again.
 *   (6) resolveVisibleSections: a hidden section disappears; a teacher
 *       never sees the approvals banner; a guardian never sees finance
 *       or tasks; desktop never shows mobileStats; mobile shows
 *       mobileStats right after the hero.
 *   (7) Two users are independent: user A's layout never leaks into
 *       user B's (different localStorage keys / doc ids).
 *   (8) Local save/load round-trips per user.
 *   (9) Dashboard.tsx renders from the layout: it calls
 *       resolveVisibleSections, wraps each section in a
 *       data-dashboard-section div with an order style, and its root
 *       is a flex column (so `order` actually reorders).
 *   (10) StaffMobileApp.tsx applies the same layout to its hero and
 *       stat-cards sections (data-dashboard-section + order).
 *   (11) saveDashboardLayout writes setDoc merge into the
 *       `userDashboardLayouts` collection and falls back to local
 *       storage when the cloud write fails (never a false "saved").
 *   (12) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-dashboard-layout.ts
 * (or npm run test:dashboard-layout).
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

// In-memory localStorage stand-in (the model only needs get/set/remove).
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

const dashboard = readSource('components/Dashboard.tsx');
const mobile = readSource('components/StaffMobileApp.tsx');
const modelSrc = readSource('services/dashboardLayout.ts');
const pkg = JSON.parse(readSource('package.json'));

// (1) Registry: every desktop section + mobile-only stat cards.
const ids = (model.DASHBOARD_SECTIONS as { id: string; titleBn: string; roles: string[] }[]).map(s => s.id);
for (const id of ['hero', 'notices', 'approvals', 'tasks', 'academic', 'finance', 'reports', 'doors', 'mobileStats']) {
  check(`(1) registry has section '${id}'`, ids.includes(id), `registry ids: ${ids.join(',')}`);
}
check('(1) every section has a Bengali title',
  (model.DASHBOARD_SECTIONS as { titleBn: string }[]).every(s => typeof s.titleBn === 'string' && s.titleBn.trim().length > 0));
check('(1) approvals is admin/principal only',
  (() => {
    const a = (model.DASHBOARD_SECTIONS as any[]).find(s => s.id === 'approvals');
    return !!a && a.roles.includes('admin') && a.roles.includes('principal') && !a.roles.includes('teacher');
  })());
check('(1) mobileStats is mobile-only',
  (() => {
    const m = (model.DASHBOARD_SECTIONS as any[]).find(s => s.id === 'mobileStats');
    return !!m && m.surfaces.includes('mobile') && !m.surfaces.includes('desktop');
  })());

// (2) Default layout.
const def = model.defaultLayout();
check('(2) default order holds every section', ids.every(id => (def.order as string[]).includes(id)), `order: ${def.order.join(',')}`);
check('(2) default layout hides nothing', def.hidden.length === 0);
check('(2) default order starts with hero', def.order[0] === 'hero');

// (3) normalizeLayout.
const norm = model.normalizeLayout({ order: ['tasks', 'bogus', 'tasks', 'hero'], hidden: ['tasks', 'bogus2'] } as any);
check('(3) normalize drops unknown ids', !(norm.order as string[]).includes('bogus') && !(norm.hidden as string[]).includes('bogus2'));
check('(3) normalize dedupes', norm.order.filter((x: string) => x === 'tasks').length === 1);
check('(3) normalize appends missing ids', ids.every((id: string) => (norm.order as string[]).includes(id)));
check('(3) normalize keeps the saved relative order first', norm.order.indexOf('tasks') < norm.order.indexOf('hero'));

// (4) moveSection.
const movedUp = model.moveSection(def, 'tasks', 'up');
check('(4) move up swaps with the previous section',
  movedUp.order.indexOf('tasks') === def.order.indexOf('tasks') - 1);
const movedDown = model.moveSection(def, 'tasks', 'down');
check('(4) move down swaps with the next section',
  movedDown.order.indexOf('tasks') === def.order.indexOf('tasks') + 1);
check('(4) first section cannot move up', model.moveSection(def, 'hero', 'up').order[0] === 'hero');
check('(4) last section cannot move down',
  model.moveSection(def, 'doors', 'down').order[model.moveSection(def, 'doors', 'down').order.length - 1] === 'doors');

// (5) toggleSectionHidden.
const hiddenOnce = model.toggleSectionHidden(def, 'tasks');
check('(5) hide adds to hidden', hiddenOnce.hidden.includes('tasks'));
check('(5) show removes from hidden again', !model.toggleSectionHidden(hiddenOnce, 'tasks').hidden.includes('tasks'));

// (6) resolveVisibleSections.
const teacherVisible = model.resolveVisibleSections(model.toggleSectionHidden(def, 'academic'), 'teacher', 'desktop');
check('(6) a hidden section disappears from the Dashboard',
  !teacherVisible.includes('academic') && teacherVisible.includes('tasks'));
check('(6) a teacher never sees the approvals banner', !model.resolveVisibleSections(def, 'teacher', 'desktop').includes('approvals'));
check('(6) an admin sees the approvals banner', model.resolveVisibleSections(def, 'admin', 'desktop').includes('approvals'));
const guardianVisible = model.resolveVisibleSections(def, 'guardian', 'desktop');
check('(6) a guardian never sees finance or tasks',
  !guardianVisible.includes('finance') && !guardianVisible.includes('tasks'));
check('(6) desktop never shows mobileStats', !model.resolveVisibleSections(def, 'teacher', 'desktop').includes('mobileStats'));
const mobileVisible = model.resolveVisibleSections(def, 'teacher', 'mobile');
check('(6) mobile shows mobileStats right after the hero',
  mobileVisible.includes('mobileStats') && mobileVisible.indexOf('mobileStats') === mobileVisible.indexOf('hero') + 1);
check('(6) reordering changes the resolved order',
  model.resolveVisibleSections(model.moveSection(def, 'finance', 'up'), 'admin', 'desktop').indexOf('finance')
  < model.resolveVisibleSections(def, 'admin', 'desktop').indexOf('finance'));

// (7) Two users are independent.
store.clear();
model.saveDashboardLayoutLocal('user-A', model.toggleSectionHidden(def, 'academic'));
model.saveDashboardLayoutLocal('user-B', def);
check('(7) user A layout is independent of user B',
  (model.loadDashboardLayoutLocal('user-A')?.hidden || []).includes('academic')
  && !(model.loadDashboardLayoutLocal('user-B')?.hidden || []).includes('academic'));
check('(7) local keys differ per user',
  model.dashboardLayoutLocalKey('user-A') !== model.dashboardLayoutLocalKey('user-B'));

// (8) Local save/load round-trip.
store.clear();
const roundTrip = model.moveSection(def, 'reports', 'up');
model.saveDashboardLayoutLocal('user-C', roundTrip);
const loaded = model.loadDashboardLayoutLocal('user-C');
check('(8) local round-trip keeps the order', !!loaded && JSON.stringify(loaded.order) === JSON.stringify(roundTrip.order));
check('(8) unknown user loads null (default applies)', model.loadDashboardLayoutLocal('nobody') === null);

// (9) Dashboard.tsx renders from the layout.
check('(9) Dashboard calls resolveVisibleSections', /resolveVisibleSections\(/.test(dashboard));
check('(9) Dashboard wraps sections with data-dashboard-section',
  ['hero', 'tasks', 'academic', 'finance', 'reports', 'doors'].every(id => dashboard.includes(`data-dashboard-section="${id}"`)),
  'each section needs a data-dashboard-section wrapper');
check('(9) Dashboard section wrappers carry an order style', /data-dashboard-section="hero"[\s\S]{0,200}style=\{\{[^}]*order/.test(dashboard) || /style=\{\{\s*order/.test(dashboard));
check('(9) Dashboard root is a flex column so order reorders',
  /id="madrasha-executive-dashboard" className="[^"]*flex flex-col/.test(dashboard),
  'root must be flex flex-col, not space-y');
check('(9) Dashboard still renders every section (nothing lost)',
  ['DashboardDailyOverview', 'UrgentNoticesCard', 'MadrasaReports', 'আজকের করণীয়', 'একাডেমিক চিত্র', 'আর্থিক চিত্র'].every(s => dashboard.includes(s)));

// (10) StaffMobileApp applies the same layout to hero + stat cards.
check('(10) mobile hero is layout-driven', mobile.includes('data-dashboard-section="hero"'));
check('(10) mobile stat cards are layout-driven', mobile.includes('data-dashboard-section="mobileStats"'));
check('(10) mobile uses resolveVisibleSections', /resolveVisibleSections\(/.test(mobile));

// (11) Cloud-first save with local fallback.
check('(11) layout collection is userDashboardLayouts', modelSrc.includes("userDashboardLayouts"));
check('(11) cloud write is setDoc merge', /setDoc\(/.test(modelSrc) && /\{\s*merge:\s*true\s*\}/.test(modelSrc));
check('(11) cloud doc id is the user id', /DASHBOARD_LAYOUT_COLLECTION, userId/.test(modelSrc));
check('(11) cloud failure falls back to local (never a false saved)',
  /catch/.test(modelSrc) && modelSrc.includes('saveDashboardLayoutLocal(userId, layout)'));
check('(11) layout is NOT stored inside the user record',
  !/main_store/.test(modelSrc) && !modelSrc.includes("users") || !/collection\(db, 'users'/.test(modelSrc));

// (12) package.json exposes this verify script.
check('(12) package.json exposes test:dashboard-layout',
  pkg.scripts && pkg.scripts['test:dashboard-layout'] === 'tsx scripts/verify-dashboard-layout.ts');

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll dashboard-layout checks passed.');
