/**
 * Modern Daily Attendance Service
 * Handles Daily Student & Staff Attendance, Auto-Calculation for Exam Marks,
 * Guardian Alert List, and Monthly Register Summaries.
 */

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

export interface DailyStudentAttendanceRecord {
  id: string; // `${date}_${studentId}`
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName?: string;
  roll?: string;
  classLevel: string;
  status: AttendanceStatus;
  timeIn?: string;
  // Phase 3 (mobile roll-call): minutes late, recorded only when the
  // status is LATE. ADDITIVE optional field — old records simply lack
  // it; batchSave/save spread the whole record, so no service logic
  // change was needed to persist it.
  lateMinutes?: number;
  note?: string;
  updatedAt?: string;
}

export interface DailyStaffAttendanceRecord {
  id: string; // `${date}_${staffId}`
  date: string; // YYYY-MM-DD
  staffId: string;
  staffName?: string;
  designation?: string;
  status: AttendanceStatus;
  inTime?: string;
  outTime?: string;
  note?: string;
}

export interface DayAttendanceSummary {
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number;
}

const STORAGE_KEY_STUDENTS = 'madrasah_daily_student_attendance';
const STORAGE_KEY_STAFF = 'madrasah_daily_staff_attendance';

// ---------------------------------------------------------------------------
// Pure record helpers (Step 3, stale-view fix).
// The service methods below delegate to these. Views that must react to
// SHARED (context/cloud) attendance state call the pure helpers over the
// context array instead of the service singleton: the singleton only
// re-renders a view when that view's own state changes, so an open sheet
// never refreshed when another device's attendance landed in the cloud.
// The context array changes on every hydration merge AND every local
// save (bridge subscription), so views over it recompute on arrival.
// Logic here is byte-identical to the original method bodies.
// ---------------------------------------------------------------------------

/** Friday is the madrasa weekly holiday (same rule the register
 * applies when it skips Friday columns): no Friday is ever a working
 * day. Parsed as a civil date, never via UTC midnight, so the
 * weekday cannot shift with the device timezone. */
export function isFridayDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return false;
  return new Date(parts[0], parts[1] - 1, parts[2]).getDay() === 5;
}

/** Same predicate as getRecordsByDateAndClass, over any record list. */
export function filterStudentRecordsByDateAndClass(
  records: DailyStudentAttendanceRecord[],
  date: string,
  classLevel: string
): DailyStudentAttendanceRecord[] {
  return (records || []).filter(
    r => r.date === date && (classLevel === 'All' || r.classLevel === classLevel)
  );
}

/** Same arithmetic as calculateStudentAttendanceForExam, over any record list. */
export function calculateStudentAttendanceForExamFromRecords(
  records: DailyStudentAttendanceRecord[],
  studentId: string,
  startDate?: string,
  endDate?: string
): {
  workingDays: number;
  totalPresent: number;
  totalAbsent: number;
  attendancePercentage: number;
} {
  const filtered = (records || []).filter(r => {
    if (r.studentId !== studentId) return false;
    if (isFridayDate(r.date)) return false; // Friday is never a working day
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return true;
  });

  const workingDays = filtered.length;
  const totalPresent = filtered.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
  const totalAbsent = filtered.filter(r => r.status === 'ABSENT' || r.status === 'LEAVE').length;
  // Honest-zero rule: figures derive ONLY from recorded entries.
  const attendancePercentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

  return {
    workingDays,
    totalPresent,
    totalAbsent,
    attendancePercentage
  };
}

/** Same arithmetic as getStudentMonthlySummary, over any record list. */
export function getStudentMonthlySummaryFromRecords(
  records: DailyStudentAttendanceRecord[],
  studentId: string,
  year: number,
  month: number
): {
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  percentage: number;
} {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const filtered = (records || []).filter(
    r => r.studentId === studentId && r.date.startsWith(monthPrefix) && !isFridayDate(r.date)
  );

  const workingDays = filtered.length;
  const presentDays = filtered.filter(r => r.status === 'PRESENT').length;
  const lateDays = filtered.filter(r => r.status === 'LATE').length;
  const absentDays = filtered.filter(r => r.status === 'ABSENT').length;
  const leaveDays = filtered.filter(r => r.status === 'LEAVE').length;

  const effectivePresent = presentDays + lateDays;
  // Honest-zero rule (see above): a month with no records reports 0.
  const percentage = workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 0;

  return {
    workingDays,
    presentDays,
    absentDays,
    lateDays,
    leaveDays,
    percentage
  };
}

class DailyAttendanceService {
  private studentRecords: Record<string, DailyStudentAttendanceRecord> = {};
  private staffRecords: Record<string, DailyStaffAttendanceRecord> = {};

  // Cloud-sync bridge (Phase 2): AppContext subscribes to writes so the
  // records can be mirrored into shared state and synced through the
  // Firestore main_store payload + backups. The service itself stays the
  // UI-facing API and keeps its localStorage keys as the local mirror.
  private listeners = new Set<() => void>();
  private suppressNotify = false;

  constructor() {
    this.loadFromStorage();
  }

  /** Subscribe to data changes (every save). Returns an unsubscribe fn. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange() {
    if (this.suppressNotify) return;
    this.listeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }

  /** All student attendance records as a list (for context/payload use). */
  public getAllStudentRecords(): DailyStudentAttendanceRecord[] {
    return Object.values(this.studentRecords);
  }

  /** All staff attendance records as a list (for context/payload use). */
  public getAllStaffRecords(): DailyStaffAttendanceRecord[] {
    return Object.values(this.staffRecords);
  }

  /**
   * Replace the student records wholesale (cloud hydration / restore).
   * Persists to the localStorage mirror WITHOUT notifying subscribers,
   * so hydration never echoes back into the sync pipeline.
   */
  public replaceStudentRecords(records: DailyStudentAttendanceRecord[]) {
    const map: Record<string, DailyStudentAttendanceRecord> = {};
    (records || []).forEach(r => {
      if (r && r.date && r.studentId) map[`${r.date}_${r.studentId}`] = r;
    });
    this.studentRecords = map;
    this.suppressNotify = true;
    try { this.saveToStorage(); } finally { this.suppressNotify = false; }
  }

  /** Staff counterpart of replaceStudentRecords (silent hydration). */
  public replaceStaffRecords(records: DailyStaffAttendanceRecord[]) {
    const map: Record<string, DailyStaffAttendanceRecord> = {};
    (records || []).forEach(r => {
      if (r && r.date && r.staffId) map[`${r.date}_${r.staffId}`] = r;
    });
    this.staffRecords = map;
    this.suppressNotify = true;
    try { this.saveToStorage(); } finally { this.suppressNotify = false; }
  }

  /**
   * Merge cloud records into the local map (24 Oct 2026 visibility fix).
   * Union by record id; the INCOMING record wins on id conflict. Local
   * records absent from the incoming array are PRESERVED — this is what
   * wholesale replace() got wrong: the live cloud attendance array is
   * empty (no teacher session has ever synced it), so every snapshot /
   * getDoc hydration replaced the teacher's phone-local records with
   * [] and wiped them before any sync could upload them. Merge keeps
   * the backlog alive so the next authed sync uploads it. Silent
   * persist, like replace* (hydration never echoes into the bridge).
   * Trade-off (accepted: attendance has no delete UI): a record
   * deleted from the cloud alone resurrects from a device that still
   * holds it. That is strictly better than silently deleting local
   * records nobody deleted.
   */
  public mergeStudentRecords(records: DailyStudentAttendanceRecord[]) {
    (records || []).forEach(r => {
      if (r && r.date && r.studentId) this.studentRecords[`${r.date}_${r.studentId}`] = r;
    });
    this.suppressNotify = true;
    try { this.saveToStorage(); } finally { this.suppressNotify = false; }
  }

  /** Staff counterpart of mergeStudentRecords (same union semantics). */
  public mergeStaffRecords(records: DailyStaffAttendanceRecord[]) {
    (records || []).forEach(r => {
      if (r && r.date && r.staffId) this.staffRecords[`${r.date}_${r.staffId}`] = r;
    });
    this.suppressNotify = true;
    try { this.saveToStorage(); } finally { this.suppressNotify = false; }
  }

  private loadFromStorage() {
    try {
      const savedStudents = localStorage.getItem(STORAGE_KEY_STUDENTS);
      if (savedStudents) {
        this.studentRecords = JSON.parse(savedStudents);
      } else {
        this.seedInitialStudentAttendance();
      }

      const savedStaff = localStorage.getItem(STORAGE_KEY_STAFF);
      if (savedStaff) {
        this.staffRecords = JSON.parse(savedStaff);
      }
    } catch (e) {
      console.error('Error loading attendance from storage:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(this.studentRecords));
      localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(this.staffRecords));
    } catch (e) {
      console.error('Error saving attendance to storage:', e);
    }
    this.emitChange();
  }

  private seedInitialStudentAttendance() {
    const today = new Date().toISOString().split('T')[0];
    this.studentRecords = {};
    // Saved will populate dynamically when user opens or takes attendance
    this.saveToStorage();
  }

  // --- Student Attendance Methods ---

  public getRecordsByDateAndClass(date: string, classLevel: string): DailyStudentAttendanceRecord[] {
    return filterStudentRecordsByDateAndClass(Object.values(this.studentRecords), date, classLevel);
  }

  public getStudentRecord(date: string, studentId: string): DailyStudentAttendanceRecord | undefined {
    const key = `${date}_${studentId}`;
    return this.studentRecords[key];
  }

  public saveStudentRecord(record: DailyStudentAttendanceRecord) {
    const key = `${record.date}_${record.studentId}`;
    this.studentRecords[key] = {
      ...record,
      updatedAt: new Date().toISOString()
    };
    this.saveToStorage();
  }

  public batchSaveStudentAttendance(records: DailyStudentAttendanceRecord[]) {
    records.forEach(record => {
      const key = `${record.date}_${record.studentId}`;
      this.studentRecords[key] = {
        ...record,
        updatedAt: new Date().toISOString()
      };
    });
    this.saveToStorage();
  }

  public getDaySummary(date: string, classLevel?: string): DayAttendanceSummary {
    return summarizeStudentRecords(Object.values(this.studentRecords), date, classLevel);
  }

  public getAbsentStudents(date: string, classLevel?: string): DailyStudentAttendanceRecord[] {
    return Object.values(this.studentRecords).filter(
      r => r.date === date && 
      (!classLevel || classLevel === 'All' || r.classLevel === classLevel) &&
      (r.status === 'ABSENT' || r.status === 'LEAVE')
    );
  }

  /**
   * Auto-calculates total working days, present and absent for a student
   * within a specific date range (for auto-filling Exam Remark Cards!)
   */
  public calculateStudentAttendanceForExam(studentId: string, startDate?: string, endDate?: string): {
    workingDays: number;
    totalPresent: number;
    totalAbsent: number;
    attendancePercentage: number;
  } {
    return calculateStudentAttendanceForExamFromRecords(
      Object.values(this.studentRecords),
      studentId,
      startDate,
      endDate
    );
  }

  /**
   * Calculates monthly attendance stats for a specific student
   */
  public getStudentMonthlySummary(studentId: string, year: number, month: number): {
    workingDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
    percentage: number;
  } {
    return getStudentMonthlySummaryFromRecords(
      Object.values(this.studentRecords),
      studentId,
      year,
      month
    );
  }

  // --- Staff Attendance Methods ---

  public getStaffAttendanceByDate(date: string): DailyStaffAttendanceRecord[] {
    return Object.values(this.staffRecords).filter(r => r.date === date);
  }

  public saveStaffRecord(record: DailyStaffAttendanceRecord) {
    const key = `${record.date}_${record.staffId}`;
    this.staffRecords[key] = record;
    this.saveToStorage();
  }

  public batchSaveStaffAttendance(records: DailyStaffAttendanceRecord[]) {
    records.forEach(r => {
      const key = `${r.date}_${r.staffId}`;
      this.staffRecords[key] = r;
    });
    this.saveToStorage();
  }
}

/**
 * Pure, array-based summaries (24 Oct 2026 visibility fix). The admin
 * report center and attendance hub used to read the service singleton
 * inside useMemos whose deps never included attendance data — and cloud
 * hydration is deliberately silent — so an already-open admin session
 * never recomputed attendance even after records arrived. These helpers
 * take the REACTIVE context arrays instead, so the memos recompute
 * whenever the arrays change. Semantics are byte-identical to the
 * singleton methods they replace (recorded-only, present+late counted
 * as present, 0 when nothing is recorded).
 */
export function summarizeStudentRecords(
  records: DailyStudentAttendanceRecord[],
  date: string,
  classLevel?: string
): DayAttendanceSummary {
  // A Friday date has no working day at all, even if records were
  // saved for it before the Friday block existed.
  if (isFridayDate(date)) return { date, totalStudents: 0, presentCount: 0, absentCount: 0, lateCount: 0, leaveCount: 0, attendancePercentage: 0 };
  const filtered = (records || []).filter(
    r => r.date === date && (!classLevel || classLevel === 'All' || r.classLevel === classLevel)
  );
  const totalStudents = filtered.length;
  const presentCount = filtered.filter(r => r.status === 'PRESENT').length;
  const absentCount = filtered.filter(r => r.status === 'ABSENT').length;
  const lateCount = filtered.filter(r => r.status === 'LATE').length;
  const leaveCount = filtered.filter(r => r.status === 'LEAVE').length;
  const effectivePresent = presentCount + lateCount;
  const attendancePercentage = totalStudents > 0
    ? Math.round((effectivePresent / totalStudents) * 100)
    : 0;
  return { date, totalStudents, presentCount, absentCount, lateCount, leaveCount, attendancePercentage };
}

export function summarizeStaffRecords(
  records: DailyStaffAttendanceRecord[],
  date: string
): { total: number; present: number } {
  // Friday is never a working day (see summarizeStudentRecords).
  if (isFridayDate(date)) return { total: 0, present: 0 };
  const filtered = (records || []).filter(r => r.date === date);
  return {
    total: filtered.length,
    present: filtered.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length,
  };
}

export const dailyAttendanceService = new DailyAttendanceService();
