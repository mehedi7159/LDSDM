/**
 * Class Promotion Service Layer
 * Computes exam performance, recommends class progression,
 * assigns merit-based roll numbers, and executes bulk promotions safely.
 */

import { Student, SchoolClass, Subject, MarkRecord, GradingSystem, DEFAULT_GRADING_SYSTEM } from '../types';
import { 
  StudentPromotionItem, 
  StudentExamPerformance, 
  PromotionSessionConfig, 
  PromotionAction, 
  RollAssignmentMode,
  PromotionHistoryRecord 
} from '../types/promotion';
import { calculateStudentExamSummary } from './gradingEngine';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * Determine the next class in the academic hierarchy based on order/level
 */
export function getNextClass(
  currentClassIdentifier: string,
  classes: SchoolClass[]
): { nextClass: SchoolClass | null; isLastClass: boolean; currentClass: SchoolClass | null } {
  if (!classes || classes.length === 0) {
    return { nextClass: null, isLastClass: false, currentClass: null };
  }

  // Sort classes by order ascending (or level if order is identical)
  const sortedClasses = [...classes].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : (a.level !== undefined ? a.level : 999);
    const orderB = b.order !== undefined ? b.order : (b.level !== undefined ? b.level : 999);
    return orderA - orderB;
  });

  const currentIndex = sortedClasses.findIndex(
    c => c.name === currentClassIdentifier || c.id === currentClassIdentifier || c.displayName === currentClassIdentifier
  );

  if (currentIndex === -1) {
    // If not found, default to first class or null
    return { nextClass: null, isLastClass: false, currentClass: null };
  }

  const currentClass = sortedClasses[currentIndex];
  const isLastClass = currentIndex >= sortedClasses.length - 1;
  const nextClass = isLastClass ? null : sortedClasses[currentIndex + 1];

  return { nextClass, isLastClass, currentClass };
}

/**
 * Compute exam performance and merit ranking for all students in a class
 */
export function computeClassExamPerformance(
  students: Student[],
  examId: string | undefined,
  marks: MarkRecord[],
  subjects: Subject[],
  sourceClassIdentifier: string,
  gradingSystem: GradingSystem[] = DEFAULT_GRADING_SYSTEM
): Record<string, StudentExamPerformance> {
  const result: Record<string, StudentExamPerformance> = {};

  if (!examId || examId === 'none') {
    // Without an exam session, students are ranked by their existing roll numbers
    const sortedByRoll = [...students].sort((a, b) => {
      const rollA = parseInt(a.roll || a.rollNumber || '9999', 10);
      const rollB = parseInt(b.roll || b.rollNumber || '9999', 10);
      return rollA - rollB;
    });

    sortedByRoll.forEach((s, idx) => {
      result[s.id] = {
        studentId: s.id,
        totalObtained: 0,
        totalFullMarks: 0,
        percentage: 0,
        gpa: 0,
        overallGrade: 'N/A',
        isPassed: true,
        failedSubjectCount: 0,
        failedSubjectNames: [],
        isAbsent: false,
        meritRank: idx + 1
      };
    });

    return result;
  }

  // Filter subjects for the source class
  const classSubjects = subjects.filter(
    sub => sub.classLevel === sourceClassIdentifier || 
           (sub as any).classId === sourceClassIdentifier ||
           !sub.classLevel // universal
  );

  // Filter marks for this exam session
  const examMarks = marks.filter(m => m.examId === examId);

  // Evaluate performance for each student
  const evaluations: (StudentExamPerformance & { currentRoll: number })[] = [];

  students.forEach(student => {
    const summary = calculateStudentExamSummary(student.id, examMarks, classSubjects, gradingSystem);

    // Identify names of failed subjects
    const failedSubjectNames: string[] = [];
    Object.entries(summary.subjectResults).forEach(([subId, subRes]) => {
      if (!subRes.isPassed && !subRes.isAbsent) {
        const foundSub = classSubjects.find(s => s.id === subId);
        failedSubjectNames.push(foundSub?.nameBn || foundSub?.name || subId);
      } else if (subRes.isAbsent) {
        const foundSub = classSubjects.find(s => s.id === subId);
        failedSubjectNames.push(`${foundSub?.nameBn || foundSub?.name || subId} (অনুপস্থিত)`);
      }
    });

    const currentRoll = parseInt(student.roll || student.rollNumber || '9999', 10);

    evaluations.push({
      studentId: student.id,
      totalObtained: summary.totalObtained,
      totalFullMarks: summary.totalFullMarks,
      percentage: summary.overallPercentage,
      gpa: summary.gpa,
      overallGrade: summary.overallGrade,
      isPassed: summary.isPassed,
      failedSubjectCount: summary.failedSubjectCount,
      failedSubjectNames,
      isAbsent: summary.isAllAbsent,
      meritRank: 0,
      currentRoll
    });
  });

  // Sort by merit: Passed students first, higher GPA, higher total marks, then current roll
  evaluations.sort((a, b) => {
    // 1. Passed before failed
    if (a.isPassed !== b.isPassed) {
      return a.isPassed ? -1 : 1;
    }
    // 2. Higher GPA first
    if (b.gpa !== a.gpa) {
      return b.gpa - a.gpa;
    }
    // 3. Higher Total Marks first
    if (b.totalObtained !== a.totalObtained) {
      return b.totalObtained - a.totalObtained;
    }
    // 4. Fewer failed subjects
    if (a.failedSubjectCount !== b.failedSubjectCount) {
      return a.failedSubjectCount - b.failedSubjectCount;
    }
    // 5. Existing roll number
    return a.currentRoll - b.currentRoll;
  });

  // Assign Merit Ranks
  evaluations.forEach((item, index) => {
    result[item.studentId] = {
      studentId: item.studentId,
      totalObtained: item.totalObtained,
      totalFullMarks: item.totalFullMarks,
      percentage: item.percentage,
      gpa: item.gpa,
      overallGrade: item.overallGrade,
      isPassed: item.isPassed,
      failedSubjectCount: item.failedSubjectCount,
      failedSubjectNames: item.failedSubjectNames,
      isAbsent: item.isAbsent,
      meritRank: index + 1
    };
  });

  return result;
}

/**
 * Generate initial promotion items for all students in the class
 */
export function buildInitialPromotionItems(
  students: Student[],
  config: PromotionSessionConfig,
  performanceMap: Record<string, StudentExamPerformance>,
  isLastClass: boolean
): StudentPromotionItem[] {
  // Only process active/enrolled students (not former students who already left)
  const candidateStudents = students.filter(s => !s.isFormer && s.status !== 'Former');

  const items: StudentPromotionItem[] = candidateStudents.map(student => {
    const perf = performanceMap[student.id];
    let action: PromotionAction = 'PROMOTE';
    let selected = true;

    if (config.ruleMode === 'passed_only') {
      if (perf && !perf.isPassed) {
        action = 'RETAIN';
        selected = false;
      } else {
        action = isLastClass ? 'GRADUATE' : 'PROMOTE';
        selected = true;
      }
    } else if (config.ruleMode === 'all') {
      action = isLastClass ? 'GRADUATE' : 'PROMOTE';
      selected = true;
    } else if (config.ruleMode === 'min_gpa') {
      const minGpa = config.minGpa ?? 1.0;
      const maxFailed = config.maxFailedSubjects ?? 0;
      const gpaPass = perf ? perf.gpa >= minGpa : true;
      const failCountOk = perf ? perf.failedSubjectCount <= maxFailed : true;

      if (gpaPass && failCountOk) {
        action = isLastClass ? 'GRADUATE' : 'PROMOTE';
        selected = true;
      } else {
        action = 'RETAIN';
        selected = false;
      }
    }

    const currentRoll = student.roll || student.rollNumber || '';

    return {
      studentId: student.id,
      student,
      sourceClassLevel: config.sourceClassLevel,
      sourceClassId: config.sourceClassId,
      targetClassLevel: config.targetClassLevel,
      targetClassId: config.targetClassId,
      targetAcademicYearId: config.targetAcademicYearId,
      currentRoll,
      newRoll: currentRoll,
      action,
      selected,
      examSummary: perf
    };
  });

  // Calculate initial roll numbers based on mode
  return recalculateRollNumbers(items, config.rollAssignmentMode);
}

/**
 * Re-calculate / allocate new roll numbers for promoted students
 */
export function recalculateRollNumbers(
  items: StudentPromotionItem[],
  mode: RollAssignmentMode
): StudentPromotionItem[] {
  if (mode === 'keep_existing') {
    return items.map(item => ({
      ...item,
      newRoll: item.currentRoll || ''
    }));
  }

  if (mode === 'merit') {
    // Sort promoted students by exam merit rank
    const promotedItems = items.filter(i => i.action === 'PROMOTE');
    const nonPromotedItems = items.filter(i => i.action !== 'PROMOTE');

    const sortedPromoted = [...promotedItems].sort((a, b) => {
      const rankA = a.examSummary?.meritRank ?? 9999;
      const rankB = b.examSummary?.meritRank ?? 9999;
      if (rankA !== rankB) return rankA - rankB;
      const gpaA = a.examSummary?.gpa ?? 0;
      const gpaB = b.examSummary?.gpa ?? 0;
      if (gpaB !== gpaA) return gpaB - gpaA;
      const marksA = a.examSummary?.totalObtained ?? 0;
      const marksB = b.examSummary?.totalObtained ?? 0;
      if (marksB !== marksA) return marksB - marksA;
      const rollA = parseInt(a.currentRoll || '9999', 10);
      const rollB = parseInt(b.currentRoll || '9999', 10);
      return rollA - rollB;
    });

    const newRollMap: Record<string, string> = {};
    sortedPromoted.forEach((item, index) => {
      newRollMap[item.studentId] = String(index + 1);
    });

    return items.map(item => {
      if (item.action === 'PROMOTE') {
        return {
          ...item,
          newRoll: newRollMap[item.studentId] || item.currentRoll || ''
        };
      }
      return {
        ...item,
        newRoll: item.currentRoll || ''
      };
    });
  }

  // 'manual' keeps whatever newRoll is already set
  return items;
}

/**
 * Apply bulk promotion to student collection and return updated students & history record
 */
export function executeClassPromotion(
  allStudents: Student[],
  promotionItems: StudentPromotionItem[],
  sessionConfig: {
    sourceClass: string;
    targetClass: string;
    examId?: string;
    examName?: string;
    academicYear: string;
    targetAcademicYear: string;
    actor: { uid: string; email: string; name?: string };
  }
): {
  updatedStudents: Student[];
  historyRecord: PromotionHistoryRecord;
  stats: { totalPromoted: number; totalRetained: number; totalGraduated: number; totalSkipped: number };
} {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const itemsMap = new Map<string, StudentPromotionItem>();
  promotionItems.forEach(item => itemsMap.set(item.studentId, item));

  let totalPromoted = 0;
  let totalRetained = 0;
  let totalGraduated = 0;
  let totalSkipped = 0;

  const historyStudents: PromotionHistoryRecord['students'] = [];

  const updatedStudents = allStudents.map(student => {
    const promotion = itemsMap.get(student.id);
    if (!promotion) {
      return student;
    }

    const { action, newRoll, targetClassLevel, targetClassId, targetSectionId, targetAcademicYearId, examSummary } = promotion;

    if (action === 'PROMOTE') {
      totalPromoted++;
      historyStudents.push({
        studentId: student.id,
        studentName: student.name,
        studentNameBn: student.nameBn,
        action: 'PROMOTE',
        oldRoll: student.roll || student.rollNumber,
        newRoll: newRoll || student.roll,
        gpa: examSummary?.gpa,
        grade: examSummary?.overallGrade,
        totalMarks: examSummary?.totalObtained,
        meritRank: examSummary?.meritRank,
        targetClass: targetClassLevel
      });

      return {
        ...student,
        classLevel: targetClassLevel,
        classId: targetClassId || targetClassLevel,
        sectionId: targetSectionId !== undefined ? targetSectionId : student.sectionId,
        roll: newRoll || student.roll,
        rollNumber: newRoll || student.rollNumber,
        academicYearId: targetAcademicYearId || student.academicYearId,
        status: 'Active' as const,
        isFormer: false,
        updatedAt: now,
        updatedBy: sessionConfig.actor.uid
      };
    }

    if (action === 'RETAIN') {
      totalRetained++;
      historyStudents.push({
        studentId: student.id,
        studentName: student.name,
        studentNameBn: student.nameBn,
        action: 'RETAIN',
        oldRoll: student.roll || student.rollNumber,
        newRoll: newRoll || student.roll,
        gpa: examSummary?.gpa,
        grade: examSummary?.overallGrade,
        totalMarks: examSummary?.totalObtained,
        meritRank: examSummary?.meritRank,
        targetClass: student.classLevel
      });

      return {
        ...student,
        roll: newRoll || student.roll,
        rollNumber: newRoll || student.rollNumber,
        academicYearId: targetAcademicYearId || student.academicYearId,
        updatedAt: now,
        updatedBy: sessionConfig.actor.uid
      };
    }

    if (action === 'GRADUATE') {
      totalGraduated++;
      historyStudents.push({
        studentId: student.id,
        studentName: student.name,
        studentNameBn: student.nameBn,
        action: 'GRADUATE',
        oldRoll: student.roll || student.rollNumber,
        newRoll: undefined,
        gpa: examSummary?.gpa,
        grade: examSummary?.overallGrade,
        totalMarks: examSummary?.totalObtained,
        meritRank: examSummary?.meritRank,
        targetClass: 'Graduated / সমাপনী সম্পন্ন'
      });

      return {
        ...student,
        status: 'Former' as const,
        isFormer: true,
        leavingDate: today,
        leavingReason: 'Graduated / সমাপনী পরীক্ষা উত্তীর্ণ',
        updatedAt: now,
        updatedBy: sessionConfig.actor.uid
      };
    }

    // SKIP
    totalSkipped++;
    return student;
  });

  const historyRecord: PromotionHistoryRecord = {
    id: `prom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    date: today,
    sourceClass: sessionConfig.sourceClass,
    targetClass: sessionConfig.targetClass,
    examId: sessionConfig.examId,
    examName: sessionConfig.examName,
    academicYear: sessionConfig.academicYear,
    targetAcademicYear: sessionConfig.targetAcademicYear,
    totalEvaluated: promotionItems.length,
    totalPromoted,
    totalRetained,
    totalGraduated,
    promotedBy: sessionConfig.actor.name || sessionConfig.actor.email || 'Admin',
    promotedByEmail: sessionConfig.actor.email,
    students: historyStudents
  };

  return {
    updatedStudents,
    historyRecord,
    stats: { totalPromoted, totalRetained, totalGraduated, totalSkipped }
  };
}

/**
 * Record a class promotion audit event in the platform log
 */
export async function recordPromotionAuditEvent(params: {
  historyRecord: PromotionHistoryRecord;
  actor: { uid: string; email: string; role?: string };
  institutionId?: string;
}) {
  try {
    await logAuditEvent({
      action: 'STUDENTS_BULK_PROMOTED' as any,
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      actorRole: params.actor.role || 'admin',
      institutionId: params.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'academic_promotion' as any,
      targetId: params.historyRecord.id,
      targetName: `${params.historyRecord.sourceClass} ➔ ${params.historyRecord.targetClass}`,
      metadata: {
        sourceClass: params.historyRecord.sourceClass,
        targetClass: params.historyRecord.targetClass,
        examName: params.historyRecord.examName,
        totalPromoted: params.historyRecord.totalPromoted,
        totalRetained: params.historyRecord.totalRetained,
        totalGraduated: params.historyRecord.totalGraduated,
        date: params.historyRecord.date
      }
    });
  } catch (err) {
    console.warn('[PromotionService] Audit event log error:', err);
  }
}
