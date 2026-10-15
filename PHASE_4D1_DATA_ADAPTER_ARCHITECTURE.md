# PHASE 4D-1 — CLIENT DATA ADAPTER & READ COMPATIBILITY ARCHITECTURE

> **CRITICAL DIRECTIVE & MANDATORY STATEMENT:**  
> **THIS PHASE DOES NOT MIGRATE PRODUCTION DATA.**  
> 
> - **DATABASE MIGRATION EXECUTED: NO**  
> - **EXISTING DATA MODIFIED: NO**  
> - **EXISTING DATA DELETED: NO**  
> - **FIRESTORE RULES CHANGED: NO**  
> - **PRODUCTION TENANT DATA WRITTEN: NO**  
> - **DUAL-WRITE ENABLED: NO**  
> - **PRODUCTION CUTOVER EXECUTED: NO**  
> - **ACTUAL BACKUP EXECUTED: NO**  

---

## A. Current Legacy Data Source

The current production data source remains 100% authoritative and untouched:
- Single-tenant root document: `/institution/main_store` (containing institutional profile, arrays for students, classes, subjects, exams, marks, remarks, transactions, feeStructures, and trashBin).
- Root-level collection paths:
  - `/students/{studentId}`
  - `/classes/{classId}`
  - `/subjects/{subjectId}`
  - `/exams/{examId}`
  - `/marks/{markId}`
  - `/remarks/{remarkId}`
  - `/transactions/{transactionId}`
  - `/feeStructures/{feeStructureId}`
  - `/trashBin/{trashId}`
  - `/admins/{uid}`
- All current UI views and contexts continue reading from these authoritative production locations.

---

## B. Future Tenant Data Source

The target SaaS multi-tenant path hierarchy is designed as:
```
/institutions/{institutionId}/profile/config
/institutions/{institutionId}/members/{uid}
/institutions/{institutionId}/classes/{classId}
/institutions/{institutionId}/subjects/{subjectId}
/institutions/{institutionId}/exams/{examId}
/institutions/{institutionId}/students/{studentId}
/institutions/{institutionId}/guardians/{guardianId}
/institutions/{institutionId}/staff/{staffId}
/institutions/{institutionId}/marks/{markId}
/institutions/{institutionId}/performanceRemarks/{remarkId}
/institutions/{institutionId}/attendance/{attendanceId}
/institutions/{institutionId}/feeStructures/{feeStructureId}
/institutions/{institutionId}/studentFeeDues/{dueId}
/institutions/{institutionId}/payments/{paymentId}
/institutions/{institutionId}/transactions/{transactionId}
/institutions/{institutionId}/ledgerEntries/{entryId}
/institutions/{institutionId}/funds/{fundId}
/institutions/{institutionId}/trashBin/{trashId}
/institutions/{institutionId}/auditLogs/{auditId}
```
**Phase 4D-1 Constraint:** This target structure is defined purely at the interface and abstraction layer. **Zero production writes** are performed to any `/institutions/{institutionId}/...` path.

---

## C. Adapter Architecture

The Client Data Adapter (`/services/dataAdapter.ts`) introduces an interface-driven abstraction layer:

```
[ Application Layer / UI / Context ]
                   │
                   ▼
     [ IDataAdapter Abstraction ]
       ├─ Mode: 'LEGACY_ROOT' | 'TENANT_SCOPED'
       ├─ IsReadOnly: true (strictly enforced in 4D-1)
       └─ Repositories (10 core + 5 future domains)
                   │
         ┌─────────┴─────────────────────┐
         ▼                               ▼
[ LegacyDataAdapter ]         [ FutureTenantDataAdapter ]
  (Active Production)           (Read-Only Preview Stub)
  Reads from:                   Target Scope:
  /institution/main_store       /institutions/{instId}/...
  & root collections            (Zero writes allowed)
```

Factory function `getDataAdapter(tenantId?: string)` governs instantiation:
- **Default:** Always instantiates and returns `LegacyDataAdapter` (`mode: 'LEGACY_ROOT'`).
- Feature flag `VITE_USE_TENANT_COLLECTIONS` defaults to `false`.

---

## D. Repository Interfaces

1. **`IInstitutionRepository`**: Fetches institutional profile, grading system, and tenant metadata.
2. **`IStudentRepository`**: Retrieves enrolled student lists, queries by class level, and retrieves individual students by ID.
3. **`IClassRepository`**: Manages academic class configurations and sort orders.
4. **`ISubjectRepository`**: Manages curricular subject lists and class assignments.
5. **`IExamRepository`**: Manages exam term definitions, categories, and contribution weights.
6. **`IMarkRepository`**: Queries student scores by exam or student.
7. **`IPerformanceRemarkRepository`**: Handles exam-wise teacher observations and aggregate term attendance.
8. **`ITransactionRepository`**: Queries single-entry cash income/expense vouchers, calculates financial totals.
9. **`IFeeStructureRepository`**: Queries class fee catalogs and templates.
10. **`ITrashRepository`**: Queries soft-deleted restorable items.
11. **Future Domain Stubs**:
    - `IAttendanceRepository` (Daily timestamped roll calls)
    - `IStudentFeeDuesRepository` (Student-specific generated fee invoices)
    - `IPaymentRepository` (Real money collection receipts)
    - `IDoubleEntryLedgerRepository` (Double-entry debits and credits)
    - `IAuditLogRepository` (Immutable operational security logs)

---

## E. Strict Domain Separation

To avoid conflation of distinct business entities, the adapter strictly segregates:

| # | Legacy Concept | Target Entity | Why Separated |
|---|---|---|---|
| 1 | `remarks` | `performanceRemarks` | Exam-term summary & qualitative comment; NOT daily attendance. |
| 2 | *(New domain)* | `attendance` | Daily timestamped check-in records (`status: PRESENT/ABSENT/LATE`). |
| 3 | `feeStructures` | `feeStructures` | Catalog templates of monthly/admission/exam rates per class. |
| 4 | *(New domain)* | `studentFeeDues` | Actual student debt/invoices generated per billing cycle. |
| 5 | *(New domain)* | `payments` | Formal money receipts upon receiving tuition or fees. |
| 6 | `transactions` | `transactions` | Single-entry cash receipts and disbursements vouchers. |
| 7 | *(New domain)* | `ledgerEntries` | Double-entry accounting lines (Debit Account / Credit Account). |
| 8 | `trashBin` | `trashBin` | Recoverable soft-delete bin that can be restored or purged. |
| 9 | *(New domain)* | `auditLogs` | Immutable, append-only security logs for compliance. |

---

## F. ID Preservation Strategy

- **Deterministic ID Invariant**: Every record retains its existing identifier:
  $$\text{Target ID} \equiv \text{Legacy ID}$$
- For example, `/students/std_001` becomes `/institutions/inst_madrasah_primary/students/std_001`.
- No auto-generated randomized hashes replace existing keys. This ensures 100% stable foreign key relationships (`mark.studentId === student.id`).

---

## G. Read Strategy

- **Authoritative Source**: Legacy root data source.
- **Offline Resiliency**: Seamless fallback to cached localStorage snapshots if Firestore connection is offline.
- **Tenant Mode**: In Phase 4D-1, `FutureTenantDataAdapter` operates strictly as a read-only preview/stub that returns empty datasets and blocks any state modifications.

---

## H. Write Safety

- **No Dual-Write**: Dual-write is intentionally **NOT** implemented in Phase 4D-1 to prevent race conditions, duplicate writes, or partial state corruptions.
- **Write Path Unchanged**: Application writes remain strictly on the existing production path (`institution/main_store` via `AppContext.tsx`).
- **Zero Tenant Pollution**: No documents or subcollections are created under `/institutions/{institutionId}/...`.

---

## I. Validation & Integrity Strategy

The pure, non-destructive function `executeDataIntegrityValidation()` scans in-memory datasets and flags:
1. Missing primary IDs (`id`, `studentId`, `classId`, `subjectId`, `examId`).
2. Orphaned marks (marks referencing deleted students, subjects, or exams).
3. Orphaned remarks (remarks referencing non-existent students or exams).
4. Malformed transactions (missing voucher numbers or non-positive amounts).
5. Unlinked class assignments (students or subjects assigned to unregistered classes).
6. Financial balance checksums ($\text{Net} = \text{Total Income} - \text{Total Expense}$).

**Absolute Rule:** The integrity checker **NEVER** mutates, repairs, or deletes any production record automatically; it exclusively produces an audit report.

---

## J. Rollback Concept

- Since zero writes are made to tenant paths, rollback is fundamentally guaranteed by design:
  - If any issue arises with the adapter, UI code can reference legacy context functions directly.
  - The feature flag `VITE_USE_TENANT_COLLECTIONS` defaults to `false`.

---

## K. Future Migration Path

Following Phase 4D-1, the roadmap proceeds strictly through:
1. **PHASE 4D-2**: In-Memory Dry-Run + Schema & Foreign-Key Integrity Validation (validating live production data in-memory without writes).
2. **PHASE 4E**: Non-destructive batch migration with strict verification gates.
3. **PHASE 4F**: Read verification & controlled dual-read validation before any cutover.

---

## L. Known Limitations

- `FutureTenantDataAdapter` does not query live Firestore tenant subcollections in Phase 4D-1 (stubbed to prevent accidental reads or writes before Phase 4D-2 dry-run).
- Dual-read verification is deferred to Phase 4F after migration data is verified.
