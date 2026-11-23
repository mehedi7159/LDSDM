import { Student, ClassFeeStructure, FinanceTransaction } from '../types';
import { feeArrangementOf, hasFeeArrangement, classFeeBase } from './studentFeeArrangement';
import type { FeeTypeDef } from './feeTypes';
import type { AcademicYear } from '../types/academic';

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
 * Monthly amount the STUDENT owes — the single hook for fee arrangements.
 * Precedence: (1) a stored discount/fund arrangement's payable wins
 * (full waiver => 0; fund types => student part only — the fund part is
 * an arrangement, not a payment transaction, so it never appears as paid
 * here); (2) the legacy per-student monthlyFee override; (3) the class
 * structure via classFeeBase (tuition + food only when the food type is
 * enabled; food disabled by default, so tuition-only). One-time/event
 * fees (admission, session, registration, form fillup, exam, book) NEVER
 * enter monthly dues. Every dues caller (FinanceManager,
 * StaffMobileApp, GuardianPortal) flows through calculateSingleStudentDue
 * / calculateFeeAging below, so wiring this one helper wires them all.
 */
export function monthlyExpectedFor(
  student: Student,
  feeStructures: ClassFeeStructure[],
  feeTypes?: FeeTypeDef[]
): number {
  const arrangement = feeArrangementOf(student);
  if (arrangement.discountType !== 'none') return arrangement.payableAmount;
  const perStudentOverride = Number((student as any).monthlyFee) || 0;
  if (perStudentOverride > 0) return perStudentOverride;
  const struct = feeStructures.find(f => f.classLevel === student.classLevel);
  return classFeeBase(struct, feeTypes);
}
/**
 * Shared tuition-allocation rule (master audit): a payment counts toward
 * monthly tuition dues only when it is tuition money. Exam-fee money
 * (category EXAM_FEE, or any row carrying examId — examId is set ONLY on
 * exam-fee payments) never counts, and a row whose feeBreakdown has no
 * monthly line (tuition / boarding / food — the heads inside
 * monthlyExpected) is one-time money, not tuition. A legacy row with no
 * breakdown at all still counts: old readers wrote none, and those
 * payments were tuition.
 */
export function isTuitionPayment(tx: FinanceTransaction): boolean {
  if (tx.type !== 'INCOME') return false;
  if (tx.category === 'EXAM_FEE' || tx.examId) return false;
  if (tx.feeBreakdown && tx.feeBreakdown.length > 0) {
    return tx.feeBreakdown.some(l =>
      /tuition|বেতন|boarding|বোর্ডিং|food|খাবার/i.test(`${l.name || ''} ${l.nameBn || ''}`));
  }
  return true;
}

export function calculateSingleStudentDue(
  student: Student,
  feeStructures: ClassFeeStructure[],
  transactions: FinanceTransaction[],
  targetMonth?: string,
  feeTypes?: FeeTypeDef[]
): StudentDueProfile {
  const currentMonthStr = targetMonth || new Date().toISOString().slice(0, 7); // YYYY-MM

  // Monthly expected fee via the single hook (arrangement payable, else
  // legacy override, else class structure tuition + boarding).
  const monthlyExpected = monthlyExpectedFor(student, feeStructures, feeTypes);

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

  // A discount arrangement that zeroes the payable is a full waiver, not
  // an unset fee — label it so it is never mistaken for missing data.
  if (monthlyExpected === 0 && hasFeeArrangement(student)) {
    statusBadgeBn = 'সম্পূর্ণ ছাড়';
    statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
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
  targetMonth?: string,
  feeTypes?: FeeTypeDef[]
): ClassDuesSummary {
  const className = students[0]?.classLevel || 'সকল শ্রেণি';
  let totalExpected = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let dueStudentsCount = 0;
  let paidStudentsCount = 0;

  const profiles = students.map(st => {
    const p = calculateSingleStudentDue(st, feeStructures, transactions, targetMonth, feeTypes);
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

/**
 * Fallback aging start month for students with NO date at all (no
 * admissionDate, no createdAt, no paid month) — approved 2 Nov 2026:
 * January of the CURRENT academic year (the current year's startDate
 * year when present, else a 4-digit year parsed from its name, e.g.
 * '2026' -> '2026-01'). Falls back to January of the asOf year when no
 * year can be parsed. Callers pass this explicitly; calculateFeeAging
 * never invents a start on its own, and a real admission/created/paid
 * start always wins over this fallback.
 */
export function academicYearFallbackStartMonth(
  academicYears: AcademicYear[] | undefined,
  asOfMonth?: string
): string {
  const asOf = asOfMonth || new Date().toISOString().slice(0, 7);
  const current = (academicYears || []).find(y => y.isCurrent) || (academicYears || [])[0];
  const startYear = current?.startDate ? current.startDate.slice(0, 4) : undefined;
  const nameYear = current?.name ? (current.name.match(/\d{4}/) || [])[0] : undefined;
  const year = (startYear && /^\d{4}$/.test(startYear)) ? startYear
    : (nameYear && /^\d{4}$/.test(nameYear)) ? nameYear
    : asOf.slice(0, 4);
  return `${year}-01`;
}

/**
 * ONE shared aging-start rule (21 Nov 2026): the first month a student's
 * dues can accrue from — admissionDate first, then record creation, then
 * the earliest month the student ever paid for, and only then the
 * caller-supplied academic-year fallback (Jan of the current academic
 * year, approved 2 Nov 2026, for students with no date at all). Months
 * before the start month never enter aging. A fallback at/after asOf is
 * ignored, so a dateless student in a future-dated academic year stays
 * empty instead of showing a current-month due. Returns null when no
 * start can be resolved at all.
 *
 * calculateFeeAging, the Reports 3+ dues alert and the fee-history grid
 * all use this — the alert used to guard on admissionDate only, so a
 * student with no admissionDate counted all 12 finished months as due
 * and a brand-new student landed in "৩ মাস+ বকেয়া" on day one.
 */
export function resolveAgingStartMonth(
  student: Student,
  paidMonths: string[],
  fallbackStartMonth?: string,
  asOfMonth?: string
): string | null {
  const adm = (student.admissionDate || '').slice(0, 7);
  if (YYYY_MM.test(adm)) return adm;
  const created = (student.createdAt || '').slice(0, 7);
  if (YYYY_MM.test(created)) return created;
  const paid = (paidMonths || []).filter(m => YYYY_MM.test(m)).sort();
  if (paid.length > 0) return paid[0];
  const asOf = asOfMonth || new Date().toISOString().slice(0, 7);
  if (fallbackStartMonth && YYYY_MM.test(fallbackStartMonth) && fallbackStartMonth < asOf) {
    return fallbackStartMonth;
  }
  return null;
}

export function calculateFeeAging(
  student: Student,
  feeStructures: ClassFeeStructure[],
  transactions: FinanceTransaction[],
  asOfMonth?: string,
  feeTypes?: FeeTypeDef[],
  fallbackStartMonth?: string
): FeeAging {
  const asOf = asOfMonth || new Date().toISOString().slice(0, 7);
  const empty: FeeAging = {
    studentId: student.id, asOfMonth: asOf, startMonth: null,
    currentMonthDue: 0, oneMonthOld: 0, twoPlusMonthsOld: 0, totalAged: 0, byMonth: []
  };

  // Monthly expected fee — the SAME hook as calculateSingleStudentDue
  // (arrangement payable, else legacy override, else structure).
  const monthlyExpected = monthlyExpectedFor(student, feeStructures, feeTypes);
  if (monthlyExpected <= 0) return empty;

  const myTx = transactions.filter(tx =>
    tx.type === 'INCOME' && tx.studentId && (tx.studentId === student.id || tx.studentId === student.studentId)
    && isTuitionPayment(tx));

  // Start month — the one shared rule (resolveAgingStartMonth).
  // Months before the start month never enter aging.
  const start = resolveAgingStartMonth(
    student,
    myTx.map(tx => (tx.feeMonth || (tx.date || '').slice(0, 7))),
    fallbackStartMonth,
    asOf
  );
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

// ---------------------------------------------------------------------------
// ONE shared dues total (fee-totals fix, Nov 2026 — 7 Nov audit §14;
// completed-months rule, 23 Nov 2026 — Sagor's rule).
// Definition: মোট বকেয়া = শেষ হওয়া সব মাসের বকেয়া (finished months'
// unpaid balance ONLY). A month's fee becomes due only after that month
// ends — November's fee is not dues while November runs; it starts
// counting on 1 December. The current month's still-payable amount is
// NOT dues: it stays visible separately (currentMonthDue /
// profile.dueThisMonth) for the collection views, so paying the current
// month in advance still works and never reduces old dues.
// Monthly expected comes from the one hook (monthlyExpectedFor); exam /
// admission / session / book / registration / form-fillup never enter
// it, and a missing fee structure means expected 0 — never an invented
// ৳700. The dashboard, the finance header, the fee-page cards and the
// reports header all call this one function with the same student set,
// month, feeTypes and aging fallback, so they show the same number.
// ---------------------------------------------------------------------------

/** Local (device-timezone) YYYY-MM — one definition of "this month", so
 * the dashboard, finance header, fee page and reports never disagree by
 * month (the old UTC default differs from the local month before 06:00
 * on the 1st in Dhaka). */
export function localMonthStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface TotalDueEntry {
  profile: StudentDueProfile; // current-month profile (payable now)
  aging: FeeAging; // finished-months aging as of the target month
  totalDue: number; // aging.totalAged ONLY — finished months' unpaid dues.
  // The current (unfinished) month's fee becomes due only after that
  // month ends, so it is never inside totalDue; it stays visible as
  // the current month's payable (profile.dueThisMonth /
  // summary.currentMonthDue) for the collection views.
  // How many months the totalDue covers: finished months still owed
  // (aging.byMonth). Shown beside the amount so "৳15,000" reads as
  // "১০ মাসের বকেয়া", never as one month's fee.
  dueMonthCount: number;
}

export interface TotalDuesSummary {
  totalDue: number; // finished months' unpaid dues, over all students
  // (the current month's unpaid fee is NOT dues yet — it becomes due
  // only after the month ends — so it is not inside totalDue).
  currentMonthDue: number; // current month's still-payable amount
  // (collection views use this; it is never a "বকেয়া" figure).
  agedDue: number; // == totalDue (finished months' unpaid dues)
  totalExpected: number; // target month's expected monthly fees
  totalPaid: number; // target month's recorded payments
  totalStudents: number;
  dueStudentsCount: number; // students with totalDue > 0
  paidStudentsCount: number; // students with totalDue == 0 (nothing
  // due at all — a student who paid this month but still owes old
  // months is NOT counted as paid here).
  profiles: StudentDueProfile[]; // current-month profiles (as before)
  entries: TotalDueEntry[]; // per-student combined totals
}

export function calculateTotalDues(
  students: Student[],
  feeStructures: ClassFeeStructure[],
  transactions: FinanceTransaction[],
  targetMonth?: string,
  feeTypes?: FeeTypeDef[],
  fallbackStartMonth?: string
): TotalDuesSummary {
  // Same month into both halves. The UTC default is kept here so the
  // inner functions behave exactly as their other callers expect; the
  // headline call sites pass localMonthStr() explicitly.
  const month = targetMonth || new Date().toISOString().slice(0, 7);
  const summary = calculateClassDuesSummary(students, feeStructures, transactions, month, feeTypes);
  let agedDue = 0;
  let dueStudentsCount = 0;
  const entries: TotalDueEntry[] = summary.profiles.map(profile => {
    const aging = calculateFeeAging(profile.student, feeStructures, transactions, month, feeTypes, fallbackStartMonth);
    // FINISHED months only: a month's fee becomes due only after that
    // month ends, so the current (unfinished) month's unpaid fee
    // (profile.dueThisMonth) is NEVER inside totalDue — it stays
    // visible as the current month's payable (summary.currentMonthDue)
    // for the collection views. A November payment therefore never
    // reduces old dues, and an exam-fee payment never reduces dues.
    const totalDue = aging.totalAged;
    agedDue += aging.totalAged;
    if (totalDue > 0) dueStudentsCount += 1;
    return {
      profile,
      aging,
      totalDue,
      dueMonthCount: aging.byMonth.length,
    };
  });
  return {
    totalDue: agedDue,
    currentMonthDue: summary.totalDue,
    agedDue,
    totalExpected: summary.totalExpected,
    totalPaid: summary.totalPaid,
    totalStudents: students.length,
    dueStudentsCount,
    paidStudentsCount: summary.totalStudents - dueStudentsCount,
    profiles: summary.profiles,
    entries,
  };
}

/**
 * The top debtors, from the ONE shared dues total: the entries of
 * calculateTotalDues, largest totalDue first. Both top-dues cards
 * (Dashboard's করণীয় card and MadrasaReports' Overview list) read
 * through this helper, so they can never disagree again — the old
 * split was one card on finished-months-only (totalAged) and the
 * other on the current month only (dueThisMonth).
 */
export function topDueEntries(entries: TotalDueEntry[], count = 5): TotalDueEntry[] {
  // filter() returns a new array, so the sort below never mutates the
  // caller's (memoized) entries.
  return (entries || [])
    .filter(e => e.totalDue > 0)
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, count);
}
