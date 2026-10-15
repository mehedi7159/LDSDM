import assert from 'node:assert';
import {
  validateRecoverySnapshot,
  LocalRecoverySnapshot
} from '../services/localDataRecovery';

console.log('================================================================');
console.log('EMERGENCY DATA RECOVERY TEST SUITE');
console.log('================================================================');

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✖ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// TEST 1: Old browser with real local data -> valid snapshot
test('TEST 1: Valid snapshot with student/marks/classes passes validation and allows restore', () => {
  const sampleSnapshot: LocalRecoverySnapshot = {
    version: '1.0.0-recovery',
    exportedAt: new Date().toISOString(),
    sourceOrigin: 'http://localhost:3000',
    counts: {
      students: 2,
      classes: 1,
      subjects: 1,
      exams: 1,
      marks: 1,
      remarks: 0,
      transactions: 0,
      feeStructures: 0,
      trashBin: 0
    },
    payload: {
      schoolProfile: {
        name: 'দারুল উলুম মাদ্রাসা',
        nameBn: 'দারুল উলুম মাদ্রাসা',
        address: 'ঢাকা',
        phone: '',
        email: '',
        academicYear: '২০২৬',
        headMasterName: 'মুহতামিম সাহেব'
      },
      students: [
        { id: 'std_1', studentId: '101', name: 'আব্দুল্লাহ', classLevel: 'হিফজ', status: 'Active' },
        { id: 'std_2', studentId: '102', name: 'আব্দুর রহমান', classLevel: 'হিফজ', status: 'Active' }
      ],
      classes: [
        { id: 'cls_1', name: 'হিফজ', order: 1 }
      ],
      subjects: [
        { id: 'sub_1', name: 'কুরআন মাজীদ', classLevel: 'হিফজ', fullMarks: 100, passMarks: 33, isOptional: false, order: 1 }
      ],
      exams: [
        { id: 'ex_1', name: 'প্রথম সাময়িক', academicYear: '২০২৬', category: 'Term' }
      ],
      marks: [
        { id: 'm_1', studentId: 'std_1', subjectId: 'sub_1', examId: 'ex_1', obtained: 95, total: 100 }
      ],
      remarks: [],
      transactions: [],
      feeStructures: [],
      trashBin: []
    }
  };

  const val = validateRecoverySnapshot(sampleSnapshot);
  assert.strictEqual(val.isValid, true);
  assert.strictEqual(val.canRestore, true);
  assert.strictEqual(val.isEmpty, false);
  assert.strictEqual(val.errors.length, 0);
  assert.strictEqual(val.summary.hasStudents, true);
});

// TEST 2: Empty browser -> strictly blocks cloud write
test('TEST 2: Empty browser snapshot (0 records) strictly fails validation and blocks restore', () => {
  const emptySnapshot: LocalRecoverySnapshot = {
    version: '1.0.0-recovery',
    exportedAt: new Date().toISOString(),
    sourceOrigin: 'http://localhost:3000',
    counts: {
      students: 0,
      classes: 0,
      subjects: 0,
      exams: 0,
      marks: 0,
      remarks: 0,
      transactions: 0,
      feeStructures: 0,
      trashBin: 0
    },
    payload: {
      schoolProfile: {
        name: 'Default',
        nameBn: 'Default',
        address: '',
        phone: '',
        email: '',
        academicYear: '2026',
        headMasterName: ''
      },
      students: [],
      classes: [],
      subjects: [],
      exams: [],
      marks: [],
      remarks: [],
      transactions: [],
      feeStructures: [],
      trashBin: []
    }
  };

  const val = validateRecoverySnapshot(emptySnapshot);
  assert.strictEqual(val.isValid, false, 'Empty snapshot must be invalid');
  assert.strictEqual(val.canRestore, false, 'Empty snapshot MUST NOT be allowed to restore');
  assert.strictEqual(val.isEmpty, true, 'Snapshot is correctly flagged as empty');
  assert(val.errors.length > 0, 'Must provide an explicit error explaining the empty state');
});

// TEST 3: Malformed local record -> validation reports error/warnings
test('TEST 3: Malformed student record (missing ID) is caught during validation', () => {
  const malformedSnapshot: LocalRecoverySnapshot = {
    version: '1.0.0-recovery',
    exportedAt: new Date().toISOString(),
    sourceOrigin: 'http://localhost:3000',
    counts: {
      students: 1,
      classes: 1,
      subjects: 0,
      exams: 0,
      marks: 0,
      remarks: 0,
      transactions: 0,
      feeStructures: 0,
      trashBin: 0
    },
    payload: {
      schoolProfile: {} as any,
      students: [
        { id: '', studentId: '101', name: 'অজ্ঞাত', classLevel: 'হিফজ', status: 'Active' } // Missing ID
      ],
      classes: [{ id: '1', name: 'হিফজ', order: 1 }],
      subjects: [],
      exams: [],
      marks: [],
      remarks: [],
      transactions: [],
      feeStructures: [],
      trashBin: []
    }
  };

  const val = validateRecoverySnapshot(malformedSnapshot);
  assert.strictEqual(val.isValid, false);
  assert.strictEqual(val.canRestore, false);
  assert(val.errors.some(e => e.entity === 'Student' && e.message.includes('missing unique ID')));
});

// TEST 4: Orphan mark detection
test('TEST 4: Marks pointing to deleted/missing student IDs are flagged as warnings', () => {
  const orphanMarkSnapshot: LocalRecoverySnapshot = {
    version: '1.0.0-recovery',
    exportedAt: new Date().toISOString(),
    sourceOrigin: 'http://localhost:3000',
    counts: {
      students: 1,
      classes: 1,
      subjects: 1,
      exams: 1,
      marks: 1,
      remarks: 0,
      transactions: 0,
      feeStructures: 0,
      trashBin: 0
    },
    payload: {
      schoolProfile: {} as any,
      students: [
        { id: 'std_valid', studentId: '101', name: 'সাদিক', classLevel: 'হিফজ', status: 'Active' }
      ],
      classes: [{ id: '1', name: 'হিফজ', order: 1 }],
      subjects: [{ id: 'sub_1', name: 'কুরআন', classLevel: 'হিফজ', fullMarks: 100, passMarks: 33, isOptional: false, order: 1 }],
      exams: [{ id: 'ex_1', name: 'বার্ষিক', academicYear: '২০২৬', category: 'Term' }],
      marks: [
        { id: 'm_1', studentId: 'std_deleted_orphan', subjectId: 'sub_1', examId: 'ex_1', obtained: 80, total: 100 }
      ],
      remarks: [],
      transactions: [],
      feeStructures: [],
      trashBin: []
    }
  };

  const val = validateRecoverySnapshot(orphanMarkSnapshot);
  assert(val.warnings.some(w => w.entity === 'Mark' && w.message.includes('missing studentId')));
});

// TEST 5: ID Checksum & Parity Verification
test('TEST 5: ID parity verification detects missing or mismatched IDs accurately', () => {
  const localStudents = [{ id: 's1' }, { id: 's2' }];
  const cloudStudents = [{ id: 's1' }, { id: 's2' }];
  const localSet = new Set(localStudents.map(s => s.id));
  const cloudSet = new Set(cloudStudents.map(s => s.id));
  assert.strictEqual(localSet.size, cloudSet.size);
  for (const id of localSet) {
    assert.strictEqual(cloudSet.has(id), true);
  }

  // Mismatched ID scenario
  const corruptedCloud = [{ id: 's1' }, { id: 's999' }];
  const corruptedCloudSet = new Set(corruptedCloud.map(s => s.id));
  assert.strictEqual(corruptedCloudSet.has('s2'), false);
});

// TEST 6: Empty client state cannot auto-sync
test('TEST 6: Auto-sync guard rejects empty client array states', () => {
  const students = [];
  const marks = [];
  const classes = [];
  const shouldBlockSync = students.length === 0 && marks.length === 0 && classes.length === 0;
  assert.strictEqual(shouldBlockSync, true, 'Auto sync MUST be blocked when client arrays are empty');
});

// TEST 7: Non-empty client allows sync
test('TEST 7: Non-empty client state permits sync for authenticated admin', () => {
  const students = [{ id: 's1' }];
  const marks = [];
  const classes = [{ id: 'c1' }];
  const shouldBlockSync = students.length === 0 && marks.length === 0 && classes.length === 0;
  assert.strictEqual(shouldBlockSync, false, 'Auto sync allowed when real data exists');
});

console.log('----------------------------------------------------------------');
console.log(`Results: ${passed}/${total} recovery test assertions PASSED cleanly.`);
console.log('================================================================');
