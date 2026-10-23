import { Student, ClassFeeStructure, FinanceTransaction } from '../types';

export interface StudentDueProfile {
  student: Student;
  classLevel: string;
  monthlyExpected: number;
  paidThisMonth: number;
  dueThisMonth: number;
  totalPaidLifetime: number;
  isPaid: boolean;
  statusBadgeBn: string;
  statusBadgeColor: string;
}

export interface ClassDuesSummary {
  className: string;
  totalStudents: number;
  totalExpected: number;
  totalPaid: number;
  totalDue: number;
  dueStudentsCount: number;
  paidStudentsCount: number;
  profiles: StudentDueProfile[];
}

/**
 * Calculates current month student fee and due status based on feeStructures and recorded transactions
 */
export function calculateSingleStudentDue(
  student: Student,
  feeStructures: ClassFeeStructure[],
  transactions: FinanceTransaction[],
  targetMonth?: string
): StudentDueProfile {
  const currentMonthStr = targetMonth || new Date().toISOString().slice(0, 7); // YYYY-MM

  // Find fee structure for student's class
  const struct = feeStructures.find(f => f.classLevel === student.classLevel);
  // An explicit per-student monthly fee recorded on the student record
  // (legacy field, still honoured where present) overrides the class rate.
  const perStudentOverride = Number((student as any).monthlyFee) || 0;
  // Default expected tuition if no structure is configured is 0 or base rate
  const monthlyExpected = perStudentOverride > 0
    ? perStudentOverride
    : struct ? (struct.monthlyTuition || 0) + (struct.boardingFee || 0) : 0;

  // Filter transactions for this student
  let paidThisMonth = 0;
  let totalPaidLifetime = 0;

  transactions.forEach(tx => {
    if (tx.type === 'INCOME' && tx.studentId && (tx.studentId === student.id || tx.studentId === student.studentId)) {
      totalPaidLifetime += Number(tx.amount) || 0;

      const txDateMonth = (tx.date || '').slice(0, 7);
      if (tx.feeMonth === currentMonthStr || txDateMonth === currentMonthStr) {
        paidThisMonth += Number(tx.amount) || 0;
      }
    }
  });

  const dueThisMonth = Math.max(0, monthlyExpected - paidThisMonth);
  const isPaid = monthlyExpected > 0 ? dueThisMonth === 0 : true;

  let statusBadgeBn = 'পরিশোধিত';
  let statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  if (monthlyExpected > 0) {
    if (paidThisMonth >= monthlyExpected) {
      statusBadgeBn = 'পরিশোধিত';
      statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (paidThisMonth > 0) {
      statusBadgeBn = 'আংশিক পরিশোধ';
      statusBadgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    } else {
      statusBadgeBn = 'বকেয়া রয়েছে';
      statusBadgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
  } else {
    statusBadgeBn = 'ফি নির্ধারণ নেই';
    statusBadgeColor = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }

  return {
    student,
    classLevel: student.classLevel,
    monthlyExpected,
    paidThisMonth,
    dueThisMonth,
    totalPaidLifetime,
    isPaid,
    statusBadgeBn,
    statusBadgeColor
  };
}

/**
 * Calculates dues summary for a roster of students in a class
 */
export function calculateClassDuesSummary(
  students: Student[],
  feeStructures: ClassFeeStructure[],
  transactions: FinanceTransaction[],
  targetMonth?: string
): ClassDuesSummary {
  const className = students[0]?.classLevel || 'সকল শ্রেণি';
  let totalExpected = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let dueStudentsCount = 0;
  let paidStudentsCount = 0;

  const profiles = students.map(st => {
    const p = calculateSingleStudentDue(st, feeStructures, transactions, targetMonth);
    totalExpected += p.monthlyExpected;
    totalPaid += p.paidThisMonth;
    totalDue += p.dueThisMonth;
    if (p.dueThisMonth > 0) {
      dueStudentsCount += 1;
    } else {
      paidStudentsCount += 1;
    }
    return p;
  });

  return {
    className,
    totalStudents: students.length,
    totalExpected,
    totalPaid,
    totalDue,
    dueStudentsCount,
    paidStudentsCount,
    profiles
  };
}

/**
 * Formats a friendly Bengali SMS or message for parents regarding fee dues
 */
export function getDueReminderMessage(
  studentName: string,
  classLevel: string,
  dueAmount: number,
  institutionName: string
): string {
  return `আসসালামু আলাইকুম। ${institutionName}-এর শিক্ষার্থী ${studentName} (${classLevel})-এর চলতি মাসের ফি বাবদ ৳${dueAmount.toLocaleString()} বকেয়া রয়েছে। মাদরাসার সার্বিক পরিচালনা নিয়মিত রাখতে অনুগ্রহপূর্বক দ্রুত বকেয়া পরিশোধ করার অনুরোধ করা হলো। জাযাকাল্লাহু খাইরান।`;
}
