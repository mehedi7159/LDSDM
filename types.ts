export interface SchoolProfile {
  name: string;
  nameBn?: string;
  address: string;
  addressBn?: string;
  phone: string;
  email: string;
  academicYear: string;
  logoUrl?: string; // Data URL or placeholder
  signatureUrl?: string; // Headmaster signature
  headMasterName: string;
  headMasterNameBn?: string;
  established?: string;
  watermarkUrl?: string;
  showWatermark?: boolean;
  showLogoOnCard?: boolean;
  showHeadmasterSignature?: boolean;
  showGuardianSignature?: boolean;
  showClassTeacherSignature?: boolean;
  resultCardTemplate?: 'Classic' | 'Monthly' | 'Term' | 'BW_Term' | 'Premium_Dakhil' | 'Premium_Colored' | 'Premium_Royal';
  banglaFont?: string;
  banglaNumberFont?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  nameBn?: string;
  order: number;
}

export interface Student {
  id: string; // Internal GUID
  studentId: string; // Manual Student ID (String)
  roll?: string; // Roll number
  name: string;
  nameBn?: string;
  fatherName?: string;
  fatherNameBn?: string;
  motherName?: string;
  motherNameBn?: string;
  classLevel: string; // Changed from enum to string (matches SchoolClass.name or id)
  group?: 'Science' | 'General' | 'Humanities' | 'Commerce' | '';
  status: 'Active' | 'Inactive' | 'Former';
  isFormer?: boolean;
  leavingDate?: string;
  leavingReason?: string;
}

export interface Subject {
  id: string;
  name: string;
  nameBn?: string;
  code?: string;
  classLevel: string; // Changed from enum to string
  examIds?: string[]; // Array of exam IDs this subject is assigned to
  group?: 'Science' | 'General' | 'Humanities' | 'Commerce' | 'All'; // For class 9 and 10
  fullMarks: number;
  passMarks: number;
  isOptional: boolean;
  order: number;
  // CQ (Creative Question / Theory)
  hasCQ?: boolean;
  cqMarks?: number;
  cqPassMarks?: number;
  // MCQ (Multiple Choice Question)
  hasMCQ?: boolean;
  mcqMarks?: number;
  mcqPassMarks?: number;
}

export type ExamCategory = 'Term' | 'Model' | 'Monthly';

export interface ExamContribution {
  examId: string;
  percentage: number;
}

export interface Exam {
  id: string;
  name: string;
  nameBn?: string;
  academicYear: string;
  category: ExamCategory;
  contributions?: ExamContribution[];
  enableContributions?: boolean;
}

export interface MarkRecord {
  id: string;
  studentId: string;
  subjectId: string;
  examId: string;
  obtained: number; // Total obtained (calculated)
  obtainedCQ?: number;
  obtainedMCQ?: number;
  isAbsent?: boolean;
  total: number; // Snapshot of full marks at time of entry
}

export interface RemarkRecord {
  studentId: string;
  examId: string;
  remark: string;
  workingDays?: number;
  totalPresent?: number;
  totalAbsent?: number;
}

export interface GradingSystem {
  grade: string;
  gpa: number;
  min: number;
  max: number;
}

export const DEFAULT_GRADING_SYSTEM: GradingSystem[] = [
  { grade: 'A+', gpa: 5.0, min: 80, max: 100 },
  { grade: 'A', gpa: 4.0, min: 70, max: 79 },
  { grade: 'A-', gpa: 3.5, min: 60, max: 69 },
  { grade: 'B', gpa: 3.0, min: 50, max: 59 },
  { grade: 'C', gpa: 2.0, min: 40, max: 49 },
  { grade: 'D', gpa: 1.0, min: 32, max: 39 },
  { grade: 'F', gpa: 0.0, min: 0, max: 31 },
];