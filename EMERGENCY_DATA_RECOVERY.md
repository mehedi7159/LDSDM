# EMERGENCY DATA RECOVERY ARCHITECTURE & RUNBOOK
## LocalStorage Snapshot to Cloud Firestore (`/institution/main_store`)

> **CRITICAL RECOVERY DIRECTIVES & SAFETY RECORD**:
> - **DATA MIGRATION: NO**
> - **AUTOMATIC CLOUD SYNC: NO**
> - **LOCAL DATA DELETED: NO**
> - **DEMO DATA LOADED: NO**
> - **TENANT DATA WRITTEN: NO**
> - **FIRESTORE RULES CHANGED: NO**
> - **AUTH/RBAC CHANGED: NO**
> - **RECOVERY UI CREATED: YES**
> - **LOCAL BACKUP EXPORT CREATED: YES**
> - **CLOUD RESTORE IMPLEMENTED: YES**
> - **CLOUD RESTORE EXECUTED: NO** (Ready for Administrator Action)

---

## A. Root Cause Analysis

1. **Client-Side Storage Precedence**: Prior to custom claim validation, application state lived entirely within the browser's `localStorage` (students, classes, subjects, exams, marks, remarks, transactions).
2. **Permission Denial During Initial Sessions**: Because Firestore security rules enforced `request.auth.token.role == 'admin'`, cloud writes from the client were rejected with `PERMISSION_DENIED`. The data remained fully intact in the original browser's local cache but was never written to Cloud Firestore.
3. **New Browser Cold-Start**: Opening the app in a fresh browser starts with an empty `localStorage`. When the app queried Firestore, the document `/institution/main_store` was empty/non-existent, resulting in 0 records displayed.

---

## B. LocalStorage Data Sources & Inventory

The recovery utility (`/services/localDataRecovery.ts`) inspects the following 10 exact keys:

| LocalStorage Key | Domain Entity | Description |
|---|---|---|
| `students` | Students | Enrolled student profiles, rolls, IDs, guardian details |
| `classes` | Classes | Academic classes and grade level definitions |
| `subjects` | Subjects | Curricular subjects, theory/MCQ full and pass marks |
| `exams` | Exams | Examination terms (Annual, Term, Monthly) |
| `marks` | Marks | Exam marks, obtained totals, CQ/MCQ breakdown |
| `remarks` | Remarks | Exam-wise qualitative evaluations and attendance summaries |
| `madrasha_transactions` | Transactions | Income & expense cash flow vouchers |
| `madrasha_fee_structures` | Fee Structures | Class fee templates |
| `madrasha_trash_bin` | Trash Bin | Recoverable deleted items |
| `schoolProfile` | Profile | Institutional name, headmaster, grading system |

---

## C. Step-by-Step Administrator Recovery Flow

```
+-----------------------------------------------------------------------------------+
| STEP 1: OPEN APPLICATION IN ORIGINAL BROWSER                                      |
| Open the application in the browser/device where the data was originally entered. |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| STEP 2: OPEN EMERGENCY DATA RECOVERY MODAL                                        |
| Click "ডাটা রিকভারি ও ব্যাকআপ" on the Dashboard or Cloud Sync widget.              |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| STEP 3: INSPECT LOCAL CENSUS                                                      |
| Verify non-zero counts for Students, Marks, Classes, Subjects, Exams.             |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| STEP 4: DOWNLOAD LOCAL JSON BACKUP                                                |
| Click "Download Local JSON Backup" (madrasah-local-recovery-YYYY-MM-DD.json).     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| STEP 5: AUTOMATED INTEGRITY VALIDATION                                            |
| System validates foreign keys, primary IDs, and ensures zero malformed records.   |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| STEP 6: EXPLICIT ADMINISTRATOR CONFIRMATION                                       |
| Check the confirmation checkbox approving the push to `/institution/main_store`.  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| STEP 7: RESTORE & IMMEDIATE READ-BACK VERIFICATION                                |
| System pushes validated payload and reads back Firestore to verify count parity.  |
+-----------------------------------------------------------------------------------+
```

---

## D. Validation Engine & Error Handling

The pure validation function `validateRecoverySnapshot()` enforces:
1. **Empty-State Blocking**: If total records equal 0, restore is blocked.
2. **Missing ID Detection**: Flags records missing primary identifiers.
3. **Foreign Key Integrity**: Identifies orphaned marks where `studentId` does not exist in student census.
4. **Duplicate Detection**: Identifies repeated student IDs.

---

## E. Critical Empty-Data & Auto-Sync Protection

To protect Firestore from being overwritten by empty clients:
1. **No Auto-Seed on Login**: Removed automatic initial seed of empty objects when `!snapshot.exists()`.
2. **Auto-Sync Guard**: Debounced auto-sync strictly checks:
   ```typescript
   if (students.length === 0 && marks.length === 0 && classes.length === 0) {
     return; // Block auto-sync from empty browser sessions
   }
   ```
3. **Demo Data Guard**: Seeding demo data now requires explicit double-confirmation with warning text.

---

## F. Target Destination

- **Authoritative Legacy Path**: `/institution/main_store`
- **Strict Rule**: No tenant subcollections (`/institutions/...`) are written during this recovery phase.

---

## G. Post-Restore Verification

Immediately after `setDoc(doc(db, 'institution', 'main_store'), payload, { merge: true })`:
1. The client executes `getDoc()` to read back the freshly committed state.
2. Counts for students, classes, subjects, exams, marks, and transactions are matched with the local snapshot.
3. If counts match 100%, the green verification badge is displayed.

---

## H. Preservation of Local Data

- Even after successful cloud sync, **`localStorage` is NEVER cleared or deleted**.
- The administrator retains both the local storage state and the downloaded JSON backup file.
