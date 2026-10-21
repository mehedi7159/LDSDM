import { SchoolClass, Student, Subject, Exam, MarkRecord, FinanceTransaction, ClassFeeStructure } from '../types';

export const defaultFeeStructures: ClassFeeStructure[] = [];

/**
 * Returns empty transaction list ensuring no demo financial records exist.
 */
export const generateSampleFinanceData = (_students: Student[] = []): FinanceTransaction[] => {
  return [];
};

/**
 * Returns empty structures ensuring no demo students, subjects, or marks exist.
 */
export const generateSampleMadrashaData = (
  _classes: SchoolClass[],
  existingExams: Exam[]
): {
  sampleStudents: Student[];
  sampleSubjects: Subject[];
  sampleMarks: MarkRecord[];
  sampleExams: Exam[];
} => {
  return {
    sampleStudents: [],
    sampleSubjects: [],
    sampleMarks: [],
    sampleExams: existingExams || []
  };
};
