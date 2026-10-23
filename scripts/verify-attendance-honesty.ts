/**
 * Attendance honesty — verification for the fake-stats fix.
 *
 * Uses the REAL dailyAttendanceService (with an in-memory localStorage
 * stub) and the REAL formatNumber/formatSafeDate helpers, and walks the
 * three data states the desktop headers must handle:
 *
 *   A. NO records for the date  → day summary is all-zero; the header
 *      rate is null → "হাজিরা নেওয়া হয়নি / Not taken yet"; the monthly
 *      summary and the exam-attendance calc return honest ZEROS (they
 *      previously invented 24 days/22 present and 90 days/85 present).
 *   B. PARTIAL records (2 of 5) → rate is computed over the 2 recorded
 *      entries only (50%), pending = 3; a student with no records still
 *      reports zeros, never an estimate.
 *   C. FULL records (5 of 5)    → rate over all recorded, pending = 0.
 *
 * Also asserts digit consistency for the header strings the components
 * now compose: bn mode → NO Latin digits anywhere (rate, counts, date);
 * en mode → NO Bangla digits.
 *
 * The header composition replicated here mirrors
 * components/attendance/AttendanceManager.tsx (KPI memo + strip).
 *
 * Run: npx tsx scripts/verify-attendance-honesty.ts
 * Exit code 0 = all proofs hold.
 */

// In-memory localStorage stub — must exist BEFORE the service module is
// imported, because the service singleton loads from storage at import.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); }
};

async function main() {
  const { dailyAttendanceService } = await import('../services/dailyAttendanceService');
  const { formatNumber, formatSafeDate } = await import('../services/utils');

  let failures = 0;
  const check = (label: string, cond: boolean, detail = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!cond) failures++;
  };

  const DATE = '2026-10-23';
  const CLASS = 'Class 6';
  const ENROLLED = 5;
  const mk = (studentId: string, status: string) => ({
    id: `${DATE}_${studentId}`,
    date: DATE,
    studentId,
    classLevel: CLASS,
    status,
    updatedAt: '2026-10-23T08:00:00.000Z'
  } as any);

  // AttendanceManager KPI-memo replica (post-fix): recorded-only.
  const headerState = (enrolled: number) => {
    const s = dailyAttendanceService.getDaySummary(DATE);
    const recorded = s.totalStudents;
    const present = s.presentCount + s.lateCount;
    const rate = recorded > 0 ? Math.round((present / recorded) * 100) : null;
    return { recorded, present, absent: s.absentCount, rate, pending: Math.max(0, enrolled - recorded) };
  };
  const headerStrings = (lang: 'bn' | 'en', enrolled: number) => {
    const h = headerState(enrolled);
    const isBn = lang === 'bn';
    const rateStr = h.rate !== null ? `${formatNumber(h.rate, lang)}%` : (isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet');
    const presentStr = h.rate !== null
      ? (isBn ? `${formatNumber(h.present, lang)} জন উপস্থিত • রেকর্ড ${formatNumber(h.recorded, lang)}/${formatNumber(enrolled, lang)}` : `${formatNumber(h.present, lang)} present • recorded ${formatNumber(h.recorded, lang)}/${formatNumber(enrolled, lang)}`)
      : (isBn ? `${formatNumber(h.pending, lang)} জন শিক্ষার্থীর হাজিরা বাকি` : `${formatNumber(h.pending, lang)} students pending`);
    const dateStr = formatNumber(formatSafeDate(DATE, isBn), lang);
    return { rateStr, presentStr, dateStr, h };
  };

  // ---- State A: no records -------------------------------------------------
  dailyAttendanceService.replaceStudentRecords([]);
  dailyAttendanceService.replaceStaffRecords([]);
  {
    const s = dailyAttendanceService.getDaySummary(DATE);
    check('A: day summary totalStudents = 0 (recorded only)', s.totalStudents === 0, JSON.stringify(s));
    const { rateStr, h } = headerStrings('bn', ENROLLED);
    check('A: header rate is the not-taken state', h.rate === null && rateStr === 'হাজিরা নেওয়া হয়নি', rateStr);
    check('A: pending = all enrolled', h.pending === ENROLLED, `pending=${h.pending}`);
    const m = dailyAttendanceService.getStudentMonthlySummary('s1', 2026, 10);
    check('A: monthly summary is honest zeros (was 24d/22p/100%)',
      m.workingDays === 0 && m.presentDays === 0 && m.absentDays === 0 && m.percentage === 0, JSON.stringify(m));
    const e = dailyAttendanceService.calculateStudentAttendanceForExam('s1');
    check('A: exam calc is honest zeros (was 90d/85p/5a)',
      e.workingDays === 0 && e.totalPresent === 0 && e.totalAbsent === 0 && e.attendancePercentage === 0, JSON.stringify(e));
  }

  // ---- State B: partial records (s1 PRESENT, s2 ABSENT of 5) --------------
  dailyAttendanceService.replaceStudentRecords([mk('s1', 'PRESENT'), mk('s2', 'ABSENT')]);
  {
    const { h } = headerStrings('bn', ENROLLED);
    check('B: rate computed over recorded entries only = 50%', h.rate === 50, `rate=${h.rate}`);
    check('B: present = 1, absent = 1, pending = 3', h.present === 1 && h.absent === 1 && h.pending === 3, JSON.stringify(h));
    const m1 = dailyAttendanceService.getStudentMonthlySummary('s1', 2026, 10);
    check('B: recorded student monthly = 1 day / 1 present / 100%', m1.workingDays === 1 && m1.presentDays === 1 && m1.percentage === 100, JSON.stringify(m1));
    const m3 = dailyAttendanceService.getStudentMonthlySummary('s3', 2026, 10);
    check('B: unrecorded student monthly stays zeros (no estimate)', m3.workingDays === 0 && m3.percentage === 0, JSON.stringify(m3));
  }

  // ---- State C: full records (4 PRESENT, 1 LATE) ---------------------------
  dailyAttendanceService.replaceStudentRecords([
    mk('s1', 'PRESENT'), mk('s2', 'PRESENT'), mk('s3', 'PRESENT'), mk('s4', 'PRESENT'), mk('s5', 'LATE')
  ]);
  {
    const { h } = headerStrings('en', ENROLLED);
    check('C: full records rate = 100% over 5 recorded, pending = 0', h.rate === 100 && h.pending === 0 && h.recorded === 5, JSON.stringify(h));
  }

  // ---- Digit consistency (state B strings) ---------------------------------
  dailyAttendanceService.replaceStudentRecords([mk('s1', 'PRESENT'), mk('s2', 'ABSENT')]);
  {
    const bn = headerStrings('bn', ENROLLED);
    const bnAll = `${bn.rateStr} | ${bn.presentStr} | ${bn.dateStr}`;
    console.log(`\nbn header (partial): ${bnAll}`);
    check('bn: no Latin digits in rate/counts/date', !/[0-9]/.test(bnAll));
    const en = headerStrings('en', ENROLLED);
    const enAll = `${en.rateStr} | ${en.presentStr} | ${en.dateStr}`;
    console.log(`en header (partial): ${enAll}`);
    check('en: no Bangla digits in rate/counts/date', !/[০-৯]/.test(enAll));
    const bnNone = headerStrings('bn', ENROLLED);
    dailyAttendanceService.replaceStudentRecords([]);
    const bnEmpty = headerStrings('bn', ENROLLED);
    console.log(`bn header (no records): ${bnEmpty.rateStr} | ${bnEmpty.presentStr} | ${bnEmpty.dateStr}`);
    check('bn no-records header carries no percentage at all', !/%/.test(bnEmpty.rateStr), bnEmpty.rateStr);
    void bnNone;
  }

  console.log(failures === 0 ? '\nRESULT: ALL CHECKS PASSED — headers derive only from recorded attendance.' : `\nRESULT: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
