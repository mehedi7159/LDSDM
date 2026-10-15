# PHASE 4C — SAFE SaaS DATABASE MIGRATION ARCHITECTURE (REVISED)
## Educational ERP (School & Madrasah Multi-Tenant Architecture)

> ### CRITICAL SAFETY DIRECTIVES & EXECUTION STATUS
> - **DATABASE MIGRATION EXECUTED: NO**
> - **EXISTING DATA MODIFIED: NO**
> - **EXISTING DATA DELETED: NO**
> - **FIRESTORE RULES CHANGED: NO**
> - **ACTUAL BACKUP EXECUTED: NO**
> - **ACTUAL CUTOVER EXECUTED: NO**
>
> **Scope of Phase 4C**: This document serves strictly as a conceptual, technical, and architectural specification for future SaaS database migration. **No actual data operations, document copies, deletions, rule modifications, or production scripts are executed in this phase.**

---

## 1. Current Database Structure (Flat Root Collections)

The existing Madrasah application stores all records in single-tenant root-level flat collections:

```
[Firestore Root]
├── institution/
│   └── main_store                  // Unified document: Profile, branding, signatures, grading rules
├── students/
│   └── {studentId}                 // Flat student profiles (e.g. name, fatherName, classLevel, status)
├── subjects/
│   └── {subjectId}                 // Subject definitions (fullMarks, passMarks, CQ/MCQ breakdown)
├── exams/
│   └── {examId}                    // Exam terms (academicYear, category, contribution weights)
├── marks/
│   └── {markId}                    // Exam mark records (studentId, subjectId, examId, obtained)
├── remarks/
│   └── {remarkId}                  // Exam-wise teacher remarks & attendance summaries (workingDays, presents)
├── classes/
│   └── {classId}                   // Class names and numeric ordering
├── transactions/
│   └── {transactionId}             // Financial vouchers (single-entry cash receipts & disbursements)
├── feeStructures/
│   └── {feeStructureId}            // Class-wise fee templates (tuition, admission, exam, boarding)
├── trashBin/
│   └── {trashId}                   // Soft-deleted records holding bin for recovery
└── admins/
    └── {uid}                       // RBAC Admin registry mapping
```

---

## 2. Target SaaS Multi-Tenant Database Structure

The target multi-tenant SaaS architecture isolates every institution's domain data under a scoped tenant path:

```
[Firestore Root]
├── institutions/
│   └── {institutionId}/
│       ├── (document root fields)  // Tenant metadata: type ('MADRASAH' | 'SCHOOL'), status, tier
│       │
│       ├── profile/
│       │   ├── config              // Institutional profile, localized names, contact, academic year
│       │   ├── branding            // Logo assets, watermark URLs, digital signatures
│       │   └── grading             // Grading system, GPA scale, pass/fail rules
│       │
│       ├── members/
│       │   └── {uid}               // Tenant staff/teacher/admin membership & assigned permissions
│       │
│       ├── classes/
│       │   └── {classId}           // Academic classes and sections
│       │
│       ├── subjects/
│       │   └── {subjectId}         // Curricular subjects with class and assessment criteria links
│       │
│       ├── exams/
│       │   └── {examId}            // Examination terms, evaluation weights, and schedules
│       │
│       ├── students/
│       │   └── {studentId}         // Enrolled student profiles and academic histories
│       │
│       ├── guardians/
│       │   └── {guardianId}        // Normalized guardian records (parent contact, NID)
│       │
│       ├── staff/
│       │   └── {staffId}           // Teachers, Ustadhs, accountants, and staff profiles
│       │
│       ├── marks/
│       │   └── {markId}            // Detailed exam scores, CQ/MCQ breakdown
│       │
│       ├── performanceRemarks/
│       │   └── {remarkId}          // Exam-wise qualitative evaluations & attendance summaries
│       │
│       ├── attendance/
│       │   └── {attendanceId}      // Future daily timestamped student & staff check-ins
│       │
│       ├── feeStructures/
│       │   └── {feeStructureId}    // Academic fee catalogs & class-wise fee templates
│       │
│       ├── studentFeeDues/
│       │   └── {dueId}             // Generated monthly/term student fee invoices and dues
│       │
│       ├── payments/
│       │   └── {paymentId}         // Money receipts, student fee collections & gateway payments
│       │
│       ├── transactions/
│       │   └── {transactionId}     // General cash flow vouchers (Income & Expense journal)
│       │
│       ├── ledgerEntries/
│       │   └── {entryId}           // Future double-entry accounting journal lines
│       │
│       ├── funds/
│       │   └── {fundId}            // Dedicated fund buckets (General, Zakat, Lillah, Development, Mahfil)
│       │
│       ├── trashBin/
│       │   └── {trashId}           // Tenant-scoped soft-delete recycle bin (restorable items)
│       │
│       └── auditLogs/
│           └── {auditId}           // Immutable audit trail for system operations & security events
│
└── system/                         // Global metadata (Cross-tenant routing & migration tracking)
    ├── tenantIndex/{slugOrDomain}  // Tenant resolution mapping
    └── migrationLogs/{logId}       // Global migration history, dry-run logs & checksum reports
```

---

## 3. Current → Target Semantic Collection Mapping & Domain Separation

### A. Remarks vs Attendance (Separation of Semantics)
* **Current `/remarks/{remarkId}`**: Contains `studentId`, `examId`, `remark` (qualitative observation), `workingDays`, `totalPresent`, `totalAbsent`.
* **Semantic Analysis**: This is an **Exam-Level Summary** (exam attendance aggregate + behavioral evaluation), **NOT** daily attendance logs.
* **Target Mapping**:
  - `/remarks/{remarkId}` ➔ `/institutions/{institutionId}/performanceRemarks/{remarkId}` (Preserves qualitative evaluations and term attendance totals).
  - `/institutions/{institutionId}/attendance/{attendanceId}` is reserved for future **daily timestamped roll calls** (Date, StudentId, Status: Present/Absent/Late).
  - **No semantic data degradation**: Historical summaries will not be artificially split into fake daily logs.

### B. Trash Bin vs Audit Log (Operational Separation)
* **Current `/trashBin/{trashId}`**: Soft-deleted entities (students, transactions, marks) that can be restored or permanently purged by the administrator.
* **Target Mapping**:
  - `/trashBin/{trashId}` ➔ `/institutions/{institutionId}/trashBin/{trashId}` (Maintains restore/delete workflow).
  - `/institutions/{institutionId}/auditLogs/{auditId}`: Dedicated strictly to **immutable, append-only security and operational audit records** (who did what, at what timestamp, IP/UserAgent).

### C. Fee Structure vs Student Dues vs Payments (Financial Entity Separation)
* **Current `/feeStructures/{feeStructureId}`**: Holds class fee configurations (`monthlyTuition`, `admissionFee`, `examFee`, `boardingFee`, `bookFee`).
* **Target Separation**:
  1. `feeStructures/{feeStructureId}`: Catalog / template of standard rates per class.
  2. `studentFeeDues/{dueId}`: Distinct student receivable invoices generated per billing period (Amount, Due Date, Discount, Net Due).
  3. `payments/{paymentId}`: Real money receipts recorded upon receiving funds against a due or fee item.
  - **Integrity Principle**: Templates are strictly segregated from actual student liabilities and money receipts.

### D. Single-Entry Transactions vs Double-Entry Ledger (Accounting Integrity)
* **Current `/transactions/{transactionId}`**: Single-entry vouchers (Income/Expense, Category, FundType, Amount, Date, VoucherNo, PaymentMethod).
* **Target Accounting Strategy**:
  - Historical vouchers migrate 1:1 into `/institutions/{institutionId}/transactions/{transactionId}` preserving their exact single-entry cash semantics.
  - **No Artificial Ledger Creation**: The migration process will **NOT** fabricate synthetic debit/credit rows for historical data.
  - Future double-entry entries (`ledgerEntries/{entryId}`) will be generated exclusively by the new SaaS double-entry accounting engine starting from the cutover date.

---

## 4. Deconstructing `institution/main_store`

The monolithic `institution/main_store` will be modularized cleanly:

1. **Root Tenant Document (`/institutions/{institutionId}`)**:
   - `id`, `slug`, `type` (`'MADRASAH'`), `status` (`'ACTIVE'`), `createdAt`, `ownerUid`.
2. **Profile Configuration (`/institutions/{institutionId}/profile/config`)**:
   - Institutional localized names (`name`, `nameBn`, `address`, `addressBn`, `phone`, `email`, `academicYear`).
   - Executive titles (`headMasterName`, `headMasterNameBn`).
3. **Branding Configuration (`/institutions/{institutionId}/profile/branding`)**:
   - Logo assets, watermark URLs, digital signatures, template settings (`resultCardTemplate`).
4. **Grading Configuration (`/institutions/{institutionId}/profile/grading`)**:
   - `gradingSystem` rules (Grade boundaries, GPA points, pass marks).

---

## 5. Stable `institutionId` Strategy

To ensure multi-tenant reliability and long-term data integrity:
- **Immutability**: The `institutionId` is permanent and immutable for the lifetime of the organization.
- **Independence**: It does not derive from email addresses (which may change) or institution names (which may be renamed).
- **Format**: Structured alphanumeric prefix + UUID: `inst_madrasah_primary` (or GUID `inst_c9cf5740-6efd-4d02-8af4-293ed58abf4b`).
- **Madrasah Assignment**: The existing Madrasah will be assigned the canonical primary tenant ID: `inst_madrasah_primary`.
- **Universality**: Works identically for Madrasah and School tenants across the SaaS ecosystem.

---

## 6. School & Madrasah Multi-Tenant Coexistence

Both educational models share the unified underlying SaaS schema with domain-specific module configurations:

```typescript
export interface TenantConfig {
  institutionId: string;
  institutionType: 'MADRASAH' | 'SCHOOL';
  academicYear: string;
  activeModules: CommonModuleKey[];
  terminology: {
    principal: string;       // "মুহতামিম / মুহতামিম সাহেব" (Madrasah) vs "প্রধান শিক্ষক" (School)
    academicTeacher: string; // "উস্তাদ / শিক্ষক" (Madrasah) vs "শ্রেণি শিক্ষক" (School)
    fund: string;            // "তহবিল (লিল্লাহ/যাকাত/সাধারণ)" (Madrasah) vs "School Fund" (School)
  };
  madrasahSpecific?: {
    hifzTrackerEnabled: boolean;
    zakatFundSegregation: boolean;
    qurbaniLeatherCollection: boolean;
    annualMahfilManagement: boolean;
  };
}
```

---

## 7. Migration Dependency & Execution Topology

Migration must execute in a strictly defined topological sequence to guarantee referential integrity:

```
[Phase 1: Tenant Core]
   Step 1: Create Tenant Root Document (/institutions/{instId})
   Step 2: Migrate Owner & Staff Memberships (/admins → /institutions/{instId}/members)
   Step 3: Migrate Institutional Profile, Branding & Grading Configs

[Phase 2: Academic Skeleton]
   Step 4: Migrate Classes (/classes → /institutions/{instId}/classes)
   Step 5: Migrate Subjects (/subjects → /institutions/{instId}/subjects)
   Step 6: Migrate Exams (/exams → /institutions/{instId}/exams)
   Step 7: Migrate Fee Structure Catalogs (/feeStructures → /institutions/{instId}/feeStructures)

[Phase 3: Student & Enrollment Core]
   Step 8: Migrate Students (/students → /institutions/{instId}/students) [Preserving Student IDs]

[Phase 4: Academic Records]
   Step 9: Migrate Exam Marks (/marks → /institutions/{instId}/marks)
   Step 10: Migrate Performance Remarks (/remarks → /institutions/{instId}/performanceRemarks)

[Phase 5: Financials & Utilities]
   Step 11: Migrate Transactions (/transactions → /institutions/{instId}/transactions)
   Step 12: Migrate Trash Bin Archive (/trashBin → /institutions/{instId}/trashBin)
   Step 13: Write Migration Audit Log (/institutions/{instId}/auditLogs/migration_log)
```

---

## 8. Planned Pre-Migration Checklist & Backup Strategy

*(Note: These are planned requirements to be executed strictly before any future live migration begins)*

### Pre-Migration Verification Checklist
- [ ] **Cloud Firestore Export**: Trigger full database export to Google Cloud Storage (`gs://madrasha-backup-{timestamp}/`).
- [ ] **Local Offline Snapshot**: Download complete JSON archive containing all 11 source collections.
- [ ] **Document Count Census**: Record exact source counts across all collections.
- [ ] **Financial Totals Reconciliation**: Compute total income, expense, and net balance hashes from source `/transactions`.
- [ ] **SHA-256 Checksum Manifest**: Generate checksum hashes for student, marks, and transaction payloads.
- [ ] **Staging Restore Rehearsal**: Validate that backup JSON files can be fully restored in a sandboxed test database.

---

## 9. Planned Dry-Run & Validation Pipeline

Before touching production data, a non-destructive dry run must be executed:
1. **In-Memory Transformation**: Read all source records and transform into target schemas without calling Firestore write methods.
2. **Schema Validation**: Execute strict Zod/TypeScript schema parsers against every transformed entity.
3. **Foreign Key Integrity Verification**:
   - Verify every `mark.studentId` exists in the student census.
   - Verify every `mark.subjectId` exists in the subject catalog.
   - Verify every `mark.examId` exists in the exam catalog.
   - Verify every `student.classLevel` matches a defined class.
4. **Dry-Run Audit Output**: Generate a simulation report indicating total transformed records, memory footprint, and any data anomalies.

---

## 10. Data-Loss Prevention & ID Preservation Principles

- **Zero-Loss ID Preservation**: Every target document retains its exact source ID (e.g. `/students/std_101` becomes `/institutions/{instId}/students/std_101`).
- **Idempotency**: All migration operations use `set(..., { merge: true })` so re-running a batch produces deterministic, non-duplicate results.
- **Source Data Retention**: Source root-level collections (`/students`, `/marks`, `/transactions`, etc.) remain **100% intact and untouched** during and after migration until formal deprecation sign-off.

---

## 11. Planned Rollback Architecture

- **Status**: **Planned Strategy (Design Proposal)** — not a currently guaranteed operational claim until dual-read client adapters and feature flags are implemented and tested in staging.
- **Mechanism**:
  - The client application will be equipped with a configuration switch (e.g. `VITE_DATA_SOURCE_MODE = 'LEGACY_ROOT' | 'MULTI_TENANT'`).
  - If unexpected discrepancies are detected post-migration, switching the client flag instantly redirects queries back to the original root collections.
  - Because root collections are never deleted during migration, no data loss or corruption can occur.

---

## 12. Future Multi-Tenant Firestore Security Model

Target security rules will enforce cryptographic tenant boundary isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null && request.auth.uid != null;
    }

    function isTenantMember(institutionId) {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/institutions/$(institutionId)/members/$(request.auth.uid)) ||
        request.auth.token.role == 'superadmin'
      );
    }

    function isTenantAdmin(institutionId) {
      return isSignedIn() && (
        (exists(/databases/$(database)/documents/institutions/$(institutionId)/members/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/institutions/$(institutionId)/members/$(request.auth.uid)).data.role in ['admin', 'owner']) ||
        request.auth.token.role == 'admin'
      );
    }

    // Tenant Scoped Domain Security
    match /institutions/{institutionId} {
      allow read: if isTenantMember(institutionId);
      allow write: if isTenantAdmin(institutionId);

      match /{subCollection}/{docId} {
        allow read: if isTenantMember(institutionId);
        allow write: if isTenantAdmin(institutionId);
      }
    }
  }
}
```

---

## 13. Proposed Migration Flow Diagram

```
   [1. Planned Backup & Checksum]
        ↓ (Cloud GCS Export + Local Offline JSON)
   [2. In-Memory Dry Run]
        ↓ (Zero-write schema & foreign-key validation)
   [3. Verification Gate]
        ↓ (Inspect dry-run log & checksum predictions)
   [4. Batch Migration Execution]
        ↓ (Ordered topological batch writes with preserved IDs)
   [5. Reconciliation & Hash Match]
        ↓ (Source vs Target count & financial total matching)
   [6. Controlled Tenant Cutover]
        ↓ (Staged client adapter switch to multi-tenant paths)
   [7. Retained Legacy Root Archives]
          (Original root collections preserved intact)
```
