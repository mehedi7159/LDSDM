import assert from 'node:assert';
import { assertNoPasswordInStaff, assertUpsertRecords, validateFullPayload } from '../services/mainStoreWrite';
import { stripStaffPassword } from '../services/cloudConfirm';
import { approvalPasswordFor } from '../services/googleSignupRules';

console.log('--- Running Step 1 Password Removal Self-Check ---');

// 1. Test approvalPasswordFor returns undefined for all members (no stamped default password)
assert.strictEqual(
  approvalPasswordFor({ password: 'secret', authProvider: 'google' }),
  undefined,
  'approvalPasswordFor must return undefined for google members'
);
assert.strictEqual(
  approvalPasswordFor({ password: 'secret' }),
  undefined,
  'approvalPasswordFor must return undefined for email members (no stored passwords)'
);
assert.strictEqual(
  approvalPasswordFor({}),
  undefined,
  'approvalPasswordFor must return undefined when empty'
);
console.log('✓ approvalPasswordFor returns undefined for all members');

// 2. Test stripStaffPassword strips password from object
const rawTeacher = { id: 'MDR-T001', name: 'Test Teacher', password: 'plain-password-123', email: 'test@example.com' };
const sanitizedTeacher = stripStaffPassword(rawTeacher);
assert.strictEqual('password' in sanitizedTeacher, false, 'password key must be stripped');
assert.strictEqual(sanitizedTeacher.id, 'MDR-T001');
assert.strictEqual(sanitizedTeacher.name, 'Test Teacher');
assert.strictEqual(sanitizedTeacher.email, 'test@example.com');
console.log('✓ stripStaffPassword completely removes password property');

// 3. Test assertNoPasswordInStaff rejects passwords in teachers and users
assert.throws(
  () => {
    assertNoPasswordInStaff('teachers', [{ id: 't1', password: 'secret' }]);
  },
  /Phase 1 choke point: teachers write rejected/,
  'assertNoPasswordInStaff must throw for teachers with password'
);

assert.throws(
  () => {
    assertNoPasswordInStaff('users', [{ id: 'u1', password: 'secret' }]);
  },
  /Phase 1 choke point: users write rejected/,
  'assertNoPasswordInStaff must throw for users with password'
);

// Must not throw for records without password
assert.doesNotThrow(() => {
  assertNoPasswordInStaff('teachers', [{ id: 't1', name: 'Teacher' }]);
  assertNoPasswordInStaff('users', [{ id: 'u1', name: 'User' }]);
  assertNoPasswordInStaff('students', [{ id: 's1', name: 'Student' }]);
});
console.log('✓ assertNoPasswordInStaff rejects any write with a password field');

// 4. Test assertUpsertRecords triggers assertNoPasswordInStaff
assert.throws(
  () => {
    assertUpsertRecords('teachers', [{ id: 't1', password: '123' }], (r) => r.id);
  },
  /Phase 1 choke point: teachers write rejected/,
  'assertUpsertRecords must call assertNoPasswordInStaff'
);

// 5. Test validateFullPayload triggers assertNoPasswordInStaff
assert.throws(
  () => {
    validateFullPayload(
      {
        teachers: [{ id: 't1', password: '123' }],
        users: [{ id: 'u1' }],
        students: [{ id: 's1' }]
      },
      'full'
    );
  },
  /Phase 1 choke point: teachers write rejected/,
  'validateFullPayload must reject full payload if teacher has password'
);

assert.throws(
  () => {
    validateFullPayload(
      {
        teachers: [{ id: 't1' }],
        users: [{ id: 'u1', password: '456' }],
        students: [{ id: 's1' }]
      },
      'full'
    );
  },
  /Phase 1 choke point: users write rejected/,
  'validateFullPayload must reject full payload if user has password'
);

// Safe payload passes validateFullPayload
assert.doesNotThrow(() => {
  validateFullPayload(
    {
      teachers: [{ id: 't1' }],
      users: [{ id: 'u1' }],
      students: [{ id: 's1' }]
    },
    'full'
  );
});
console.log('✓ validateFullPayload and assertUpsertRecords enforce password rejection');

console.log('--- ALL CHECKS PASSED SUCCESSFULLY ---');
