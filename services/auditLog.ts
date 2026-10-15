/**
 * Platform Audit Logging Service
 * Records immutable security and RBAC actions into the isolated collection /platformAuditLogs
 * Strictly accessible ONLY by the Platform Super Admin.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import type { PlatformAuditLogEntry, AuditActionType } from '../types/rbac';

export const PLATFORM_AUDIT_COLLECTION = 'platformAuditLogs';

/**
 * Generate a unique audit event ID with timestamp prefix for chronological ordering
 */
export function generateAuditLogId(action: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 7);
  return `audit_${ts}_${action.toLowerCase()}_${rnd}`;
}

/**
 * Log an immutable Platform Audit Event
 * Writes directly to the protected `platformAuditLogs` collection in Firestore
 */
export async function logAuditEvent(entry: {
  action: AuditActionType;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  institutionId: string;
  institutionName?: string;
  targetType: 'role' | 'member' | 'permission' | 'system' | 'settings' | 'student' | 'academic_year' | 'class' | 'section' | 'subject' | 'subject_assignment' | 'teacher_assignment' | 'teacher' | 'exam' | 'exam_subject' | 'mark' | 'grading';
  targetId: string;
  targetEmail?: string;
  targetName?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any>;
}): Promise<PlatformAuditLogEntry> {
  const logId = generateAuditLogId(entry.action);
  const now = new Date().toISOString();

  const auditRecord: PlatformAuditLogEntry = {
    id: logId,
    action: entry.action,
    actorUid: entry.actorUid,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    institutionId: entry.institutionId,
    institutionName: entry.institutionName || 'Default Madrasah',
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetEmail: entry.targetEmail,
    targetName: entry.targetName,
    before: entry.before || null,
    after: entry.after || null,
    timestamp: now,
    metadata: entry.metadata || {}
  };

  try {
    const logDocRef = doc(db, PLATFORM_AUDIT_COLLECTION, logId);
    await setDoc(logDocRef, auditRecord);
    return auditRecord;
  } catch (err) {
    // If offline or permission issue, log to console warning
    console.warn('[AuditLog] Failed to persist audit log to Firestore:', err);
    return auditRecord;
  }
}

/**
 * Fetch Platform Audit Logs
 * Callable strictly by the Super Admin
 */
export async function fetchPlatformAuditLogs(options?: {
  institutionId?: string;
  action?: AuditActionType;
  maxEntries?: number;
}): Promise<PlatformAuditLogEntry[]> {
  try {
    const auditCol = collection(db, PLATFORM_AUDIT_COLLECTION);
    const max = options?.maxEntries || 50;

    let q = query(auditCol, orderBy('timestamp', 'desc'), limit(max));

    if (options?.institutionId) {
      q = query(
        auditCol, 
        where('institutionId', '==', options.institutionId),
        orderBy('timestamp', 'desc'), 
        limit(max)
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as PlatformAuditLogEntry);
  } catch (err) {
    console.warn('[AuditLog] Error fetching platform audit logs:', err);
    return [];
  }
}
