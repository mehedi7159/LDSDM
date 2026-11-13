/**
 * Universal Production Grading & GPA Calculation Engine
 * Works for BOTH School and Madrasah institutions.
 * Reuses existing grading system configuration and supports custom institutional rules.
 */

import { GradingSystem, DEFAULT_GRADING_SYSTEM, MarkRecord, Subject, ExamSubjectAssignment } from '../types';
import { calculateGrade } from './utils';

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
 * The one pass-rate calculation for every page (dashboard, exam results,
 * reports): passed / evaluated students, 1 decimal. A student counts as
 * evaluated once they have at least one mark in the exam; 0 evaluated
 * is 0%, never 100%. Pass/fail itself stays with calculateTotalGPA
 * (no marks = fail) — this only unifies the rate.
 */
export function calcPassRate(passed: number, evaluated: number): number {
  if (!evaluated || evaluated <= 0) return 0;
  return Number(((passed / evaluated) * 100).toFixed(1));
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
  // Same >= min descending scan as utils.calculateGrade: the bands
  // are integers, so a fractional percentage between bands (79.33%)
  // must fall into the band below it, not through to 'F'.
  const matched = gradingSystem.find(g => percentage >= g.min);
  return matched ? matched.grade : 'F';
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
  // Same >= min descending scan as utils.calculateGrade (see above).
  const matched = gradingSystem.find(g => percentage >= g.min);
  return matched ? matched.gpa : 0.0;
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
 * Evaluates full exam result for a student across all subjects.
 *
 * GPA math follows the display engine (services/utils.ts
 * calculateTotalGPA) exactly, so promotion can no longer contradict the
 * result card: core subjects average; the first optional subject adds
 * only its grade point above 2.0 to the core sum; the result is capped
 * at 5.0. isFourthSubject has no rule in the display engine, so it is
 * ignored here too — whether a 4th subject should be optional-like is
 * an open question for the principal, not something to invent here.
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
  let totalGPA = 0;
  let coreCount = 0;
  let optionalHandled = false;

  examSubjects.forEach(sub => {
    const subjectId = 'subjectId' in sub ? sub.subjectId : sub.id;
    const fullMarks = sub.fullMarks || 100;
    const passMarks = sub.passMarks !== undefined ? sub.passMarks : 33;
    const isOptional = 'isOptional' in sub ? !!sub.isOptional : false;
    // Component pass marks: a Subject carries hasCQ/hasMCQ flags; an
    // assignment carries only the component full marks, so a present
    // (> 0) component stands in for the flag there.
    const hasCQ = (sub as Subject).hasCQ !== undefined
      ? !!(sub as Subject).hasCQ
      : ((sub as ExamSubjectAssignment).cqFullMarks ?? 0) > 0;
    const hasMCQ = (sub as Subject).hasMCQ !== undefined
      ? !!(sub as Subject).hasMCQ
      : ((sub as ExamSubjectAssignment).mcqFullMarks ?? 0) > 0;
    const cqPassMarks = sub.cqPassMarks ?? 0;
    const mcqPassMarks = sub.mcqPassMarks ?? 0;

    const markRecord = marks.find(m => m.studentId === studentId && m.subjectId === subjectId);
    const isAbsent = markRecord ? !!markRecord.isAbsent : true;
    const obtained = markRecord && !isAbsent ? markRecord.obtained || 0 : 0;

    const percentage = calculatePercentage(obtained, fullMarks);
    const { grade, gpa: gradePoint } = calculateGrade(obtained, fullMarks);

    // Same pass checks as the display engine: absent fails; a CQ/MCQ
    // component below its pass mark fails; otherwise the subject total
    // below pass marks fails. No record at all fails (unless pass
    // marks are 0 and there are no components).
    let isPassed = false;
    if (markRecord) {
      isPassed = !isAbsent
        && !(hasCQ && (markRecord.obtainedCQ ?? 0) < cqPassMarks)
        && !(hasMCQ && (markRecord.obtainedMCQ ?? 0) < mcqPassMarks)
        && ((hasCQ || hasMCQ) || obtained >= passMarks);
    } else if (passMarks <= 0 && !hasCQ && !hasMCQ) {
      isPassed = true;
    }

    if (isAbsent) {
      absentCount++;
    }

    if (!isOptional) {
      coreCount++;
      totalGPA += isPassed ? gradePoint : 0;
      totalObtained += obtained;
      totalFullMarks += fullMarks;
      if (!isPassed) failedSubjectCount++;
    } else if (!optionalHandled) {
      // First optional only: its excess over 2.0 joins the core sum
      // and it can never fail the student. Later optionals are
      // ignored, exactly as in the display engine.
      optionalHandled = true;
      totalObtained += obtained;
      totalFullMarks += fullMarks;
      if (gradePoint > 2.0) totalGPA += gradePoint - 2.0;
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
  const rawGPA = coreCount > 0 ? totalGPA / coreCount : 0;
  const gpa = hasFailed ? 0.0 : Math.min(5.0, Math.round(rawGPA * 100) / 100);
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
