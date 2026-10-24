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

// ---------------------------------------------------------------------------
// Fee aging (ADDITIVE — Phase 2, mobile Due report sections only).
// Tutor App rule, as the owner stated it: a month's fee becomes due only
// AFTER that month ends — September's unpaid fee shows as due from Oct 1,
// bucketed by age. This function NEVER feeds the existing current-month
// dues (calculateSingleStudentDue / calculateClassDuesSummary) or any
// desktop screen; it is used only by the new mobile report sections.
// ---------------------------------------------------------------------------

export interface FeeAgingMonth {
  month: string; // YYYY-MM, finished month with unpaid fee remaining
  due: number;
}

export interface FeeAging {
  studentId: string;
  asOfMonth: string; // YYYY-MM the aging is viewed from
  startMonth: string | null; // first month with an expected fee, or null
  currentMonthDue: number; // unfinished month's due — DISPLAY ONLY, never aged
  oneMonthOld: number; // unpaid from asOfMonth - 1 (e.g. September in October)
  twoPlusMonthsOld: number; // unpaid from asOfMonth - 2 and older
  totalAged: number; // oneMonthOld + twoPlusMonthsOld (current month excluded)
  byMonth: FeeAgingMonth[]; // finished months with due > 0, oldest first
}

function agingMonthAdd(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function agingMonthsBetween(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12
    + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
}

const YYYY_MM = /^\d{4}-\d{2}$/;

export function calculateFeeAging(
  student: Student,
  feeStructures: ClassFeeStructure[],
  transactions: FinanceTransaction[],
  asOfMonth?: string
): FeeAging {
  const asOf = asOfMonth || new Date().toISOString().slice(0, 7);
  const empty: FeeAging = {
    studentId: student.id, asOfMonth: asOf, startMonth: null,
    currentMonthDue: 0, oneMonthOld: 0, twoPlusMonthsOld: 0, totalAged: 0, byMonth: []
  };

  // Monthly expected fee — the SAME rule as calculateSingleStudentDue:
  // per-student override wins, else class structure tuition + boarding.
  const struct = feeStructures.find(f => f.classLevel === student.classLevel);
  const perStudentOverride = Number((student as any).monthlyFee) || 0;
  const monthlyExpected = perStudentOverride > 0
    ? perStudentOverride
    : struct ? (struct.monthlyTuition || 0) + (struct.boardingFee || 0) : 0;
  if (monthlyExpected <= 0) return empty;

  const myTx = transactions.filter(tx =>
    tx.type === 'INCOME' && tx.studentId && (tx.studentId === student.id || tx.studentId === student.studentId));

  // Start month: admission date first, then record creation, then the
  // earliest month the student ever paid for (feeMonth, else tx date).
  // Months before the start month never enter aging.
  let start: string | null = null;
  const adm = (student.admissionDate || '').slice(0, 7);
  const created = (student.createdAt || '').slice(0, 7);
  if (YYYY_MM.test(adm)) start = adm;
  else if (YYYY_MM.test(created)) start = created;
  if (!start) {
    const paidMonths = myTx
      .map(tx => (tx.feeMonth || (tx.date || '').slice(0, 7)))
      .filter(m => YYYY_MM.test(m));
    if (paidMonths.length > 0) start = paidMonths.sort()[0];
  }
  if (!start) return empty;

  // Finished months only: start .. month before asOf. The current
  // (unfinished) month never appears here.
  const finished: string[] = [];
  let m = start;
  while (m < asOf && finished.length < 240) { finished.push(m); m = agingMonthAdd(m, 1); }
  if (finished.length === 0) {
    // Admitted this month: only a current-month due can exist.
    const curPaid = myTx.reduce((s, tx) => {
      const fm = (tx.feeMonth || '').slice(0, 7);
      const dm = (tx.date || '').slice(0, 7);
      if (fm === asOf || (!YYYY_MM.test(fm) && dm === asOf)) return s + (Number(tx.amount) || 0);
      return s;
    }, 0);
    return { ...empty, startMonth: start, currentMonthDue: Math.max(0, monthlyExpected - curPaid) };
  }

  const paid = new Map<string, number>();
  finished.forEach(mm => paid.set(mm, 0));
  let currentPaid = 0;
  let unallocated = 0;
  myTx.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    const fm = (tx.feeMonth || '').slice(0, 7);
    const dm = (tx.date || '').slice(0, 7);
    if (YYYY_MM.test(fm)) {
      if (paid.has(fm)) paid.set(fm, paid.get(fm)! + amt);
      else if (fm === asOf) currentPaid += amt;
      else unallocated += amt; // future month or pre-admission month
    } else if (YYYY_MM.test(dm)) {
      if (paid.has(dm)) paid.set(dm, paid.get(dm)! + amt);
      else if (dm === asOf) currentPaid += amt;
      else unallocated += amt;
    } else {
      unallocated += amt; // no usable month at all
    }
  });

  // Per-month remainder, then surplus + unallocated payments reduce the
  // OLDEST outstanding month first (so a partial payment always clears
  // the oldest bucket before a newer one).
  const dues = finished.map(mm => ({
    month: mm,
    due: Math.max(0, monthlyExpected - (paid.get(mm) || 0))
  }));
  let surplus = finished.reduce((s, mm) => s + Math.max(0, (paid.get(mm) || 0) - monthlyExpected), 0) + unallocated;
  for (const d of dues) {
    if (surplus <= 0) break;
    const cut = Math.min(d.due, surplus);
    d.due -= cut;
    surplus -= cut;
  }

  let oneMonthOld = 0;
  let twoPlusMonthsOld = 0;
  const byMonth: FeeAgingMonth[] = [];
  dues.forEach(d => {
    if (d.due <= 0) return;
    byMonth.push({ month: d.month, due: d.due });
    const age = agingMonthsBetween(d.month, asOf);
    if (age <= 1) oneMonthOld += d.due;
    else twoPlusMonthsOld += d.due;
  });

  return {
    studentId: student.id,
    asOfMonth: asOf,
    startMonth: start,
    currentMonthDue: Math.max(0, monthlyExpected - currentPaid),
    oneMonthOld,
    twoPlusMonthsOld,
    totalAged: oneMonthOld + twoPlusMonthsOld,
    byMonth
  };
}
