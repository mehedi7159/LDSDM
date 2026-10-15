/**
 * Production Academic Foundation Types
 * Academic Year, Class, Section & Student Academic Placement
 * Works for BOTH School and Madrasah.
 */

export type AcademicYearStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED';
export type AcademicEntityStatus = 'ACTIVE' | 'INACTIVE';
export type TeacherStatus = 'ACTIVE' | 'INACTIVE';
export type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'MARKS_ENTRY' | 'FINALIZED' | 'ARCHIVED';
export type MarkStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'FINALIZED';
export type SubjectCategory = 'General' | 'Science' | 'Commerce' | 'Humanities' | 'Islamic' | 'Language' | 'Vocational' | 'Other';
export type SubjectType = 'Core' | 'Elective' | 'Mandatory' | 'Optional' | 'Fourth';
export type ClassTeacherType = 'CLASS_TEACHER' | 'SECTION_TEACHER';

export interface AcademicYear {
  id: string;
  institutionId?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status: AcademicYearStatus;
  isCurrent: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Section {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  classId: string;
  name: string;
  displayName?: string;
  capacity?: number;
  status: AcademicEntityStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ClassAcademicConfig {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  name: string;
  nameBn?: string;
  displayName?: string;
  level?: number;
  order: number;
  status?: AcademicEntityStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Subject {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  code?: string;
  name: string;
  nameBn?: string;
  shortName?: string;
  displayName?: string;
  category?: SubjectCategory | string;
  type?: SubjectType | string;
  classLevel: string; // for backward compatibility with marks/exams
  examIds?: string[]; // for backward compatibility with exam toggle
  group?: 'Science' | 'General' | 'Humanities' | 'Commerce' | 'All'; // for backward compatibility
  fullMarks: number;
  maxMarks?: number;
  passMarks: number;
  isOptional: boolean;
  isFourthSubject?: boolean;
  order: number;
  // CQ (Creative Question / Theory)
  hasCQ?: boolean;
  cqMarks?: number;
  cqPassMarks?: number;
  // MCQ (Multiple Choice Question)
  hasMCQ?: boolean;
  mcqMarks?: number;
  mcqPassMarks?: number;
  // Practical component
  hasPractical?: boolean;
  practicalMarks?: number;
  practicalPassMarks?: number;
  status?: AcademicEntityStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AcademicTeacher {
  id: string;
  institutionId?: string;
  userId?: string; // Auth UID when linked
  name: string;
  nameBn?: string;
  employeeCode?: string;
  designation?: string;
  email?: string;
  phone?: string;
  status: TeacherStatus;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ClassSubjectAssignment {
  id: string;
  institutionId?: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  isCompulsory?: boolean;
  status: AcademicEntityStatus;
  order: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TeacherSubjectAssignment {
  id: string;
  institutionId?: string;
  academicYearId: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  sectionId?: string;
  status: AcademicEntityStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ClassTeacherAssignment {
  id: string;
  institutionId?: string;
  academicYearId: string;
  teacherId: string;
  classId: string;
  sectionId?: string;
  type: ClassTeacherType;
  status: AcademicEntityStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ExamSubjectAssignment {
  id: string;
  institutionId?: string;
  examId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  fullMarks: number;
  passMarks: number;
  cqFullMarks?: number;
  cqPassMarks?: number;
  mcqFullMarks?: number;
  mcqPassMarks?: number;
  practicalFullMarks?: number;
  practicalPassMarks?: number;
  examDate?: string;
  startTime?: string;
  durationMinutes?: number;
  status: AcademicEntityStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AcademicValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface StudentPlacementParams {
  studentId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  rollNumber?: string;
}

// -------------------------------------------------------------
// STEP 3: ACADEMIC ROUTINE, SYLLABUS & CALENDAR MODELS
// -------------------------------------------------------------

export type DayOfWeek = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface ClassRoutineItem {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  classLevel: string; // e.g. '১ম শ্রেণি', 'Class 1'
  sectionName?: string; // e.g. 'ক', 'A', 'আবু বকর'
  dayOfWeek: DayOfWeek;
  periodNumber: number; // 1, 2, 3, 4, 5, 6, 7
  periodName?: string; // '১ম ঘণ্টা', '২য় ঘণ্টা'
  startTime: string; // '09:00 AM'
  endTime: string; // '09:45 AM'
  subjectId: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  roomNumber?: string;
  status: AcademicEntityStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SyllabusItem {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  classLevel: string;
  subjectId: string;
  subjectName?: string;
  examId?: string;
  termName: string; // '১ম সাময়িক', '২য় সাময়িক', 'বার্ষিক'
  chapterNo?: string;
  title: string;
  topics?: string;
  totalPeriods?: number;
  completedPeriods?: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  teacherNotes?: string;
  targetDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AcademicCalendarEvent {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  title: string;
  titleBn?: string;
  type: 'HOLIDAY' | 'EXAM' | 'EVENT' | 'VACATION' | 'ACADEMIC_TERM' | 'MEETING';
  startDate: string;
  endDate: string;
  totalDays: number;
  isHoliday: boolean;
  description?: string;
  applicableClasses?: string[];
  createdAt?: string;
  updatedAt?: string;
}
