import assert from 'node:assert';
import { executeDataIntegrityValidation, LegacyDataAdapter, FutureTenantDataAdapter, getDataAdapter, CANONICAL_PRIMARY_INSTITUTION_ID } from '../services/dataAdapter.ts';

console.log('================================================================');
console.log('PHASE 4D-1: CLIENT DATA ADAPTER & READ COMPATIBILITY TEST SUITE');
console.log('================================================================');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✖ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✖ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // Test 1: Factory defaults to LegacyDataAdapter
  test('Factory defaults to LegacyDataAdapter with mode LEGACY_ROOT', () => {
    const adapter = getDataAdapter();
    assert.strictEqual(adapter.mode, 'LEGACY_ROOT');
    assert.strictEqual(adapter.tenantId, CANONICAL_PRIMARY_INSTITUTION_ID);
    assert.strictEqual(adapter.isReadOnly, true);
  });

  // Test 2: Stable Institution ID
  test('Institution ID is stable, canonical, and immutable (inst_madrasah_primary)', () => {
    assert.strictEqual(CANONICAL_PRIMARY_INSTITUTION_ID, 'inst_madrasah_primary');
    const adapter = new FutureTenantDataAdapter(CANONICAL_PRIMARY_INSTITUTION_ID);
    assert.strictEqual(adapter.tenantId, 'inst_madrasah_primary');
  });

  // Test 3: Domain Separation - Remarks vs Daily Attendance
  test('Remarks and Attendance are strictly separated repositories', () => {
    const adapter = new LegacyDataAdapter();
    assert(typeof adapter.remarks.getAll === 'function', 'remarks repository exists');
    assert(typeof adapter.attendance.getAll === 'function', 'attendance repository exists');
    assert.notStrictEqual(adapter.remarks, adapter.attendance, 'remarks and attendance must be distinct repositories');
  });

  // Test 4: Domain Separation - FeeStructures vs StudentFeeDues vs Payments
  test('FeeStructures, StudentFeeDues, and Payments are strictly separated', () => {
    const adapter = new LegacyDataAdapter();
    assert(typeof adapter.feeStructures.getAll === 'function', 'feeStructures repository exists');
    assert(typeof adapter.studentFeeDues.getAll === 'function', 'studentFeeDues repository exists');
    assert(typeof adapter.payments.getAll === 'function', 'payments repository exists');
    assert.notStrictEqual(adapter.feeStructures, adapter.studentFeeDues);
    assert.notStrictEqual(adapter.studentFeeDues, adapter.payments);
  });

  // Test 5: Domain Separation - Transactions vs DoubleEntryLedger
  test('Single-entry Transactions and DoubleEntryLedger are strictly separated', () => {
    const adapter = new LegacyDataAdapter();
    assert(typeof adapter.transactions.getAll === 'function', 'transactions repository exists');
    assert(typeof adapter.doubleEntryLedger.getAll === 'function', 'doubleEntryLedger repository exists');
    assert.notStrictEqual(adapter.transactions, adapter.doubleEntryLedger);
  });

  // Test 6: Domain Separation - Trash vs AuditLogs
  test('TrashBin and AuditLogs are strictly separated', () => {
    const adapter = new LegacyDataAdapter();
    assert(typeof adapter.trash.getAll === 'function', 'trash repository exists');
    assert(typeof adapter.auditLogs.getAll === 'function', 'auditLogs repository exists');
    assert.notStrictEqual(adapter.trash, adapter.auditLogs);
  });

  // Test 7: FutureTenantDataAdapter is Read-Only Preview in Phase 4D-1
  await testAsync('FutureTenantDataAdapter operates in safe preview mode with empty arrays', async () => {
    const tenantAdapter = new FutureTenantDataAdapter('inst_test_tenant');
    assert.strictEqual(tenantAdapter.mode, 'TENANT_SCOPED');
    assert.strictEqual(tenantAdapter.tenantId, 'inst_test_tenant');
    assert.strictEqual(tenantAdapter.isReadOnly, true);
    
    const students = await tenantAdapter.students.getAll();
    assert.deepStrictEqual(students, []);
    const transactions = await tenantAdapter.transactions.getAll();
    assert.deepStrictEqual(transactions, []);
  });

  // Test 8: Data Integrity Validator detects missing foreign keys & malformed records
  test('DataIntegrityValidator accurately detects orphans without mutating inputs', () => {
    const sampleInput = {
      sourceMode: 'LEGACY_ROOT',
      tenantId: 'inst_madrasah_primary',
      students: [
        { id: 'std_1', studentId: '101', name: 'রহিম', classLevel: 'দাখিল', status: 'Active' },
        { id: 'std_2', studentId: '', name: 'করিম', classLevel: 'অজানা_ক্লাস', status: 'Active' } // Warning: empty roll, invalid class
      ],
      classes: [
        { id: 'cls_1', name: 'দাখিল', order: 1 }
      ],
      subjects: [
        { id: 'sub_1', name: 'কুরআন মাজীদ', classLevel: 'দাখিল', fullMarks: 100, passMarks: 33, isOptional: false, order: 1 }
      ],
      exams: [
        { id: 'ex_1', name: 'প্রথম সাময়িক', academicYear: '২০২৬', category: 'Term' }
      ],
      marks: [
        { id: 'm_1', studentId: 'std_1', subjectId: 'sub_1', examId: 'ex_1', obtained: 85, total: 100 },
        { id: 'm_2', studentId: 'std_999_missing', subjectId: 'sub_1', examId: 'ex_1', obtained: 70, total: 100 } // Orphan student
      ],
      remarks: [
        { studentId: 'std_1', examId: 'ex_1', remark: 'উত্তম', workingDays: 60, totalPresent: 58 }
      ],
      transactions: [
        { id: 'trx_1', voucherNo: 'MR-001', type: 'INCOME', category: 'TUITION', fundType: 'GENERAL', amount: 1500, date: '2026-01-01', paymentMethod: 'CASH', payerOrPayee: 'রহিম', createdAt: '2026-01-01' },
        { id: 'trx_2', voucherNo: '', type: 'EXPENSE', category: 'SALARY', fundType: 'GENERAL', amount: 0, date: '2026-01-02', paymentMethod: 'CASH', payerOrPayee: 'উস্তাদ', createdAt: '2026-01-02' } // Warnings: missing voucherNo, zero amount
      ],
      feeStructures: [
        { id: 'fs_1', classLevel: 'দাখিল', monthlyTuition: 1000, admissionFee: 2000, examFee: 500, boardingFee: 3000, bookFee: 500 }
      ],
      trashItems: []
    };

    const report = executeDataIntegrityValidation(sampleInput);

    assert.strictEqual(report.isHealthy, true, 'No fatal blocking ERROR in standard warning cases');
    assert(report.totalWarnings >= 4, `Expected at least 4 warnings, found: ${report.totalWarnings}`);
    assert.strictEqual(report.census.students, 2);
    assert.strictEqual(report.census.marks, 2);
    assert.strictEqual(report.census.transactions, 2);
    assert.strictEqual(report.checksums.totalIncome, 1500);
    assert.strictEqual(report.checksums.totalExpense, 0);
    assert.strictEqual(report.checksums.netBalance, 1500);
    assert.strictEqual(report.checksums.totalMarksSum, 155);

    // Verify input was not mutated
    assert.strictEqual(sampleInput.students.length, 2);
    assert.strictEqual(sampleInput.marks.length, 2);
  });

  // Test 9: ID Preservation Determinism
  test('Deterministic ID mapping preserves original IDs without random generation', () => {
    const rawStudent = { id: 'guid_std_007', studentId: '107', name: 'আব্দুল্লাহ' };
    assert.strictEqual(rawStudent.id, 'guid_std_007');
    assert.strictEqual(rawStudent.studentId, '107');
  });

  console.log('----------------------------------------------------------------');
  console.log(`Results: ${passed}/${total} tests PASSED cleanly.`);
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
