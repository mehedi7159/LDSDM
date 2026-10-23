/**
 * Admission Applications — SINGLE canonical store (Phase 2, Batch 2).
 *
 * Historically there were TWO disconnected admission ledgers:
 *   1. Office intake  — components/students/AdmissionApplicationManager.tsx
 *      localStorage key `madrasah_admission_applications`
 *   2. Online tracker — components/portals/PortalsServicesManager.tsx
 *      localStorage key `mms_online_admissions_v1`
 * An application entered on one screen never appeared on the other.
 *
 * This service is now the only store either screen reads or writes:
 *   canonical key: `mms_admission_applications_v1`
 *
 * Migration (idempotent, additive, non-destructive):
 *  - On first load, every record from both legacy keys is mapped into the
 *    unified shape and absorbed into the canonical list.
 *  - Absorption runs on every load, so a record restored from an OLD backup
 *    (which only contains the legacy keys) is picked up too.
 *  - Duplicates across the two ledgers are merged by a stable key:
 *    normalized guardian phone + normalized applicant name + desired class
 *    + applied date. Merging fills empty fields from the other copy and
 *    keeps the furthest-advanced status.
 *  - Legacy keys are NEVER deleted or rewritten by this service — they stay
 *    as a historical fallback. Neither UI deletes applications, so
 *    re-absorption can never resurrect a deleted record.
 *  - Status can never move backwards through an adapter save
 *    (precedence: admitted > approved > rejected > interview_called > pending),
 *    because the office adapter's shape cannot distinguish "approved" from
 *    "admitted" — the truthful terminal state is protected.
 */

export type UnifiedAdmissionStatus =
  | 'pending'
  | 'interview_called'
  | 'approved'
  | 'rejected'
  | 'admitted';

export interface UnifiedAdmissionApplication {
  id: string;
  applicationNo?: string;
  applicantName: string;
  applicantNameBn?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  desiredClass: string;
  fatherName: string;
  fatherNameBn?: string;
  motherName?: string;
  guardianPhone: string;
  guardianEmail?: string;
  previousSchool?: string;
  address?: string;
  isResidential?: boolean;
  appliedDate: string;
  status: UnifiedAdmissionStatus;
  notes?: string;
  source: 'office' | 'online' | 'merged';
}

export const ADMISSION_APPLICATIONS_STORAGE_KEY = 'mms_admission_applications_v1';
const LEGACY_OFFICE_KEY = 'madrasah_admission_applications';
const LEGACY_ONLINE_KEY = 'mms_online_admissions_v1';

const STATUS_PRECEDENCE: Record<UnifiedAdmissionStatus, number> = {
  pending: 1,
  interview_called: 2,
  rejected: 3,
  approved: 4,
  admitted: 5,
};

/** Shape used by the office intake screen (AdmissionApplicationManager). */
export interface OfficeAdmissionApplication {
  id: string;
  applicationNo: string;
  applicantName: string;
  applicantNameBn?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  desiredClass: string;
  fatherName: string;
  fatherNameBn?: string;
  motherName: string;
  guardianPhone: string;
  guardianEmail?: string;
  previousSchool?: string;
  address: string;
  appliedDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
}

/** Shape used by the online tracker screen (PortalsServicesManager). */
export interface OnlineAdmissionApplication {
  id: string;
  applicantName: string;
  applicantNameBn?: string;
  fatherName: string;
  motherName?: string;
  phone: string;
  desiredClass: string;
  previousSchool?: string;
  dateOfBirth?: string;
  gender: 'male' | 'female';
  isResidential: boolean;
  status: 'pending' | 'interview_called' | 'approved' | 'rejected' | 'admitted';
  appliedDate: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Normalization / dedupe
// ---------------------------------------------------------------------------

function normalizePhone(raw?: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) digits = '0' + digits.slice(3);
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits;
  return digits;
}

function normalizeText(raw?: string): string {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Stable identity of an applicant across the two ledgers: same guardian
 * phone + same applicant name + same desired class + same applied date
 * means the same application typed into both systems.
 * Records without a phone can only be matched by their own id.
 */
export function admissionDedupeKey(a: {
  guardianPhone?: string;
  applicantName?: string;
  desiredClass?: string;
  appliedDate?: string;
}): string | null {
  const phone = normalizePhone(a.guardianPhone);
  if (!phone) return null;
  return [
    phone,
    normalizeText(a.applicantName),
    normalizeText(a.desiredClass),
    String(a.appliedDate || '').slice(0, 10),
  ].join('|');
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function mergeRecords(
  base: UnifiedAdmissionApplication,
  extra: UnifiedAdmissionApplication
): UnifiedAdmissionApplication {
  const merged: UnifiedAdmissionApplication = { ...base };
  (Object.keys(extra) as (keyof UnifiedAdmissionApplication)[]).forEach(k => {
    if (k === 'id' || k === 'status' || k === 'source') return;
    if (isEmpty(merged[k]) && !isEmpty(extra[k])) {
      (merged as any)[k] = extra[k];
    }
  });
  merged.status =
    STATUS_PRECEDENCE[extra.status] > STATUS_PRECEDENCE[base.status]
      ? extra.status
      : base.status;
  merged.source = base.source === extra.source ? base.source : 'merged';
  return merged;
}

function absorb(
  list: UnifiedAdmissionApplication[],
  incoming: UnifiedAdmissionApplication
): UnifiedAdmissionApplication[] {
  const key = admissionDedupeKey(incoming);
  let idx = key ? list.findIndex(r => admissionDedupeKey(r) === key) : -1;
  if (idx < 0) idx = list.findIndex(r => r.id === incoming.id);
  if (idx < 0) return [...list, incoming];
  const next = [...list];
  next[idx] = mergeRecords(next[idx], incoming);
  return next;
}

// ---------------------------------------------------------------------------
// Legacy record mapping
// ---------------------------------------------------------------------------

function fromOfficeRecord(a: any): UnifiedAdmissionApplication | null {
  if (!a || !a.id || !a.applicantName) return null;
  const statusMap: Record<string, UnifiedAdmissionStatus> = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  };
  return {
    id: String(a.id),
    applicationNo: a.applicationNo || undefined,
    applicantName: String(a.applicantName),
    applicantNameBn: a.applicantNameBn || undefined,
    gender: (a.gender as any) || 'male',
    dateOfBirth: a.dateOfBirth || undefined,
    desiredClass: String(a.desiredClass || ''),
    fatherName: String(a.fatherName || ''),
    fatherNameBn: a.fatherNameBn || undefined,
    motherName: a.motherName || undefined,
    guardianPhone: String(a.guardianPhone || a.phone || ''),
    guardianEmail: a.guardianEmail || undefined,
    previousSchool: a.previousSchool || undefined,
    address: a.address || undefined,
    appliedDate: String(a.appliedDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    status: statusMap[String(a.status || 'PENDING').toUpperCase()] || 'pending',
    notes: a.notes || undefined,
    source: 'office',
  };
}

function fromOnlineRecord(a: any): UnifiedAdmissionApplication | null {
  if (!a || !a.id || !a.applicantName) return null;
  const validStatuses: UnifiedAdmissionStatus[] = [
    'pending',
    'interview_called',
    'approved',
    'rejected',
    'admitted',
  ];
  return {
    id: String(a.id),
    applicantName: String(a.applicantName),
    applicantNameBn: a.applicantNameBn || undefined,
    gender: (a.gender as any) || 'male',
    dateOfBirth: a.dateOfBirth || undefined,
    desiredClass: String(a.desiredClass || ''),
    fatherName: String(a.fatherName || ''),
    motherName: a.motherName || undefined,
    guardianPhone: String(a.phone || a.guardianPhone || ''),
    previousSchool: a.previousSchool || undefined,
    isResidential: !!a.isResidential,
    appliedDate: String(a.appliedDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    status: validStatuses.includes(a.status) ? a.status : 'pending',
    notes: a.notes || undefined,
    source: 'online',
  };
}

// ---------------------------------------------------------------------------
// Adapters used by the two screens (their local shapes stay unchanged)
// ---------------------------------------------------------------------------

export function toOfficeApplication(u: UnifiedAdmissionApplication): OfficeAdmissionApplication {
  const statusMap: Record<UnifiedAdmissionStatus, OfficeAdmissionApplication['status']> = {
    pending: 'PENDING',
    interview_called: 'PENDING',
    approved: 'APPROVED',
    admitted: 'APPROVED',
    rejected: 'REJECTED',
  };
  return {
    id: u.id,
    applicationNo: u.applicationNo || '',
    applicantName: u.applicantName,
    applicantNameBn: u.applicantNameBn,
    gender: u.gender,
    dateOfBirth: u.dateOfBirth || '',
    desiredClass: u.desiredClass,
    fatherName: u.fatherName,
    fatherNameBn: u.fatherNameBn,
    motherName: u.motherName || '',
    guardianPhone: u.guardianPhone,
    guardianEmail: u.guardianEmail,
    previousSchool: u.previousSchool,
    address: u.address || '',
    appliedDate: u.appliedDate,
    status: statusMap[u.status],
    notes: u.notes,
  };
}

export function fromOfficeApplication(a: OfficeAdmissionApplication): UnifiedAdmissionApplication {
  return (
    fromOfficeRecord(a) || {
      id: a.id,
      applicantName: a.applicantName,
      desiredClass: a.desiredClass,
      fatherName: a.fatherName,
      guardianPhone: a.guardianPhone,
      appliedDate: a.appliedDate,
      gender: a.gender,
      status: 'pending',
      source: 'office',
    }
  );
}

export function toOnlineApplication(u: UnifiedAdmissionApplication): OnlineAdmissionApplication {
  return {
    id: u.id,
    applicantName: u.applicantName,
    applicantNameBn: u.applicantNameBn,
    fatherName: u.fatherName,
    motherName: u.motherName,
    phone: u.guardianPhone,
    desiredClass: u.desiredClass,
    previousSchool: u.previousSchool,
    dateOfBirth: u.dateOfBirth,
    gender: (u.gender === 'other' ? 'male' : u.gender) as 'male' | 'female',
    isResidential: !!u.isResidential,
    status: u.status,
    appliedDate: u.appliedDate,
    notes: u.notes,
  };
}

export function fromOnlineApplication(a: OnlineAdmissionApplication): UnifiedAdmissionApplication {
  return (
    fromOnlineRecord(a) || {
      id: a.id,
      applicantName: a.applicantName,
      desiredClass: a.desiredClass,
      fatherName: a.fatherName,
      guardianPhone: a.phone,
      appliedDate: a.appliedDate,
      gender: a.gender,
      status: a.status,
      source: 'online',
    }
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let cache: UnifiedAdmissionApplication[] | null = null;
const listeners = new Set<() => void>();

function readJsonArray(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: UnifiedAdmissionApplication[]) {
  try {
    localStorage.setItem(ADMISSION_APPLICATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to persist admission applications:', e);
  }
}

function notify() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {}
  });
}

function assignApplicationNumbers(list: UnifiedAdmissionApplication[]): UnifiedAdmissionApplication[] {
  let seq = list.filter(r => r.applicationNo).length;
  return list.map(r => {
    if (r.applicationNo) return r;
    seq += 1;
    const year = (r.appliedDate || '').slice(0, 4) || String(new Date().getFullYear());
    return { ...r, applicationNo: `ADM-${year}-${String(seq).padStart(3, '0')}` };
  });
}

/**
 * Loads the canonical list, migrating/absorbing both legacy ledgers.
 * Runs the absorption on every first load of a session: cheap, idempotent,
 * and it also picks up legacy records restored later from old backups.
 */
export function getAdmissionApplications(): UnifiedAdmissionApplication[] {
  if (cache) return cache;
  let list: UnifiedAdmissionApplication[] = [];
  readJsonArray(ADMISSION_APPLICATIONS_STORAGE_KEY).forEach(raw => {
    const rec = raw && raw.id ? ({ ...raw } as UnifiedAdmissionApplication) : null;
    if (rec) list = absorb(list, rec);
  });
  readJsonArray(LEGACY_OFFICE_KEY).forEach(raw => {
    const rec = fromOfficeRecord(raw);
    if (rec) list = absorb(list, rec);
  });
  readJsonArray(LEGACY_ONLINE_KEY).forEach(raw => {
    const rec = fromOnlineRecord(raw);
    if (rec) list = absorb(list, rec);
  });
  list = assignApplicationNumbers(list);
  // Newest first, matching both screens' previous presentation.
  list.sort((a, b) => String(b.appliedDate).localeCompare(String(a.appliedDate)));
  cache = list;
  persist(list);
  return list;
}

/**
 * Replaces the canonical list with an adapter-provided list, merging each
 * record onto the existing canonical record with the same id so fields the
 * adapter does not own (isResidential, applicationNo, source, ...) survive,
 * and so status can never regress (see header note).
 */
export function saveAdmissionApplications(incoming: UnifiedAdmissionApplication[]) {
  const current = getAdmissionApplications();
  const byId = new Map(current.map(r => [r.id, r]));
  const next: UnifiedAdmissionApplication[] = incoming.map(rec => {
    const existing = byId.get(rec.id);
    if (!existing) return rec;
    const merged = mergeRecords(existing, rec);
    // Adapter-owned fields win when explicitly provided.
    const explicit: UnifiedAdmissionApplication = { ...merged };
    (Object.keys(rec) as (keyof UnifiedAdmissionApplication)[]).forEach(k => {
      if (k === 'status' || k === 'source') return;
      if (!isEmpty((rec as any)[k])) (explicit as any)[k] = (rec as any)[k];
    });
    explicit.status =
      STATUS_PRECEDENCE[rec.status] > STATUS_PRECEDENCE[existing.status]
        ? rec.status
        : existing.status;
    explicit.source = existing.source;
    return explicit;
  });
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  cache = next;
  persist(next);
  notify();
}

/** Sets one application's status directly on the canonical record. */
export function updateAdmissionApplicationStatus(id: string, status: UnifiedAdmissionStatus) {
  const current = getAdmissionApplications();
  if (!current.some(r => r.id === id)) return;
  const next = current.map(r => (r.id === id ? { ...r, status } : r));
  cache = next;
  persist(next);
  notify();
}

export function subscribeAdmissionApplications(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
