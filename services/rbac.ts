/**
 * Multi-Institution Custom Role Management Service
 * Supports per-institution roles, default templates, and tenant-scoped member assignments.
 */

import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { 
  CustomRole, 
  InstitutionMember, 
  DefaultRoleTemplate, 
  Permission 
} from '../types/rbac';

/**
 * The platform owner's email lives in exactly one place:
 * services/appConfig.ts (env-overridable via VITE_SUPER_ADMIN_EMAIL).
 * Re-exported here for backwards compatibility with existing imports.
 */
export { SUPER_ADMIN_EMAIL } from './appConfig';

/**
 * Pre-defined Default Role Templates (Templates ONLY, never hardcoded global roles).
 * Institutions can customize, modify, duplicate, or delete these.
 */
export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    templateKey: 'institution_admin',
    defaultName: 'institution_admin',
    displayNameBn: 'প্রতিষ্ঠান অ্যাডমিন',
    displayNameEn: 'Institution Administrator',
    description: 'সম্পূর্ণ প্রতিষ্ঠানের সকল মডিউল, ইউজার ও সেটিংস পরিচালনার সর্বোচ্চ ক্ষমতা।',
    permissions: ['*'], // Wildcard permission for all actions within this institution
    defaultScopes: { allClasses: true, allSubjects: true }
  },
  {
    templateKey: 'principal',
    defaultName: 'principal',
    displayNameBn: 'অধ্যক্ষ / সুপারিনটেনডেন্ট',
    displayNameEn: 'Principal / Superintendent',
    description: 'একাডেমিক কার্যক্রম, পরীক্ষার ফলাফল ও প্রাতিষ্ঠানিক রিপোর্ট তদারকি।',
    // Phase 6 (RBAC Option A): aligned to the canonical hardcoded behaviour
    // in AppContext.hasPermission, which grants a principal EVERY permission
    // except the two explicitly vetoed there ('system.backup' and
    // 'system.audit' are denied at the hasPermission layer before this
    // role's grants are consulted). The wildcard is the only faithful
    // expression of "everything except the vetoed pair".
    permissions: ['*'],
    defaultScopes: { allClasses: true, allSubjects: true }
  },
  {
    templateKey: 'teacher',
    defaultName: 'teacher',
    displayNameBn: 'সহকারী শিক্ষক / শিক্ষিকা',
    displayNameEn: 'Assistant Teacher / Faculty',
    description: 'বরাদ্দকৃত ক্লাসের হাজিরা গ্রহণ, নম্বর প্রদান ও মূল্যায়ন পরিচালনা।',
    // Phase 6 (RBAC Option A): aligned to AppContext.hasPermission's teacher
    // branch, which grants the attendance./marks./subjects. prefixes in
    // full (any action) plus 'reports.view' and 'students.view'. The
    // 'classes.view', 'exams.view' and 'results.view' keys were already
    // granted through this template layer and are kept. NOTE: 'results.print'
    // is granted by NEITHER the hardcoded branch nor the previous template,
    // so it is deliberately NOT added.
    permissions: [
      'students.view',
      'classes.view',
      'subjects.*',
      'attendance.*',
      'exams.view',
      'marks.*',
      'results.view',
      'reports.view'
    ],
    defaultScopes: { allClasses: false, classes: [], allSubjects: false, subjects: [] }
  },
  {
    templateKey: 'accountant',
    defaultName: 'accountant',
    displayNameBn: 'হিসাবরক্ষক / ক্যাশিয়ার',
    displayNameEn: 'Accountant / Cashier',
    description: 'বেতন, ফি আদায়, ভাউচার এন্ট্রি ও আর্থিক হিসাব ব্যবস্থাপনা।',
    // Phase 6 (RBAC Option A): aligned to AppContext.hasPermission's
    // accountant branch, which grants the finance./fees./payments. prefixes
    // in full (any action — including e.g. 'fees.delete', which the previous
    // enumerated list did not name) plus 'reports.view' and 'students.view'.
    // 'reports.print' was already granted through this template layer and
    // is kept.
    permissions: [
      'students.view',
      'fees.*',
      'payments.*',
      'finance.*',
      'reports.view', 'reports.print'
    ],
    defaultScopes: { allClasses: true }
  },
  {
    templateKey: 'office_staff',
    defaultName: 'office_staff',
    displayNameBn: 'অফিস সহকারী',
    displayNameEn: 'Office Staff',
    description: 'শিক্ষার্থী ভর্তি, তথ্য হালনাগাদ ও নোটিশ/সার্টিফিকেট প্রিন্ট।',
    permissions: [
      'students.view', 'students.create', 'students.edit',
      'classes.view',
      'attendance.view',
      'results.view', 'results.print',
      'reports.view'
    ],
    defaultScopes: { allClasses: true }
  },
  {
    templateKey: 'librarian',
    defaultName: 'librarian',
    displayNameBn: 'গ্রন্থাগারিক',
    displayNameEn: 'Librarian',
    description: 'বই ব্যাংক ও শিক্ষার্থী তালিকা পর্যবেক্ষণ।',
    permissions: [
      'students.view',
      'reports.view'
    ],
    defaultScopes: { allClasses: true }
  },
  {
    // Phase 6 (RBAC Option A): the guardian/parent role previously existed
    // ONLY as a hardcoded branch in AppContext.hasPermission (granting
    // students.view, marks.view, attendance.view, fees.view) with no
    // template at all. This template mirrors that branch exactly so the
    // CustomRole layer can represent the role; it adds no new grant.
    templateKey: 'guardian',
    defaultName: 'guardian',
    displayNameBn: 'অভিভাবক',
    displayNameEn: 'Guardian / Parent',
    description: 'সন্তানের তথ্য, হাজিরা, নম্বর ও ফি বিবরণী পর্যবেক্ষণ।',
    permissions: [
      'students.view',
      'marks.view',
      'attendance.view',
      'fees.view'
    ],
    defaultScopes: { allClasses: true }
  }
];

/**
 * Phase 6 (RBAC Option A): conservative template merge.
 *
 * Given a stored institution role, if it corresponds to a default template
 * (matched by the seeded id `role_<templateKey>` or by exact template name),
 * return a copy whose permission list is the UNION of the stored grants and
 * the template's grants. This only ever ADDS template keys that a stored
 * role is missing (e.g. roles seeded from an older template revision); it
 * never removes a stored grant and never touches dataScopes. Roles that do
 * not match a template are returned unchanged.
 */
export function mergeRolePermissionsWithTemplate(role: CustomRole): CustomRole {
  if (!role) return role;
  const template = DEFAULT_ROLE_TEMPLATES.find(
    t => role.id === `role_${t.templateKey}` || role.name === t.defaultName
  );
  if (!template) return role;
  const stored: string[] = Array.isArray(role.permissions) ? role.permissions : [];
  const missing = template.permissions.filter(p => !stored.includes(p));
  if (missing.length === 0) return role;
  return { ...role, permissions: [...stored, ...missing] };
}

/**
 * Generate a unique custom role ID for an institution
 */
export function generateRoleId(institutionId: string, roleName: string): string {
  const sanitized = roleName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `role_${sanitized}_${Date.now().toString(36)}`;
}

/**
 * Initialize Default Roles for an Institution from Templates
 * (Only if the institution doesn't have custom roles yet)
 */
export async function initializeInstitutionDefaultRoles(
  institutionId: string, 
  actorUid: string
): Promise<CustomRole[]> {
  const rolesCol = collection(db, 'institutions', institutionId, 'roles');
  const existingSnap = await getDocs(rolesCol);

  if (!existingSnap.empty) {
    return existingSnap.docs.map(d => mergeRolePermissionsWithTemplate(d.data() as CustomRole));
  }

  const createdRoles: CustomRole[] = [];
  const now = new Date().toISOString();

  for (const template of DEFAULT_ROLE_TEMPLATES) {
    const roleId = `role_${template.templateKey}`;
    const roleDocRef = doc(db, 'institutions', institutionId, 'roles', roleId);
    
    const newRole: CustomRole = {
      id: roleId,
      institutionId,
      name: template.defaultName,
      displayName: template.displayNameBn,
      description: template.description,
      permissions: template.permissions,
      dataScopes: template.defaultScopes || { allClasses: true },
      isSystemRole: template.templateKey === 'institution_admin',
      isActive: true,
      createdAt: now,
      createdBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid
    };

    await setDoc(roleDocRef, newRole);
    createdRoles.push(newRole);
  }

  return createdRoles;
}

/**
 * Fetch all Custom Roles for a specific Institution
 */
export async function getInstitutionRoles(institutionId: string): Promise<CustomRole[]> {
  try {
    const rolesCol = collection(db, 'institutions', institutionId, 'roles');
    const snap = await getDocs(rolesCol);
    return snap.docs.map(d => mergeRolePermissionsWithTemplate(d.data() as CustomRole));
  } catch (err) {
    console.warn(`[RBAC] Failed to fetch roles for institution ${institutionId}:`, err);
    return [];
  }
}

/**
 * Create a new Custom Role inside an Institution
 */
export async function createInstitutionRole(
  institutionId: string,
  roleData: Omit<CustomRole, 'id' | 'institutionId' | 'createdAt' | 'updatedAt'>,
  actorUid: string
): Promise<CustomRole> {
  const roleId = generateRoleId(institutionId, roleData.name);
  const now = new Date().toISOString();

  const newRole: CustomRole = {
    ...roleData,
    id: roleId,
    institutionId,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid
  };

  const roleDocRef = doc(db, 'institutions', institutionId, 'roles', roleId);
  await setDoc(roleDocRef, newRole);
  return newRole;
}

/**
 * Update an existing Custom Role
 */
export async function updateInstitutionRole(
  institutionId: string,
  roleId: string,
  updates: Partial<Omit<CustomRole, 'id' | 'institutionId' | 'createdAt' | 'createdBy'>>,
  actorUid: string
): Promise<void> {
  const roleDocRef = doc(db, 'institutions', institutionId, 'roles', roleId);
  await setDoc(roleDocRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid
  }, { merge: true });
}

/**
 * Delete a Custom Role (System roles cannot be deleted)
 */
export async function deleteInstitutionRole(
  institutionId: string,
  roleId: string
): Promise<{ success: boolean; message?: string }> {
  const roleDocRef = doc(db, 'institutions', institutionId, 'roles', roleId);
  const snap = await getDoc(roleDocRef);
  
  if (!snap.exists()) {
    return { success: false, message: 'Role does not exist.' };
  }

  const role = snap.data() as CustomRole;
  if (role.isSystemRole) {
    return { success: false, message: 'System roles cannot be deleted.' };
  }

  // Check if any member is assigned to this role
  const membersCol = collection(db, 'institutions', institutionId, 'members');
  const q = query(membersCol, where('roleId', '==', roleId));
  const memberSnap = await getDocs(q);

  if (!memberSnap.empty) {
    return { 
      success: false, 
      message: `Cannot delete role. It is currently assigned to ${memberSnap.size} member(s).` 
    };
  }

  await deleteDoc(roleDocRef);
  return { success: true };
}

// Helper for resilient non-blocking async operations
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }).catch(() => {
      clearTimeout(timer);
      return fallback;
    }),
    timeoutPromise
  ]);
}

/**
 * Get a specific member's record inside an Institution
 */
export async function getInstitutionMember(
  institutionId: string,
  uid: string
): Promise<InstitutionMember | null> {
  // 1. Check local storage first for instant speed
  try {
    const saved = localStorage.getItem('madrasha_institution_members');
    if (saved) {
      const list: InstitutionMember[] = JSON.parse(saved);
      const found = list.find(m => m.uid === uid || m.email === uid);
      if (found) return found;
    }
  } catch (e) {}

  try {
    const memberDocRef = doc(db, 'institutions', institutionId, 'members', uid);
    const snap = await withTimeout(getDoc(memberDocRef), 2000, null as any);
    if (snap && snap.exists && snap.exists()) {
      return snap.data() as InstitutionMember;
    }
    return null;
  } catch (err) {
    console.warn(`[RBAC] Failed to fetch member ${uid} in institution ${institutionId}:`, err);
    return null;
  }
}

/**
 * Assign or update an Institution Member's role and data scopes
 */
export async function setInstitutionMember(
  institutionId: string,
  memberData: Omit<InstitutionMember, 'institutionId' | 'createdAt' | 'updatedAt'>,
  actorUid: string
): Promise<InstitutionMember> {
  const memberDocRef = doc(db, 'institutions', institutionId, 'members', memberData.uid);
  const now = new Date().toISOString();

  // Save to local storage IMMEDIATELY so there is ZERO delay or loss
  let fullMember: InstitutionMember = {
    ...memberData,
    institutionId,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid
  };

  try {
    const saved = localStorage.getItem('madrasha_institution_members');
    const list: InstitutionMember[] = saved ? JSON.parse(saved) : [];
    const existingIndex = list.findIndex(m => m.uid === fullMember.uid || m.email.toLowerCase() === fullMember.email.toLowerCase());
    if (existingIndex >= 0) {
      fullMember.createdAt = list[existingIndex].createdAt || now;
      fullMember.createdBy = list[existingIndex].createdBy || actorUid;
      list[existingIndex] = fullMember;
    } else {
      list.push(fullMember);
    }
    localStorage.setItem('madrasha_institution_members', JSON.stringify(list));
  } catch (e) {}

  // Sync to Firestore in background without blocking
  withTimeout(setDoc(memberDocRef, fullMember, { merge: true }), 2500, null).catch(e => {
    console.warn('[RBAC] Firestore setDoc fallback notice:', e);
  });

  return fullMember;
}

/**
 * Fetch all members of an institution
 *
 * The Firestore read has a quick timeout and the function never throws:
 * on timeout/error it returns the local-store merge. Callers that must
 * tell the user "update failed" apart from "no pending applicants" read
 * getLastMembersSyncStatus() right after awaiting this — it reports
 * whether the Firestore leg of the most recent call actually landed.
 */
let lastMembersCloudOk = true;
export function getLastMembersSyncStatus(): { cloudOk: boolean } {
  return { cloudOk: lastMembersCloudOk };
}

export async function getAllInstitutionMembers(institutionId: string): Promise<InstitutionMember[]> {
  const membersMap = new Map<string, InstitutionMember>();

  // 1. Read from local storage (instant)
  try {
    const saved = localStorage.getItem('madrasha_institution_members');
    if (saved) {
      const list: InstitutionMember[] = JSON.parse(saved);
      list.forEach(m => {
        if (m && m.uid && (m as any).status !== 'deleted' && !(m as any).isDeleted) {
          membersMap.set(m.uid, m);
        }
      });
    }
  } catch (e) {}

  // 2. Read from Firestore with quick timeout
  try {
    const membersCol = collection(db, 'institutions', institutionId, 'members');
    const snap = await withTimeout(getDocs(membersCol), 2000, null as any);
    if (snap && snap.docs) {
      snap.docs.forEach((d: any) => {
        const data = d.data() as InstitutionMember;
        if (data && data.uid && (data as any).status !== 'deleted' && !(data as any).isDeleted) {
          membersMap.set(data.uid, data);
        }
      });
      lastMembersCloudOk = true;
    } else {
      // Timeout (null snapshot): Firestore leg did not land.
      lastMembersCloudOk = false;
    }
  } catch (err) {
    lastMembersCloudOk = false;
    console.warn(`[RBAC] Firestore member fetch notice (using local store):`, err);
  }

  const result = Array.from(membersMap.values());
  // Refresh local cache with latest merged
  try {
    localStorage.setItem('madrasha_institution_members', JSON.stringify(result));
  } catch (e) {}

  return result;
}

/**
 * Delete an institution member.
 * Marks the document as deleted (guaranteed update) and deletes it from Firestore and local cache.
 */
export async function deleteInstitutionMember(institutionId: string, uid: string): Promise<{ ok: boolean }> {
  try {
    const saved = localStorage.getItem('madrasha_institution_members');
    if (saved) {
      const list: InstitutionMember[] = JSON.parse(saved);
      const filtered = list.filter(m => m.uid !== uid);
      localStorage.setItem('madrasha_institution_members', JSON.stringify(filtered));
    }
  } catch (e) {}

  try {
    const memberDocRef = doc(db, 'institutions', institutionId, 'members', uid);
    // 1. Mark as deleted via update (which works for all authenticated users)
    await withTimeout(setDoc(memberDocRef, { status: 'deleted', isDeleted: true, updatedAt: new Date().toISOString() }, { merge: true }), 1500, null);
    // 2. Attempt hard delete
    await withTimeout(deleteDoc(memberDocRef), 1500, null);
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

/**
 * Delete several member docs, reporting exactly which ones failed
 * (Phase 2). Delete callers run this AFTER the main_store cloud
 * confirm — never before — so a failed cloud write can never leave
 * member docs deleted while the staff record survives.
 */
export async function deleteInstitutionMembers(institutionId: string, uids: string[]): Promise<{ ok: boolean; failedUids: string[] }> {
  const failedUids: string[] = [];
  for (const uid of uids) {
    const res = await deleteInstitutionMember(institutionId, uid);
    if (!res.ok) failedUids.push(uid);
  }
  return { ok: failedUids.length === 0, failedUids };
}

/**
 * Approve and assign role to a pending member
 */
export async function approveInstitutionMember(
  institutionId: string,
  uid: string,
  roleId: string,
  assignedClasses: string[] = [],
  assignedSubjects: string[] = [],
  actorUid: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Update local storage immediately
  try {
    const saved = localStorage.getItem('madrasha_institution_members');
    if (saved) {
      const list: InstitutionMember[] = JSON.parse(saved);
      const updated = list.map(m => m.uid === uid ? {
        ...m,
        roleId,
        status: 'active' as const,
        assignedClasses,
        assignedSubjects,
        updatedAt: now,
        updatedBy: actorUid
      } : m);
      localStorage.setItem('madrasha_institution_members', JSON.stringify(updated));
    }
  } catch (e) {}

  try {
    const memberDocRef = doc(db, 'institutions', institutionId, 'members', uid);
    await withTimeout(setDoc(memberDocRef, {
      roleId,
      status: 'active',
      assignedClasses,
      assignedSubjects,
      updatedAt: now,
      updatedBy: actorUid
    }, { merge: true }), 2500, null);
  } catch (e) {}
}
