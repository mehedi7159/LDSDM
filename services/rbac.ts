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

export const SUPER_ADMIN_EMAIL = 'mehedihasansagor26@gmail.com';

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
    displayNameBn: 'মুহতামিম / অধ্যক্ষ',
    displayNameEn: 'Principal / Head',
    description: 'একাডেমিক কার্যক্রম, পরীক্ষার ফলাফল ও প্রাতিষ্ঠানিক রিপোর্ট তদারকি।',
    permissions: [
      'students.view', 'students.edit',
      'teachers.view',
      'classes.view',
      'subjects.view',
      'attendance.view',
      'exams.view',
      'marks.view',
      'results.view', 'results.print',
      'fees.view',
      'finance.view',
      'reports.view', 'reports.print',
      'institution.settings.view'
    ],
    defaultScopes: { allClasses: true, allSubjects: true }
  },
  {
    templateKey: 'teacher',
    defaultName: 'teacher',
    displayNameBn: 'সহকারী শিক্ষক / উস্তাদ',
    displayNameEn: 'Teacher / Instructor',
    description: 'বরাদ্দকৃত ক্লাসের হাজিরা গ্রহণ, নম্বর প্রদান ও মূল্যায়ন পরিচালনা।',
    permissions: [
      'students.view',
      'classes.view',
      'subjects.view',
      'attendance.view', 'attendance.create', 'attendance.edit',
      'exams.view',
      'marks.view', 'marks.create', 'marks.edit',
      'results.view'
    ],
    defaultScopes: { allClasses: false, classes: [], allSubjects: false, subjects: [] }
  },
  {
    templateKey: 'accountant',
    defaultName: 'accountant',
    displayNameBn: 'হিসাবরক্ষক / ক্যাশিয়ার',
    displayNameEn: 'Accountant / Cashier',
    description: 'বেতন, ফি আদায়, ভাউচার এন্ট্রি ও আর্থিক হিসাব ব্যবস্থাপনা।',
    permissions: [
      'students.view',
      'fees.view', 'fees.create', 'fees.edit',
      'payments.view', 'payments.create', 'payments.edit',
      'finance.view', 'finance.create', 'finance.edit',
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
  }
];

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
    return existingSnap.docs.map(d => d.data() as CustomRole);
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
    return snap.docs.map(d => d.data() as CustomRole);
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
 */
export async function getAllInstitutionMembers(institutionId: string): Promise<InstitutionMember[]> {
  const membersMap = new Map<string, InstitutionMember>();

  // 1. Read from local storage (instant)
  try {
    const saved = localStorage.getItem('madrasha_institution_members');
    if (saved) {
      const list: InstitutionMember[] = JSON.parse(saved);
      list.forEach(m => {
        if (m && m.uid) membersMap.set(m.uid, m);
      });
    }
  } catch (e) {}

  // 2. Also check if any teachers exist in 'teachers' localStorage and add as member records if missing
  try {
    const teachersSaved = localStorage.getItem('teachers');
    if (teachersSaved) {
      const teachersList: any[] = JSON.parse(teachersSaved);
      teachersList.forEach(t => {
        if (t && t.id) {
          const existingKey = t.id;
          const found = Array.from(membersMap.values()).find(m => m.uid === t.id || (t.phone && m.phone === t.phone));
          if (!found) {
            const memberObj: InstitutionMember = {
              uid: t.id,
              institutionId,
              email: t.phone ? `teacher.${t.phone}@madrasha.local` : `teacher.${t.id}@madrasha.local`,
              displayName: t.name || t.nameBn || 'শিক্ষক',
              phone: t.phone || '',
              roleId: 'role_teacher',
              requestedRole: 'সহকারী শিক্ষক (Teacher)',
              status: 'active',
              assignedClasses: [],
              assignedSubjects: [],
              createdAt: t.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            membersMap.set(t.id, memberObj);
          }
        }
      });
    }
  } catch (e) {}

  // 3. Read from Firestore in background with quick timeout
  try {
    const membersCol = collection(db, 'institutions', institutionId, 'members');
    const snap = await withTimeout(getDocs(membersCol), 2000, null as any);
    if (snap && snap.docs) {
      snap.docs.forEach((d: any) => {
        const data = d.data() as InstitutionMember;
        if (data && data.uid) {
          membersMap.set(data.uid, data);
        }
      });
    }
  } catch (err) {
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
 * Delete an institution member
 */
export async function deleteInstitutionMember(institutionId: string, uid: string): Promise<void> {
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
    await withTimeout(deleteDoc(memberDocRef), 2000, null);
  } catch (e) {}
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
