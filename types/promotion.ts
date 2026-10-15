/**
 * Class Promotion Domain Types
 * Supports both School and Madrasah institutions.
 */

import { Student } from './student';

export type PromotionAction = 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'SKIP';
export type RollAssignmentMode = 'merit' | 'keep_existing' | 'manual';
export type PromotionRuleMode = 'passed_only' | 'all' | 'custom' | 'min_gpa';

export interface StudentExamPerformance {
  studentId: string;
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  gpa: number;
  overallGrade: string;
  isPassed: boolean;
  failedSubjectCount: number;
  failedSubjectNames?: string[];
  isAbsent: boolean;
  meritRank: number;
}

export interface StudentPromotionItem {
  studentId: string;
  student: Student;
  sourceClassLevel: string;
  sourceClassId?: string;
  targetClassLevel: string;
  targetClassId?: string;
  targetSectionId?: string;
  targetAcademicYearId?: string;
  currentRoll?: string;
  newRoll?: string;
  action: PromotionAction;
  selected: boolean;
  examSummary?: StudentExamPerformance;
  note?: string;
}

export interface PromotionSessionConfig {
  sourceClassLevel: string;
  sourceClassId?: string;
  targetClassLevel: string;
  targetClassId?: string;
  examId?: string;
  examName?: string;
  academicYearId?: string;
  targetAcademicYearId?: string;
  ruleMode: PromotionRuleMode;
  minGpa?: number;
  maxFailedSubjects?: number;
  rollAssignmentMode: RollAssignmentMode;
}

export interface PromotionHistoryRecord {
  id: string;
  timestamp: string;
  date: string;
  sourceClass: string;
  targetClass: string;
  examId?: string;
  examName?: string;
  academicYear: string;
  targetAcademicYear: string;
  totalEvaluated: number;
  totalPromoted: number;
  totalRetained: number;
  totalGraduated: number;
  promotedBy: string;
  promotedByEmail?: string;
  students: {
    studentId: string;
    studentName: string;
    studentNameBn?: string;
    action: PromotionAction;
    oldRoll?: string;
    newRoll?: string;
    gpa?: number;
    grade?: string;
    totalMarks?: number;
    meritRank?: number;
    targetClass: string;
  }[];
}
