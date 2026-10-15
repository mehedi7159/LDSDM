import { 
  normalizeStudent, 
  filterStudents, 
  findStudentById, 
  buildCreateStudentPayload, 
  buildUpdateStudentPayload, 
  buildArchiveStudentPayload,
  generateStudentId
} from '../services/studentService';
import { validateStudent } from '../services/studentValidation';
import { 
  checkPermission, 
  buildAuthorizationContext, 
  isVerifiedSuperAdmin 
} from '../services/authorization';
import type { Student } from '../types/student';
import type { CustomRole, InstitutionMember, AuthorizationContext } from '../types/rbac';

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
console.log('🧪 PHASE 2 — STUDENT MANAGEMENT FOUNDATION TEST SUITE');
console.log('🧪 ========================================================\n');

// Sample Existing / Legacy Student Dataset
const existingLegacyStudents: any[] = [
  {
    id: 'std_legacy_001',
    studentId: 'STD-001',
    name: 'আব্দুল্লাহ আল মামুন',
    nameBn: 'আব্দুল্লাহ আল মামুন',
    nameEn: 'Abdullah Al Mamun',
    fatherName: 'মাওলানা ইব্রাহিম খলিল',
    motherName: 'মোসাম্মাৎ আয়েশা খাতুন',
    classLevel: 'Class 6',
    roll: '01',
    status: 'Active',
    isFormer: false,
    group: 'General'
  },
  {
    id: 'std_legacy_002',
    studentId: 'STD-002',
    name: 'মুহাম্মদ তাওহীদ হাসান',
    nameBn: 'মুহাম্মদ তাওহীদ হাসান',
    nameEn: 'Muhammad Tawhid Hasan',
    fatherName: 'মুহাম্মদ তারেকুল ইসলাম',
    motherName: 'নাজমুন নাহার',
    classLevel: 'Class 7',
    roll: '02',
    status: 'Active',
    isFormer: false,
    group: 'Science'
  },
  {
    id: 'std_legacy_003',
    studentId: 'STD-003',
    name: 'ফাতিমা খাতুন',
    nameBn: 'ফাতিমা খাতুন',
    nameEn: 'Fatima Khatun',
    fatherName: 'হাফেজ রফিকুল ইসলাম',
    motherName: 'মরিয়ম বেগম',
    classLevel: 'Class 6',
    roll: '03',
    status: 'Former',
    isFormer: true,
    leavingDate: '2024-01-15',
    leavingReason: 'Transferred to another district'
  }
];

// Snapshot of existing data to guarantee immutability across the suite
const existingDataSnapshot = JSON.stringify(existingLegacyStudents);

// ============================================================================
// TEST 1: Existing students can still be read
// ============================================================================
console.log('--- TEST 1: Safe Read Architecture ---');
const normalizedList = existingLegacyStudents.map(s => normalizeStudent(s));
assert(
  normalizedList.length === 3 &&
  normalizedList[0].name === 'আব্দুল্লাহ আল মামুন' &&
  normalizedList[1].name === 'মুহাম্মদ তাওহীদ হাসান' &&
  normalizedList[2].name === 'ফাতিমা খাতুন',
  'TEST 1: Existing students can still be read accurately without data loss'
);

// ============================================================================
// TEST 2: Student IDs remain stable
// ============================================================================
console.log('\n--- TEST 2: Student Identity Immutability ---');
const student1 = normalizedList[0];
const originalId = student1.id;

// Simulate an update payload
const { student: updatedStudent1 } = buildUpdateStudentPayload(student1, {
  name: 'আব্দুল্লাহ আল মামুন (সংশোধিত)',
  roll: '05',
  classLevel: 'Class 7'
});

assert(
  updatedStudent1.id === originalId &&
  updatedStudent1.id === 'std_legacy_001',
  'TEST 2: Student ID remains immutable across roll number and class changes'
);

// ============================================================================
// TEST 3: Student validation rejects invalid required data
// ============================================================================
console.log('\n--- TEST 3: Validation on Missing Required Data ---');
const invalidEmptyName = validateStudent({ name: '', classLevel: 'Class 6' }, { isNewRegistration: true });
const invalidMissingClass = validateStudent({ name: 'হুমায়ুন কবীর', classLevel: '' }, { isNewRegistration: true });
const invalidStatus = validateStudent({ name: 'হাসান মাহমুদ', classLevel: 'Class 6', status: 'INVALID_STATUS' as any });

assert(
  !invalidEmptyName.isValid && !!invalidEmptyName.errors.name,
  'TEST 3A: Validation rejects student with empty name'
);
assert(
  !invalidMissingClass.isValid && !!invalidMissingClass.errors.classLevel,
  'TEST 3B: Validation rejects new registration without class selection'
);
assert(
  !invalidStatus.isValid && !!invalidStatus.errors.status,
  'TEST 3C: Validation rejects unrecognized lifecycle status'
);

// ============================================================================
// TEST 4: Student validation accepts valid optional fields
// ============================================================================
console.log('\n--- TEST 4: Validation on Complete Optional Fields ---');
const completeStudentData: Partial<Student> = {
  name: 'মুহাম্মদ ওবায়দুল্লাহ',
  nameBn: 'মুহাম্মদ ওবায়দুল্লাহ',
  nameEn: 'Muhammad Obaidullah',
  gender: 'male',
  dateOfBirth: '2012-05-14',
  classLevel: 'Class 6',
  classId: 'cls_6',
  rollNumber: '15',
  academicYearId: 'year_2026',
  admissionDate: '2026-01-02',
  admissionNumber: 'ADM-2026-0045',
  fatherName: 'মাওলানা আব্দুর রাজ্জাক',
  motherName: 'মোসাম্মাৎ কুলসুম বেগম',
  guardianName: 'মাওলানা আব্দুর রাজ্জাক',
  guardianPhone: '01712345678',
  guardianEmail: 'guardian@example.com',
  address: 'গ্রাম: চর ভৈরব, ডাকঘর: উলিপুর, কুড়িগ্রাম',
  bloodGroup: 'B+',
  religion: 'Islam',
  photoUrl: 'https://example.com/photos/std_15.jpg',
  status: 'active'
};

const validResult = validateStudent(completeStudentData, { isNewRegistration: true });
assert(
  validResult.isValid && Object.keys(validResult.errors).length === 0,
  'TEST 4: Student validation successfully accepts valid optional fields'
);

// ============================================================================
// TEST 5: A user with students.view can view students
// ============================================================================
console.log('\n--- TEST 5: RBAC Authorization - students.view Permitted ---');
const teacherViewerRole: CustomRole = {
  id: 'role_teacher_viewer',
  institutionId: 'inst_madrasah_primary',
  name: 'viewer_teacher',
  displayName: 'শিক্ষক (অনুমোদিত)',
  description: 'Teacher with student viewing permissions',
  permissions: ['students.view'],
  isActive: true,
  isSystemRole: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const teacherMember: InstitutionMember = {
  uid: 'uid_teacher_01',
  institutionId: 'inst_madrasah_primary',
  email: 'teacher1@school.edu',
  displayName: 'Teacher One',
  roleId: 'role_teacher_viewer',
  dataScopes: { allClasses: true },
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const teacherAuthContext: AuthorizationContext = buildAuthorizationContext(
  { uid: 'uid_teacher_01', email: 'teacher1@school.edu' } as any,
  null,
  teacherMember,
  teacherViewerRole,
  'inst_madrasah_primary'
);

const canView = checkPermission(teacherAuthContext, 'students.view');
assert(
  canView === true,
  'TEST 5: A user with students.view permission can view students'
);

// ============================================================================
// TEST 6: A user without students.view cannot access student management
// ============================================================================
console.log('\n--- TEST 6: RBAC Authorization - students.view Denied ---');
const restrictedRole: CustomRole = {
  id: 'role_accounts_only',
  institutionId: 'inst_madrasah_primary',
  name: 'accountant_limited',
  displayName: 'হিসাব রক্ষক',
  permissions: ['finance.view', 'fees.view'],
  isActive: true,
  isSystemRole: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const restrictedMember: InstitutionMember = {
  uid: 'uid_acct_01',
  institutionId: 'inst_madrasah_primary',
  email: 'accounts@school.edu',
  displayName: 'Accountant User',
  roleId: 'role_accounts_only',
  dataScopes: { allClasses: true },
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const restrictedAuthContext: AuthorizationContext = buildAuthorizationContext(
  { uid: 'uid_acct_01', email: 'accounts@school.edu' } as any,
  null,
  restrictedMember,
  restrictedRole,
  'inst_madrasah_primary'
);

const cannotView = checkPermission(restrictedAuthContext, 'students.view');
assert(
  cannotView === false,
  'TEST 6: A user without students.view cannot access student management'
);

// ============================================================================
// TEST 7: A teacher's class scope is respected by the application authorization layer
// ============================================================================
console.log('\n--- TEST 7: Scoped Data Access (Class Scopes) ---');
const classScopedMember: InstitutionMember = {
  uid: 'uid_teacher_class7',
  institutionId: 'inst_madrasah_primary',
  email: 'class7teacher@school.edu',
  displayName: 'Class 7 Class Teacher',
  roleId: 'role_teacher_viewer',
  dataScopes: {
    allClasses: false,
    classes: ['Class 7', 'cls_7'] // Allowed only for Class 7
  },
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const classScopedContext: AuthorizationContext = buildAuthorizationContext(
  { uid: 'uid_teacher_class7', email: 'class7teacher@school.edu' } as any,
  null,
  classScopedMember,
  teacherViewerRole,
  'inst_madrasah_primary'
);

const allowedInClass7 = checkPermission(classScopedContext, 'students.view', { classId: 'Class 7' });
const deniedInClass6 = checkPermission(classScopedContext, 'students.view', { classId: 'Class 6' });

assert(
  allowedInClass7 === true && deniedInClass6 === false,
  "TEST 7: A teacher's class scope (Class 7) is strictly enforced (allowed for Class 7, denied for Class 6)"
);

// ============================================================================
// TEST 8: A user without students.edit cannot edit students
// ============================================================================
console.log('\n--- TEST 8: RBAC Authorization - students.edit Denied ---');
const canEdit = checkPermission(teacherAuthContext, 'students.edit');
assert(
  canEdit === false,
  'TEST 8: A user without students.edit is blocked from editing students'
);

// ============================================================================
// TEST 9: Super Admin retains full student access
// ============================================================================
console.log('\n--- TEST 9: Super Admin Full Access ---');
const superAdminUser = { uid: 'superadmin_uid_01', email: 'mehedihasansagor26@gmail.com' };
const superAdminClaims = { role: 'admin', isSuperAdmin: true, email: 'mehedihasansagor26@gmail.com' };

const isSuper = isVerifiedSuperAdmin(superAdminUser as any, superAdminClaims);
const superAdminContext = buildAuthorizationContext(
  superAdminUser as any,
  superAdminClaims,
  null,
  null,
  'inst_madrasah_primary'
);

const superCanView = checkPermission(superAdminContext, 'students.view');
const superCanCreate = checkPermission(superAdminContext, 'students.create');
const superCanEdit = checkPermission(superAdminContext, 'students.edit');
const superCanDelete = checkPermission(superAdminContext, 'students.delete');
const superCanArchive = checkPermission(superAdminContext, 'students.archive');

assert(
  isSuper === true &&
  superCanView === true &&
  superCanCreate === true &&
  superCanEdit === true &&
  superCanDelete === true &&
  superCanArchive === true,
  'TEST 9: Super Admin (mehedihasansagor26@gmail.com) retains full student management access'
);

// ============================================================================
// TEST 10: No existing student data is modified during this phase
// ============================================================================
console.log('\n--- TEST 10: Absolute Data Immutability Guarantee ---');
const finalDataSnapshot = JSON.stringify(existingLegacyStudents);
assert(
  existingDataSnapshot === finalDataSnapshot,
  'TEST 10: No existing student data was modified or deleted during this phase'
);

console.log(`\n========================================================`);
console.log(`Summary: ${passedTests}/${totalTests} Tests Passed`);
console.log(`========================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
