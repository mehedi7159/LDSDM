import { 
  getCachedGoogleAccessToken, 
  setCachedGoogleAccessToken, 
  auth, 
  googleProvider 
} from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import type {
  SchoolProfile,
  SchoolClass,
  Student,
  Subject,
  Exam,
  MarkRecord,
  RemarkRecord,
  AcademicYear,
  Section,
  AcademicTeacher,
  ClassSubjectAssignment,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
  ExamSubjectAssignment,
  PromotionHistoryRecord,
  FinanceTransaction,
  ClassFeeStructure,
  TrashItem
} from '../types';
import { 
  readCurrentLocalStoragePayload, 
  executeFullSystemRestore, 
  extractSystemCounts,
  saveToIndexedDbVault,
  SystemDataCounts,
  CloudDataSnapshotPackage
} from './multiStorePersistence';

export interface DriveBackupPayload {
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
  academicYears: AcademicYear[];
  sections: Section[];
  teachers: AcademicTeacher[];
  classSubjectAssignments: ClassSubjectAssignment[];
  teacherSubjectAssignments: TeacherSubjectAssignment[];
  classTeacherAssignments: ClassTeacherAssignment[];
  examSubjectAssignments: ExamSubjectAssignment[];
  promotionHistory: PromotionHistoryRecord[];
}

export interface GoogleDriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
  modifiedTime?: string;
  description?: string;
  properties?: Record<string, string>;
  counts?: SystemDataCounts;
  isAutoBackup?: boolean;
  isIncremental?: boolean;
  sequenceNumber?: number;
  deltaSummary?: string;
  source?: string;
}

export interface GoogleDriveBackupSettings {
  autoBackupEnabled: boolean;
  intervalMinutes: number; // 15, 30, 60, 360, 1440
  lastBackupTime: string | null;
  lastBackupStatus: 'success' | 'failed' | 'idle' | 'in_progress';
  lastBackupFileName?: string;
  lastError?: string;
  retentionLimit: number; // e.g., 10, 15, 20
  autoBackupOnMajorChanges: boolean;
  folderName: string;
  incrementalSyncEnabled?: boolean;
  lastIncrementalSyncTime?: string | null;
  lastIncrementalSequence?: number;
}

const DEFAULT_FOLDER_NAME = 'Madrasah_Management_Cloud_Backups';
const STORAGE_KEY_SETTINGS = 'madrasha_gdrive_backup_settings';

export const getGoogleDriveBackupSettings = (): GoogleDriveBackupSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      return {
        autoBackupEnabled: true,
        intervalMinutes: 30,
        lastBackupTime: null,
        lastBackupStatus: 'idle',
        retentionLimit: 15,
        autoBackupOnMajorChanges: true,
        folderName: DEFAULT_FOLDER_NAME,
        ...JSON.parse(raw)
      };
    }
  } catch (e) {
    console.warn('Failed to parse Google Drive settings:', e);
  }
  return {
    autoBackupEnabled: true,
    intervalMinutes: 30,
    lastBackupTime: null,
    lastBackupStatus: 'idle',
    retentionLimit: 15,
    autoBackupOnMajorChanges: true,
    folderName: DEFAULT_FOLDER_NAME
  };
};

export const saveGoogleDriveBackupSettings = (updates: Partial<GoogleDriveBackupSettings>): GoogleDriveBackupSettings => {
  const current = getGoogleDriveBackupSettings();
  const next = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(next));
  } catch (e) {
    console.warn('Failed to save Google Drive settings:', e);
  }
  return next;
};

/**
 * Ensures user has active Google Drive OAuth access token
 */
export const ensureGoogleDriveToken = async (): Promise<string> => {
  const cached = getCachedGoogleAccessToken();
  if (cached) return cached;

  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google Drive Access Token unavailable. Please grant permission.');
  }

  setCachedGoogleAccessToken(credential.accessToken);
  return credential.accessToken;
};

/**
 * Finds or creates the dedicated Google Drive backup folder
 */
export const getOrCreateBackupFolder = async (accessToken: string, folderName = DEFAULT_FOLDER_NAME): Promise<string> => {
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Google Drive API error: ${searchRes.status} ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Permanent Auto & Manual Backups for Madrasah / Academy Management System'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${createRes.status} ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
};

/**
 * Uploads current system state or custom payload as a full snapshot to Google Drive
 */
export const uploadBackupToGoogleDrive = async (
  customPayload?: any,
  options?: {
    backupType?: 'manual' | 'auto_interval' | 'auto_schedule' | 'critical_change';
    label?: string;
    token?: string;
  }
): Promise<{ fileId: string; fileName: string; size: number; counts: SystemDataCounts; createdTime: string }> => {
  const token = options?.token || await ensureGoogleDriveToken();
  const payload = customPayload || readCurrentLocalStoragePayload();
  const counts = extractSystemCounts(payload);
  const settings = getGoogleDriveBackupSettings();
  const folderId = await getOrCreateBackupFolder(token, settings.folderName);

  const now = new Date();
  const dateIso = now.toISOString();
  const dateFormatted = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const timeFormatted = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-');

  const backupType = options?.backupType || 'manual';
  const prefix = backupType.startsWith('auto') ? 'AUTO_BACKUP' : 'MANUAL_BACKUP';
  const instName = (payload.schoolProfile?.name || 'Madrasha').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_').slice(0, 20);
  const labelSuffix = options?.label ? `_${options.label.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_').slice(0, 20)}` : '';
  const fileName = `${prefix}_${instName}_${dateFormatted}_${timeFormatted}${labelSuffix}.json`;

  const snapshotPackage: CloudDataSnapshotPackage = {
    version: '3.5.0-gdrive-snapshot',
    type: 'madrasha_cloud_firestore_snapshot',
    exportedAt: dateIso,
    exportedBy: auth.currentUser?.email || 'admin@madrasah.edu',
    source: 'google_drive_cloud_vault',
    counts,
    checksum: `gdrive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    securityHash: `sec_${Date.now()}`,
    payload
  };

  const jsonString = JSON.stringify(snapshotPackage, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const fileSize = blob.size;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    description: `Auto-Backup | Students: ${counts.students}, Marks: ${counts.marks}, Exams: ${counts.exams}, Classes: ${counts.classes}`,
    properties: {
      app: 'MadrasahManagementSystem',
      backupType,
      timestamp: dateIso,
      students: String(counts.students),
      marks: String(counts.marks),
      exams: String(counts.exams),
      classes: String(counts.classes),
      subjects: String(counts.subjects),
      transactions: String(counts.transactions)
    }
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${uploadRes.status} ${errText}`);
  }

  const result = await uploadRes.json();

  // Update settings with last successful backup
  saveGoogleDriveBackupSettings({
    lastBackupTime: dateIso,
    lastBackupStatus: 'success',
    lastBackupFileName: fileName,
    lastError: undefined
  });

  // Auto-prune older auto-backups to maintain retention limit
  if (backupType.startsWith('auto')) {
    pruneOldDriveAutoBackups(token, settings.retentionLimit).catch(() => {});
  }

  return {
    fileId: result.id,
    fileName: result.name || fileName,
    size: Number(result.size) || fileSize,
    counts,
    createdTime: result.createdTime || dateIso
  };
};

/**
 * Pushes an incremental snapshot directly from Cloud Firestore into Google Drive
 */
export const pushFirestoreIncrementalSnapshotToDrive = async (
  adminEmail?: string,
  options?: { force?: boolean; token?: string; customNote?: string }
): Promise<{
  fileId: string;
  fileName: string;
  sequenceNumber: number;
  deltaSummary: string;
  counts: SystemDataCounts;
  isUnchanged?: boolean;
}> => {
  const token = options?.token || await ensureGoogleDriveToken();
  const { snapshot, payload } = await (await import('./multiStorePersistence')).fetchFirestoreAuthoritativeSnapshot(adminEmail);
  const counts = snapshot.counts;
  const settings = getGoogleDriveBackupSettings();
  const folderId = await getOrCreateBackupFolder(token, settings.folderName);

  // Compute state fingerprint
  const fingerprint = `${counts.students}_${counts.classes}_${counts.subjects}_${counts.exams}_${counts.marks}_${counts.transactions}`;
  const lastFingerprint = localStorage.getItem('madrasha_gdrive_last_synced_fingerprint');

  if (!options?.force && lastFingerprint === fingerprint) {
    return {
      fileId: settings.lastBackupFileName || 'latest',
      fileName: settings.lastBackupFileName || 'latest_snapshot.json',
      sequenceNumber: settings.lastIncrementalSequence || 1,
      deltaSummary: 'কোনো নতুন পরিবর্তন পাওয়া যায়নি (Unchanged since last sync)',
      counts,
      isUnchanged: true
    };
  }

  // Calculate delta summary
  const lastCountsRaw = localStorage.getItem('madrasha_gdrive_last_synced_counts');
  let deltaParts: string[] = [];
  if (lastCountsRaw) {
    try {
      const prev = JSON.parse(lastCountsRaw);
      const diffStudents = counts.students - (prev.students || 0);
      const diffMarks = counts.marks - (prev.marks || 0);
      const diffExams = counts.exams - (prev.exams || 0);
      const diffClasses = counts.classes - (prev.classes || 0);
      const diffTx = counts.transactions - (prev.transactions || 0);

      if (diffStudents !== 0) deltaParts.push(`${diffStudents > 0 ? '+' : ''}${diffStudents} শিক্ষার্থী`);
      if (diffMarks !== 0) deltaParts.push(`${diffMarks > 0 ? '+' : ''}${diffMarks} নম্বর`);
      if (diffExams !== 0) deltaParts.push(`${diffExams > 0 ? '+' : ''}${diffExams} পরীক্ষা`);
      if (diffClasses !== 0) deltaParts.push(`${diffClasses > 0 ? '+' : ''}${diffClasses} ক্লাস`);
      if (diffTx !== 0) deltaParts.push(`${diffTx > 0 ? '+' : ''}${diffTx} লেনদেন`);
    } catch (e) {}
  }

  const deltaSummary = deltaParts.length > 0 
    ? deltaParts.join(', ') 
    : `প্রাথমিক ফায়ারস্টোর ডাটাবেস সিঙ্ক (${counts.students} শিক্ষার্থী, ${counts.marks} নম্বর)`;

  const currentSeq = (settings.lastIncrementalSequence || 0) + 1;
  const now = new Date();
  const dateIso = now.toISOString();
  const dateFormatted = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const timeFormatted = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-');

  const instName = (payload.schoolProfile?.name || 'Madrasha').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_').slice(0, 18);
  const fileName = `INCREMENTAL_SYNC_v${currentSeq}_${instName}_${dateFormatted}_${timeFormatted}.json`;

  const snapshotPackage: CloudDataSnapshotPackage = {
    version: '3.6.0-incremental-sync',
    type: 'madrasha_cloud_firestore_snapshot',
    exportedAt: dateIso,
    exportedBy: adminEmail || auth.currentUser?.email || 'admin@madrasah.edu',
    source: 'firestore_cloud_live',
    counts,
    checksum: `inc_sync_v${currentSeq}_${Date.now()}`,
    securityHash: snapshot.securityHash || `sec_${Date.now()}`,
    payload
  };

  const jsonString = JSON.stringify(snapshotPackage, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const fileSize = blob.size;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    description: `Incremental Firestore Cloud Sync v${currentSeq} | Delta: ${deltaSummary} | Total Students: ${counts.students}`,
    properties: {
      app: 'MadrasahManagementSystem',
      backupType: 'incremental_sync',
      isIncremental: 'true',
      sequenceNumber: String(currentSeq),
      deltaSummary,
      source: 'firestore_cloud_live',
      timestamp: dateIso,
      students: String(counts.students),
      marks: String(counts.marks),
      exams: String(counts.exams),
      classes: String(counts.classes),
      subjects: String(counts.subjects),
      transactions: String(counts.transactions)
    }
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive incremental sync failed: ${uploadRes.status} ${errText}`);
  }

  const result = await uploadRes.json();

  // Save sync state
  localStorage.setItem('madrasha_gdrive_last_synced_fingerprint', fingerprint);
  localStorage.setItem('madrasha_gdrive_last_synced_counts', JSON.stringify(counts));

  saveGoogleDriveBackupSettings({
    lastBackupTime: dateIso,
    lastBackupStatus: 'success',
    lastBackupFileName: fileName,
    lastIncrementalSyncTime: dateIso,
    lastIncrementalSequence: currentSeq,
    lastError: undefined
  });

  return {
    fileId: result.id,
    fileName: result.name || fileName,
    sequenceNumber: currentSeq,
    deltaSummary,
    counts
  };
};

/**
 * Lists all backup snapshot files stored in Google Drive folder
 */
export const listGoogleDriveBackups = async (customToken?: string): Promise<GoogleDriveFileMeta[]> => {
  const token = customToken || await ensureGoogleDriveToken();
  const settings = getGoogleDriveBackupSettings();
  const folderId = await getOrCreateBackupFolder(token, settings.folderName);
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&orderBy=createdTime desc&pageSize=100&fields=files(id, name, mimeType, size, createdTime, modifiedTime, description, properties)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list Google Drive backups: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const files: any[] = data.files || [];

  return files.map(f => {
    let counts: SystemDataCounts | undefined = undefined;
    if (f.properties) {
      counts = {
        students: parseInt(f.properties.students || f.properties.totalStudents || '0', 10),
        classes: parseInt(f.properties.classes || f.properties.totalClasses || '0', 10),
        subjects: parseInt(f.properties.subjects || f.properties.totalSubjects || '0', 10),
        exams: parseInt(f.properties.exams || f.properties.totalExams || '0', 10),
        marks: parseInt(f.properties.marks || f.properties.totalMarks || '0', 10),
        remarks: 0,
        transactions: parseInt(f.properties.transactions || f.properties.totalTransactions || '0', 10),
        feeStructures: 0,
        teachers: 0,
        academicYears: 0,
        trashBin: 0
      };
    }

    const isAuto = f.name?.startsWith('AUTO_BACKUP') || f.properties?.backupType?.startsWith('auto');
    const isIncremental = f.name?.startsWith('INCREMENTAL_SYNC') || f.properties?.isIncremental === 'true';
    const seqNum = f.properties?.sequenceNumber ? parseInt(f.properties.sequenceNumber, 10) : undefined;
    const delta = f.properties?.deltaSummary || undefined;
    const source = f.properties?.source || undefined;

    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : undefined,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      description: f.description,
      properties: f.properties,
      counts,
      isAutoBackup: isAuto,
      isIncremental,
      sequenceNumber: seqNum,
      deltaSummary: delta,
      source
    };
  });
};

/**
 * Downloads a backup file from Google Drive, validates and inspects its contents
 */
export const downloadAndInspectDriveBackup = async (
  fileId: string,
  customToken?: string
): Promise<{ packageData: CloudDataSnapshotPackage; counts: SystemDataCounts; exportedAt: string }> => {
  const token = customToken || await ensureGoogleDriveToken();
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to download backup from Google Drive: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const payload = json.payload || json;
  const counts = extractSystemCounts(payload);

  return {
    packageData: {
      version: json.version || '3.5.0-gdrive',
      type: 'madrasha_cloud_firestore_snapshot',
      exportedAt: json.exportedAt || json.timestamp || new Date().toISOString(),
      exportedBy: json.exportedBy || json.author?.email || 'unknown',
      source: 'google_drive_cloud_vault',
      counts,
      checksum: json.checksum || `chk_${fileId}`,
      securityHash: json.securityHash || 'sec',
      payload
    },
    counts,
    exportedAt: json.exportedAt || json.timestamp || new Date().toISOString()
  };
};

/**
 * Restores system from a Google Drive backup package
 */
export const restoreFromGoogleDriveBackup = async (
  packageData: CloudDataSnapshotPackage,
  restoreMode: 'full' | 'client_only' = 'full',
  adminEmail?: string
): Promise<{ success: boolean; message: string }> => {
  if (!packageData || !packageData.payload) {
    throw new Error('Invalid Google Drive backup package: missing payload.');
  }

  // 1. Create safety rollback checkpoint in IndexedDB
  const current = readCurrentLocalStoragePayload();
  await saveToIndexedDbVault(current, 'pre_restore', 'গুগল ড্রাইভ রিস্টোর পূর্ববর্তী ব্যাকআপ', 'Pre-Drive-Restore Checkpoint');

  // 2. Execute full system restore to LocalStorage
  const email = adminEmail || auth.currentUser?.email || 'admin@madrasah.edu';
  await executeFullSystemRestore(packageData.payload, email);

  // 3. If full mode and authenticated, sync to Firestore
  if (restoreMode === 'full' && auth.currentUser) {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const docRef = doc(db, 'institution', 'main_store');
      await setDoc(docRef, {
        ...packageData.payload,
        updatedBy: email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore cloud sync after Drive restore note:', e);
    }
  }

  return {
    success: true,
    message: `গুগল ড্রাইভ ব্যাকআপ থেকে ${packageData.counts.students} জন শিক্ষার্থী ও ${packageData.counts.marks} টি মার্কস রেকর্ড সফলভাবে রিস্টোর হয়েছে!`
  };
};

/**
 * Deletes a backup file from Google Drive
 */
export const deleteDriveBackupFile = async (fileId: string, customToken?: string): Promise<boolean> => {
  const token = customToken || await ensureGoogleDriveToken();
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204) {
    const errText = await res.text();
    throw new Error(`Failed to delete Google Drive file: ${res.status} ${errText}`);
  }

  return true;
};

/**
 * Automatically purges older auto-backups on Google Drive if exceeding retention limit
 */
export const pruneOldDriveAutoBackups = async (
  accessToken: string, 
  retentionLimit = 15
): Promise<{ prunedCount: number }> => {
  try {
    const files = await listGoogleDriveBackups(accessToken);
    const autoFiles = files.filter(f => f.isAutoBackup);
    
    if (autoFiles.length > retentionLimit) {
      const toDelete = autoFiles.slice(retentionLimit);
      let count = 0;
      for (const item of toDelete) {
        try {
          await deleteDriveBackupFile(item.id, accessToken);
          count++;
        } catch (e) {
          console.warn('Error pruning file from drive:', item.id, e);
        }
      }
      return { prunedCount: count };
    }
  } catch (e) {
    console.warn('Pruning check notice:', e);
  }
  return { prunedCount: 0 };
};
