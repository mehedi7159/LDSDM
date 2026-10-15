import { 
  inspectAndParseExamBackup, 
  executeExamRestore, 
  normalizeMarkRecord 
} from '../services/examBackupService';
import { Exam, MarkRecord, RemarkRecord, Subject } from '../types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`, details || '');
  }
}

console.log('🧪 Starting Exam Backup & Restore Test Suite...\n');

// 1. Test normalizeMarkRecord
const normalized1 = normalizeMarkRecord({
  student_id: 'std-101',
  subject_id: 'sub-math',
  obtainedMarks: '85.5',
  fullMarks: '100',
  isAbsent: false
}, 'exam-annual-2024');

assert(
  normalized1 !== null &&
  normalized1.studentId === 'std-101' &&
  normalized1.subjectId === 'sub-math' &&
  normalized1.obtained === 85.5 &&
  normalized1.total === 100 &&
  normalized1.examId === 'exam-annual-2024',
  'normalizeMarkRecord parses legacy snake_case and string marks correctly'
);

// 2. Test inspectAndParseExamBackup with v2.0 format
const v2Package = {
  version: '2.0',
  type: 'madrasha_exam_marks_backup',
  exportDate: '2026-09-25T12:00:00.000Z',
  exam: {
    id: 'exam-first-term',
    name: 'First Term Examination',
    academicYear: '2024',
    category: 'Term'
  },
  examId: 'exam-first-term',
  marks: [
    { id: 'm1', studentId: 's1', subjectId: 'sub1', examId: 'exam-first-term', obtained: 92, total: 100 },
    { id: 'm2', studentId: 's2', subjectId: 'sub1', examId: 'exam-first-term', obtained: 78, total: 100 },
    { id: 'm3', studentId: 's1', subjectId: 'sub2', examId: 'exam-first-term', obtained: 88, total: 100 }
  ],
  remarks: [
    { studentId: 's1', examId: 'exam-first-term', remark: 'Excellent performance' }
  ],
  subjects: [
    { id: 'sub1', name: 'Quran Mazid', classLevel: 'Class 6', fullMarks: 100, passMarks: 33, order: 1, isOptional: false }
  ]
};

const inspection1 = inspectAndParseExamBackup(JSON.stringify(v2Package));
assert(inspection1.isValid === true, 'v2.0 exam backup format is valid');
assert(inspection1.stats.totalMarks === 3, 'v2.0 parsed 3 mark records');
assert(inspection1.stats.totalStudents === 2, 'v2.0 detected 2 unique students');
assert(inspection1.detectedExamId === 'exam-first-term', 'v2.0 detected exam ID correctly');
assert(inspection1.remarks.length === 1, 'v2.0 detected 1 remark');

// 3. Test inspectAndParseExamBackup with raw array format
const rawArray = [
  { studentId: 'std-201', subjectId: 'sub-arabic', marks: 95, examId: 'exam-annual' },
  { studentId: 'std-202', subjectId: 'sub-arabic', mark: 60, isAbsent: false, examId: 'exam-annual' }
];
const inspection2 = inspectAndParseExamBackup(JSON.stringify(rawArray));
assert(inspection2.isValid === true, 'Raw marks array format is valid');
assert(inspection2.stats.totalMarks === 2, 'Raw marks parsed 2 records');
assert(inspection2.detectedExamId === 'exam-annual', 'Detected examId from items in raw array');

// 4. Test executeExamRestore with Replace Mode
const currentExams: Exam[] = [
  { id: 'exam-1', name: 'First Term Exam', academicYear: '2024', category: 'Term' },
  { id: 'exam-2', name: 'Annual Exam', academicYear: '2024', category: 'Term' }
];

const currentMarks: MarkRecord[] = [
  // Exam 1 existing marks (should be replaced)
  { id: 'old-1', studentId: 's1', subjectId: 'sub1', examId: 'exam-1', obtained: 50, total: 100 },
  // Exam 2 existing marks (must be PRESERVED untouched)
  { id: 'keep-1', studentId: 's1', subjectId: 'sub1', examId: 'exam-2', obtained: 99, total: 100 },
  { id: 'keep-2', studentId: 's2', subjectId: 'sub1', examId: 'exam-2', obtained: 95, total: 100 }
];

const currentRemarks: RemarkRecord[] = [
  { studentId: 's1', examId: 'exam-2', remark: 'Annual remark' }
];

const currentSubjects: Subject[] = [];

const restoreResultReplace = executeExamRestore({
  inspection: inspection1,
  targetExamId: 'exam-1',
  restoreMode: 'replace',
  includeRemarks: true,
  includeSubjects: true,
  currentExams,
  currentMarks,
  currentRemarks,
  currentSubjects
});

assert(
  restoreResultReplace.updatedMarks.length === 5, // 2 preserved from exam-2 + 3 restored for exam-1
  'Replace Mode preserved exam-2 marks and replaced exam-1 marks'
);
assert(
  restoreResultReplace.updatedMarks.filter(m => m.examId === 'exam-2').length === 2,
  'Exam-2 marks untouched in Replace mode'
);
assert(
  restoreResultReplace.updatedMarks.filter(m => m.examId === 'exam-1').length === 3,
  'Exam-1 marks cleanly restored in Replace mode'
);
assert(
  restoreResultReplace.updatedSubjects.length === 1,
  'Missing subject automatically created from backup'
);

// 5. Test executeExamRestore with New Exam Auto-Creation
const restoreResultNewExam = executeExamRestore({
  inspection: inspection1,
  targetExamId: 'exam-brand-new',
  targetExamDetails: {
    name: 'Mid Term 2025',
    academicYear: '2025',
    category: 'Term'
  },
  restoreMode: 'replace',
  includeRemarks: true,
  includeSubjects: false,
  currentExams,
  currentMarks,
  currentRemarks,
  currentSubjects
});

assert(
  restoreResultNewExam.stats.examCreated === true,
  'Automatically created non-existent exam in exams list'
);
assert(
  restoreResultNewExam.updatedExams.some(e => e.id === 'exam-brand-new' && e.name === 'Mid Term 2025'),
  'New exam properly stored with requested name and academic year'
);

// 6. Test executeExamRestore with Merge Mode
const initialMarksForMerge: MarkRecord[] = [
  { id: 'm-s1-sub1', studentId: 's1', subjectId: 'sub1', examId: 'exam-1', obtained: 40, total: 100 },
  { id: 'm-s3-sub1', studentId: 's3', subjectId: 'sub1', examId: 'exam-1', obtained: 85, total: 100 } // s3 not in backup, should remain!
];

const restoreResultMerge = executeExamRestore({
  inspection: inspection1, // has s1 (sub1: 92, sub2: 88) and s2 (sub1: 78)
  targetExamId: 'exam-1',
  restoreMode: 'merge',
  includeRemarks: false,
  includeSubjects: false,
  currentExams,
  currentMarks: initialMarksForMerge,
  currentRemarks: [],
  currentSubjects: []
});

assert(
  restoreResultMerge.updatedMarks.length === 4,
  'Merge Mode retained s3 while updating s1 and adding s2'
);
const s1Sub1 = restoreResultMerge.updatedMarks.find(m => m.studentId === 's1' && m.subjectId === 'sub1');
assert(s1Sub1?.obtained === 92, 'Merge Mode successfully updated s1 score to 92');
const s3Sub1 = restoreResultMerge.updatedMarks.find(m => m.studentId === 's3' && m.subjectId === 'sub1');
assert(s3Sub1?.obtained === 85, 'Merge Mode retained unaffected student s3');

console.log(`\n========================================`);
console.log(`Summary: ${passedTests}/${totalTests} Tests Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
