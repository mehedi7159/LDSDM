/**
 * Desktop role matrix — verification for the non-admin desktop fix
 * (landing + tab gate + menu composition), built from the code's OWN
 * rules rather than hand-copied tables:
 *
 *  - Permissions: the REAL services/rbac templates + authorization
 *    engine, via the same hasPermission replica the multi-role suite
 *    uses (template layer first, hardcoded branches as fallback).
 *  - Role home: the REAL roleHomeTab() from services/roleResolution.
 *  - Menu items + visibility metadata: PARSED from components/Layout.tsx
 *    navGroups (id / permissions / isAdminOnly / isSuperAdminOnly).
 *  - Tab gate: PARSED from App.tsx isTabAllowedForUser (universal list +
 *    per-case return expressions), evaluated per role.
 *  - Render guard: PARSED from App.tsx renderContent (the condition in
 *    front of each AccessRestrictedView), evaluated per role.
 *  - Menu visibility: faithful replica of Layout.isItemVisible steps 1–6
 *    for a non-admin, non-principal, single-role user.
 *  - Rail: faithful replica of Layout.canOpenRailTab (post-fix).
 *
 * Proves, for teacher / accountant / staff / guardian:
 *  1. The role's desktop home tab passes BOTH the gate and the render
 *     guard (a working landing, not a wall).
 *  2. EVERY menu item the role can see passes BOTH the gate and the
 *     render guard (no visible-but-blocked / dead-end items).
 *  3. Every slim-rail tab offered to the role passes gate + render.
 *
 * Run: npx tsx scripts/verify-desktop-role-matrix.ts
 * Exit code 0 = all proofs hold.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { checkPermission, buildAuthorizationContext } from '../services/authorization';
import { DEFAULT_ROLE_TEMPLATES, mergeRolePermissionsWithTemplate } from '../services/rbac';
import { normalizeRoleKey, roleHomeTab } from '../services/roleResolution';
import type { CustomRole, InstitutionMember, Permission } from '../types/rbac';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTITUTION_ID = 'inst_madrasah_primary';

// ---------------------------------------------------------------------------
// hasPermission replica (same construction as scripts/test-rbac-multirole.ts)
// ---------------------------------------------------------------------------
const KEY_TO_TEMPLATE: Record<string, string> = {
  teacher: 'teacher',
  accountant: 'accountant',
  principal: 'principal',
  staff: 'office_staff',
  guardian: 'guardian',
  super_admin: 'institution_admin'
};

function roleDocForKey(key: string): CustomRole | null {
  const templateKey = KEY_TO_TEMPLATE[key];
  if (!templateKey) return null;
  const t = DEFAULT_ROLE_TEMPLATES.find(x => x.templateKey === templateKey);
  if (!t) return null;
  const now = '2026-01-01T00:00:00.000Z';
  return mergeRolePermissionsWithTemplate({
    id: `role_${templateKey}`,
    institutionId: INSTITUTION_ID,
    name: t.defaultName,
    displayName: t.displayNameBn,
    permissions: [...t.permissions],
    dataScopes: t.defaultScopes,
    isSystemRole: templateKey === 'institution_admin',
    isActive: true,
    createdAt: now,
    createdBy: 'script',
    updatedAt: now,
    updatedBy: 'script'
  });
}

function hardcodedBranchGrants(role: string | null | undefined, permission: Permission): boolean {
  const key = normalizeRoleKey(role) || role;
  if (key === 'accountant') {
    if (permission.startsWith('finance.') || permission.startsWith('fees.') || permission.startsWith('payments.')) return true;
    if (permission === 'reports.view' || permission === 'students.view') return true;
  }
  if (key === 'teacher') {
    if (permission.startsWith('attendance.') || permission.startsWith('marks.') || permission.startsWith('subjects.')) return true;
    if (permission === 'reports.view' || permission === 'students.view') return true;
  }
  if (key === 'guardian') {
    if (permission === 'students.view' || permission === 'marks.view' || permission === 'attendance.view' || permission === 'fees.view') return true;
  }
  return false;
}

function makeHasPermission(roleKey: string) {
  const doc = roleDocForKey(roleKey);
  const member: InstitutionMember = {
    uid: 'uid_matrix',
    institutionId: INSTITUTION_ID,
    email: 'matrix@example.com',
    roleId: doc?.id || `role_${roleKey}`,
    status: 'active', // checkPermission requires the lowercase form
    assignedClasses: [],
    assignedSubjects: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  } as InstitutionMember;
  const authUser: any = { uid: 'uid_matrix', email: 'matrix@example.com' };
  return (permission: string): boolean => {
    const ctx = buildAuthorizationContext(authUser, null, member, doc, INSTITUTION_ID);
    if (checkPermission(ctx, permission as Permission)) return true;
    return hardcodedBranchGrants(roleKey, permission as Permission);
  };
}

// ---------------------------------------------------------------------------
// Source parsing: menu (Layout.tsx), gate + render guards (App.tsx)
// ---------------------------------------------------------------------------
interface MenuItem { id: string; perms: string[] | null; adminOnly: boolean; superOnly: boolean }

function parseMenuItems(): MenuItem[] {
  const src = fs.readFileSync(path.join(ROOT, 'components/Layout.tsx'), 'utf8');
  const start = src.indexOf('const navGroups');
  const region = src.slice(start, src.indexOf('];', start));
  const parts = region.split(/id: '/).slice(1);
  const seen = new Set<string>();
  const items: MenuItem[] = [];
  for (const p of parts) {
    const id = p.slice(0, p.indexOf("'"));
    if (seen.has(id) || id.endsWith('_section')) continue;
    seen.add(id);
    const chunk = p.slice(0, 1200);
    const permM = chunk.match(/permissions: \[([^\]]*)\]/);
    const perms = permM ? [...permM[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : null;
    items.push({
      id,
      perms,
      adminOnly: /isAdminOnly: true/.test(chunk),
      superOnly: /isSuperAdminOnly: true/.test(chunk)
    });
  }
  return items;
}

/** Evaluate a boolean expression copied from App.tsx for a scenario user
 *  (non-admin, non-owner, non-principal, single role `roleKey`). */
function evalAppExpr(expr: string, hp: (p: string) => boolean, roleKey: string): boolean {
  const js = expr
    .replace(/hasPermission\('([^']+)'\)/g, (_m, p) => String(hp(p)))
    .replace(/\(effectiveRoles \|\| \[\]\)/g, JSON.stringify([roleKey]))
    .replace(/currentUser\?\.role/g, JSON.stringify(roleKey))
    .replace(/currentMember\?\.roleId/g, JSON.stringify(`role_${roleKey}`))
    .replace(/\bisOwnerAdmin\b/g, 'false')
    .replace(/\bisSuperAdmin\b/g, 'false')
    .replace(/\bisAdmin\b/g, 'false');
  // eslint-disable-next-line no-new-func
  return Boolean(new Function(`return (${js});`)());
}

function parseGate(): { universal: string[]; cases: Map<string, string>; defaultExpr: string } {
  const src = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  const fnStart = src.indexOf('const isTabAllowedForUser');
  const region = src.slice(fnStart, src.indexOf('// Debounced verification', fnStart));

  const uniM = region.match(/\/\/ Public \/ universal tabs[\s\S]*?if \(([^)]*)\) \{\s*return true;/);
  const universal = uniM ? [...uniM[1].matchAll(/tab === '([^']+)'/g)].map(m => m[1]) : [];

  // Sequential scan: stacked `case 'a': case 'b':` labels share the next
  // `return ...;`, so collect pending labels and assign on each return.
  const cases = new Map<string, string>();
  let defaultExpr = 'true';
  const switchStart = region.indexOf('switch (tab)');
  const switchRegion = region.slice(switchStart);
  const tokenRe = /case '([^']+)':|default:|return ([^;]+);/g;
  let pending: string[] = [];
  let pendingDefault = false;
  let tm: RegExpExecArray | null;
  while ((tm = tokenRe.exec(switchRegion)) !== null) {
    if (tm[1]) { pending.push(tm[1]); continue; }
    if (tm[0] === 'default:') { pendingDefault = true; continue; }
    if (tm[2]) {
      for (const l of pending) cases.set(l, tm[2].trim());
      if (pendingDefault) defaultExpr = tm[2].trim();
      pending = [];
      pendingDefault = false;
    }
  }
  return { universal, cases, defaultExpr };
}

function parseRenderGuards(): Map<string, string | null> {
  const src = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  const start = src.indexOf('const renderContent');
  const region = src.slice(start);
  const guards = new Map<string, string | null>();
  const segments = region.split(/\n      case '/).slice(1);
  for (const seg of segments) {
    const id = seg.slice(0, seg.indexOf("'"));
    if (guards.has(id)) continue;
    if (!seg.includes('AccessRestrictedView')) { guards.set(id, null); continue; }
    const m = seg.match(/return \(([^;]*?)\)\s*\n?\s*\?/s);
    guards.set(id, m ? m[1].replace(/\s+/g, ' ').trim() : 'PARSE_FAILURE');
  }
  return guards;
}

// ---------------------------------------------------------------------------
// Layout.isItemVisible replica (steps 1–6, non-admin non-principal user)
// ---------------------------------------------------------------------------
function isItemVisible(item: MenuItem, roleKey: string, hp: (p: string) => boolean): boolean {
  if (item.superOnly) return false;                       // step 1
  // step 2 (admin tier) does not apply to these roles.
  if (item.adminOnly) {                                   // step 3
    if (item.perms && item.perms.length > 0) return item.perms.some(p => hp(p));
    return false;
  }
  if (item.perms && item.perms.length > 0) {              // step 4
    return item.perms.some(p => hp(p));
  }
  // step 5
  if (['fixed_assets', 'store_inventory', 'house_system', 'fuzala_alumni', 'health_medical'].includes(item.id)) return false;
  if (['staff_leaves', 'staff_id_cards', 'staff_payroll', 'staff_analytics', 'user_roles', 'staff_roles'].includes(item.id)) return false;
  if (['sms_gateway', 'boarding_mess', 'islamic_welfare'].includes(item.id)) return roleKey === 'accountant';
  if (['student_tc', 'promotion', 'student_admission'].includes(item.id)) return false;
  return true;                                            // step 6
}

// Layout.canOpenRailTab replica (post-fix)
function canOpenRailTab(tab: string, hp: (p: string) => boolean): boolean {
  switch (tab) {
    case 'students': return hp('students.view') || hp('students.create');
    case 'attendance': return hp('attendance.view') || hp('attendance.create') || hp('attendance.edit');
    case 'results': return hp('marks.view') || hp('marks.create') || hp('reports.view');
    case 'finance': return hp('finance.view') || hp('fees.view') || hp('payments.view');
    case 'class_routine': return hp('academic.view') || hp('subjects.view');
    case 'notice_board': return true;
    case 'settings': return hp('institution.settings.view');
    default: return false;
  }
}

const RAIL_TABS = ['students', 'attendance', 'results', 'finance', 'class_routine', 'notice_board', 'settings'];

// ---------------------------------------------------------------------------
// Run the matrix
// ---------------------------------------------------------------------------
const menu = parseMenuItems();
const gate = parseGate();
const renderGuards = parseRenderGuards();

const gateAllows = (tab: string, roleKey: string, hp: (p: string) => boolean): boolean => {
  if (gate.universal.includes(tab)) return true;
  const expr = gate.cases.get(tab) || gate.defaultExpr;
  return evalAppExpr(expr, hp, roleKey);
};
const renderAllows = (tab: string, roleKey: string, hp: (p: string) => boolean): boolean => {
  const g = renderGuards.get(tab);
  if (g === null || g === undefined) return true; // unconditional render (or default case)
  return evalAppExpr(g, hp, roleKey);
};

let failures = 0;
console.log(`Parsed: ${menu.length} menu items, gate universal=[${gate.universal.join(', ')}], ${gate.cases.size} gate cases, ${renderGuards.size} render cases.\n`);

for (const roleKey of ['teacher', 'accountant', 'staff', 'guardian']) {
  const hp = makeHasPermission(roleKey);
  const home = roleHomeTab(roleKey);
  const visible = menu.filter(i => isItemVisible(i, roleKey, hp));

  console.log(`=== ${roleKey.toUpperCase()} ===`);
  console.log(`Landing (desktop home): ${home}  gate=${gateAllows(home, roleKey, hp)} render=${renderAllows(home, roleKey, hp)}`);
  if (!gateAllows(home, roleKey, hp) || !renderAllows(home, roleKey, hp)) {
    console.log(`  FAIL: home tab does not open cleanly`);
    failures++;
  }
  console.log(`Visible menu (${visible.length}): ${visible.map(i => i.id).join(', ')}`);
  for (const item of visible) {
    const g = gateAllows(item.id, roleKey, hp);
    const r = renderAllows(item.id, roleKey, hp);
    if (!g || !r) {
      console.log(`  FAIL: visible item "${item.id}" gate=${g} render=${r}`);
      failures++;
    }
  }
  const rail = RAIL_TABS.filter(t => canOpenRailTab(t, hp));
  console.log(`Slim rail offered: ${[home, ...rail.filter(t => t !== home)].join(', ')}`);
  for (const t of rail) {
    if (!gateAllows(t, roleKey, hp) || !renderAllows(t, roleKey, hp)) {
      console.log(`  FAIL: rail tab "${t}" gate=${gateAllows(t, roleKey, hp)} render=${renderAllows(t, roleKey, hp)}`);
      failures++;
    }
  }
  // Informational: permitted + openable but not in the menu
  const hidden = menu.filter(i => !isItemVisible(i, roleKey, hp) && gateAllows(i.id, roleKey, hp) && renderAllows(i.id, roleKey, hp));
  if (hidden.length) console.log(`(info) openable via deep link but not in menu: ${hidden.map(i => i.id).join(', ')}`);
  console.log('');
}

if (failures > 0) {
  console.log(`RESULT: ${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('RESULT: ALL ROLES PASS — every visible menu item and rail tab passes gate + render; every role home opens cleanly.');
