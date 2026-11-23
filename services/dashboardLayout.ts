// Shared dashboard layout model (22 Nov 2026, principal's word:
// "ড্যাশবোর্ড সাজান" — each user arranges their own dashboard in
// My Settings; it saves as soon as it changes).
//
// One registry + one per-user layout drive BOTH surfaces:
//  - desktop: components/Dashboard.tsx sections
//  - mobile:  components/StaffMobileApp.tsx home cards (hero + stat
//    cards; the other mobile home cards are role-work cards — routine
//    strip, class reports, recent collections, staff cards, parent
//    children, next-task nudge — not report sections, so the layout
//    does not touch them).
//
// The reference app's এক নজরে কার্ড / নজর দেওয়ার তালিকা / পরীক্ষার
// রিপোর্ট all live INSIDE the desktop 'academic' (একাডেমিক চিত্র)
// block — one header + one set of filters drives its class grid,
// charts, merit and at-risk panels — so they move/hide together as
// that one section. Splitting them apart would rebuild the academic
// filters; that is a separate decision, not part of this model.
//
// Storage: per-user, cloud-first so the layout follows the user
// across devices. A NEW collection `userDashboardLayouts` under the
// institution, doc id = the signed-in user's id (AppContext
// currentUser.id — the Firebase uid for signed-in users, the AppUser
// record id otherwise). The layout is NEVER stored inside the user
// record (users still live in main_store; Job 15 not done). Local
// fallback: one localStorage key per user id. A failed cloud write
// keeps the layout locally and reports 'local' — never a false
// "saved" (AGENTS.md truthful-save rule).
// Firestore rules already allow authenticated create/update under
// institutions/{id}/{document=**}, so no rules change is needed.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CANONICAL_PRIMARY_INSTITUTION_ID } from './dataAdapter';

export type DashboardSectionId =
  | 'hero'
  | 'notices'
  | 'approvals'
  | 'tasks'
  | 'academic'
  | 'finance'
  | 'attendance'
  | 'incomeExpense'
  | 'feeCollection'
  | 'reports'
  | 'doors'
  | 'mobileStats';

export type DashboardRoleKey =
  | 'admin'
  | 'principal'
  | 'teacher'
  | 'accountant'
  | 'guardian'
  | 'staff';

export type DashboardSurface = 'desktop' | 'mobile';

export interface DashboardSectionDef {
  id: DashboardSectionId;
  titleBn: string;
  titleEn: string;
  /** Short note shown in the arrange panel (what lives inside). */
  subtitleBn?: string;
  /** Which roles are offered this section at all. */
  roles: DashboardRoleKey[];
  /** Which surfaces render this section. */
  surfaces: DashboardSurface[];
}

const STAFF_ROLES: DashboardRoleKey[] = ['admin', 'principal', 'teacher', 'accountant', 'staff'];

export const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'hero', titleBn: 'হিরো (নাম, তারিখ ও দ্রুত কাজ)', titleEn: 'Hero (name, date, quick actions)', roles: [...STAFF_ROLES, 'guardian'], surfaces: ['desktop', 'mobile'] },
  { id: 'mobileStats', titleBn: 'সংক্ষিপ্ত সংখ্যা (মোবাইল)', titleEn: 'Summary numbers (mobile)', subtitleBn: 'শুধু মোবাইল হোমে দেখায়', roles: [...STAFF_ROLES, 'guardian'], surfaces: ['mobile'] },
  { id: 'notices', titleBn: 'জরুরি নোটিশ', titleEn: 'Urgent notices', subtitleBn: 'নোটিশ না থাকলে নিজে লুকিয়ে যায়', roles: [...STAFF_ROLES, 'guardian'], surfaces: ['desktop'] },
  { id: 'approvals', titleBn: 'অনুমোদনের অপেক্ষায়', titleEn: 'Pending approvals', roles: ['admin', 'principal'], surfaces: ['desktop'] },
  { id: 'tasks', titleBn: 'আজকের করণীয়', titleEn: "Today's To-Do", roles: STAFF_ROLES, surfaces: ['desktop'] },
  { id: 'academic', titleBn: 'একাডেমিক চিত্র', titleEn: 'Academic Overview', subtitleBn: 'এক নজরে, পরীক্ষার রিপোর্ট, মেধা তালিকা, নজর দেওয়ার তালিকা', roles: STAFF_ROLES, surfaces: ['desktop'] },
  { id: 'finance', titleBn: 'আর্থিক চিত্র — সর্বোচ্চ বকেয়া', titleEn: 'Finance — Top Fee Dues', subtitleBn: 'বকেয়া রিপোর্ট', roles: STAFF_ROLES, surfaces: ['desktop'] },
  { id: 'attendance', titleBn: 'হাজিরা রিপোর্ট', titleEn: 'Attendance Report', subtitleBn: 'আজকের হাজিরা, শ্রেণি অনুযায়ী', roles: STAFF_ROLES, surfaces: ['desktop'] },
  { id: 'incomeExpense', titleBn: 'আয়-ব্যয় রিপোর্ট', titleEn: 'Income-Expense Report', subtitleBn: 'এই সেশনের আয়, ব্যয় ও নিট', roles: ['admin', 'principal', 'accountant'], surfaces: ['desktop'] },
  { id: 'feeCollection', titleBn: 'ফি আদায় ও ব্যাচ', titleEn: 'Fee Collection & Batch', subtitleBn: 'শ্রেণি অনুযায়ী আদায়', roles: ['admin', 'principal', 'accountant', 'teacher'], surfaces: ['desktop'] },
  { id: 'reports', titleBn: 'মাদ্রাসা রিপোর্ট', titleEn: 'Madrasa Reports', roles: STAFF_ROLES, surfaces: ['desktop'] },
  { id: 'doors', titleBn: 'প্রতিবেদন (দরজা)', titleEn: 'Reports (doors)', roles: STAFF_ROLES, surfaces: ['desktop'] }
];

export const DEFAULT_DASHBOARD_ORDER: DashboardSectionId[] = [
  'hero', 'mobileStats', 'notices', 'approvals', 'tasks', 'academic', 'finance', 'attendance', 'incomeExpense', 'feeCollection', 'reports', 'doors'
];

// Default-hidden: incomeExpense only — on the 22 Nov audit the
// transaction count was 0, so it stays hidden until real
// transactions exist (the reference app hid it too). Attendance and
// fee collection show real data (even ৳0 collected), so they show.
export const DEFAULT_HIDDEN_SECTIONS: DashboardSectionId[] = ['incomeExpense'];

export interface DashboardLayout {
  order: DashboardSectionId[];
  hidden: DashboardSectionId[];
  updatedAt: string;
}

export function defaultLayout(): DashboardLayout {
  return { order: [...DEFAULT_DASHBOARD_ORDER], hidden: [...DEFAULT_HIDDEN_SECTIONS], updatedAt: new Date().toISOString() };
}

const KNOWN_IDS = new Set<string>(DASHBOARD_SECTIONS.map(s => s.id));
const isKnownId = (v: unknown): v is DashboardSectionId => typeof v === 'string' && KNOWN_IDS.has(v);

/** Repair a stored layout: drop unknown ids, dedupe, append any missing
 *  section (new sections appear at the end, visible), prune hidden. */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const def = defaultLayout();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Partial<DashboardLayout>;
  const order: DashboardSectionId[] = [];
  for (const id of Array.isArray(r.order) ? r.order : []) {
    if (isKnownId(id) && !order.includes(id)) order.push(id);
  }
  for (const id of def.order) if (!order.includes(id)) order.push(id);
  const hidden: DashboardSectionId[] = [];
  for (const id of Array.isArray(r.hidden) ? r.hidden : []) {
    if (isKnownId(id) && !hidden.includes(id)) hidden.push(id);
  }
  return { order, hidden, updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : def.updatedAt };
}

/** Move one section one step up/down inside the visible order. */
export function moveSection(layout: DashboardLayout, id: DashboardSectionId, dir: 'up' | 'down'): DashboardLayout {
  const order = [...normalizeLayout(layout).order];
  const i = order.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return { ...normalizeLayout(layout), order };
  [order[i], order[j]] = [order[j], order[i]];
  return { order, hidden: [...normalizeLayout(layout).hidden], updatedAt: new Date().toISOString() };
}

/** Hide a visible section, or show a hidden one. */
export function toggleSectionHidden(layout: DashboardLayout, id: DashboardSectionId): DashboardLayout {
  const norm = normalizeLayout(layout);
  const hidden = norm.hidden.includes(id)
    ? norm.hidden.filter(h => h !== id)
    : [...norm.hidden, id];
  return { order: norm.order, hidden, updatedAt: new Date().toISOString() };
}

/** Restore the default order with nothing hidden. */
export function resetLayout(): DashboardLayout {
  return defaultLayout();
}

// AppContext role signals are mixed: currentUser.role is a UserRole
// ('super_admin' | 'principal' | 'teacher' | 'accountant' | 'staff' |
// 'guardian'); currentMember.roleId is 'role_principal' etc. The
// layout only needs the coarse key; unknown roles get 'staff' (least
// privilege — no approvals banner, no finance).
export function dashboardRoleKey(
  role?: string | null,
  roleId?: string | null,
  isAdmin = false
): DashboardRoleKey {
  if (isAdmin) return 'admin';
  const raw = String(roleId || role || '').replace(/^role_/, '').toLowerCase();
  if (raw === 'super_admin' || raw === 'admin') return 'admin';
  if (raw === 'principal') return 'principal';
  if (raw === 'teacher') return 'teacher';
  if (raw === 'accountant' || raw === 'cashier') return 'accountant';
  if (raw === 'guardian' || raw === 'parent') return 'guardian';
  if (raw === 'staff') return 'staff';
  return 'staff';
}

/** StaffMobileApp's home key ('teacher' | 'cashier' | 'parent' |
 *  'staff' | 'principal') maps to the same role key. */
export function dashboardRoleKeyFromMobileHome(home: string): DashboardRoleKey {
  return dashboardRoleKey(home === 'cashier' ? 'accountant' : home);
}

/** Sections this role may arrange on this surface, in layout order,
 *  each with its hidden flag (for the arrange panel). */
export function arrangeableSections(
  layout: DashboardLayout,
  role: DashboardRoleKey,
  surface?: DashboardSurface
): { def: DashboardSectionDef; hidden: boolean }[] {
  const norm = normalizeLayout(layout);
  return norm.order
    .map(id => DASHBOARD_SECTIONS.find(s => s.id === id)!)
    .filter(def => def.roles.includes(role) && (!surface || def.surfaces.includes(surface)))
    .map(def => ({ def, hidden: norm.hidden.includes(def.id) }));
}

/** The section ids actually rendered for this role + surface. */
export function resolveVisibleSections(
  layout: DashboardLayout,
  role: DashboardRoleKey,
  surface: DashboardSurface
): DashboardSectionId[] {
  const norm = normalizeLayout(layout);
  return norm.order.filter(id => {
    const def = DASHBOARD_SECTIONS.find(s => s.id === id);
    return !!def && def.roles.includes(role) && def.surfaces.includes(surface) && !norm.hidden.includes(id);
  });
}

// --- Persistence: cloud-first, local fallback -------------------------

export const DASHBOARD_LAYOUT_COLLECTION = 'userDashboardLayouts';

export function dashboardLayoutLocalKey(userId: string): string {
  return `ldsdm_dashboard_layout_${userId}`;
}

export function loadDashboardLayoutLocal(userId: string): DashboardLayout | null {
  try {
    const raw = localStorage.getItem(dashboardLayoutLocalKey(userId));
    if (!raw) return null;
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDashboardLayoutLocal(userId: string, layout: DashboardLayout): void {
  try {
    localStorage.setItem(dashboardLayoutLocalKey(userId), JSON.stringify(normalizeLayout(layout)));
  } catch {
    // Private-mode storage failure: layout stays in memory only.
  }
}

function layoutDocRef(userId: string) {
  return doc(db, 'institutions', CANONICAL_PRIMARY_INSTITUTION_ID, DASHBOARD_LAYOUT_COLLECTION, userId);
}

const CLOUD_TIMEOUT_MS = 15000;

/** Load: cloud first; local fallback when offline/unsigned-in; default
 *  when neither has a layout. */
export async function loadDashboardLayout(
  userId: string
): Promise<{ layout: DashboardLayout; source: 'cloud' | 'local' | 'default' }> {
  try {
    const snap = await Promise.race([
      getDoc(layoutDocRef(userId)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('layout cloud read timeout')), CLOUD_TIMEOUT_MS))
    ]);
    if (snap.exists()) {
      const layout = normalizeLayout(snap.data());
      saveDashboardLayoutLocal(userId, layout);
      return { layout, source: 'cloud' };
    }
  } catch {
    // Offline or no Firebase identity: fall through to local.
  }
  const local = loadDashboardLayoutLocal(userId);
  if (local) return { layout: local, source: 'local' };
  return { layout: defaultLayout(), source: 'default' };
}

/** Save immediately on every change (no separate save button — the
 *  reference saves as soon as it changes). Cloud first with a 15 s
 *  bound; on ANY failure the layout is kept locally and 'local' is
 *  returned, so the caller never shows a false "saved". */
export async function saveDashboardLayout(
  userId: string,
  layout: DashboardLayout
): Promise<'cloud' | 'local'> {
  const norm = normalizeLayout(layout);
  saveDashboardLayoutLocal(userId, norm);
  try {
    await Promise.race([
      setDoc(layoutDocRef(userId), { ...norm }, { merge: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('layout cloud write timeout')), CLOUD_TIMEOUT_MS))
    ]);
    return 'cloud';
  } catch {
    // Layout is already safe locally; the next load retries the cloud
    // read, and the next change retries the cloud write.
    return 'local';
  }
}

/** Push a locally-kept layout to cloud (call on mount / online /
 *  foreground). Before this, a single failed save stayed local
 *  forever — the only retry was the next manual change, so the
 *  panel's "পরে আবার চেষ্টা হবে" never happened. Returns 'cloud'
 *  when it landed, 'local' when it is still only on this device,
 *  'none' when there is no local layout to push. */
export async function retryDashboardLayoutCloudSave(
  userId: string
): Promise<'cloud' | 'local' | 'none'> {
  const local = loadDashboardLayoutLocal(userId);
  if (!local) return 'none';
  return saveDashboardLayout(userId, local);
}
