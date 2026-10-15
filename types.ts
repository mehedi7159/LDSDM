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
  gradingSystem?: GradingSystem[];
}

export interface SchoolClass {
  id: string;
  name: string;
  nameBn?: string;
  order: number;
  institutionId?: string;
  academicYearId?: string;
  displayName?: string;
  level?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Re-export Academic & Student Domain Models & Types
export * from './types/academic';
export * from './types/student';
export * from './types/promotion';
export * from './types/notice';
import type { ExamStatus, MarkStatus } from './types/academic';

export type ExamCategory = 'Term' | 'Model' | 'Monthly' | 'ClassTest' | 'Final' | 'Other' | string;

export interface ExamContribution {
  examId: string;
  percentage: number;
}

export interface Exam {
  id: string;
  institutionId?: string;
  academicYearId?: string;
  academicYear: string; // Snapshot / legacy compatibility
  name: string;
  nameBn?: string;
  type?: string;
  category: ExamCategory;
  classIds?: string[];
  sectionIds?: string[];
  startDate?: string;
  endDate?: string;
  status?: ExamStatus;
  description?: string;
  contributions?: ExamContribution[];
  enableContributions?: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

export interface MarkRecord {
  id: string;
  institutionId?: string;
  studentId: string;
  subjectId: string;
  examId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  obtained: number; // Total obtained (calculated)
  obtainedCQ?: number;
  obtainedMCQ?: number;
  obtainedPractical?: number;
  total: number; // Snapshot of full marks at time of entry
  fullMarks?: number;
  passMarks?: number;
  isAbsent?: boolean;
  absentReason?: string;
  grade?: string;
  gradePoint?: number;
  status?: MarkStatus;
  enteredBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
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

// ==================== FINANCE & ACCOUNTING TYPES ====================

export type TransactionType = 'INCOME' | 'EXPENSE';

export type FundType = 
  | 'GENERAL'        // সাধারণ তহবিল (General Operating Fund)
  | 'ZAKAT'          // যাকাত, ফিতরা ও সদকা তহবিল (Zakat & Fitra Fund)
  | 'DEVELOPMENT'    // মাদ্রাসা উন্নয়ন ও নির্মাণ তহবিল (Building & Development)
  | 'ORPHAN_AID'     // লিল্লাহ বোর্ডিং ও এতিম তহবিল (Lillah & Orphan Welfare)
  | 'BOOK_BANK'      // কিতাব ও লাইব্রেরি তহবিল (Books & Stationery Fund)
  | 'MAHFIL';        // বার্ষিক ওয়াজ ও মাহফিল তহবিল (Annual Mahfil / Event Fund)

export type PaymentMethod = 
  | 'CASH'           // নগদ টাকা (Cash)
  | 'BKASH'          // বিকাশ (bKash)
  | 'NAGAD'          // নগদ (Nagad)
  | 'ROCKET'         // রকেট (Rocket)
  | 'BANK_TRANSFER'  // ব্যাংক হিসাব / ট্রান্সফার (Bank Transfer)
  | 'CHEQUE'         // চেক (Cheque)
  | 'OTHER';         // অন্যান্য

export type IncomeCategory =
  | 'STUDENT_TUITION'       // মাসিক ছাত্র বেতন
  | 'ADMISSION_FEE'         // ভর্তি ও পুনঃভর্তি ফি
  | 'EXAM_FEE'              // পরীক্ষা ফি
  | 'BOARDING_FEE'          // বোর্ডিং / খাবার ফি
  | 'BOOK_STATIONERY'       // কিতাব ও খাতা ফি
  | 'BOOK_PURCHASE_FEE'     // কিতাব ও পাঠাগার ফি
  | 'GENERAL_DONATION'      // সাধারণ দান ও অনুদান
  | 'ZAKAT_FITRA'           // যাকাত ও ফিতরা ফান্ড
  | 'QURBANI_LEATHER'       // কোরবানির চামড়া বাবদ দান
  | 'MONTHLY_DONOR'         // আজীবন / দাতা সদস্য মাসিক চাঁদা
  | 'BUILDING_CONSTRUCTION' // মসজিদ ও ভবন নির্মাণ ফান্ড
  | 'ORPHAN_SPONSOR'        // এতিম ছাত্র লালন-পালন ফান্ড
  | 'MAHFIL_COLLECTION'     // বার্ষিক মাহফিল ও জলসা ফান্ড
  | 'PROPERTY_RENT'         // দোকান ও জমি ভাড়া বাবদ আয়
  | 'GOV_GRANT'             // সরকারি অনুদান
  | 'MISC_INCOME'           // বিবিধ আয়
  | 'OTHER_INCOME';         // অন্যান্য আয়

export type ExpenseCategory =
  | 'STAFF_SALARY'          // উস্তাদ ও স্টাফদের বেতন / হাদিয়া
  | 'BOARDING_MESS'         // বোর্ডিং ও মেস বাজার খরচ
  | 'UTILITY_BILL'          // বিদ্যুৎ, গ্যাস ও পানির বিল
  | 'BUILDING_REPAIR'       // ভবন মেরামত
  | 'BUILDING_MAINTENANCE'  // ভবন নির্মাণ ও রক্ষণাবেক্ষণ
  | 'BOOKS_LIBRARY'         // কিতাব ও লাইব্রেরি খরচ
  | 'EXAM_EXPENSE'          // পরীক্ষার খাতা ও প্রশ্নপত্র খরচ
  | 'MAHFIL_EXPENSE'        // বার্ষিক মাহফিল ও অনুষ্ঠান খরচ
  | 'HOSPITALITY'           // মেহমানদারি ও আপ্যায়ন
  | 'MEDICAL_STUDENT'       // অসচ্ছল শিক্ষার্থীদের চিকিৎসা ও ত্রাণ
  | 'MEDICINE_TREATMENT'    // ঔষধ ও প্রাথমিক চিকিৎসা
  | 'OFFICE_STATIONERY'     // স্টেশনারি ও অফিস সরঞ্জাম
  | 'INTERNET_COMM'         // ইন্টারনেট ও যোগাযোগ
  | 'CONVEYANCE'            // যাতায়াত ও ভ্রমণ খরচ
  | 'TRAVEL_TRANSPORT'      // যাতায়াত ও ভ্রমণ
  | 'MISC_EXPENSE'          // বিবিধ ব্যয়
  | 'OTHER_EXPENSE';        // অন্যান্য খরচ

export interface StudentFeeItem {
  name: string;
  nameBn: string;
  amount: number;
}

export interface FinanceTransaction {
  id: string;
  voucherNo: string;           // e.g. MR-2026-0001 (Money Receipt) or DV-2026-0001 (Debit Voucher)
  type: TransactionType;
  category: IncomeCategory | ExpenseCategory | string;
  categoryName?: string;
  fundType: FundType;
  amount: number;
  date: string;                // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  referenceNo?: string;        // Trx ID / Cheque No / Bank Slip
  
  // Student Context (for Student Fee Collections)
  studentId?: string;          // internal student ID
  studentCode?: string;        // human-readable student code (e.g. 101)
  studentName?: string;
  studentNameBn?: string;
  classLevel?: string;
  feeMonth?: string;           // e.g. '2026-01' or 'জানুয়ারি ২০২৬'
  feeBreakdown?: StudentFeeItem[];

  // General Details
  payerOrPayee: string;        // কার কাছ থেকে পাওয়া গেল / কাকে পরিশোধ করা হলো
  contactNo?: string;
  description?: string;
  collectedBy?: string;        // আদায়কারী / ক্যাশিয়ারের নাম
  createdAt: string;
}

export interface ClassFeeStructure {
  id: string;
  classLevel: string;
  monthlyTuition: number;
  admissionFee: number;
  examFee: number;
  boardingFee: number;
  bookFee: number;
}

// ==================== SAAS MULTI-TENANT DOMAIN MODEL ====================

export type InstitutionType = 'SCHOOL' | 'MADRASAH';

export type InstitutionStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'INACTIVE';

export type CommonModuleKey =
  | 'STUDENTS'
  | 'GUARDIANS'
  | 'STAFF'
  | 'CLASSES'
  | 'SUBJECTS'
  | 'ATTENDANCE'
  | 'EXAMS'
  | 'RESULTS'
  | 'FEES'
  | 'FINANCE'
  | 'REPORTS'
  | 'SETTINGS';

export type MadrasahModuleKey =
  | 'ZAKAT'
  | 'DONATIONS'
  | 'ORPHAN_AID'
  | 'BOOK_BANK'
  | 'MAHFIL'
  | 'BOARDING';

export type SchoolModuleKey =
  | 'TRANSPORT'
  | 'ACTIVITIES'
  | 'HOUSE_SYSTEM'
  | 'CLUBS';

export type ModuleKey = CommonModuleKey | MadrasahModuleKey | SchoolModuleKey;

export type ThemePreset = 'SCHOOL' | 'MADRASAH' | 'CUSTOM';

export interface InstitutionTypography {
  fontSans?: string;
  fontBangla?: string;
  fontBanglaNumber?: string;
}

export interface InstitutionThemeConfig {
  preset: ThemePreset;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  bannerUrl?: string;
  signatureUrl?: string;
  watermarkUrl?: string;
  typography?: InstitutionTypography;
  sidebarStyle?: 'CLASSIC' | 'MODERN' | 'COMPACT' | 'MINIMAL';
  dashboardStyle?: 'CARDS' | 'METRICS' | 'MINIMAL';
  reportCardBranding?: {
    showWatermark?: boolean;
    watermarkUrl?: string;
    showLogo?: boolean;
    showHeadmasterSignature?: boolean;
    showGuardianSignature?: boolean;
    showClassTeacherSignature?: boolean;
    defaultTemplate?: 'Classic' | 'Monthly' | 'Term' | 'BW_Term' | 'Premium_Dakhil' | 'Premium_Colored' | 'Premium_Royal';
  };
}

export interface InstitutionContact {
  phone: string;
  alternatePhone?: string;
  email: string;
  website?: string;
  facebookPage?: string;
  emergencyContact?: string;
  principalOrHeadName?: string;
  principalOrHeadNameBn?: string;
}

export interface InstitutionAddress {
  street: string;
  streetBn?: string;
  postOffice?: string;
  postOfficeBn?: string;
  upazilaThana?: string;
  upazilaThanaBn?: string;
  district?: string;
  districtBn?: string;
  division?: string;
  country?: string;
  postalCode?: string;
}

export interface AcademicSettings {
  currentAcademicYear: string;
  academicYears: string[];
  gradingSystem: GradingSystem[];
  passPercentage?: number;
  allowFractions?: boolean;
  continuousAssessmentCQMCQ?: boolean;
  dakhilFourthSubjectRules?: boolean;
}

export interface FundCategoryDefinition {
  fundKey: string;
  name: string;
  nameBn: string;
  description?: string;
  isReligiousOrRestrictedFund?: boolean;
}

export interface IncomeCategoryDefinition {
  key: string;
  name: string;
  nameBn: string;
  fundType: string;
  isRecurringFee?: boolean;
}

export interface ExpenseCategoryDefinition {
  key: string;
  name: string;
  nameBn: string;
  fundType: string;
}

export interface InstitutionFinanceConfig {
  institutionType: InstitutionType;
  currency: string;
  currencySymbol: string;
  receiptPrefix: string;
  voucherPrefix: string;
  enabledFunds: FundCategoryDefinition[];
  incomeCategories: IncomeCategoryDefinition[];
  expenseCategories: ExpenseCategoryDefinition[];
}

export interface Institution {
  id: string; // Document ID / UUID (e.g. inst_abc123)
  tenantCode: string; // Unique URL slug or identifier
  name: string;
  nameBn?: string;
  institutionType: InstitutionType;
  status: InstitutionStatus;
  logo?: string;
  address: InstitutionAddress;
  contact: InstitutionContact;
  academicSettings: AcademicSettings;
  themeSettings: InstitutionThemeConfig;
  enabledModules: ModuleKey[];
  financeConfig?: InstitutionFinanceConfig;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// ==================== SAAS MULTI-TENANT AUTH & RBAC TYPES ====================

export type SaaSRole =
  | 'superadmin'
  | 'institution_admin'
  | 'staff'
  | 'teacher'
  | 'accountant'
  | 'viewer';

export interface SaaSUserClaims {
  institutionId?: string;
  role: SaaSRole | 'admin';
  permissions?: string[];
  isSuperAdmin?: boolean;
}

// ==================== SAAS TERMINOLOGY & DEPENDENCY TYPES ====================

export type TermKey =
  | 'institution'
  | 'student'
  | 'students'
  | 'teacher'
  | 'teachers'
  | 'principal'
  | 'guardian'
  | 'guardians'
  | 'class'
  | 'classes'
  | 'subject'
  | 'subjects'
  | 'exam'
  | 'exams'
  | 'result'
  | 'results'
  | 'reportCard'
  | 'tuitionFee'
  | 'admissionFee'
  | 'examFee'
  | 'salary'
  | 'donation'
  | 'zakat'
  | 'boarding'
  | 'mahfil'
  | 'bookBank'
  | 'transport'
  | 'house'
  | 'club'
  | 'voucher'
  | 'moneyReceipt';

export interface LocalizedTerm {
  en: string;
  bn: string;
}

export type TerminologyDictionary = Record<TermKey, LocalizedTerm>;

export interface ModuleDependencyRule {
  module: ModuleKey;
  requiredModules: ModuleKey[];
  description: string;
}

export interface TrashItem {
  id: string;
  type: 'student' | 'subject' | 'exam' | 'class' | 'transaction';
  data: any;
  deletedAt: string;
}

export type UserRole = 'super_admin' | 'principal' | 'teacher' | 'accountant' | 'staff' | 'guardian';

export interface AppUser {
  id: string;
  name: string;
  nameBn?: string;
  email?: string;
  phone?: string;
  password?: string;
  role: UserRole;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  studentId?: string; // Linked student for Guardian
  studentRoll?: string;
  studentClass?: string;
  designation?: string;
  status: 'active' | 'pending' | 'blocked';
  createdAt: string;
  lastLogin?: string;
}

