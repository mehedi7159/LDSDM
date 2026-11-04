/**
 * Public Portal Data Split (Phase 2)
 * ==================================
 * All app data lives in the single Firestore document
 * `institution/main_store`. Historically that document had to stay
 * world-readable because the logged-out public portal (landing page,
 * public result search, student profile by ID, QR result verification)
 * renders from the same store via AppContext.
 *
 * This module derives a public-safe subset of the store into a second
 * document, `institution/public_portal`, containing ONLY the fields the
 * public portal actually renders (audited component-by-component):
 *
 *  - LandingView / LandingPortal ......... schoolProfile (name, address,
 *                                            phone, email, academic year)
 *  - AuthPage public result search ....... students (id / roll / name
 *                                            lookup), classes, exams,
 *                                            subjects, marks
 *  - PublicResultSearch .................. students, subjects, exams,
 *                                            marks, classes, schoolProfile
 *  - StudentProfileView (by Student ID) .. student profile fields shown
 *                                            on the profile / ID card,
 *                                            marks, remarks, exams,
 *                                            examSubjectAssignments,
 *                                            notices (alert banner)
 *  - VerifiedResultModal / QR verify ..... student name, father's name,
 *                                            roll, class, group; exam;
 *                                            schoolProfile (incl. logo &
 *                                            headmaster signature)
 *
 * Everything else in main_store — transactions, fee structures, users /
 * RBAC records, teachers & staff data, staff leaves, trash bin,
 * promotion history, assignment maps — is deliberately NOT copied.
 * Within student records, fields the portal never renders (mother's
 * name, guardian email, home address, date of birth, religion) are
 * also excluded.
 *
 * The derivation is pure: it is computed from the exact payload being
 * written to main_store, so the public document can never drift from
 * the real store and needs no separate data entry.
 */

/** Copy only the listed keys, skipping undefined values (Firestore rejects them). */
const pickFields = (record: any, keys: string[]): any => {
  if (!record || typeof record !== 'object') return record;
  const out: any = {};
  for (const key of keys) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  return out;
};

const pickList = (list: any, keys: string[]): any[] =>
  Array.isArray(list) ? list.map((item) => pickFields(item, keys)) : [];

// Fields of a student record that the public portal displays or searches by.
/**
 * The public-portal field list is also the Phase 1 choke point's
 * reference shape (services/mainStoreWrite.ts): a student record whose
 * keys are all in this list, replacing a fuller cloud record, is a
 * public-subset degradation and is refused at write time. Keep this
 * list in sync with what the portal actually renders.
 */
export const PUBLIC_STUDENT_FIELDS = [
  'id',
  'studentId',      // public lookup key (printed on ID card / result)
  'studentCode',    // public lookup key (StudentProfileView login)
  'admissionNumber',// public lookup key (StudentProfileView login)
  'name',
  'nameBn',
  'class',          // legacy field rendered by AuthPage result search
  'classLevel',
  'classId',
  'section',        // legacy field rendered by AuthPage result search
  'sectionId',
  'roll',
  'rollNumber',
  'group',
  'fatherName',     // printed on the public verified marksheet
  'fatherNameBn',   // printed on the public verified marksheet
  'guardianPhone',  // shown on the public student ID card / profile
  'bloodGroup',     // shown on the public student ID card / profile
  'photoUrl',       // shown on the public profile / ID card
];

// Subject fields needed to render marksheets and compute GPA/grades
// exactly as services/utils.calculateTotalGPA / getConsolidatedMark do.
const PUBLIC_SUBJECT_FIELDS = [
  'id',
  'code',
  'name',
  'nameBn',
  'shortName',
  'classLevel',
  'group',
  'fullMarks',
  'passMarks',
  'isOptional',
  'examIds',
  'hasCQ',
  'cqMarks',
  'cqPassMarks',
  'hasMCQ',
  'mcqMarks',
  'mcqPassMarks',
  'hasPractical',
  'practicalMarks',
  'practicalPassMarks',
  'order',
];

// Exam fields the portal lists, renders and uses for mark consolidation.
const PUBLIC_EXAM_FIELDS = [
  'id',
  'name',
  'nameBn',
  'category',
  'type',
  'academicYear',
  'startDate',
  'endDate',
  'status',
  'enableContributions',
  'contributions',
];

// Mark fields shown on public marksheets / used by the grading helpers.
// (enteredBy / updatedBy / absentReason stay private.)
const PUBLIC_MARK_FIELDS = [
  'id',
  'studentId',
  'subjectId',
  'examId',
  'obtained',
  'obtainedCQ',
  'obtainedMCQ',
  'obtainedPractical',
  'total',
  'fullMarks',
  'passMarks',
  'isAbsent',
];

// Class list fields used by the portal's class filter dropdowns.
const PUBLIC_CLASS_FIELDS = ['id', 'name', 'nameBn', 'order', 'displayName', 'level', 'status'];

// Exam-routine rows rendered by StudentProfileView's schedule tab.
const PUBLIC_EXAM_SUBJECT_ASSIGNMENT_FIELDS = [
  'id',
  'examId',
  'subjectId',
  'fullMarks',
  'passMarks',
  'cqFullMarks',
  'cqPassMarks',
  'mcqFullMarks',
  'mcqPassMarks',
  'practicalFullMarks',
  'practicalPassMarks',
  'examDate',
  'startTime',
  'durationMinutes',
  'status',
];

// Notice fields rendered by the public notice alert banner / modal.
// (authorEmail stays private; only the display name/role are public.)
const PUBLIC_NOTICE_FIELDS = [
  'id',
  'title',
  'content',
  'category',
  'priority',
  'target',
  'targetClass',
  'isPinned',
  'isActive',
  'showMarquee',
  'showAlertBanner',
  'authorName',
  'authorRole',
  'date',
  'createdAt',
  'expiresAt',
  'attachmentUrl',
];

/**
 * Build the public portal document from a main_store payload (or any
 * object carrying the same top-level keys). The result intentionally
 * uses the SAME top-level keys as main_store so AppContext's
 * applyRemoteData() can hydrate state from either document unchanged.
 */
export function buildPublicPortalData(source: any): any {
  if (!source || typeof source !== 'object') return {};
  return {
    // Institution display info (name, address, phone, logo, signatures)
    // is printed on every public marksheet and portal page; the
    // SchoolProfile type carries no credentials or secrets.
    schoolProfile: source.schoolProfile,
    students: pickList(source.students, PUBLIC_STUDENT_FIELDS),
    subjects: pickList(source.subjects, PUBLIC_SUBJECT_FIELDS),
    exams: pickList(source.exams, PUBLIC_EXAM_FIELDS),
    marks: pickList(source.marks, PUBLIC_MARK_FIELDS),
    // RemarkRecord is entirely public-display data (teacher's remark +
    // attendance summary shown on the student's own profile).
    remarks: pickList(source.remarks, [
      'studentId',
      'examId',
      'remark',
      'workingDays',
      'totalPresent',
      'totalAbsent',
    ]),
    classes: pickList(source.classes, PUBLIC_CLASS_FIELDS),
    examSubjectAssignments: pickList(
      source.examSubjectAssignments,
      PUBLIC_EXAM_SUBJECT_ASSIGNMENT_FIELDS
    ),
    notices: pickList(source.notices, PUBLIC_NOTICE_FIELDS),
    publicPortalMeta: {
      derivedFrom: 'institution/main_store',
      version: 1,
    },
    updatedAt: new Date().toISOString(),
  };
}
