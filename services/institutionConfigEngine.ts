import {
  Institution,
  InstitutionType,
  InstitutionThemeConfig,
  InstitutionFinanceConfig,
  ModuleKey,
  CommonModuleKey,
  MadrasahModuleKey,
  SchoolModuleKey,
  TermKey,
  TerminologyDictionary,
  ModuleDependencyRule,
  FundCategoryDefinition,
  IncomeCategoryDefinition,
  ExpenseCategoryDefinition,
  DEFAULT_GRADING_SYSTEM,
} from '../types';

// ==================== 1. MODULE DEFINITIONS & LISTS ====================

export const COMMON_MODULES: CommonModuleKey[] = [
  'STUDENTS',
  'GUARDIANS',
  'STAFF',
  'CLASSES',
  'SUBJECTS',
  'ATTENDANCE',
  'EXAMS',
  'RESULTS',
  'FEES',
  'FINANCE',
  'REPORTS',
  'SETTINGS',
];

export const MADRASAH_MODULES: MadrasahModuleKey[] = [
  'ZAKAT',
  'DONATIONS',
  'ORPHAN_AID',
  'BOOK_BANK',
  'MAHFIL',
  'BOARDING',
];

export const SCHOOL_MODULES: SchoolModuleKey[] = [
  'TRANSPORT',
  'ACTIVITIES',
  'HOUSE_SYSTEM',
  'CLUBS',
];

export const DEFAULT_MODULES_BY_TYPE: Record<InstitutionType, ModuleKey[]> = {
  MADRASAH: [...COMMON_MODULES, ...MADRASAH_MODULES],
  SCHOOL: [...COMMON_MODULES, ...SCHOOL_MODULES],
};

// ==================== 2. MODULE DEPENDENCY RULES ====================

export const MODULE_DEPENDENCY_RULES: Partial<Record<ModuleKey, ModuleDependencyRule>> = {
  BOARDING: {
    module: 'BOARDING',
    requiredModules: ['STUDENTS', 'FEES'],
    description: 'Boarding requires Student profiles and Fee accounting for meal billings.',
  },
  ZAKAT: {
    module: 'ZAKAT',
    requiredModules: ['FINANCE'],
    description: 'Zakat Fund requires the Finance ledger module.',
  },
  DONATIONS: {
    module: 'DONATIONS',
    requiredModules: ['FINANCE'],
    description: 'Donations & Lillah accounting requires the Finance ledger module.',
  },
  ORPHAN_AID: {
    module: 'ORPHAN_AID',
    requiredModules: ['STUDENTS', 'FINANCE'],
    description: 'Orphan Aid requires Student records and Finance fund allocations.',
  },
  BOOK_BANK: {
    module: 'BOOK_BANK',
    requiredModules: ['CLASSES', 'FINANCE'],
    description: 'Book Bank requires Class curriculums and Finance fee tracking.',
  },
  MAHFIL: {
    module: 'MAHFIL',
    requiredModules: ['FINANCE'],
    description: 'Annual Mahfil requires Finance income/expense vouchers.',
  },
  TRANSPORT: {
    module: 'TRANSPORT',
    requiredModules: ['STUDENTS', 'FEES'],
    description: 'Transport management requires Student records and Fee collection.',
  },
  ACTIVITIES: {
    module: 'ACTIVITIES',
    requiredModules: ['STUDENTS'],
    description: 'Extra-curricular activities require Student rosters.',
  },
  HOUSE_SYSTEM: {
    module: 'HOUSE_SYSTEM',
    requiredModules: ['STUDENTS'],
    description: 'House system requires Student rosters and classes.',
  },
  CLUBS: {
    module: 'CLUBS',
    requiredModules: ['STUDENTS'],
    description: 'Clubs require Student rosters.',
  },
  RESULTS: {
    module: 'RESULTS',
    requiredModules: ['EXAMS', 'SUBJECTS', 'STUDENTS'],
    description: 'Results tabulation requires Exams, Subjects, and Students.',
  },
  FEES: {
    module: 'FEES',
    requiredModules: ['STUDENTS', 'FINANCE'],
    description: 'Student fees require Students and Finance ledger integration.',
  },
};

/**
 * Validates that an array of enabled modules satisfies all dependency prerequisites.
 */
export function validateModuleDependencies(enabledModules: ModuleKey[]): {
  valid: boolean;
  missingDependencies: { module: ModuleKey; required: ModuleKey[] }[];
} {
  const enabledSet = new Set(enabledModules);
  const missing: { module: ModuleKey; required: ModuleKey[] }[] = [];

  for (const module of enabledModules) {
    const rule = MODULE_DEPENDENCY_RULES[module];
    if (rule) {
      const unfulfilled = rule.requiredModules.filter((req) => !enabledSet.has(req));
      if (unfulfilled.length > 0) {
        missing.push({ module, required: unfulfilled });
      }
    }
  }

  return {
    valid: missing.length === 0,
    missingDependencies: missing,
  };
}

/**
 * Checks whether a specific module is enabled in an institution configuration.
 */
export function isModuleEnabled(
  configOrModules: Institution | ModuleKey[] | undefined,
  module: ModuleKey
): boolean {
  if (!configOrModules) {
    // Default fallback for existing Madrasah system: all Common & Madrasah modules enabled
    return DEFAULT_MODULES_BY_TYPE.MADRASAH.includes(module);
  }

  if (Array.isArray(configOrModules)) {
    return configOrModules.includes(module);
  }

  return configOrModules.enabledModules?.includes(module) ?? false;
}

// ==================== 3. THEME PRESETS ====================

export const MADRASAH_THEME: InstitutionThemeConfig = {
  preset: 'MADRASAH',
  primaryColor: '#065f46',   // Emerald 800
  secondaryColor: '#047857', // Emerald 700
  accentColor: '#d97706',    // Amber 600
  sidebarStyle: 'CLASSIC',
  dashboardStyle: 'CARDS',
  reportCardBranding: {
    showWatermark: true,
    showLogo: true,
    showHeadmasterSignature: true,
    showGuardianSignature: true,
    showClassTeacherSignature: true,
    defaultTemplate: 'Premium_Dakhil',
  },
};

export const SCHOOL_THEME: InstitutionThemeConfig = {
  preset: 'SCHOOL',
  primaryColor: '#1e40af',   // Blue 800
  secondaryColor: '#2563eb', // Blue 600
  accentColor: '#ea580c',    // Orange 600
  sidebarStyle: 'MODERN',
  dashboardStyle: 'METRICS',
  reportCardBranding: {
    showWatermark: true,
    showLogo: true,
    showHeadmasterSignature: true,
    showGuardianSignature: true,
    showClassTeacherSignature: true,
    defaultTemplate: 'Premium_Colored',
  },
};

export const THEME_PRESETS_BY_TYPE: Record<InstitutionType, InstitutionThemeConfig> = {
  MADRASAH: MADRASAH_THEME,
  SCHOOL: SCHOOL_THEME,
};

// ==================== 4. TERMINOLOGY DICTIONARIES ====================

export const MADRASAH_TERMINOLOGY: TerminologyDictionary = {
  institution: { en: 'Alia Madrasah', bn: 'আলিয়া মাদ্রাসা' },
  student: { en: 'Student', bn: 'শিক্ষার্থী (ছাত্র / ছাত্রী)' },
  students: { en: 'Students', bn: 'শিক্ষার্থীবৃন্দ' },
  teacher: { en: 'Teacher', bn: 'শিক্ষক / শিক্ষিকা' },
  teachers: { en: 'Teachers & Faculty', bn: 'শিক্ষক-শিক্ষিকাবৃন্দ' },
  principal: { en: 'Principal / Superintendent', bn: 'অধ্যক্ষ / সুপারিনটেনডেন্ট' },
  guardian: { en: 'Guardian', bn: 'অভিভাবক' },
  guardians: { en: 'Guardians', bn: 'অভিভাবকবৃন্দ' },
  class: { en: 'Class', bn: 'শ্রেণি' },
  classes: { en: 'Classes & Sections', bn: 'শ্রেণি ও শাখাসমূহ' },
  subject: { en: 'Subject', bn: 'পাঠ্যবিষয়' },
  subjects: { en: 'Subjects', bn: 'বিষয়সমূহ' },
  exam: { en: 'Term / Board Exam', bn: 'সাময়িক ও বোর্ড পরীক্ষা' },
  exams: { en: 'Examinations', bn: 'পরীক্ষাসমূহ' },
  result: { en: 'Academic Result (GPA 5.00)', bn: 'একাডেমিক ফলাফল ও জিপিএ' },
  results: { en: 'Results Tabulation', bn: 'গ্রেড ও ফলাফল বিবরণী' },
  reportCard: { en: 'Academic Progress Report Card', bn: 'একাডেমিক প্রগ্রেস রিপোর্ট কার্ড' },
  tuitionFee: { en: 'Monthly Tuition Fee', bn: 'মাসিক টিউশন ফি (বেতন)' },
  admissionFee: { en: 'Admission & Session Fee', bn: 'ভর্তি ও সেশন ফি' },
  examFee: { en: 'Examination & Center Fee', bn: 'পরীক্ষা ও কেন্দ্র ফি' },
  salary: { en: 'Staff Salary & Payroll', bn: 'শিক্ষক-কর্মচারী বেতন' },
  donation: { en: 'Development & General Fund', bn: 'উন্নয়ন ও সাধারণ তহবিল' },
  zakat: { en: 'Student Welfare & Stipend Fund', bn: 'ছাত্রকল্যাণ ও উপবৃত্তি তহবিল' },
  boarding: { en: 'Hostel & Mess Dining', bn: 'ছাত্রাবাস ও হোস্টেল মেস' },
  mahfil: { en: 'Annual Sports, Cultural & Seerat Event', bn: 'বার্ষিক ক্রীড়া, সাংস্কৃতিক ও সিরাত মাহফিল' },
  bookBank: { en: 'Library & Textbook Bank', bn: 'লাইব্রেরি ও পাঠ্যপুস্তক ব্যাংক' },
  transport: { en: 'Transport', bn: 'যাতায়াত ও পরিবহন' },
  house: { en: 'House System', bn: 'হাউজ সিস্টেম (দল)' },
  club: { en: 'Co-Curricular & Clubs', bn: 'সহশিক্ষা ও ক্লাব ফোরাম' },
  voucher: { en: 'Debit Voucher', bn: 'ডেবিট ভাউচার' },
  moneyReceipt: { en: 'Money Receipt', bn: 'টাকা জমার মানি রসিদ' },
};

export const SCHOOL_TERMINOLOGY: TerminologyDictionary = {
  institution: { en: 'School', bn: 'বিদ্যালয়' },
  student: { en: 'Student', bn: 'শিক্ষার্থী / ছাত্র-ছাত্রী' },
  students: { en: 'Students', bn: 'শিক্ষার্থীবৃন্দ' },
  teacher: { en: 'Teacher', bn: 'শিক্ষক / শিক্ষিকা' },
  teachers: { en: 'Faculty & Teachers', bn: 'শিক্ষক-শিক্ষিকাবৃন্দ' },
  principal: { en: 'Headmaster / Principal', bn: 'প্রধান শিক্ষক / অধ্যক্ষ' },
  guardian: { en: 'Parent / Guardian', bn: 'অভিভাবক' },
  guardians: { en: 'Parents & Guardians', bn: 'অভিভাবকবৃন্দ' },
  class: { en: 'Class', bn: 'শ্রেণী' },
  classes: { en: 'Classes & Sections', bn: 'শ্রেণী ও শাখাসমূহ' },
  subject: { en: 'Subject', bn: 'বিষয়' },
  subjects: { en: 'Subjects', bn: 'বিষয়সমূহ' },
  exam: { en: 'Term Examination', bn: 'সাময়িক পরীক্ষা' },
  exams: { en: 'Examinations', bn: 'পরীক্ষাসমূহ' },
  result: { en: 'Academic Result', bn: 'একাডেমিক ফলাফল' },
  results: { en: 'Tabulation Sheet', bn: 'গ্রেড ও ফলাফল বিবরণী' },
  reportCard: { en: 'Progress Report Card', bn: 'প্রগ্রেস রিপোর্ট / নম্বরপত্র' },
  tuitionFee: { en: 'Monthly Tuition Fee', bn: 'মাসিক টিউশন ফি' },
  admissionFee: { en: 'Admission & Session Fee', bn: 'ভর্তি ও সেশন ফি' },
  examFee: { en: 'Exam Fee', bn: 'পরীক্ষা ফি' },
  salary: { en: 'Staff Salary', bn: 'শিক্ষক ও কর্মচারী বেতন' },
  donation: { en: 'Alumni / Development Fund', bn: 'উন্নয়ন অনুদান' },
  zakat: { en: 'Charity / Student Aid', bn: 'ছাত্র কল্যাণ তহবিল' },
  boarding: { en: 'Dormitory / Hostel', bn: 'ছাত্রাবাস / হোস্টেল' },
  mahfil: { en: 'Annual Cultural Day', bn: 'বার্ষিক ক্রীড়া ও সাংস্কৃতিক অনুষ্ঠান' },
  bookBank: { en: 'School Library & Book Bank', bn: 'গ্রন্থাগার ও পাঠাগার' },
  transport: { en: 'School Bus & Transport', bn: 'স্কুল বাস ও পরিবহন' },
  house: { en: 'House System', bn: 'হাউস সিস্টেম' },
  club: { en: 'School Clubs & Science Society', bn: 'ক্লাব ও সহশিক্ষা কার্যক্রম' },
  voucher: { en: 'Expense Voucher', bn: 'ব্যয় ভাউচার' },
  moneyReceipt: { en: 'Fee Collection Receipt', bn: 'ফি আদায়ের রসিদ' },
};

export const TERMINOLOGY_BY_TYPE: Record<InstitutionType, TerminologyDictionary> = {
  MADRASAH: MADRASAH_TERMINOLOGY,
  SCHOOL: SCHOOL_TERMINOLOGY,
};

/**
 * Resolves a localized term for the given institution type or institution configuration.
 */
export function getTerm(
  typeOrConfig: InstitutionType | Institution | undefined,
  termKey: TermKey,
  lang: 'en' | 'bn' = 'en'
): string {
  const type: InstitutionType =
    typeof typeOrConfig === 'string'
      ? typeOrConfig
      : typeOrConfig?.institutionType || 'MADRASAH';

  const dict = TERMINOLOGY_BY_TYPE[type] || MADRASAH_TERMINOLOGY;
  const term = dict[termKey];
  if (!term) return termKey;
  return term[lang] || term.en;
}

// ==================== 5. FINANCE CONFIGURATIONS ====================

export const MADRASAH_FUNDS: FundCategoryDefinition[] = [
  { fundKey: 'GENERAL', name: 'General Operating Fund', nameBn: 'সাধারণ পরিচালনা তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'ZAKAT', name: 'Student Welfare & Stipend Fund', nameBn: 'ছাত্রকল্যাণ ও উপবৃত্তি তহবিল', isReligiousOrRestrictedFund: true },
  { fundKey: 'DEVELOPMENT', name: 'Building & Development Fund', nameBn: 'মাদ্রাসা উন্নয়ন ও নির্মাণ তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'ORPHAN_AID', name: 'Merit & Need-based Aid Fund', nameBn: 'মেধাবৃত্তি ও দরিদ্র কল্যাণ তহবিল', isReligiousOrRestrictedFund: true },
  { fundKey: 'BOOK_BANK', name: 'Books & Library Fund', nameBn: 'লাইব্রেরি ও পাঠ্যবই তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'MAHFIL', name: 'Annual Sports & Cultural Fund', nameBn: 'বার্ষিক ক্রীড়া ও সাংস্কৃতিক তহবিল', isReligiousOrRestrictedFund: false },
];

export const MADRASAH_INCOME_CATEGORIES: IncomeCategoryDefinition[] = [
  { key: 'STUDENT_TUITION', name: 'Monthly Tuition Fee', nameBn: 'মাসিক ছাত্র বেতন', fundType: 'GENERAL', isRecurringFee: true },
  { key: 'ADMISSION_FEE', name: 'Admission & Registration Fee', nameBn: 'ভর্তি ও পুনঃভর্তি ফি', fundType: 'GENERAL' },
  { key: 'EXAM_FEE', name: 'Examination Fee', nameBn: 'পরীক্ষা ফি', fundType: 'GENERAL' },
  { key: 'BOARDING_FEE', name: 'Boarding & Mess Fee', nameBn: 'বোর্ডিং / খাবার ফি', fundType: 'GENERAL' },
  { key: 'BOOK_STATIONERY', name: 'Book & Stationery Fee', nameBn: 'কিতাব ও খাতা ফি', fundType: 'BOOK_BANK' },
  { key: 'GENERAL_DONATION', name: 'General Donation', nameBn: 'সাধারণ দান ও অনুদান', fundType: 'GENERAL' },
  { key: 'ZAKAT_FITRA', name: 'Zakat & Fitra Collection', nameBn: 'যাকাত ও ফিতরা ফান্ড', fundType: 'ZAKAT' },
  { key: 'QURBANI_LEATHER', name: 'Qurbani Leather / Sacrificial Meat', nameBn: 'কোরবানির চামড়া বাবদ দান', fundType: 'ORPHAN_AID' },
  { key: 'MONTHLY_DONOR', name: 'Monthly Life/Donor Member Subscription', nameBn: 'আজীবন / দাতা সদস্য মাসিক চাঁদা', fundType: 'GENERAL' },
  { key: 'BUILDING_CONSTRUCTION', name: 'Mosque & Building Construction', nameBn: 'মসজিদ ও ভবন নির্মাণ ফান্ড', fundType: 'DEVELOPMENT' },
  { key: 'ORPHAN_SPONSOR', name: 'Orphan Student Sponsorship', nameBn: 'এতিম ছাত্র লালন-পালন ফান্ড', fundType: 'ORPHAN_AID' },
  { key: 'MAHFIL_COLLECTION', name: 'Annual Mahfil Collection', nameBn: 'বার্ষিক মাহফিল ও জলসা ফান্ড', fundType: 'MAHFIL' },
  { key: 'OTHER_INCOME', name: 'Other Income', nameBn: 'অন্যান্য আয়', fundType: 'GENERAL' },
];

export const MADRASAH_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [
  { key: 'STAFF_SALARY', name: 'Teacher & Staff Salary / Hadiah', nameBn: 'উস্তাদ ও স্টাফদের বেতন / হাদিয়া', fundType: 'GENERAL' },
  { key: 'BOARDING_MESS', name: 'Mess & Food Expenses', nameBn: 'বোর্ডিং ও মেস বাজার খরচ', fundType: 'GENERAL' },
  { key: 'UTILITY_BILL', name: 'Electricity, Gas & Water', nameBn: 'বিদ্যুৎ, গ্যাস ও পানির বিল', fundType: 'GENERAL' },
  { key: 'BUILDING_MAINTENANCE', name: 'Building Repair & Construction', nameBn: 'ভবন নির্মাণ ও রক্ষণাবেক্ষণ', fundType: 'DEVELOPMENT' },
  { key: 'BOOKS_LIBRARY', name: 'Books & Kitab Purchase', nameBn: 'কিতাব ও লাইব্রেরি খরচ', fundType: 'BOOK_BANK' },
  { key: 'EXAM_EXPENSE', name: 'Exam Sheets & Printing', nameBn: 'পরীক্ষার খাতা ও প্রশ্নপত্র খরচ', fundType: 'GENERAL' },
  { key: 'MAHFIL_EXPENSE', name: 'Mahfil Arrangements & Hospitality', nameBn: 'বার্ষিক মাহফিল ও অনুষ্ঠান খরচ', fundType: 'MAHFIL' },
  { key: 'MEDICAL_STUDENT', name: 'Medical Treatment for Poor Students', nameBn: 'অসচ্ছল শিক্ষার্থীদের চিকিৎসা ও ত্রাণ', fundType: 'ORPHAN_AID' },
  { key: 'MISC_EXPENSE', name: 'Miscellaneous Expenses', nameBn: 'বিবিধ ব্যয়', fundType: 'GENERAL' },
];

export const SCHOOL_FUNDS: FundCategoryDefinition[] = [
  { fundKey: 'GENERAL', name: 'General Operational Fund', nameBn: 'সাধারণ পরিচালনা তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'DEVELOPMENT', name: 'School Development Fund', nameBn: 'বিদ্যালয় উন্নয়ন তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'SPORTS_CULTURE', name: 'Sports & Cultural Fund', nameBn: 'ক্রীড়া ও সাংস্কৃতিক তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'TRANSPORT', name: 'Transport Maintenance Fund', nameBn: 'পরিবহন তহবিল', isReligiousOrRestrictedFund: false },
  { fundKey: 'LIBRARY', name: 'Library & Science Lab Fund', nameBn: 'গ্রন্থাগার ও ল্যাব তহবিল', isReligiousOrRestrictedFund: false },
];

export const SCHOOL_INCOME_CATEGORIES: IncomeCategoryDefinition[] = [
  { key: 'STUDENT_TUITION', name: 'Monthly Tuition Fee', nameBn: 'মাসিক টিউশন ফি', fundType: 'GENERAL', isRecurringFee: true },
  { key: 'ADMISSION_FEE', name: 'Admission & Session Charge', nameBn: 'ভর্তি ও সেশন চার্জ', fundType: 'GENERAL' },
  { key: 'EXAM_FEE', name: 'Term Examination Fee', nameBn: 'সাময়িক পরীক্ষা ফি', fundType: 'GENERAL' },
  { key: 'TRANSPORT_FEE', name: 'School Bus / Transport Fee', nameBn: 'পরিবহন ফি', fundType: 'TRANSPORT' },
  { key: 'LAB_LIBRARY_FEE', name: 'Lab & Library Fee', nameBn: 'ল্যাব ও পাঠাগার ফি', fundType: 'LIBRARY' },
  { key: 'SPORTS_FEE', name: 'Sports & Co-curricular Fee', nameBn: 'ক্রীড়া ও সহশিক্ষা ফি', fundType: 'SPORTS_CULTURE' },
  { key: 'GENERAL_DONATION', name: 'Alumni / Community Donations', nameBn: 'সাধারণ অনুদান', fundType: 'DEVELOPMENT' },
  { key: 'GOV_GRANT', name: 'Government MPO / Development Grant', nameBn: 'সরকারি অনুদান', fundType: 'DEVELOPMENT' },
  { key: 'OTHER_INCOME', name: 'Other School Income', nameBn: 'অন্যান্য আয়', fundType: 'GENERAL' },
];

export const SCHOOL_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [
  { key: 'STAFF_SALARY', name: 'Teacher & Staff Salary', nameBn: 'শিক্ষক ও কর্মচারীদের বেতন', fundType: 'GENERAL' },
  { key: 'UTILITY_BILL', name: 'Electricity, Water & Internet', nameBn: 'বিদ্যুৎ, পানি ও ইন্টারনেট বিল', fundType: 'GENERAL' },
  { key: 'BUILDING_MAINTENANCE', name: 'Campus Maintenance & Infrastructure', nameBn: 'ক্যাম্পাস রক্ষণাবেক্ষণ ও সংস্কার', fundType: 'DEVELOPMENT' },
  { key: 'TRANSPORT_EXPENSE', name: 'Bus Fuel & Vehicle Maintenance', nameBn: 'যানবাহন জ্বালানি ও রক্ষণাবেক্ষণ', fundType: 'TRANSPORT' },
  { key: 'LAB_LIBRARY_EXPENSE', name: 'Science Lab Equipment & Books', nameBn: 'বিজ্ঞানাগার সরঞ্জাম ও বই ক্রয়', fundType: 'LIBRARY' },
  { key: 'SPORTS_EVENT_EXPENSE', name: 'Annual Sports & Cultural Day', nameBn: 'বার্ষিক ক্রীড়া ও সাংস্কৃতিক অনুষ্ঠান খরচ', fundType: 'SPORTS_CULTURE' },
  { key: 'EXAM_EXPENSE', name: 'Question Paper Printing & Exam Materials', nameBn: 'প্রশ্নপত্র মুদ্রণ ও পরীক্ষার সামগ্রী', fundType: 'GENERAL' },
  { key: 'OFFICE_STATIONERY', name: 'Office Stationery & Supplies', nameBn: 'অফিস স্টেশনারি ও সরঞ্জাম', fundType: 'GENERAL' },
  { key: 'MISC_EXPENSE', name: 'Miscellaneous Expenses', nameBn: 'বিবিধ ব্যয়', fundType: 'GENERAL' },
];

export const FINANCE_CONFIGS_BY_TYPE: Record<InstitutionType, InstitutionFinanceConfig> = {
  MADRASAH: {
    institutionType: 'MADRASAH',
    currency: 'BDT',
    currencySymbol: '৳',
    receiptPrefix: 'MR-MAD-',
    voucherPrefix: 'DV-MAD-',
    enabledFunds: MADRASAH_FUNDS,
    incomeCategories: MADRASAH_INCOME_CATEGORIES,
    expenseCategories: MADRASAH_EXPENSE_CATEGORIES,
  },
  SCHOOL: {
    institutionType: 'SCHOOL',
    currency: 'BDT',
    currencySymbol: '৳',
    receiptPrefix: 'MR-SCH-',
    voucherPrefix: 'DV-SCH-',
    enabledFunds: SCHOOL_FUNDS,
    incomeCategories: SCHOOL_INCOME_CATEGORIES,
    expenseCategories: SCHOOL_EXPENSE_CATEGORIES,
  },
};

// ==================== 6. MASTER CONFIGURATION FACTORY ====================

/**
 * Returns the authoritative default configuration for a given institution type.
 */
export function getDefaultInstitutionConfig(
  type: InstitutionType,
  overrides?: Partial<Institution>
): Institution {
  const isSchool = type === 'SCHOOL';
  const timestamp = new Date().toISOString();
  const currentYear = new Date().getFullYear().toString();

  const baseConfig: Institution = {
    id: overrides?.id || (isSchool ? 'inst_school_default' : 'inst_madrasah_default'),
    tenantCode: overrides?.tenantCode || (isSchool ? 'school-primary' : 'madrasah-primary'),
    name: overrides?.name || (isSchool ? 'Model High School & College' : 'JAMIA ISLAMIA MADRASAH'),
    nameBn: overrides?.nameBn || (isSchool ? 'মডেল হাই স্কুল অ্যান্ড কলেজ' : 'জামিয়া ইসলামিয়া মাদ্রাসা'),
    institutionType: type,
    status: overrides?.status || 'ACTIVE',
    logo: overrides?.logo,
    address: overrides?.address || {
      street: '123 Education Road',
      streetBn: '১২৩ শিক্ষা সড়ক',
      postOffice: 'Dhaka GPO',
      postOfficeBn: 'ঢাকা জিপিও',
      upazilaThana: 'Dhanmondi',
      upazilaThanaBn: 'ধানমন্ডি',
      district: 'Dhaka',
      districtBn: 'ঢাকা',
      division: 'Dhaka',
      country: 'Bangladesh',
      postalCode: '1205',
    },
    contact: overrides?.contact || {
      phone: '+880 1711-000000',
      email: isSchool ? 'contact@modelschool.edu.bd' : 'info@jamiaislamia.edu.bd',
      principalOrHeadName: isSchool ? 'Prof. Mohammad Rafiqul Islam' : 'Moulana Abdul Karim',
      principalOrHeadNameBn: isSchool ? 'প্রফেসর মো. রফিকুল ইসলাম' : 'মাওলানা আব্দুল করিম',
    },
    academicSettings: overrides?.academicSettings || {
      currentAcademicYear: currentYear,
      academicYears: [currentYear],
      gradingSystem: DEFAULT_GRADING_SYSTEM,
      passPercentage: 33,
      allowFractions: false,
      continuousAssessmentCQMCQ: true,
      dakhilFourthSubjectRules: !isSchool, // Enabled by default for Madrasah
    },
    themeSettings: overrides?.themeSettings || THEME_PRESETS_BY_TYPE[type],
    enabledModules: overrides?.enabledModules || DEFAULT_MODULES_BY_TYPE[type],
    financeConfig: overrides?.financeConfig || FINANCE_CONFIGS_BY_TYPE[type],
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: overrides?.metadata || {},
  };

  return baseConfig;
}

/**
 * Accessor for finance configurations.
 */
export function getFinanceConfig(
  typeOrConfig: InstitutionType | Institution | undefined
): InstitutionFinanceConfig {
  if (!typeOrConfig) return FINANCE_CONFIGS_BY_TYPE.MADRASAH;
  if (typeof typeOrConfig === 'string') return FINANCE_CONFIGS_BY_TYPE[typeOrConfig];
  return typeOrConfig.financeConfig || FINANCE_CONFIGS_BY_TYPE[typeOrConfig.institutionType];
}

/**
 * Accessor for theme configurations.
 */
export function getThemeConfig(
  typeOrConfig: InstitutionType | Institution | undefined
): InstitutionThemeConfig {
  if (!typeOrConfig) return THEME_PRESETS_BY_TYPE.MADRASAH;
  if (typeof typeOrConfig === 'string') return THEME_PRESETS_BY_TYPE[typeOrConfig];
  return typeOrConfig.themeSettings || THEME_PRESETS_BY_TYPE[typeOrConfig.institutionType];
}
