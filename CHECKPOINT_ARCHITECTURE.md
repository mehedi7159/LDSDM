# Architecture & Pre-Refactoring Checkpoint Documentation

## 1. System Overview
The application is a single-page React 19 + TypeScript + Vite application designed for Madrasah (Islamic academic institution) management. It manages student profiles, subjects, examination marks entry, grade & GPA tabulation calculations, PDF report cards with QR authentication, and a finance & accounts ledger.

## 2. Core Architecture Components
- **State Management & Persistence (`context/AppContext.tsx`)**:
  - Centralized React Context managing collections: `students`, `subjects`, `exams`, `marks`, `remarks`, `classes`, `trashBin`, `transactions`, `feeStructures`, `vouchers`, and `schoolProfile`.
  - Firestore Real-time synchronization with LocalStorage fallback / cache.
  - Role-Based Access Control (`isAdmin`, `adminPin`) for sensitive operational workflows (Finance, Settings, Mass Deletions).
- **Core Domain & Type Model (`types.ts` & `components/finance/types.ts`)**:
  - Complete schema for academic entities (students, grading systems, pass/fail rules, continuous assessment CQ/MCQ, Dakhil 4th subject logic).
  - Finance models: `Transaction`, `ClassFeeStructure`, `MonthlyFeeRecord`, `Voucher`, and `SalaryDisbursementBridge`.
- **Reporting & Verification (`components/ResultView.tsx`, `ResultVerificationQR.tsx`, `VerifiedResultModal.tsx`)**:
  - Multiple result sheet engines: Standard, B&W, Premium Dakhil, Premium Colored, Royal Crest, Monthly Report, Tabulation Matrix.
  - Unique QR Verification Hash engine derived deterministically from student roll, session, exam payload, and institution metadata with direct scan routing via query parameters.
- **Finance Module (`components/FinanceManager.tsx` & `/components/finance/*`)**:
  - Student fee collections, Teacher salary disbursement, General income/expense vouchers, Development donations, and Ledger analytics.

## 3. Major Known Risks & Considerations for Upcoming Phases
1. **Large Component Monoliths**:
   - `components/ResultView.tsx` (~3,180 lines) contains multiple card templates. Any card styling changes must preserve existing print boundary coordinates (`210mm x 297mm`) and QR rendering.
   - `components/FinanceManager.tsx` (~840 lines) hosts multiple modal states and sub-views. Refactoring must keep top-level navigation intuitive and prevent cross-view state leaks.
2. **Dual Fee Architecture**:
   - Both `student.monthlyFees` (legacy embedded array) and `Transaction` records (ledger-based) exist. Changes to Finance must ensure reconciliation calculations in `services/utils.ts` continue matching both structures without breaking historical records.
3. **Print & PDF Layout Staging**:
   - Print & PDF exports rely on off-screen staging DOM elements with strict DPI sizing to avoid blank page or clipping issues. Changes to CSS / Tailwind classes must preserve `@media print` rules in `index.html`.
4. **Security & Permissions**:
   - Firestore security rules are open (`allow read, write: if true`) with app-level PIN gates. No rules changes or auth breaking migrations should occur until explicitly requested.
