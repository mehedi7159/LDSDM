/**
 * Student Domain Entity & Management Foundation Types
 * Multi-Institution & Dual Compatibility (School + Madrasah)
 */

export type StudentLifecycleStatus = 
  | 'active'
  | 'inactive'
  | 'transferred'
  | 'graduated'
  | 'dropped'
  | 'archived'
  | 'Active'
  | 'Inactive'
  | 'Former';

export type StudentGender = 'male' | 'female' | 'other' | '';

/**
 * Tuition-fee discount arrangement for one student (set on the admission
 * form / student edit form). 'none' = institute fee in full; 'full' =
 * institute waives the whole fee; 'partial' = institute waives part;
 * 'etim' = orphan fund pays part, student pays the rest; 'other' =
 * another named fund pays part, student pays the rest.
 */
export type FeeDiscountType = 'none' | 'full' | 'partial' | 'etim' | 'other';

/**
 * Standard Future-Ready Student Model
 * Strictly backward-compatible with legacy Student objects.
 */
export interface Student {
  // Primary immutable unique identifier (stable internal GUID/UUID)
  id: string;

  // Multi-Institution Tenant Isolation (future-ready)
  institutionId?: string;

  // External / Institutional Identifiers
  studentId?: string; // Legacy manual student ID string (e.g. "STD-001")
  studentCode?: string; // Standard institutional code
  admissionNumber?: string; // Institutional admission ledger number

  // Identity & Names
  name: string;
  nameBn?: string;
  nameEn?: string;

  // Demographics
  gender?: StudentGender;
  dateOfBirth?: string; // YYYY-MM-DD
  bloodGroup?: string;
  religion?: string;

  // Academic Placement
  classId?: string; // Reference to SchoolClass ID
  classLevel: string; // Legacy class name or ID (maintained for 100% backward compatibility)
  sectionId?: string; // Reference to Section ID
  roll?: string; // Legacy roll number string
  rollNumber?: string; // Standardized roll number string
  academicYearId?: string; // Reference to Academic Year
  admissionDate?: string; // YYYY-MM-DD
  group?: 'Science' | 'General' | 'Humanities' | 'Commerce' | '';

  // Guardian Details (Prepared for future Guardian entity)
  fatherName?: string;
  fatherNameBn?: string;
  motherName?: string;
  motherNameBn?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;

  // Media
  photoUrl?: string;

  // Status & Lifecycle
  status: StudentLifecycleStatus;
  isFormer?: boolean;
  leavingDate?: string;
  leavingReason?: string;

  // Tuition Fee Arrangement (optional; absent = no discount, payable = base)
  feeDiscountType?: FeeDiscountType;
  feeBaseAmount?: number; // institute-set monthly fee used for this arrangement
  feeWaiverAmount?: number; // institute-waived part (full / partial waiver)
  feeFundAmount?: number; // part paid by a fund (etim / other fund)
  feeFundSource?: string; // fund name; 'এতিম ফান্ড' for etim, free text for other
  feePayableAmount?: number; // what the student pays per month (= base - waiver - fund, never negative)

  // Extensibility & Audit
  metadata?: Record<string, any>;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Filter & Search options for Student queries
 */
export interface StudentFilterOptions {
  searchTerm?: string;
  classId?: string;
  classLevel?: string;
  sectionId?: string;
  academicYearId?: string;
  status?: StudentLifecycleStatus | 'all';
  limit?: number;
  offset?: number;
}

/**
 * Validation result shape
 */
export interface StudentValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
