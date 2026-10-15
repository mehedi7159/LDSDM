/**
 * Class Promotion Domain & Service Test Suite
 */

import { 
  getNextClass, 
  computeClassExamPerformance, 
  buildInitialPromotionItems, 
  recalculateRollNumbers, 
  executeClassPromotion 
} from '../services/promotionService';
import type { Student, SchoolClass, Subject, MarkRecord, GradingSystem } from '../types';
import type { PromotionSessionConfig, StudentPromotionItem } from '../types/promotion';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`, details || '');
  }
}

console.log('🧪 ========================================================');
console.log('🧪 CLASS PROMOTION FEATURE TEST SUITE');
console.log('🧪 ========================================================\n');

// Test Classes
const mockClasses: SchoolClass[] = [
  { id: 'c1', name: 'Class 1', order: 1 },
  { id: 'c2', name: 'Class 2', order: 2 },
  { id: 'c3', name: 'Class 3', order: 3 },
  { id: 'c4', name: 'Class 10', order: 10 }
];

// Test 1: getNextClass sequencing
console.log('--- Test Group 1: Academic Level Progression ---');
const nextFromClass1 = getNextClass('Class 1', mockClasses);
assert(nextFromClass1.nextClass?.name === 'Class 2', 'Class 1 progression leads to Class 2');
assert(!nextFromClass1.isLastClass, 'Class 1 is not the last class');

const nextFromClass10 = getNextClass('Class 10', mockClasses);
assert(nextFromClass10.nextClass === null, 'Final class has no next class');
assert(nextFromClass10.isLastClass === true, 'Final class is identified as last class');

// Test 2: computeClassExamPerformance & Merit Ranking
console.log('\n--- Test Group 2: Exam Performance & Merit Ranking ---');
const mockStudents: Student[] = [
  {
    id: 's1',
    studentId: 'STD-001',
    name: 'Rahim Khan',
    classLevel: 'Class 1',
    roll: '05',
    status: 'Active',
    isFormer: false
  },
  {
    id: 's2',
    studentId: 'STD-002',
    name: 'Karim Ahmed',
    classLevel: 'Class 1',
    roll: '02',
    status: 'Active',
    isFormer: false
  },
  {
    id: 's3',
    studentId: 'STD-003',
    name: 'Tariq Hasan',
    classLevel: 'Class 1',
    roll: '01',
    status: 'Active',
    isFormer: false
  }
];

const mockSubjects: Subject[] = [
  {
    id: 'sub_math',
    name: 'Mathematics',
    classLevel: 'Class 1',
    fullMarks: 100,
    passMarks: 33,
    isOptional: false,
    order: 1
  },
  {
    id: 'sub_eng',
    name: 'English',
    classLevel: 'Class 1',
    fullMarks: 100,
    passMarks: 33,
    isOptional: false,
    order: 2
  }
];

// Rahim gets 90 & 85 (Total 175, GPA 5.0, Passed)
// Karim gets 70 & 65 (Total 135, GPA 3.75, Passed)
// Tariq gets 25 & 60 (Total 85, GPA 0.0, Failed in Math)
const mockMarks: MarkRecord[] = [
  { id: 'm1', studentId: 's1', subjectId: 'sub_math', examId: 'exam_annual', obtained: 90, total: 100 },
  { id: 'm2', studentId: 's1', subjectId: 'sub_eng', examId: 'exam_annual', obtained: 85, total: 100 },
  { id: 'm3', studentId: 's2', subjectId: 'sub_math', examId: 'exam_annual', obtained: 70, total: 100 },
  { id: 'm4', studentId: 's2', subjectId: 'sub_eng', examId: 'exam_annual', obtained: 65, total: 100 },
  { id: 'm5', studentId: 's3', subjectId: 'sub_math', examId: 'exam_annual', obtained: 25, total: 100 },
  { id: 'm6', studentId: 's3', subjectId: 'sub_eng', examId: 'exam_annual', obtained: 60, total: 100 }
];

const performanceMap = computeClassExamPerformance(
  mockStudents,
  'exam_annual',
  mockMarks,
  mockSubjects,
  'Class 1'
);

assert(performanceMap['s1'].isPassed === true, 'Rahim passed both subjects');
assert(performanceMap['s1'].gpa === 5.0, 'Rahim achieved GPA 5.0');
assert(performanceMap['s1'].meritRank === 1, 'Rahim ranked 1st in Merit');

assert(performanceMap['s2'].isPassed === true, 'Karim passed both subjects');
assert(performanceMap['s2'].meritRank === 2, 'Karim ranked 2nd in Merit');

assert(performanceMap['s3'].isPassed === false, 'Tariq failed in Mathematics');
assert(performanceMap['s3'].gpa === 0.0, 'Tariq has 0.0 GPA due to failing Math');
assert(performanceMap['s3'].failedSubjectCount === 1, 'Tariq has 1 failed subject');
assert(performanceMap['s3'].meritRank === 3, 'Failed student ranked after passing students');

// Test 3: buildInitialPromotionItems with different rule modes
console.log('\n--- Test Group 3: Promotion Rules & Action Evaluation ---');

// Rule: passed_only
const configPassedOnly: PromotionSessionConfig = {
  sourceClassLevel: 'Class 1',
  targetClassLevel: 'Class 2',
  examId: 'exam_annual',
  targetAcademicYearId: '2027',
  ruleMode: 'passed_only',
  rollAssignmentMode: 'merit'
};

const itemsPassedOnly = buildInitialPromotionItems(
  mockStudents,
  configPassedOnly,
  performanceMap,
  false
);

const rahimItem = itemsPassedOnly.find(i => i.studentId === 's1');
const tariqItem = itemsPassedOnly.find(i => i.studentId === 's3');

assert(rahimItem?.action === 'PROMOTE', 'Passed student action is PROMOTE');
assert(rahimItem?.newRoll === '1', 'Merit rank 1 assigned roll 1');
assert(tariqItem?.action === 'RETAIN', 'Failed student action is RETAIN');

// Test 4: recalculateRollNumbers with merit vs keep_existing
console.log('\n--- Test Group 4: Roll Number Allocation Modes ---');
const itemsKeepExisting = recalculateRollNumbers(itemsPassedOnly, 'keep_existing');
const rahimKeep = itemsKeepExisting.find(i => i.studentId === 's1');
assert(rahimKeep?.newRoll === '05', 'keep_existing preserves original roll 05');

const itemsMerit = recalculateRollNumbers(itemsPassedOnly, 'merit');
const rahimMerit = itemsMerit.find(i => i.studentId === 's1');
const karimMerit = itemsMerit.find(i => i.studentId === 's2');
assert(rahimMerit?.newRoll === '1', 'Merit roll assigns 1 to 1st place');
assert(karimMerit?.newRoll === '2', 'Merit roll assigns 2 to 2nd place');

// Test 5: executeClassPromotion execution & student record updates
console.log('\n--- Test Group 5: Execution & Audit Record Creation ---');
const executionResult = executeClassPromotion(
  mockStudents,
  itemsMerit,
  {
    sourceClass: 'Class 1',
    targetClass: 'Class 2',
    examId: 'exam_annual',
    examName: 'Annual Exam 2026',
    academicYear: '2026',
    targetAcademicYear: '2027',
    actor: { uid: 'admin_test_uid', email: 'admin@madrasha.edu.bd', name: 'Principal' }
  }
);

assert(executionResult.stats.totalPromoted === 2, '2 students promoted to Class 2');
assert(executionResult.stats.totalRetained === 1, '1 student retained in Class 1');

const updatedRahim = executionResult.updatedStudents.find(s => s.id === 's1');
assert(updatedRahim?.classLevel === 'Class 2', 'Promoted student classLevel updated to Class 2');
assert(updatedRahim?.roll === '1', 'Promoted student roll updated to 1');
assert(updatedRahim?.academicYearId === '2027', 'Promoted student academicYear updated to 2027');

const updatedTariq = executionResult.updatedStudents.find(s => s.id === 's3');
assert(updatedTariq?.classLevel === 'Class 1', 'Retained student remains in Class 1');

assert(executionResult.historyRecord.totalPromoted === 2, 'History record contains accurate promoted count');
assert(executionResult.historyRecord.students.length === 3, 'History record tracks all evaluated students');
assert(executionResult.historyRecord.promotedBy === 'Principal', 'History record tracks authorizing actor');

console.log('\n========================================================');
console.log(`Test Results: ${passedTests} passed of ${totalTests} total tests`);
console.log('========================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL PROMOTION TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
