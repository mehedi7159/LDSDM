import { Exam, MarkRecord, RemarkRecord, Subject, Student, SchoolClass, SchoolProfile } from '../types';

export interface ExamBackupPackage {
  version: '2.0';
  type: 'madrasha_exam_marks_backup';
  exportDate: string;
  system: string;
  exam?: Exam | null;
  examId: string;
  examName?: string;
  academicYear?: string;
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  subjects?: Subject[];
  classes?: SchoolClass[] | string[];
  studentsSummary?: {
    total: number;
    classes: string[];
  };
  stats: {
    totalMarks: number;
    totalStudents: number;
    totalSubjects: number;
    totalRemarks: number;
  };
  schoolProfile?: {
    name: string;
    academicYear: string;
  };
}

export interface ExamBackupInspectionResult {
  isValid: boolean;
  errorMessage?: string | null;
  version?: string;
  detectedExam: Exam | null;
  detectedExamId: string | null;
  detectedExamName: string;
  academicYear: string;
  isAllExams: boolean;
  detectedExamIds: string[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  subjects: Subject[];
  classes: string[];
  studentIds: string[];
  stats: {
    totalMarks: number;
    totalStudents: number;
    totalSubjects: number;
    totalRemarks: number;
  };
}

export interface ExecuteExamRestoreParams {
  inspection: ExamBackupInspectionResult;
  targetExamId: string;
  targetExamDetails?: Partial<Exam>;
  restoreMode: 'replace' | 'merge'; // 'replace' removes only target exam's existing marks; 'merge' updates matching student-subject
  includeRemarks: boolean;
  includeSubjects: boolean;
  currentExams: Exam[];
  currentMarks: MarkRecord[];
  currentRemarks: RemarkRecord[];
  currentSubjects: Subject[];
  currentClasses?: SchoolClass[];
}

export interface ExecuteExamRestoreResult {
  updatedExams: Exam[];
  updatedMarks: MarkRecord[];
  updatedRemarks: RemarkRecord[];
  updatedSubjects: Subject[];
  stats: {
    restoredMarksCount: number;
    replacedMarksCount: number;
    insertedMarksCount: number;
    restoredRemarksCount: number;
    examCreated: boolean;
    createdSubjectsCount: number;
    targetExamName: string;
    targetExamId: string;
  };
}

/**
 * Generates and downloads a rich, comprehensive JSON backup for an exam
 */
export function exportExamBackup(options: {
  examId: string;
  exams: Exam[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  students: Student[];
  subjects: Subject[];
  classes: SchoolClass[];
  schoolProfile?: SchoolProfile;
}): void {
  const { examId, exams, marks, remarks, students, subjects, classes, schoolProfile } = options;

  let examToBackup: Exam | null = null;
  let targetMarks: MarkRecord[] = marks;
  let targetRemarks: RemarkRecord[] = remarks;
  const isAllExams = examId === 'all';

  if (!isAllExams) {
    examToBackup = exams.find(e => e.id === examId) || null;
    targetMarks = marks.filter(m => m.examId === examId);
    targetRemarks = remarks.filter(r => r.examId === examId);
  }

  // Filter relevant subjects
  const subjectIdsInMarks = new Set(targetMarks.map(m => m.subjectId));
  const relevantSubjects = subjects.filter(s => subjectIdsInMarks.has(s.id));

  // Extract student summary
  const studentIdsInMarks = new Set(targetMarks.map(m => m.studentId));
  const involvedStudents = students.filter(s => studentIdsInMarks.has(s.id));
  const involvedClasses = Array.from(new Set(involvedStudents.map(s => s.classLevel).filter(Boolean)));

  const backupPackage: ExamBackupPackage = {
    version: '2.0',
    type: 'madrasha_exam_marks_backup',
    exportDate: new Date().toISOString(),
    system: 'Madrasha Result & Management System',
    exam: examToBackup,
    examId: examId,
    examName: examToBackup?.name || (isAllExams ? 'All Exams' : 'Exam Marks'),
    academicYear: examToBackup?.academicYear || schoolProfile?.academicYear || new Date().getFullYear().toString(),
    marks: targetMarks,
    remarks: targetRemarks,
    subjects: relevantSubjects,
    classes: classes,
    studentsSummary: {
      total: studentIdsInMarks.size,
      classes: involvedClasses,
    },
    stats: {
      totalMarks: targetMarks.length,
      totalStudents: studentIdsInMarks.size,
      totalSubjects: subjectIdsInMarks.size,
      totalRemarks: targetRemarks.length,
    },
    schoolProfile: schoolProfile ? {
      name: schoolProfile.name,
      academicYear: schoolProfile.academicYear,
    } : undefined
  };

  const safeExamName = (examToBackup?.name || (isAllExams ? 'all_exams' : 'exam_marks'))
    .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `madrasha_exam_backup_${safeExamName}_${dateStr}.json`;

  const blob = new Blob([JSON.stringify(backupPackage, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes raw mark records from any legacy or modern schema
 */
export function normalizeMarkRecord(raw: any, fallbackExamId?: string): MarkRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const studentId = String(raw.studentId || raw.student_id || raw.roll || '').trim();
  const subjectId = String(raw.subjectId || raw.subject_id || raw.subject || '').trim();
  const examId = String(raw.examId || raw.exam_id || fallbackExamId || '').trim();

  if (!studentId || !subjectId) {
    return null;
  }

  // Parse obtained marks
  let obtained = 0;
  if (raw.obtained !== undefined && raw.obtained !== null && raw.obtained !== '') {
    obtained = parseFloat(String(raw.obtained));
  } else if (raw.obtainedMarks !== undefined && raw.obtainedMarks !== null && raw.obtainedMarks !== '') {
    obtained = parseFloat(String(raw.obtainedMarks));
  } else if (raw.mark !== undefined && raw.mark !== null && raw.mark !== '') {
    obtained = parseFloat(String(raw.mark));
  } else if (raw.marks !== undefined && typeof raw.marks === 'number') {
    obtained = raw.marks;
  }

  if (isNaN(obtained) || obtained < 0) obtained = 0;

  // Parse CQ / MCQ
  let obtainedCQ: number | undefined;
  if (raw.obtainedCQ !== undefined && raw.obtainedCQ !== null && raw.obtainedCQ !== '') {
    const num = parseFloat(String(raw.obtainedCQ));
    if (!isNaN(num)) obtainedCQ = num;
  } else if (raw.cq !== undefined && raw.cq !== null && raw.cq !== '') {
    const num = parseFloat(String(raw.cq));
    if (!isNaN(num)) obtainedCQ = num;
  }

  let obtainedMCQ: number | undefined;
  if (raw.obtainedMCQ !== undefined && raw.obtainedMCQ !== null && raw.obtainedMCQ !== '') {
    const num = parseFloat(String(raw.obtainedMCQ));
    if (!isNaN(num)) obtainedMCQ = num;
  } else if (raw.mcq !== undefined && raw.mcq !== null && raw.mcq !== '') {
    const num = parseFloat(String(raw.mcq));
    if (!isNaN(num)) obtainedMCQ = num;
  }

  // Parse Total (Full marks snapshot)
  let total = 100;
  if (raw.total !== undefined && raw.total !== null && raw.total !== '') {
    const num = parseFloat(String(raw.total));
    if (!isNaN(num) && num > 0) total = num;
  } else if (raw.fullMarks !== undefined && raw.fullMarks !== null) {
    const num = parseFloat(String(raw.fullMarks));
    if (!isNaN(num) && num > 0) total = num;
  }

  const isAbsent = Boolean(
    raw.isAbsent === true || 
    raw.absent === true || 
    raw.status === 'absent' || 
    raw.status === 'Absent'
  );

  const id = String(raw.id || `mark_${studentId}_${subjectId}_${examId || 'auto'}_${Math.random().toString(36).substring(2, 7)}`);

  return {
    id,
    studentId,
    subjectId,
    examId,
    obtained,
    obtainedCQ,
    obtainedMCQ,
    isAbsent,
    total
  };
}

/**
 * Normalizes raw remark records
 */
export function normalizeRemarkRecord(raw: any, fallbackExamId?: string): RemarkRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const studentId = String(raw.studentId || raw.student_id || '').trim();
  const examId = String(raw.examId || raw.exam_id || fallbackExamId || '').trim();

  if (!studentId) return null;

  return {
    studentId,
    examId,
    remark: String(raw.remark || raw.remarks || raw.comment || '').trim(),
    workingDays: raw.workingDays !== undefined ? Number(raw.workingDays) : undefined,
    totalPresent: raw.totalPresent !== undefined ? Number(raw.totalPresent) : undefined,
    totalAbsent: raw.totalAbsent !== undefined ? Number(raw.totalAbsent) : undefined,
  };
}

/**
 * Inspects, parses and validates an uploaded backup file string
 */
export function inspectAndParseExamBackup(fileContent: string): ExamBackupInspectionResult {
  if (!fileContent || typeof fileContent !== 'string') {
    return {
      isValid: false,
      errorMessage: 'The uploaded file is empty.',
      detectedExam: null,
      detectedExamId: null,
      detectedExamName: '',
      academicYear: '',
      isAllExams: false,
      detectedExamIds: [],
      marks: [],
      remarks: [],
      subjects: [],
      classes: [],
      studentIds: [],
      stats: { totalMarks: 0, totalStudents: 0, totalSubjects: 0, totalRemarks: 0 }
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err: any) {
    return {
      isValid: false,
      errorMessage: 'Invalid JSON format. Please upload a valid .json backup file.',
      detectedExam: null,
      detectedExamId: null,
      detectedExamName: '',
      academicYear: '',
      isAllExams: false,
      detectedExamIds: [],
      marks: [],
      remarks: [],
      subjects: [],
      classes: [],
      studentIds: [],
      stats: { totalMarks: 0, totalStudents: 0, totalSubjects: 0, totalRemarks: 0 }
    };
  }

  // Extract Marks array
  let rawMarksList: any[] = [];
  let rawRemarksList: any[] = [];
  let rawSubjectsList: any[] = [];
  let detectedExam: Exam | null = null;
  let detectedExamId: string | null = null;
  let detectedExamName = '';
  let academicYear = '';
  const version = parsed.version || '1.0';

  if (Array.isArray(parsed)) {
    // Array of mark records directly
    rawMarksList = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    if (Array.isArray(parsed.marks)) {
      rawMarksList = parsed.marks;
    } else if (Array.isArray(parsed.examMarks)) {
      rawMarksList = parsed.examMarks;
    } else if (Array.isArray(parsed.data?.marks)) {
      rawMarksList = parsed.data.marks;
    }

    if (Array.isArray(parsed.remarks)) {
      rawRemarksList = parsed.remarks;
    }

    if (Array.isArray(parsed.subjects)) {
      rawSubjectsList = parsed.subjects;
    }

    // Detected Exam info
    if (parsed.exam && typeof parsed.exam === 'object') {
      detectedExam = parsed.exam;
      detectedExamId = parsed.exam.id || parsed.examId || null;
      detectedExamName = parsed.exam.name || parsed.examName || '';
      academicYear = parsed.exam.academicYear || parsed.academicYear || '';
    } else if (parsed.examId) {
      detectedExamId = String(parsed.examId);
      detectedExamName = parsed.examName || `Exam (${parsed.examId})`;
      academicYear = parsed.academicYear || '';
    } else if (parsed.examName) {
      detectedExamName = parsed.examName;
      academicYear = parsed.academicYear || '';
    }
  }

  if (rawMarksList.length === 0) {
    return {
      isValid: false,
      errorMessage: 'No student marks records found in this backup file.',
      detectedExam,
      detectedExamId,
      detectedExamName,
      academicYear,
      isAllExams: false,
      detectedExamIds: [],
      marks: [],
      remarks: [],
      subjects: [],
      classes: [],
      studentIds: [],
      stats: { totalMarks: 0, totalStudents: 0, totalSubjects: 0, totalRemarks: 0 }
    };
  }

  // Normalize Marks
  const validMarks: MarkRecord[] = [];
  const studentIdSet = new Set<string>();
  const subjectIdSet = new Set<string>();
  const examIdSet = new Set<string>();

  for (const raw of rawMarksList) {
    const normalized = normalizeMarkRecord(raw, detectedExamId || undefined);
    if (normalized) {
      validMarks.push(normalized);
      studentIdSet.add(normalized.studentId);
      subjectIdSet.add(normalized.subjectId);
      if (normalized.examId) {
        examIdSet.add(normalized.examId);
      }
    }
  }

  if (validMarks.length === 0) {
    return {
      isValid: false,
      errorMessage: 'The file contains records, but none could be parsed as valid marks data.',
      detectedExam,
      detectedExamId,
      detectedExamName,
      academicYear,
      isAllExams: false,
      detectedExamIds: [],
      marks: [],
      remarks: [],
      subjects: [],
      classes: [],
      studentIds: [],
      stats: { totalMarks: 0, totalStudents: 0, totalSubjects: 0, totalRemarks: 0 }
    };
  }

  // Normalize Remarks
  const validRemarks: RemarkRecord[] = [];
  for (const raw of rawRemarksList) {
    const normRemark = normalizeRemarkRecord(raw, detectedExamId || undefined);
    if (normRemark) {
      validRemarks.push(normRemark);
    }
  }

  // Normalize Subjects
  const validSubjects: Subject[] = [];
  if (Array.isArray(rawSubjectsList)) {
    for (const sub of rawSubjectsList) {
      if (sub && sub.id && sub.name && sub.classLevel) {
        validSubjects.push(sub as Subject);
      }
    }
  }

  const detectedExamIds = Array.from(examIdSet);
  const isAllExams = detectedExamIds.length > 1 || detectedExamId === 'all';

  if (!detectedExamId && detectedExamIds.length === 1) {
    detectedExamId = detectedExamIds[0];
  }

  if (!detectedExamName && detectedExamId) {
    detectedExamName = `Exam ID: ${detectedExamId}`;
  }

  return {
    isValid: true,
    version,
    detectedExam,
    detectedExamId,
    detectedExamName: detectedExamName || 'Exam Marks',
    academicYear: academicYear || new Date().getFullYear().toString(),
    isAllExams,
    detectedExamIds,
    marks: validMarks,
    remarks: validRemarks,
    subjects: validSubjects,
    classes: Array.isArray(parsed?.studentsSummary?.classes) ? parsed.studentsSummary.classes : [],
    studentIds: Array.from(studentIdSet),
    stats: {
      totalMarks: validMarks.length,
      totalStudents: studentIdSet.size,
      totalSubjects: subjectIdSet.size,
      totalRemarks: validRemarks.length
    }
  };
}

/**
 * Applies the verified restore package into the app data model safely
 */
export function executeExamRestore(params: ExecuteExamRestoreParams): ExecuteExamRestoreResult {
  const {
    inspection,
    targetExamId,
    targetExamDetails,
    restoreMode,
    includeRemarks,
    includeSubjects,
    currentExams,
    currentMarks,
    currentRemarks,
    currentSubjects
  } = params;

  let updatedExams = [...currentExams];
  let examCreated = false;
  let finalTargetExamId = targetExamId;

  // 1. Resolve Target Exam
  let targetExam = updatedExams.find(e => e.id === finalTargetExamId);

  if (!targetExam) {
    // Exam does not exist in current exams list; create it!
    const newExam: Exam = {
      id: finalTargetExamId || `exam_${Date.now()}`,
      name: targetExamDetails?.name || inspection.detectedExam?.name || inspection.detectedExamName || 'Restored Examination',
      nameBn: targetExamDetails?.nameBn || inspection.detectedExam?.nameBn || '',
      academicYear: targetExamDetails?.academicYear || inspection.detectedExam?.academicYear || inspection.academicYear || new Date().getFullYear().toString(),
      category: targetExamDetails?.category || inspection.detectedExam?.category || 'Term',
      contributions: inspection.detectedExam?.contributions || [],
      enableContributions: inspection.detectedExam?.enableContributions || false
    };
    finalTargetExamId = newExam.id;
    updatedExams = [...updatedExams, newExam];
    targetExam = newExam;
    examCreated = true;
  } else if (targetExamDetails?.name && targetExamDetails.name !== targetExam.name) {
    // Update existing exam name/details if provided
    updatedExams = updatedExams.map(e => e.id === finalTargetExamId ? { ...e, ...targetExamDetails } : e);
  }

  // 2. Resolve & Link Marks to Target Exam ID
  const marksToInsert: MarkRecord[] = inspection.marks.map(m => ({
    ...m,
    id: `mark_${m.studentId}_${m.subjectId}_${finalTargetExamId}`,
    examId: finalTargetExamId
  }));

  let updatedMarks: MarkRecord[] = [];
  let replacedMarksCount = 0;
  let insertedMarksCount = 0;

  if (restoreMode === 'replace') {
    // Remove all existing marks ONLY for this target exam
    const preservedMarks = currentMarks.filter(m => m.examId !== finalTargetExamId);
    replacedMarksCount = currentMarks.length - preservedMarks.length;
    updatedMarks = [...preservedMarks, ...marksToInsert];
    insertedMarksCount = marksToInsert.length;
  } else {
    // Merge mode: Overwrite matching (studentId, subjectId, examId) and append new
    const marksMap = new Map<string, MarkRecord>();
    currentMarks.forEach(m => marksMap.set(`${m.studentId}-${m.subjectId}-${m.examId}`, m));

    marksToInsert.forEach(m => {
      const key = `${m.studentId}-${m.subjectId}-${m.examId}`;
      if (marksMap.has(key)) {
        replacedMarksCount++;
      } else {
        insertedMarksCount++;
      }
      marksMap.set(key, m);
    });

    updatedMarks = Array.from(marksMap.values());
  }

  // 3. Resolve & Link Remarks
  let updatedRemarks = [...currentRemarks];
  let restoredRemarksCount = 0;

  if (includeRemarks && inspection.remarks.length > 0) {
    const remarksToInsert: RemarkRecord[] = inspection.remarks.map(r => ({
      ...r,
      examId: finalTargetExamId
    }));

    if (restoreMode === 'replace') {
      const preservedRemarks = currentRemarks.filter(r => r.examId !== finalTargetExamId);
      updatedRemarks = [...preservedRemarks, ...remarksToInsert];
      restoredRemarksCount = remarksToInsert.length;
    } else {
      const remarksMap = new Map<string, RemarkRecord>();
      currentRemarks.forEach(r => remarksMap.set(`${r.studentId}-${r.examId}`, r));
      remarksToInsert.forEach(r => remarksMap.set(`${r.studentId}-${r.examId}`, r));
      updatedRemarks = Array.from(remarksMap.values());
      restoredRemarksCount = remarksToInsert.length;
    }
  }

  // 4. Resolve Subjects (if enabled)
  let updatedSubjects = [...currentSubjects];
  let createdSubjectsCount = 0;

  if (includeSubjects && inspection.subjects.length > 0) {
    const existingSubjectIds = new Set(currentSubjects.map(s => s.id));
    const missingSubjects = inspection.subjects.filter(s => !existingSubjectIds.has(s.id));
    if (missingSubjects.length > 0) {
      updatedSubjects = [...updatedSubjects, ...missingSubjects];
      createdSubjectsCount = missingSubjects.length;
    }
  }

  return {
    updatedExams,
    updatedMarks,
    updatedRemarks,
    updatedSubjects,
    stats: {
      restoredMarksCount: marksToInsert.length,
      replacedMarksCount,
      insertedMarksCount,
      restoredRemarksCount,
      examCreated,
      createdSubjectsCount,
      targetExamName: targetExam?.name || inspection.detectedExamName,
      targetExamId: finalTargetExamId
    }
  };
}
