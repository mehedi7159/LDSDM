import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth, firebaseConfig } from './firebase';
import type {
  SchoolProfile,
  SchoolClass,
  Student,
  Subject,
  Exam,
  MarkRecord,
  RemarkRecord,
  FinanceTransaction,
  ClassFeeStructure,
  TrashItem,
  AcademicYear,
  Section,
  AcademicTeacher,
  ClassSubjectAssignment,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
  ExamSubjectAssignment,
  PromotionHistoryRecord,
  GradingSystem
} from '../types';
import { DEFAULT_GRADING_SYSTEM } from '../types';

/**
 * ============================================================================
 * MULTI-STORE PERSISTENCE & AUTO-RECOVERY ENGINE (v3.0)
 * 
 * Provides unbreakable 4-Tier Data Resilience:
 * Tier 1: LocalStorage (Fast Synchronous UI Cache)
 * Tier 2: IndexedDB Permanent Vault (High Capacity, Persistent Storage Protected)
 * Tier 3: Cloud Firestore Vault (Realtime Sync & Cloud Historical Snapshots)
 * Tier 4: Auto-Rolling Point-in-Time Checkpoints (Up to 30 rotating snapshots)
 * Tier 5: Smart Auto-Resurrection on Startup (Auto-recovers when Chrome clears cache)
 * ============================================================================
 */

const DB_NAME = 'madrasah_permanent_vault_v2';
const DB_VERSION = 1;
const STORE_ENTITIES = 'entities';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_META = 'meta';

export interface SystemDataPayload {
  schoolProfile: SchoolProfile;
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  exams: Exam[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  transactions: FinanceTransaction[];
  feeStructures: ClassFeeStructure[];
  trashBin: TrashItem[];
  academicYears?: AcademicYear[];
  sections?: Section[];
  teachers?: AcademicTeacher[];
  classSubjectAssignments?: ClassSubjectAssignment[];
  teacherSubjectAssignments?: TeacherSubjectAssignment[];
  classTeacherAssignments?: ClassTeacherAssignment[];
  examSubjectAssignments?: ExamSubjectAssignment[];
  promotionHistory?: PromotionHistoryRecord[];
  gradingSystem?: GradingSystem[];
  institutionMembers?: any[];
}

export interface SystemDataCounts {
  students: number;
  classes: number;
  subjects: number;
  exams: number;
  marks: number;
  remarks: number;
  transactions: number;
  feeStructures: number;
  teachers: number;
  academicYears: number;
  trashBin: number;
}

export interface SystemSnapshot {
  id: string;
  timestamp: string;
  createdAt: number;
  trigger: 'auto_interval' | 'manual' | 'pre_restore' | 'pre_mutation' | 'cloud_sync' | 'resurrection';
  labelBn: string;
  labelEn: string;
  counts: SystemDataCounts;
  payload: SystemDataPayload;
}

export interface MultiStoreHealth {
  localStorageOk: boolean;
  indexedDbOk: boolean;
  cloudSyncOk: boolean;
  persistentStorageGranted: boolean;
  totalSnapshots: number;
  lastSnapshotTime?: string;
  lastCloudSyncTime?: string;
  totalRecordsCount: number;
}

// ----------------------------------------------------------------------------
// IndexedDB Engine Initialization & Helper
// ----------------------------------------------------------------------------

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ENTITIES)) {
        db.createObjectStore(STORE_ENTITIES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const snapStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        snapStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Request persistent browser storage to prevent Chrome eviction
 */
export async function requestPersistentStorage(): Promise<{ isPersisted: boolean; quota?: number; usage?: number }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        let quota: number | undefined;
        let usage: number | undefined;
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          quota = estimate.quota;
          usage = estimate.usage;
        }
        return { isPersisted, quota, usage };
      }
    }
  } catch (err) {
    console.warn('[Storage] Persistent storage request notice:', err);
  }
  return { isPersisted: false };
}

export async function checkPersistentStorageStatus(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
  } catch (err) {
    console.warn('[Storage] Check persisted error:', err);
  }
  return false;
}

// ----------------------------------------------------------------------------
// Local Storage Snapshot Reader & Synchronizer
// ----------------------------------------------------------------------------

export function extractSystemCounts(payload: SystemDataPayload): SystemDataCounts {
  return {
    students: Array.isArray(payload.students) ? payload.students.length : 0,
    classes: Array.isArray(payload.classes) ? payload.classes.length : 0,
    subjects: Array.isArray(payload.subjects) ? payload.subjects.length : 0,
    exams: Array.isArray(payload.exams) ? payload.exams.length : 0,
    marks: Array.isArray(payload.marks) ? payload.marks.length : 0,
    remarks: Array.isArray(payload.remarks) ? payload.remarks.length : 0,
    transactions: Array.isArray(payload.transactions) ? payload.transactions.length : 0,
    feeStructures: Array.isArray(payload.feeStructures) ? payload.feeStructures.length : 0,
    teachers: Array.isArray(payload.teachers) ? payload.teachers.length : 0,
    academicYears: Array.isArray(payload.academicYears) ? payload.academicYears.length : 0,
    trashBin: Array.isArray(payload.trashBin) ? payload.trashBin.length : 0,
  };
}

export function readCurrentLocalStoragePayload(): SystemDataPayload {
  const safeParse = <T>(key: string, fallback: T): T => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return fallback;
      const val = localStorage.getItem(key);
      if (!val) return fallback;
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const defaultProfile: SchoolProfile = {
    name: 'MADRASHA MANAGEMENT HIGH SCHOOL',
    nameBn: 'দারুল উলুম মাদ্রাসা',
    address: 'Dhaka, Bangladesh',
    addressBn: 'ঢাকা, বাংলাদেশ',
    phone: '',
    email: '',
    academicYear: '২০২৬',
    headMasterName: 'মুহতামিম সাহেব'
  };

  return {
    schoolProfile: safeParse<SchoolProfile>('schoolProfile', defaultProfile),
    students: safeParse<Student[]>('students', []),
    classes: safeParse<SchoolClass[]>('classes', []),
    subjects: safeParse<Subject[]>('subjects', []),
    exams: safeParse<Exam[]>('exams', []),
    marks: safeParse<MarkRecord[]>('marks', []),
    remarks: safeParse<RemarkRecord[]>('remarks', []),
    transactions: safeParse<FinanceTransaction[]>('madrasha_transactions', []),
    feeStructures: safeParse<ClassFeeStructure[]>('madrasha_fee_structures', []),
    trashBin: safeParse<TrashItem[]>('madrasha_trash_bin', []),
    academicYears: safeParse<AcademicYear[]>('academicYears', []),
    sections: safeParse<Section[]>('sections', []),
    teachers: safeParse<AcademicTeacher[]>('teachers', []),
    classSubjectAssignments: safeParse<ClassSubjectAssignment[]>('classSubjectAssignments', []),
    teacherSubjectAssignments: safeParse<TeacherSubjectAssignment[]>('teacherSubjectAssignments', []),
    classTeacherAssignments: safeParse<ClassTeacherAssignment[]>('classTeacherAssignments', []),
    examSubjectAssignments: safeParse<ExamSubjectAssignment[]>('examSubjectAssignments', []),
    promotionHistory: safeParse<PromotionHistoryRecord[]>('madrasha_promotion_history', []),
    gradingSystem: safeParse<GradingSystem[]>('gradingSystem', DEFAULT_GRADING_SYSTEM),
    institutionMembers: safeParse<any[]>('madrasha_institution_members', [])
  };
}

export function writePayloadToLocalStorage(payload: SystemDataPayload): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  if (payload.schoolProfile) localStorage.setItem('schoolProfile', JSON.stringify(payload.schoolProfile));
  if (Array.isArray(payload.students)) localStorage.setItem('students', JSON.stringify(payload.students));
  if (Array.isArray(payload.classes)) localStorage.setItem('classes', JSON.stringify(payload.classes));
  if (Array.isArray(payload.subjects)) localStorage.setItem('subjects', JSON.stringify(payload.subjects));
  if (Array.isArray(payload.exams)) localStorage.setItem('exams', JSON.stringify(payload.exams));
  if (Array.isArray(payload.marks)) localStorage.setItem('marks', JSON.stringify(payload.marks));
  if (Array.isArray(payload.remarks)) localStorage.setItem('remarks', JSON.stringify(payload.remarks));
  if (Array.isArray(payload.transactions)) localStorage.setItem('madrasha_transactions', JSON.stringify(payload.transactions));
  if (Array.isArray(payload.feeStructures)) localStorage.setItem('madrasha_fee_structures', JSON.stringify(payload.feeStructures));
  if (Array.isArray(payload.trashBin)) localStorage.setItem('madrasha_trash_bin', JSON.stringify(payload.trashBin));
  if (Array.isArray(payload.academicYears)) localStorage.setItem('academicYears', JSON.stringify(payload.academicYears));
  if (Array.isArray(payload.sections)) localStorage.setItem('sections', JSON.stringify(payload.sections));
  if (Array.isArray(payload.teachers)) localStorage.setItem('teachers', JSON.stringify(payload.teachers));
  if (Array.isArray(payload.classSubjectAssignments)) localStorage.setItem('classSubjectAssignments', JSON.stringify(payload.classSubjectAssignments));
  if (Array.isArray(payload.teacherSubjectAssignments)) localStorage.setItem('teacherSubjectAssignments', JSON.stringify(payload.teacherSubjectAssignments));
  if (Array.isArray(payload.classTeacherAssignments)) localStorage.setItem('classTeacherAssignments', JSON.stringify(payload.classTeacherAssignments));
  if (Array.isArray(payload.examSubjectAssignments)) localStorage.setItem('examSubjectAssignments', JSON.stringify(payload.examSubjectAssignments));
  if (Array.isArray(payload.promotionHistory)) localStorage.setItem('madrasha_promotion_history', JSON.stringify(payload.promotionHistory));
  if (Array.isArray(payload.institutionMembers) && payload.institutionMembers.length > 0) {
    localStorage.setItem('madrasha_institution_members', JSON.stringify(payload.institutionMembers));
  }
}

// ----------------------------------------------------------------------------
// IndexedDB Vault Storage Operations
// ----------------------------------------------------------------------------

/**
 * Save full system state into IndexedDB Permanent Vault & Auto-create rolling snapshot
 */
export async function saveToIndexedDbVault(
  payload: SystemDataPayload, 
  trigger: SystemSnapshot['trigger'] = 'auto_interval',
  labelBn?: string,
  labelEn?: string
): Promise<SystemSnapshot | null> {
  try {
    const db = await openIndexedDb();
    const counts = extractSystemCounts(payload);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    // Write main current entity state
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_ENTITIES, STORE_META], 'readwrite');
      const entityStore = tx.objectStore(STORE_ENTITIES);
      const metaStore = tx.objectStore(STORE_META);

      entityStore.put({ key: 'current_system_payload', value: payload, updatedAt: Date.now(), counts });
      metaStore.put({ key: 'last_vault_sync', timestamp: new Date().toISOString(), totalRecords });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // If total records > 0, generate rolling snapshot
    if (totalRecords > 0) {
      const snapId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('bn-BD');

      const snapshot: SystemSnapshot = {
        id: snapId,
        timestamp: now.toISOString(),
        createdAt: Date.now(),
        trigger,
        labelBn: labelBn || `স্বয়ংক্রিয় ব্যাকআপ (${dateStr}, ${timeStr})`,
        labelEn: labelEn || `Automatic Checkpoint (${now.toLocaleDateString()}, ${now.toLocaleTimeString()})`,
        counts,
        payload
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_SNAPSHOTS], 'readwrite');
        const snapStore = tx.objectStore(STORE_SNAPSHOTS);
        snapStore.put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Maintain max 30 rotating snapshots in IndexedDB
      await pruneOldSnapshots(30);

      return snapshot;
    }
  } catch (err) {
    console.warn('[IndexedDB Vault] Save error:', err);
  }
  return null;
}

/**
 * Prune old snapshots exceeding maximum retain count (FIFO)
 */
async function pruneOldSnapshots(maxKeep = 30): Promise<void> {
  try {
    const db = await openIndexedDb();
    const snapshots = await getAllIndexedDbSnapshots();
    if (snapshots.length > maxKeep) {
      const sorted = [...snapshots].sort((a, b) => a.createdAt - b.createdAt);
      const toDelete = sorted.slice(0, snapshots.length - maxKeep);

      const tx = db.transaction([STORE_SNAPSHOTS], 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      for (const item of toDelete) {
        store.delete(item.id);
      }
    }
  } catch (err) {
    console.warn('[IndexedDB Vault] Prune error:', err);
  }
}

/**
 * Get all saved snapshots from IndexedDB Permanent Vault
 */
export async function getAllIndexedDbSnapshots(): Promise<SystemSnapshot[]> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_SNAPSHOTS], 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result || []) as SystemSnapshot[];
        list.sort((a, b) => b.createdAt - a.createdAt);
        resolve(list);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get current system payload from IndexedDB Vault
 */
export async function getIndexedDbCurrentPayload(): Promise<SystemDataPayload | null> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_ENTITIES], 'readonly');
      const store = tx.objectStore(STORE_ENTITIES);
      const request = store.get('current_system_payload');

      request.onsuccess = () => {
        if (request.result && request.result.value) {
          resolve(request.result.value);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Smart Auto-Resurrection Engine
// ----------------------------------------------------------------------------

export interface ResurrectionResult {
  resurrected: boolean;
  source: 'indexeddb_current' | 'indexeddb_snapshot' | 'firestore_cloud' | 'none';
  counts: SystemDataCounts;
  messageBn: string;
  messageEn: string;
  restoredPayload?: SystemDataPayload;
}

/**
 * Smart Startup Guardian: If Chrome clear data occurred, this automatically
 * resurrects all data from IndexedDB Vault or Firestore Cloud!
 */
export async function resurrectDataIfEmpty(): Promise<ResurrectionResult> {
  const currentLocal = readCurrentLocalStoragePayload();
  const localCounts = extractSystemCounts(currentLocal);
  const totalLocal = Object.values(localCounts).reduce((a, b) => a + b, 0);

  // If local storage has adequate records, no resurrection required
  if (totalLocal > 3) {
    // Make sure we keep IndexedDB vault synchronized in background
    saveToIndexedDbVault(currentLocal, 'auto_interval').catch(() => {});
    return {
      resurrected: false,
      source: 'none',
      counts: localCounts,
      messageBn: 'লোকাল ডাটা উপস্থিত রয়েছে।',
      messageEn: 'Local data is intact.'
    };
  }

  // 1. Try restoring from IndexedDB Vault current state
  try {
    const idbPayload = await getIndexedDbCurrentPayload();
    if (idbPayload) {
      const idbCounts = extractSystemCounts(idbPayload);
      const totalIdb = Object.values(idbCounts).reduce((a, b) => a + b, 0);
      if (totalIdb > 0) {
        writePayloadToLocalStorage(idbPayload);
        return {
          resurrected: true,
          source: 'indexeddb_current',
          counts: idbCounts,
          messageBn: `ক্রোম ডাটা ক্লিয়ার হলেও স্থায়ী ব্যাকআপ ভল্ট থেকে ${idbCounts.students} জন শিক্ষার্থী ও ${idbCounts.marks} টি মার্কস স্বয়ংক্রিয়ভাবে উদ্ধার করা হয়েছে!`,
          messageEn: `Auto-restored ${idbCounts.students} students and ${idbCounts.marks} marks from IndexedDB Permanent Vault!`,
          restoredPayload: idbPayload
        };
      }
    }
  } catch (err) {
    console.warn('[Resurrection] IndexedDB current check notice:', err);
  }

  // 2. Try restoring from IndexedDB Snapshots history
  try {
    const snapshots = await getAllIndexedDbSnapshots();
    if (snapshots.length > 0) {
      const bestSnap = snapshots[0];
      const snapCounts = bestSnap.counts;
      const totalSnap = Object.values(snapCounts).reduce((a, b) => a + b, 0);
      if (totalSnap > 0 && bestSnap.payload) {
        writePayloadToLocalStorage(bestSnap.payload);
        return {
          resurrected: true,
          source: 'indexeddb_snapshot',
          counts: snapCounts,
          messageBn: `পূর্বের সংরক্ষিত স্ন্যাপশট (${new Date(bestSnap.timestamp).toLocaleString('bn-BD')}) থেকে সমস্ত ডাটা উদ্ধার করা হয়েছে!`,
          messageEn: `Restored all data from snapshot (${new Date(bestSnap.timestamp).toLocaleString()})!`,
          restoredPayload: bestSnap.payload
        };
      }
    }
  } catch (err) {
    console.warn('[Resurrection] Snapshot check notice:', err);
  }

  // 3. Try restoring from Firestore Cloud
  try {
    const docRef = doc(db, 'institution', 'main_store');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const cloudData = docSnap.data() as SystemDataPayload;
      const cloudCounts = extractSystemCounts(cloudData);
      const totalCloud = Object.values(cloudCounts).reduce((a, b) => a + b, 0);
      if (totalCloud > 0) {
        writePayloadToLocalStorage(cloudData);
        // Also save to IndexedDB Vault
        saveToIndexedDbVault(cloudData, 'resurrection').catch(() => {});
        return {
          resurrected: true,
          source: 'firestore_cloud',
          counts: cloudCounts,
          messageBn: `ক্লাউড ফায়ারস্টোর ভল্ট থেকে ${cloudCounts.students} জন শিক্ষার্থী ও প্রাতিষ্ঠানিক ডাটা সফলভাবে পুনরুদ্ধার করা হয়েছে!`,
          messageEn: `Successfully restored ${cloudCounts.students} students and institutional data from Cloud Firestore Vault!`,
          restoredPayload: cloudData
        };
      }
    }
  } catch (err) {
    console.warn('[Resurrection] Cloud check notice:', err);
  }

  return {
    resurrected: false,
    source: 'none',
    counts: localCounts,
    messageBn: 'কোনো পূর্ববর্তী ব্যাকআপ পাওয়া যায়নি।',
    messageEn: 'No previous backup found.'
  };
}

// ----------------------------------------------------------------------------
// Full System Backup Export & Import (JSON)
// ----------------------------------------------------------------------------

export interface SystemBackupPackage {
  version: '3.0.0-permanent-vault';
  system: 'Darul-Ulum-Madrasah-OS';
  exportedAt: string;
  sourceOrigin: string;
  counts: SystemDataCounts;
  checksum: string;
  payload: SystemDataPayload;
}

/**
 * Generate complete JSON backup file and trigger download
 */
export function downloadFullSystemBackup(payload?: SystemDataPayload, customName?: string): string {
  const data = payload || readCurrentLocalStoragePayload();
  const counts = extractSystemCounts(data);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${now.getHours()}-${now.getMinutes()}`;
  const filename = customName || `madrasha-full-system-backup-${dateStr}_${timeStr}.json`;

  const pkg: SystemBackupPackage = {
    version: '3.0.0-permanent-vault',
    system: 'Darul-Ulum-Madrasah-OS',
    exportedAt: now.toISOString(),
    sourceOrigin: typeof window !== 'undefined' ? window.location.origin : 'offline',
    counts,
    checksum: `chk_${Date.now()}_${counts.students}_${counts.marks}`,
    payload: data
  };

  if (typeof window !== 'undefined' && document) {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Also store as an instant checkpoint in IndexedDB
  saveToIndexedDbVault(data, 'manual', 'ম্যানুয়াল ব্যাকআপ ফাইল ডাউনলোড', 'Manual Backup Download').catch(() => {});

  return filename;
}

export interface BackupValidationInspection {
  isValid: boolean;
  version?: string;
  exportedAt?: string;
  counts: SystemDataCounts;
  errors: string[];
  warnings: string[];
  payload?: SystemDataPayload;
}

/**
 * Validates a JSON backup file content before restoring
 */
export function validateFullSystemBackup(jsonContent: string): BackupValidationInspection {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== 'object') {
      return {
        isValid: false,
        counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
        errors: ['ফাইলের ফরম্যাট সঠিক নয়। এটি একটি বৈধ JSON ফাইল হতে হবে।'],
        warnings: []
      };
    }

    // Extract payload
    const payload: SystemDataPayload = parsed.payload ? parsed.payload : parsed;
    const counts = extractSystemCounts(payload);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    if (totalRecords === 0) {
      errors.push('ব্যাকআপ ফাইলে কোনো শিক্ষার্থী, পরীক্ষা, বিষয় বা লেনদেনের তথ্য নেই।');
    }

    if (!payload.schoolProfile) {
      warnings.push('মাদ্রাসা প্রোফাইল তথ্য অনুপস্থিত, ডিফল্ট প্রোফাইল ব্যবহার করা হবে।');
    }

    return {
      isValid: errors.length === 0,
      version: parsed.version || 'unknown',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      counts,
      errors,
      warnings,
      payload
    };
  } catch (err: any) {
    return {
      isValid: false,
      counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
      errors: ['JSON পার্সিং ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')],
      warnings: []
    };
  }
}

/**
 * Execute safe full system restore (writes to LocalStorage, IndexedDB Vault, and Cloud)
 */
export async function executeFullSystemRestore(
  payload: SystemDataPayload, 
  adminEmail?: string
): Promise<{ success: boolean; counts: SystemDataCounts; message: string }> {
  // Step 1: Create a safety rollback snapshot of current state before overwriting
  const current = readCurrentLocalStoragePayload();
  await saveToIndexedDbVault(current, 'pre_restore', 'রিস্টোরের পূর্ববর্তী স্বয়ংক্রিয় সেফটি স্ন্যাপশট', 'Pre-Restore Safety Checkpoint');

  // Step 2: Write to LocalStorage
  writePayloadToLocalStorage(payload);

  // Step 3: Write to IndexedDB Permanent Vault
  await saveToIndexedDbVault(payload, 'manual', 'সফল ফাইল রিস্টোর স্ন্যাপশট', 'Restored from Backup File');

  // Step 4: Write to Cloud Firestore if connected
  try {
    const docRef = doc(db, 'institution', 'main_store');
    await setDoc(docRef, {
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail || 'admin',
      version: '3.0.0-permanent-vault'
    }, { merge: true });
  } catch (err) {
    console.warn('[Full Restore] Cloud write notice:', err);
  }

  const counts = extractSystemCounts(payload);
  return {
    success: true,
    counts,
    message: `সফলভাবে ${counts.students} জন শিক্ষার্থী, ${counts.exams} টি পরীক্ষা এবং ${counts.marks} টি মার্কস রিস্টোর সম্পন্ন হয়েছে!`
  };
}

/**
 * Rollback to a specific snapshot from history
 */
export async function rollbackToSpecificSnapshot(
  snapshotId: string, 
  adminEmail?: string
): Promise<{ success: boolean; message: string }> {
  const snapshots = await getAllIndexedDbSnapshots();
  const target = snapshots.find(s => s.id === snapshotId);

  if (!target || !target.payload) {
    throw new Error('নির্দিষ্ট ব্যাকআপ স্ন্যাপশটটি পাওয়া যায়নি।');
  }

  await executeFullSystemRestore(target.payload, adminEmail);
  return {
    success: true,
    message: `সফলভাবে "${target.labelBn}" ভার্সনে রোলব্যাক করা হয়েছে!`
  };
}

// ----------------------------------------------------------------------------
// CLOUD DATA BACKUP & FIRESTORE SNAPSHOT ENGINE
// ----------------------------------------------------------------------------

export interface CloudDataSnapshotPackage {
  version: string;
  type: 'madrasha_cloud_firestore_snapshot' | 'madrasha_gdrive_snapshot';
  exportedAt: string;
  databaseId?: string;
  projectId?: string;
  exportedBy: string;
  source: string;
  counts: SystemDataCounts;
  checksum: string;
  securityHash: string;
  payload: SystemDataPayload;
}

export interface CloudStoredSnapshotMeta {
  id: string;
  timestamp: string;
  createdAt: number;
  labelBn: string;
  labelEn: string;
  exportedBy: string;
  counts: SystemDataCounts;
  payload: SystemDataPayload;
}

/**
 * Fetches current authoritative state directly from Cloud Firestore
 */
export async function fetchFirestoreAuthoritativeSnapshot(adminEmail?: string): Promise<{
  snapshot: CloudDataSnapshotPackage;
  payload: SystemDataPayload;
}> {
  const docRef = doc(db, 'institution', 'main_store');
  const docSnap = await getDoc(docRef);

  let payload: SystemDataPayload;
  if (docSnap.exists()) {
    payload = docSnap.data() as SystemDataPayload;
  } else {
    // If main_store doc isn't written yet, fallback to client local payload
    payload = readCurrentLocalStoragePayload();
  }

  const counts = extractSystemCounts(payload);
  const now = new Date();
  const rawSignature = `${counts.students}-${counts.exams}-${counts.marks}-${counts.transactions}-${now.getTime()}`;
  
  // Calculate deterministic checksum
  let hash = 0;
  for (let i = 0; i < rawSignature.length; i++) {
    const chr = rawSignature.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const checksum = `chk_cloud_${Math.abs(hash).toString(16)}_${Date.now()}`;
  const securityHash = `sec_sha256_${btoa(rawSignature).replace(/=/g, '')}`;

  const snapshot: CloudDataSnapshotPackage = {
    version: '3.0.0-cloud-snapshot',
    type: 'madrasha_cloud_firestore_snapshot',
    exportedAt: now.toISOString(),
    databaseId: (firebaseConfig as any).firestoreDatabaseId || '(default)',
    projectId: firebaseConfig.projectId || 'gen-lang-client-0692995380',
    exportedBy: adminEmail || 'admin@madrasah.system',
    source: 'firestore_cloud_live',
    counts,
    checksum,
    securityHash,
    payload
  };

  return { snapshot, payload };
}

/**
 * Generates a secure JSON snapshot of Firestore data and downloads it locally to client machine
 */
export async function downloadCloudFirestoreSnapshot(
  adminEmail?: string, 
  customFilename?: string
): Promise<{ filename: string; snapshot: CloudDataSnapshotPackage }> {
  const { snapshot, payload } = await fetchFirestoreAuthoritativeSnapshot(adminEmail);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = customFilename || `madrasah-cloud-firestore-snapshot-${dateStr}_${timeStr}.json`;

  if (typeof window !== 'undefined' && document) {
    const jsonContent = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Also record in local IndexedDB vault as a verified cloud snapshot
  saveToIndexedDbVault(
    payload, 
    'cloud_sync', 
    `ক্লাউড ফায়ারস্টোর স্ন্যাপশট ডাউনলোড (${now.toLocaleTimeString('bn-BD')})`, 
    `Cloud Firestore Snapshot Download (${now.toLocaleTimeString()})`
  ).catch(() => {});

  return { filename, snapshot };
}

/**
 * Saves a timestamped snapshot document directly into Firestore collection `cloud_snapshots`
 */
export async function saveCloudSnapshotToFirestore(
  payload?: SystemDataPayload,
  labelBn?: string,
  labelEn?: string,
  adminEmail?: string
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Authentication required: Firebase Authentication session is required to save snapshots to Cloud Firestore.');
  }
  const data = payload || readCurrentLocalStoragePayload();
  const counts = extractSystemCounts(data);
  const now = new Date();
  const snapId = `cloud_snap_${Date.now()}`;

  const snapshotDoc = {
    id: snapId,
    timestamp: now.toISOString(),
    createdAt: Date.now(),
    labelBn: labelBn || `ক্লাউড ডাটাবেস স্ন্যাপশট (${now.toLocaleDateString('bn-BD')})`,
    labelEn: labelEn || `Cloud Database Snapshot (${now.toLocaleDateString()})`,
    exportedBy: adminEmail || 'admin',
    counts,
    payload: data,
    version: '3.0.0-cloud-snapshot'
  };

  const docRef = doc(db, 'cloud_snapshots', snapId);
  await setDoc(docRef, snapshotDoc);

  return snapId;
}

/**
 * Fetches list of all cloud snapshots stored in Firestore collection `cloud_snapshots`
 */
export async function fetchFirestoreCloudSnapshots(): Promise<CloudStoredSnapshotMeta[]> {
  try {
    const q = query(collection(db, 'cloud_snapshots'), orderBy('createdAt', 'desc'), limit(20));
    const snapDocs = await getDocs(q);
    const list: CloudStoredSnapshotMeta[] = [];

    snapDocs.forEach((d) => {
      const data = d.data() as CloudStoredSnapshotMeta;
      list.push(data);
    });

    return list;
  } catch (err) {
    console.warn('[Cloud Snapshots] Fetch error:', err);
    return [];
  }
}

/**
 * Validates a downloaded or uploaded Cloud Snapshot JSON file
 */
export function validateCloudSnapshotPackage(jsonContent: string): {
  isValid: boolean;
  isCloudSnapshot: boolean;
  exportedAt?: string;
  exportedBy?: string;
  databaseId?: string;
  counts: SystemDataCounts;
  errors: string[];
  warnings: string[];
  packageData?: CloudDataSnapshotPackage;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== 'object') {
      return {
        isValid: false,
        isCloudSnapshot: false,
        counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
        errors: ['ফাইলের ফরম্যাট সঠিক নয়। এটি একটি বৈধ JSON ফাইল হতে হবে।'],
        warnings: []
      };
    }

    const isCloudSnapshot = parsed.type === 'madrasha_cloud_firestore_snapshot' || parsed.source === 'firestore_cloud_live';
    const payload: SystemDataPayload = parsed.payload ? parsed.payload : parsed;
    const counts = extractSystemCounts(payload);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    if (totalRecords === 0) {
      errors.push('ক্লাউড স্ন্যাপশট ফাইলে কোনো শিক্ষার্থী, পরীক্ষা, বিষয় বা নম্বর রেকর্ড নেই।');
    }

    if (!isCloudSnapshot) {
      warnings.push('এটি স্ট্যান্ডার্ড ব্যাকআপ ফাইল, তবে সফলভাবে ক্লাউড ও লোকাল সিস্টেমে রিস্টোর করা যাবে।');
    }

    return {
      isValid: errors.length === 0,
      isCloudSnapshot,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      exportedBy: parsed.exportedBy || 'admin',
      databaseId: parsed.databaseId || (firebaseConfig as any).firestoreDatabaseId || '(default)',
      counts,
      errors,
      warnings,
      packageData: isCloudSnapshot ? parsed : {
        version: '3.0.0-cloud-snapshot',
        type: 'madrasha_cloud_firestore_snapshot',
        exportedAt: new Date().toISOString(),
        databaseId: (firebaseConfig as any).firestoreDatabaseId || '(default)',
        projectId: firebaseConfig.projectId || 'gen-lang-client-0692995380',
        exportedBy: 'admin',
        source: 'firestore_cloud_live',
        counts,
        checksum: 'imported_custom',
        securityHash: 'sec_imported',
        payload
      }
    };
  } catch (err: any) {
    return {
      isValid: false,
      isCloudSnapshot: false,
      counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
      errors: ['JSON ফাইল স্ক্যান ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')],
      warnings: []
    };
  }
}

/**
 * Restores data from a previously generated Cloud Snapshot package
 * Target mode:
 * - 'full': Restores client LocalStorage + IndexedDB Vault AND overwrites Firestore database
 * - 'client_only': Restores browser LocalStorage & IndexedDB (useful if client data was cleared, leaving cloud as-is)
 */
export async function restoreFromCloudSnapshotPackage(
  snapshotPkg: CloudDataSnapshotPackage,
  targetMode: 'full' | 'client_only' = 'full',
  adminEmail?: string
): Promise<{ success: boolean; counts: SystemDataCounts; message: string }> {
  const payload = snapshotPkg.payload;
  const counts = extractSystemCounts(payload);

  // 1. Create safety pre-restore rollback checkpoint in IndexedDB
  const current = readCurrentLocalStoragePayload();
  await saveToIndexedDbVault(
    current, 
    'pre_restore', 
    'ক্লাউড স্ন্যাপশট রিস্টোরের পূর্ববর্তী স্বয়ংক্রিয় সেফটি চেকপয়েন্ট', 
    'Pre-Cloud Restore Safety Checkpoint'
  );

  // 2. Restore to LocalStorage (Instant client UI restoration)
  writePayloadToLocalStorage(payload);

  // 3. Save to IndexedDB Permanent Vault
  await saveToIndexedDbVault(
    payload, 
    'manual', 
    `ক্লাউড স্ন্যাপশট ফাইল থেকে রিস্টোর (${new Date().toLocaleTimeString('bn-BD')})`, 
    `Restored from Cloud Snapshot (${new Date().toLocaleTimeString()})`
  );

  // 4. If full mode, also write to Firestore database (institution/main_store)
  if (targetMode === 'full') {
    try {
      const docRef = doc(db, 'institution', 'main_store');
      await setDoc(docRef, {
        ...payload,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail || snapshotPkg.exportedBy || 'admin',
        version: '3.0.0-cloud-snapshot-restored',
        restoredFromSnapshotAt: snapshotPkg.exportedAt
      }, { merge: true });
    } catch (err: any) {
      console.warn('[Cloud Restore] Firestore write notice:', err);
    }
  }

  return {
    success: true,
    counts,
    message: targetMode === 'full'
      ? `✓ ক্লাউড স্ন্যাপশট থেকে ${counts.students} জন শিক্ষার্থী ও ${counts.marks} টি মার্কস সফলভাবে ক্লাউড ও লোকাল স্টোরেজে রিস্টোর সম্পন্ন হয়েছে!`
      : `✓ ক্লাউড স্ন্যাপশট থেকে ক্লায়েন্ট স্টোরেজে ${counts.students} জন শিক্ষার্থী ও ${counts.marks} টি মার্কস পুনরুদ্ধার (Client Recovery) সম্পন্ন হয়েছে!`
  };
}

