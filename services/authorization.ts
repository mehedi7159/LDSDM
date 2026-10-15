/**
 * Authorization Engine: Multi-Level Security (Authentication, Permissions & Data Scopes)
 * 
 * LEVEL 1: Authentication verification
 * LEVEL 2: Granular permission matching (MODULE.ACTION & Wildcard)
 * LEVEL 3: Scoped data boundaries (assigned classes, subjects, students)
 */

import type { User } from 'firebase/auth';
import type { 
  AuthorizationContext, 
  CustomRole, 
  DataScope, 
  InstitutionMember, 
  Permission 
} from '../types/rbac';

export const PLATFORM_SUPERADMIN_EMAIL = 'mehedihasansagor26@gmail.com';

/**
 * Verified Platform Super Admin Check
 * NEVER relies on unverified client state.
 * Requires:
 * 1. User authenticated
 * 2. Exact email matching PLATFORM_SUPERADMIN_EMAIL
 * 3. Cryptographic Firebase Auth Custom Claim verification (role == 'admin' or isSuperAdmin == true)
 */
export function isVerifiedSuperAdmin(
  user: User | null, 
  claims: Record<string, any> | null
): boolean {
  if (!user || !user.email) return false;
  
  const isMatchingEmail = user.email.toLowerCase() === PLATFORM_SUPERADMIN_EMAIL.toLowerCase();
  if (!isMatchingEmail) return false;

  if (!claims) return false;

  const hasRoleAdmin = claims.role === 'admin';
  const hasSuperAdminFlag = claims.isSuperAdmin === true;

  return hasRoleAdmin || hasSuperAdminFlag;
}

/**
 * Check if a permission string matches a required permission.
 * Handles wildcards:
 * - '*' matches everything
 * - 'students.*' matches 'students.view', 'students.create', etc.
 * - Exact string match
 */
export function permissionMatches(grantedPermission: string, requiredPermission: string): boolean {
  if (grantedPermission === '*') return true;
  if (grantedPermission === requiredPermission) return true;

  if (grantedPermission.endsWith('.*')) {
    const prefix = grantedPermission.slice(0, -2);
    if (requiredPermission.startsWith(`${prefix}.`)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluate Data Scopes against an access request
 */
export function evaluateDataScope(
  scope: DataScope | undefined,
  context?: { classId?: string; subjectId?: string; studentId?: string }
): boolean {
  // If no specific scope context is requested, base permission is sufficient
  if (!context || Object.keys(context).length === 0) {
    return true;
  }

  // If no scope is defined on user/role, default to unrestricted
  if (!scope) {
    return true;
  }

  // Class Scope Check
  if (context.classId) {
    if (!scope.allClasses) {
      const allowedClasses = scope.classes || [];
      if (!allowedClasses.includes(context.classId)) {
        return false;
      }
    }
  }

  // Subject Scope Check
  if (context.subjectId) {
    if (!scope.allSubjects) {
      const allowedSubjects = scope.subjects || [];
      if (!allowedSubjects.includes(context.subjectId)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Main Authorization Checker
 * Combines Level 1, Level 2, and Level 3 checks
 */
export function checkPermission(
  authCtx: AuthorizationContext | null,
  requiredPermission: Permission,
  scopeRequirements?: { classId?: string; subjectId?: string; studentId?: string }
): boolean {
  if (!authCtx) return false;

  // Platform Super Admin has universal platform authority
  if (authCtx.isSuperAdmin) {
    return true;
  }

  // Check if member is suspended or inactive
  if (authCtx.member && authCtx.member.status !== 'active') {
    return false;
  }

  // Institution Admin within their institution has wildcard permission
  if (authCtx.isInstitutionAdmin) {
    return true;
  }

  // Level 2: Permission check
  let hasGrantedPermission = false;
  for (const granted of authCtx.permissions) {
    if (permissionMatches(granted, requiredPermission)) {
      hasGrantedPermission = true;
      break;
    }
  }

  if (!hasGrantedPermission) {
    return false;
  }

  // Level 3: Data Scope check
  const effectiveScope: DataScope = {
    ...(authCtx.role?.dataScopes || {}),
    ...(authCtx.member?.dataScopes || {})
  };

  return evaluateDataScope(effectiveScope, scopeRequirements);
}

/**
 * Build an AuthorizationContext object from user credentials, role, and membership
 */
export function buildAuthorizationContext(
  user: User | null,
  claims: Record<string, any> | null,
  member: InstitutionMember | null,
  role: CustomRole | null,
  currentInstitutionId?: string
): AuthorizationContext {
  const isSuper = isVerifiedSuperAdmin(user, claims);
  const email = user?.email || '';
  const uid = user?.uid || '';

  // Determine if this user is an admin of the specified institution
  const isInstAdmin = 
    isSuper || 
    (claims?.institutionId === currentInstitutionId && claims?.role === 'institution_admin') ||
    role?.name === 'institution_admin' ||
    role?.permissions.includes('*') ||
    false;

  const permissionsSet = new Set<string>();

  if (isSuper || isInstAdmin) {
    permissionsSet.add('*');
  } else if (role?.isActive && role.permissions) {
    for (const p of role.permissions) {
      permissionsSet.add(p);
    }
  }

  const effectiveDataScopes: DataScope = {
    ...(role?.dataScopes || { allClasses: true, allSubjects: true }),
    ...(member?.dataScopes || {})
  };

  return {
    uid,
    email,
    isSuperAdmin: isSuper,
    isInstitutionAdmin: isInstAdmin,
    institutionId: currentInstitutionId || member?.institutionId,
    member,
    role,
    permissions: permissionsSet,
    dataScopes: effectiveDataScopes
  };
}
