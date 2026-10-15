/**
 * Universal Production Grading & GPA Calculation Engine
 * Works for BOTH School and Madrasah institutions.
 * Reuses existing grading system configuration and supports custom institutional rules.
 */

import { GradingSystem, DEFAULT_GRADING_SYSTEM, MarkRecord, Subject, ExamSubjectAssignment } from '../types';

export interface SubjectGradingResult {
  obtained: number;
  fullMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  isPassed: boolean;
  isAbsent: boolean;
}

export interface StudentExamSummaryResult {
  studentId: string;
  totalObtained: number;
  totalFullMarks: number;
  overallPercentage: number;
  gpa: number;
  overallGrade: string;
  isPassed: boolean;
  failedSubjectCount: number;
  isAllAbsent: boolean;
  totalSubjects: number;
  subjectResults: Record<string, SubjectGradingResult>;
}

/**
 * Normalizes mark to 100 percentage scale for grade evaluation
 */
export function calculatePercentage(obtained: number, fullMarks: number): number {
  if (!fullMarks || fullMarks <= 0) return 0;
  if (isNaN(obtained) || obtained <= 0) return 0;
  const pct = (obtained / fullMarks) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
}

/**
 * Calculates grade for an individual subject mark
 */
export function calculateSubjectGrade(
  obtained: number,
  fullMarks: number = 100,
  gradingSystem: GradingSystem[] = DEFAULT_GRADING_SYSTEM,
  isAbsent: boolean = false,
  passMarks: number = 33
): string {
  if (isAbsent) {
    return 'F';
  }

  // Pass marks check
  if (obtained < passMarks) {
    return 'F';
  }

  const percentage = calculatePercentage(obtained, fullMarks);
  const matched = gradingSystem.find(g => percentage >= g.min && percentage <= g.max);
  return matched ? matched.grade : (percentage >= 80 ? 'A+' : 'F');
}

/**
 * Calculates grade point (GPA 0.0 - 5.0) for an individual subject
 */
export function calculateSubjectGradePoint(
  obtained: number,
  fullMarks: number = 100,
  gradingSystem: GradingSystem[] = DEFAULT_GRADING_SYSTEM,
  isAbsent: boolean = false,
  passMarks: number = 33
): number {
  if (isAbsent) {
    return 0.0;
  }

  if (obtained < passMarks) {
    return 0.0;
  }

  const percentage = calculatePercentage(obtained, fullMarks);
  const matched = gradingSystem.find(g => percentage >= g.min && percentage <= g.max);
  return matched ? matched.gpa : (percentage >= 80 ? 5.0 : 0.0);
}

/**
 * Calculates average GPA across a list of grade points.
 * If any core subject has 0.0 GPA (F grade), total GPA is 0.0 under standard Bangladesh grading.
 */
export function calculateGPA(
  gradePoints: number[],
  hasFailedAnySubject: boolean = false
): number {
  if (hasFailedAnySubject) {
    return 0.0;
  }

  if (!gradePoints || gradePoints.length === 0) {
    return 0.0;
  }

  const sum = gradePoints.reduce((acc, gp) => acc + gp, 0);
  const avg = sum / gradePoints.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Converts average GPA (0.0 - 5.0) back to an overall letter grade
 */
export function getGradeFromGPA(
  gpa: number,
  gradingSystem: GradingSystem[] = DEFAULT_GRADING_SYSTEM
): string {
  if (gpa >= 5.0) return 'A+';
  if (gpa >= 4.0) return 'A';
  if (gpa >= 3.5) return 'A-';
  if (gpa >= 3.0) return 'B';
  if (gpa >= 2.0) return 'C';
  if (gpa >= 1.0) return 'D';
  return 'F';
}

/**
 * Evaluates full exam result for a student across all subjects
 */
export function calculateStudentExamSummary(
  studentId: string,
  marks: MarkRecord[],
  examSubjects: (Subject | ExamSubjectAssignment)[],
  gradingSystem: GradingSystem[] = DEFAULT_GRADING_SYSTEM
): StudentExamSummaryResult {
  const subjectResults: Record<string, SubjectGradingResult> = {};
  let totalObtained = 0;
  let totalFullMarks = 0;
  let failedSubjectCount = 0;
  let absentCount = 0;
  const gradePoints: number[] = [];

  examSubjects.forEach(sub => {
    const subjectId = 'subjectId' in sub ? sub.subjectId : sub.id;
    const fullMarks = sub.fullMarks || 100;
    const passMarks = sub.passMarks !== undefined ? sub.passMarks : 33;
    const isOptional = 'isOptional' in sub ? !!sub.isOptional : false;
    const isFourthSubject = 'isFourthSubject' in sub ? !!sub.isFourthSubject : false;

    const markRecord = marks.find(m => m.studentId === studentId && m.subjectId === subjectId);
    const isAbsent = markRecord ? !!markRecord.isAbsent : true;
    const obtained = markRecord && !isAbsent ? markRecord.obtained || 0 : 0;

    const percentage = calculatePercentage(obtained, fullMarks);
    const grade = calculateSubjectGrade(obtained, fullMarks, gradingSystem, isAbsent, passMarks);
    const gradePoint = calculateSubjectGradePoint(obtained, fullMarks, gradingSystem, isAbsent, passMarks);
    const isPassed = !isAbsent && obtained >= passMarks && grade !== 'F';

    if (isAbsent) {
      absentCount++;
    }

    if (!isPassed && !isOptional && !isFourthSubject) {
      failedSubjectCount++;
    }

    totalObtained += obtained;
    totalFullMarks += fullMarks;

    // Core subjects count directly towards GPA calculation
    if (!isFourthSubject) {
      gradePoints.push(gradePoint);
    } else {
      // Fourth subject: marks above 2.0 (standard 4th subject GPA policy)
      const bonusGP = Math.max(0, gradePoint - 2.0);
      if (bonusGP > 0) {
        gradePoints.push(bonusGP);
      }
    }

    subjectResults[subjectId] = {
      obtained,
      fullMarks,
      percentage,
      grade,
      gradePoint,
      isPassed,
      isAbsent
    };
  });

  const totalSubjects = examSubjects.length;
  const isAllAbsent = totalSubjects > 0 && absentCount === totalSubjects;
  const hasFailed = failedSubjectCount > 0 || isAllAbsent;
  const gpa = calculateGPA(gradePoints, hasFailed);
  const overallGrade = hasFailed ? 'F' : getGradeFromGPA(gpa, gradingSystem);
  const overallPercentage = calculatePercentage(totalObtained, totalFullMarks);

  return {
    studentId,
    totalObtained,
    totalFullMarks,
    overallPercentage,
    gpa,
    overallGrade,
    isPassed: !hasFailed,
    failedSubjectCount,
    isAllAbsent,
    totalSubjects,
    subjectResults
  };
}
