# Multi-Tenant SaaS Architecture Design: School & Madrasah Platform

## 1. Executive Summary & Philosophy
This document establishes the architectural blueprint for transitioning the single-tenant Madrasah Management System into a scalable, multi-tenant Software-as-a-Service (SaaS) platform capable of serving both **SCHOOL** and **MADRASAH** institutions.

### Core Principles
1. **Zero Degradation of Current Behavior**: The single-tenant production deployment and existing collections (`students`, `exams`, `marks`, `transactions`, etc.) remain fully functional and intact.
2. **Centralized Configuration Engine**: All institution variations (School vs. Madrasah) are managed through a centralized engine (`services/institutionConfigEngine.ts`), eliminating scattered `if (isMadrasah)` statements across components.
3. **Strict Multi-Tenant Isolation**: Tenant boundaries are enforced through Firestore subcollections nested under `institutions/{institutionId}` and authenticated via Firebase Custom Claims (`institutionId`, `role`).
4. **Domain Specialization Without Code Duplication**: Core modules (Students, Exams, Results, Staff, Fees) are shared; domain-specific modules (Zakat/Lillah, Mahfil for Madrasah; Transport, Clubs, House System for School) are dynamically loaded via the `enabledModules` configuration.
5. **Independent Financial Paradigms**: School and Madrasah accounts maintain separate chart-of-accounts and fund categories suited to their organizational requirements without making unverified regulatory claims.
6. **Localized Terminology Engine**: Terminology is dynamic and localized (English and Bengali) to respect each institution's cultural nomenclature (e.g., Muhtamim vs. Principal, Ustadh vs. Teacher, Talib-e-Ilm vs. Student).

---

## 2. SaaS Domain Model

### 2.1 Entity Hierarchy
```
Platform (SaaS Root)
  └── institutions/{institutionId} (Institution Document)
        ├── profiles/schoolProfile
        ├── students/{studentId}
        ├── classes/{classId}
        ├── subjects/{subjectId}
        ├── exams/{examId}
        ├── marks/{markId}
        ├── remarks/{remarkId}
        ├── transactions/{transactionId}
        ├── feeStructures/{feeId}
        ├── staff/{staffId}
        └── auditLogs/{logId}
```

### 2.2 Institution Entity Specification
```typescript
export interface Institution {
  id: string;                         // UUID / Firestore Document ID
  tenantCode: string;                 // URL slug (e.g., 'ideal-school', 'darul-ulum')
  name: string;                       // English Name
  nameBn?: string;                    // Bengali Name
  institutionType: 'SCHOOL' | 'MADRASAH';
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'INACTIVE';
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
```

---

## 3. Institution Types & Module Configuration Engine

### 3.1 Supported Institution Types
- **`MADRASAH`**: Suited for Islamic academic institutions (Qawmi, Alia, Dakhil, Alim, Hifz, Noorani).
- **`SCHOOL`**: Suited for general primary, secondary, higher secondary schools, and colleges (Bangla / English Version / English Medium).

### 3.2 Modular Capability Matrix
The platform employs a decoupled module flag architecture:

| Module Key | Module Name | Category | Madrasah Default | School Default |
| :--- | :--- | :--- | :---: | :---: |
| `STUDENTS` | Student Directory & Profiles | Common | **Enabled** | **Enabled** |
| `GUARDIANS` | Parent & Guardian Directory | Common | **Enabled** | **Enabled** |
| `STAFF` | Faculty & Staff Management | Common | **Enabled** | **Enabled** |
| `CLASSES` | Class & Section Configuration | Common | **Enabled** | **Enabled** |
| `SUBJECTS` | Subject Catalog & Marks Split | Common | **Enabled** | **Enabled** |
| `ATTENDANCE`| Daily Attendance & Register | Common | **Enabled** | **Enabled** |
| `EXAMS` | Exam Scheduling & Weighting | Common | **Enabled** | **Enabled** |
| `RESULTS` | Tabulation Sheet & Report Cards | Common | **Enabled** | **Enabled** |
| `FEES` | Fee Invoicing & Receipts | Common | **Enabled** | **Enabled** |
| `FINANCE` | Multi-Fund Accounting & Vouchers | Common | **Enabled** | **Enabled** |
| `REPORTS` | Academic & Financial Analytics | Common | **Enabled** | **Enabled** |
| `SETTINGS` | Branding & System Configuration | Common | **Enabled** | **Enabled** |
| `ZAKAT` | Zakat & Fitra Fund Ledger | Madrasah-specific | **Enabled** | Disabled |
| `DONATIONS` | Lillah & Lifetime Donor Funds | Madrasah-specific | **Enabled** | Disabled |
| `ORPHAN_AID` | Orphan Sponsorship & Welfare | Madrasah-specific | **Enabled** | Disabled |
| `BOOK_BANK` | Kitab & Library Lending Bank | Madrasah-specific | **Enabled** | Disabled |
| `MAHFIL` | Annual Islamic Gathering/Event | Madrasah-specific | **Enabled** | Disabled |
| `BOARDING` | Residential Mess & Meals | Madrasah-specific | **Enabled** | Disabled |
| `TRANSPORT` | School Bus Routes & Fleet Fee | School-specific | Disabled | **Enabled** |
| `ACTIVITIES` | Extra-curricular Activities | School-specific | Disabled | **Enabled** |
| `HOUSE_SYSTEM`| School House & Prefect System | School-specific | Disabled | **Enabled** |
| `CLUBS` | Science, Debate & Sports Clubs | School-specific | Disabled | **Enabled** |

### 3.3 Module Dependency Model
Modules can specify prerequisites to guarantee consistent business workflows:

```typescript
export const MODULE_DEPENDENCY_RULES: Partial<Record<ModuleKey, ModuleDependencyRule>> = {
  BOARDING: { module: 'BOARDING', requiredModules: ['STUDENTS', 'FEES'], description: 'Boarding requires Student profiles and Fee accounting.' },
  ZAKAT: { module: 'ZAKAT', requiredModules: ['FINANCE'], description: 'Zakat Fund requires the Finance ledger module.' },
  DONATIONS: { module: 'DONATIONS', requiredModules: ['FINANCE'], description: 'Donations & Lillah accounting requires Finance ledger.' },
  ORPHAN_AID: { module: 'ORPHAN_AID', requiredModules: ['STUDENTS', 'FINANCE'], description: 'Orphan Aid requires Student records and Finance fund allocations.' },
  BOOK_BANK: { module: 'BOOK_BANK', requiredModules: ['CLASSES', 'FINANCE'], description: 'Book Bank requires Class curriculums and Finance fee tracking.' },
  MAHFIL: { module: 'MAHFIL', requiredModules: ['FINANCE'], description: 'Annual Mahfil requires Finance income/expense vouchers.' },
  TRANSPORT: { module: 'TRANSPORT', requiredModules: ['STUDENTS', 'FEES'], description: 'Transport requires Student records and Fee collection.' },
  ACTIVITIES: { module: 'ACTIVITIES', requiredModules: ['STUDENTS'], description: 'Activities require Student rosters.' },
  HOUSE_SYSTEM: { module: 'HOUSE_SYSTEM', requiredModules: ['STUDENTS'], description: 'House system requires Student rosters and classes.' },
  CLUBS: { module: 'CLUBS', requiredModules: ['STUDENTS'], description: 'Clubs require Student rosters.' },
  RESULTS: { module: 'RESULTS', requiredModules: ['EXAMS', 'SUBJECTS', 'STUDENTS'], description: 'Results tabulation requires Exams, Subjects, and Students.' },
  FEES: { module: 'FEES', requiredModules: ['STUDENTS', 'FINANCE'], description: 'Student fees require Students and Finance ledger integration.' },
};
```

---

## 4. Theme & Visual Identity Presets

Each institution preset provides distinctive, accessible styling tokens:

### 4.1 Madrasah Theme Preset
- **Palette**: Emerald Green (`#065f46`), Jade (`#047857`), Amber Accent (`#d97706`).
- **Sidebar**: Classic Layout.
- **Dashboard**: Cards View.
- **Report Card**: `Premium_Dakhil` template with crest watermark and Madrasah seal.

### 4.2 School Theme Preset
- **Palette**: Royal Blue (`#1e40af`), Cobalt (`#2563eb`), Orange Accent (`#ea580c`).
- **Sidebar**: Modern Layout.
- **Dashboard**: Metrics & Graphs View.
- **Report Card**: `Premium_Colored` template with standard academic layout.

---

## 5. Localized Terminology Engine

Terminology is managed through a centralized translation dictionary:

| Term Key | Madrasah (EN / BN) | School (EN / BN) |
| :--- | :--- | :--- |
| `institution` | Madrasah / মাদ্রাসা | School / বিদ্যালয় |
| `student` | Talib-e-Ilm / Student / তালিব-এ ইলম (ছাত্র) | Student / শিক্ষার্থী (ছাত্র-ছাত্রী) |
| `teacher` | Ustadh / Teacher / উস্তাদ (শিক্ষক) | Teacher / শিক্ষক (শিক্ষিকা) |
| `principal` | Muhtamim / Principal / মুহতামিম (অধ্যক্ষ) | Headmaster / Principal / প্রধান শিক্ষক |
| `class` | Jamat / Class / জামাত (শ্রেণী) | Class / শ্রেণী |
| `subject` | Kitab / Subject / কিতাব (বিষয়) | Subject / বিষয় |
| `exam` | Imtihan / Exam / ইমতিহান (পরীক্ষা) | Term Examination / সাময়িক পরীক্ষা |
| `result` | Natijah / Result / ফলাফল (রেজাল্ট) | Academic Result / একাডেমিক ফলাফল |
| `tuitionFee` | Monthly Mahana / মাসিক মাহানা (বেতন) | Monthly Tuition Fee / মাসিক টিউশন ফি |
| `admissionFee` | Dakhila Fee / দাখিলা ফি | Admission Fee / ভর্তি ও সেশন ফি |
| `salary` | Hadiah / Salary / হাদিয়া (বেতন) | Staff Salary / শিক্ষক-কর্মচারী বেতন |
| `donation` | Lillah / Donation / লিল্লাহ ও দান | Alumni / Development Donation / অনুদান |
| `zakat` | Zakat & Fitra / যাকাত ও ফিতরা | Student Welfare Fund / ছাত্র কল্যাণ তহবিল |
| `mahfil` | Annual Mahfil / বার্ষিক মাহফিল ও জলসা | Annual Cultural Day / বার্ষিক সাংস্কৃতিক দিন |
| `bookBank` | Kitab Library Bank / কিতাব ব্যাংক | School Library / পাঠাগার ও লাইব্রেরি |
| `transport` | Transport / যাতায়াত | School Bus / পরিবহন |

---

## 6. Finance & Fund Accounting Engine

Financial categories and funds are segregated by institution type without making any unverified claims of automated compliance.

### 6.1 Madrasah Funds & Categories
- **Funds**: `GENERAL` (Operating), `ZAKAT` (Zakat & Fitra), `DEVELOPMENT` (Building), `ORPHAN_AID` (Lillah & Orphan Welfare), `BOOK_BANK` (Kitab Fund), `MAHFIL` (Annual Gathering).
- **Income**: Monthly Tuition, Admission, Exam Fee, Boarding Fee, Book Fee, General Donation, Zakat/Fitra, Qurbani Leather, Monthly Donor, Building Construction, Orphan Sponsor, Mahfil Collection.
- **Expense**: Teacher Hadiah/Salary, Mess & Food, Utilities, Building Repair, Books/Kitabs, Exam Printing, Mahfil Hospitality, Student Medical Aid.

### 6.2 School Funds & Categories
- **Funds**: `GENERAL` (Operating), `DEVELOPMENT` (Campus Infrastructure), `SPORTS_CULTURE` (Sports & Culture), `TRANSPORT` (Fleet & Fuel), `LIBRARY` (Science Lab & Library).
- **Income**: Monthly Tuition, Admission & Session, Exam Fee, Transport Fee, Lab & Library Fee, Sports Fee, Alumni Donation, Government Grants.
- **Expense**: Faculty Salaries, Utilities, Campus Maintenance, Transport & Fuel, Lab Consumables, Annual Sports, Exam Printing, Office Supplies.

---

## 7. Multi-Tenant Security & RBAC Model

### 7.1 Custom Claims Authorization
Authorization is strictly governed by Firebase Authentication Custom Claims. A tenant token contains:

```json
{
  "institutionId": "inst_7a9f82b1",
  "role": "institution_admin",
  "isSuperAdmin": false
}
```

### 7.2 SaaS Role Hierarchy
1. **`superadmin`**: Platform owner / SaaS operator. Full cross-tenant access.
2. **`institution_admin`**: Principal / Headmaster / Managing Director. Full administrative authority over own institution.
3. **`staff` / `teacher`**: Academic staff. Read access across own institution; write access restricted to examination marks and remarks.
4. **`accountant`**: Finance manager. Read/write access to fee collections and financial transactions.
5. **`viewer` / `student`**: Read-only access to published results.

---

## 8. Verification & Backward Compatibility Guarantee

### 8.1 Default State
- The application runtime defaults to `institutionType: "MADRASAH"` with full backward compatibility.
- Existing single-tenant local storage and Firestore data continue functioning with zero disruption.
- `isModuleEnabled(undefined, 'ZAKAT')` evaluates to `true`.
- `getTerm(undefined, 'principal')` resolves to Madrasah terminology.

### 8.2 Future Registration Readiness
A future registration flow can call:
```typescript
const newInstitution = getDefaultInstitutionConfig(selectedType, {
  name: userEnteredName,
  tenantCode: slugify(userEnteredName)
});
```
This configuration object is self-contained and ready to be persisted into Firestore.
