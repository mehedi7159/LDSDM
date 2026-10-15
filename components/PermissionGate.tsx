import React from 'react';
import { useApp } from '../context/AppContext';
import { checkPermission } from '../services/authorization';
import type { Permission } from '../types/rbac';

interface PermissionGateProps {
  permission: Permission;
  scopeRequirements?: {
    classId?: string;
    subjectId?: string;
    studentId?: string;
  };
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Declarative component for granular permission gating.
 * Renders `children` only if current user has the specified permission and data scope.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  scopeRequirements,
  children,
  fallback = null
}) => {
  const { authContext } = useApp();

  const isAllowed = checkPermission(authContext, permission, scopeRequirements);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
