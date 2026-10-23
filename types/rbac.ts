/**
 * RBAC (Role-Based Access Control) Foundation Types
 * Multi-Institution Custom Roles, Granular Permissions, Scoped Authorization & Platform Audit
 */

// 1. Granular Permission Modules & Actions
export type PermissionModule =
  | 'academicYears'
  | 'classes'
  | 'sections'
  | 'students'
  | 'teachers'
  | 'subjects'
  | 'attendance'
  | 'exams'
  | 'marks'
  | 'results'
  | 'fees'
  | 'payments'
  | 'finance'
  | 'reports'
  | 'users'
  | 'roles'
  | 'institution.settings';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'print'
  | 'export'
  | 'invite'
  | 'disable'
  | 'manage';

/**
 * Standard Permission format: MODULE.ACTION
 * E.g., 'students.view', 'attendance.create', 'finance.delete'
 */
export type StandardPermission =
  | 'academicYears.view'
  | 'academicYears.create'
  | 'academicYears.edit'
  | 'academicYears.archive'
  | 'classes.view'
  | 'classes.create'
  | 'classes.edit'
  | 'classes.delete'
  | 'classes.archive'
  | 'sections.view'
  | 'sections.create'
  | 'sections.edit'
  | 'sections.archive'
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  | 'students.archive'
  | 'students.print'
  | 'students.export'
  | 'teachers.view'
  | 'teachers.create'
  | 'teachers.edit'
  | 'teachers.delete'
  | 'subjects.view'
  | 'subjects.create'
  | 'subjects.edit'
  | 'subjects.delete'
  | 'subjects.archive'
  | 'subjects.export'
  | 'subjects.print'
  | 'subjectAssignments.view'
  | 'subjectAssignments.create'
  | 'subjectAssignments.edit'
  | 'subjectAssignments.archive'
  | 'teacherAssignments.view'
  | 'teacherAssignments.create'
  | 'teacherAssignments.edit'
  | 'teacherAssignments.archive'
  | 'classTeacherAssignments.view'
  | 'classTeacherAssignments.create'
  | 'classTeacherAssignments.edit'
  | 'classTeacherAssignments.archive'
  | 'attendance.view'
  | 'attendance.create'
  | 'attendance.edit'
  | 'attendance.delete'
  | 'exams.view'
  | 'exams.create'
  | 'exams.edit'
  | 'exams.delete'
  | 'exams.archive'
  | 'exams.finalize'
  | 'examSubjects.view'
  | 'examSubjects.create'
  | 'examSubjects.edit'
  | 'examSubjects.archive'
  | 'marks.view'
  | 'marks.create'
  | 'marks.edit'
  | 'marks.submit'
  | 'marks.correct'
  | 'marks.finalize'
  | 'marks.delete'
  | 'marks.export'
  | 'marks.print'
  | 'grading.view'
  | 'grading.edit'
  | 'results.view'
  | 'results.print'
  | 'fees.view'
  | 'fees.create'
  | 'fees.edit'
  | 'payments.view'
  | 'payments.create'
  | 'payments.edit'
  | 'finance.view'
  | 'finance.create'
  | 'finance.edit'
  | 'finance.delete'
  | 'reports.view'
  | 'reports.print'
  | 'users.view'
  | 'users.invite'
  | 'users.edit'
  | 'users.disable'
  | 'roles.view'
  | 'roles.create'
  | 'roles.edit'
  | 'roles.delete'
  | 'institution.settings.view'
  | 'institution.settings.edit'
  | '*'; // Wildcard permission for platform/institution owner

export type Permission = StandardPermission | (string & {});

// 2. Data Scope Model
export interface DataScope {
  allClasses?: boolean;
  classes?: string[]; // Array of allowed class IDs (e.g. ['cls_7', 'cls_8'])
  allSubjects?: boolean;
  subjects?: string[]; // Array of allowed subject IDs (e.g. ['sub_math'])
  assignedStudentsOnly?: boolean;
  [key: string]: any;
}

// 3. Custom Role Model (Tenant-Scoped: institutions/{institutionId}/roles/{roleId})
export interface CustomRole {
  id: string;
  institutionId: string;
  name: string; // e.g. 'class_teacher', 'principal', 'head_maulana'
  displayName: string; // e.g. 'Class Teacher', 'সহকারী মৌলভী'
  description?: string;
  permissions: Permission[];
  dataScopes?: DataScope;
  isSystemRole?: boolean; // System template roles cannot be deleted
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

// 4. Institution Member Model (Tenant-Scoped: institutions/{institutionId}/members/{uid})
export type MemberStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface InstitutionMember {
  uid: string;
  institutionId: string;
  email: string;
  displayName?: string;
  phone?: string;
  password?: string; // Stored securely for fallback authentication
  roleId: string; // References CustomRole.id in the same institution
  requestedRole?: string; // Stored during initial sign up
  status: MemberStatus;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  dataScopes?: DataScope; // Custom overrides over role default scopes
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

// 5. Default Role Template
export interface DefaultRoleTemplate {
  templateKey: string;
  defaultName: string;
  displayNameBn: string;
  displayNameEn: string;
  description: string;
  permissions: Permission[];
  defaultScopes?: DataScope;
}

// 6. Super Admin Security & Platform Audit Log Entry
export type AuditActionType =
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'ROLE_PERMISSIONS_CHANGED'
  | 'ROLE_STATUS_CHANGED'
  | 'MEMBER_INVITED'
  | 'MEMBER_ASSIGNED_ROLE'
  | 'MEMBER_SCOPES_UPDATED'
  | 'MEMBER_STATUS_CHANGED'
  | 'ACADEMIC_YEAR_CREATED'
  | 'ACADEMIC_YEAR_UPDATED'
  | 'ACADEMIC_YEAR_ACTIVATED'
  | 'ACADEMIC_YEAR_CLOSED'
  | 'CLASS_CREATED'
  | 'CLASS_UPDATED'
  | 'CLASS_ARCHIVED'
  | 'SECTION_CREATED'
  | 'SECTION_UPDATED'
  | 'SECTION_ARCHIVED'
  | 'STUDENT_CREATED'
  | 'STUDENT_UPDATED'
  | 'STUDENT_ARCHIVED'
  | 'STUDENT_PLACEMENT_UPDATED'
  | 'SUBJECT_CREATED'
  | 'SUBJECT_UPDATED'
  | 'SUBJECT_ARCHIVED'
  | 'CLASS_SUBJECT_ASSIGNED'
  | 'CLASS_SUBJECT_UPDATED'
  | 'CLASS_SUBJECT_ARCHIVED'
  | 'TEACHER_SUBJECT_ASSIGNED'
  | 'TEACHER_SUBJECT_UPDATED'
  | 'TEACHER_SUBJECT_ARCHIVED'
  | 'TEACHER_CLASS_ASSIGNED'
  | 'TEACHER_CLASS_UPDATED'
  | 'TEACHER_CLASS_ARCHIVED'
  | 'CLASS_TEACHER_ASSIGNED'
  | 'SECTION_TEACHER_ASSIGNED'
  | 'TEACHER_CREATED'
  | 'TEACHER_UPDATED'
  | 'TEACHER_ARCHIVED'
  | 'EXAM_CREATED'
  | 'EXAM_UPDATED'
  | 'EXAM_ARCHIVED'
  | 'EXAM_FINALIZED'
  | 'EXAM_SUBJECT_ASSIGNED'
  | 'EXAM_SUBJECT_UPDATED'
  | 'EXAM_SUBJECT_ARCHIVED'
  | 'MARKS_CREATED'
  | 'MARKS_UPDATED'
  | 'MARKS_SUBMITTED'
  | 'MARKS_LOCKED'
  | 'MARKS_FINALIZED'
  | 'MARKS_CORRECTED'
  | 'SUPERADMIN_AUDIT_ACCESSED'
  | 'SECURITY_POLICY_OVERRIDE'
  | 'INSTITUTION_SETTINGS_UPDATED'
  | 'EXAM_MARKS_RESTORED'
  | 'DATA_BACKUP_RESTORED';

export interface PlatformAuditLogEntry {
  id: string;
  action: AuditActionType;
  actorUid: string;
  actorEmail: string;
  actorRole: string; // 'superadmin' | 'institution_admin' | string
  institutionId: string;
  institutionName?: string;
  targetType: 'role' | 'member' | 'permission' | 'system' | 'settings' | 'student' | 'academic_year' | 'class' | 'section' | 'subject' | 'subject_assignment' | 'teacher_assignment' | 'teacher' | 'exam' | 'exam_subject' | 'mark' | 'grading';
  targetId: string;
  targetEmail?: string;
  targetName?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  timestamp: string; // ISO 8601
  metadata?: Record<string, any>;
}

// 7. Authorization Context for Evaluation
export interface AuthorizationContext {
  uid: string;
  email: string;
  isSuperAdmin: boolean;
  isInstitutionAdmin: boolean;
  institutionId?: string;
  member?: InstitutionMember | null;
  role?: CustomRole | null;
  permissions: Set<string>;
  dataScopes: DataScope;
}
