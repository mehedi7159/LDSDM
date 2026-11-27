import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Wallet, 
  Clock, 
  GraduationCap, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles,
  Users,
  ShieldCheck
} from 'lucide-react';
import { FinanceTransaction, Student, ClassFeeStructure } from '../../types';
import { formatBanglaNumber } from '../../services/utils';
import { calculateTotalDues, localMonthStr, academicYearFallbackStartMonth } from '../../services/studentDuesService';
import type { FeeTypeDef } from '../../services/feeTypes';
import type { AcademicYear } from '../../types/academic';
import { ProgressBar } from '../ui/ProgressBar';

interface HighImpactSummaryCardsProps {
  transactions: FinanceTransaction[];
  students: Student[];
  feeStructures: ClassFeeStructure[];
  feeTypes?: FeeTypeDef[];
  academicYears?: AcademicYear[];
  language: 'en' | 'bn';
  onQuickCollectFee?: () => void;
}

export const HighImpactSummaryCards: React.FC<HighImpactSummaryCardsProps> = ({
  transactions,
  students,
  feeStructures,
  feeTypes = [],
  academicYears = [],
  language,
  onQuickCollectFee,
}) => {
  const isBn = language === 'bn';

  const today = new Date();
  const currentYearMonth = today.toISOString().slice(0, 7);

  // Previous month string for trend comparison
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevYearMonth = prevMonthDate.toISOString().slice(0, 7);

  // Month names for display
  const monthNamesBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const currentMonthName = isBn 
    ? `${monthNamesBn[today.getMonth()]} ${formatBanglaNumber(today.getFullYear())}` 
    : today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // 1. Dynamic Calculations: Net Monthly Surplus & Liquidity
  const { 
    thisMonthIncome, 
    thisMonthExpense, 
    monthlySurplus, 
    prevMonthIncome, 
    prevMonthExpense, 
    prevMonthlySurplus,
    totalAllTimeIncome,
    totalAllTimeExpense,
    totalCashReserve
  } = useMemo(() => {
    let mIncome = 0;
    let mExpense = 0;
    let pmIncome = 0;
    let pmExpense = 0;
    let allIncome = 0;
    let allExpense = 0;

    transactions.forEach(tx => {
      const isThisMonth = tx.date.startsWith(currentYearMonth);
      const isPrevMonth = tx.date.startsWith(prevYearMonth);

      if (tx.type === 'INCOME') {
        allIncome += tx.amount;
        if (isThisMonth) mIncome += tx.amount;
        if (isPrevMonth) pmIncome += tx.amount;
      } else {
        allExpense += tx.amount;
        if (isThisMonth) mExpense += tx.amount;
        if (isPrevMonth) pmExpense += tx.amount;
      }
    });

    return {
      thisMonthIncome: mIncome,
      thisMonthExpense: mExpense,
      monthlySurplus: mIncome - mExpense,
      prevMonthIncome: pmIncome,
      prevMonthExpense: pmExpense,
      prevMonthlySurplus: pmIncome - pmExpense,
      totalAllTimeIncome: allIncome,
      totalAllTimeExpense: allExpense,
      totalCashReserve: allIncome - allExpense,
    };
  }, [transactions, currentYearMonth, prevYearMonth]);

  // Surplus Rate / Margin
  const surplusMarginPercent = thisMonthIncome > 0 
    ? Math.round((monthlySurplus / thisMonthIncome) * 100) 
    : 0;

  // 2. Dynamic Calculations: Total Pending Fees — the ONE shared dues
  //    total (calculateTotalDues, Fix #4): finished months' unpaid dues
  //    ONLY (a month's fee becomes due only after that month ends), same
  //    student set / month / feeTypes as the dashboard, the finance
  //    header KPI and the fee page. The old inline math (struct tuition
  //    with an invented 700 fallback for a missing structure, current
  //    month only, any status but Inactive/Former) was a fourth dues
  //    figure on the fee page: on live data it showed ৳193,200 while
  //    the header showed ৳177,800. Collection rate stays this month's.
  const {
    totalExpectedTuition,
    totalCollectedFeesThisMonth,
    totalPendingFees,
    currentMonthDueFees,
    activeStudentsCount,
    paidStudentsCount,
    pendingStudentsCount,
    collectionRatePercent
  } = useMemo(() => {
    const month = localMonthStr();
    const summary = calculateTotalDues(
      students.filter(s => s.status === 'Active' && !s.isFormer),
      feeStructures, transactions, month, feeTypes,
      academicYearFallbackStartMonth(academicYears, month));
    const collectionRate = summary.totalExpected > 0
      ? Math.round((summary.totalPaid / summary.totalExpected) * 100)
      : (summary.totalPaid > 0 ? 100 : 0);

    return {
      totalExpectedTuition: summary.totalExpected,
      totalCollectedFeesThisMonth: summary.totalPaid,
      totalPendingFees: summary.totalDue,
      currentMonthDueFees: summary.currentMonthDue,
      agedDueFees: summary.agedDue,
      activeStudentsCount: summary.totalStudents,
      paidStudentsCount: summary.paidStudentsCount,
      pendingStudentsCount: summary.dueStudentsCount,
      collectionRatePercent: collectionRate,
    };
  }, [students, feeStructures, transactions, feeTypes, academicYears]);

  const isSurplusPositive = monthlySurplus >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* ==================================================== */}
      {/* CARD 1: NET MONTHLY SURPLUS (চলতি মাসের নিট উদ্বৃত্ত) */}
      {/* ==================================================== */}
      <div className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
        isSurplusPositive 
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-emerald-500/40'
          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-rose-500/40'
      }`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-200 flex items-center gap-1.5">
              {isBn ? 'চলতি মাসের নিট উদ্বৃত্ত' : 'Net Monthly Surplus'}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${
              isSurplusPositive 
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300' 
                : 'bg-rose-500/15 text-rose-700 border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-300'
            }`}>
              {isSurplusPositive ? (isBn ? 'উদ্বৃত্ত (Surplus)' : 'Surplus') : (isBn ? 'ঘাটতি (Deficit)' : 'Deficit')}
            </span>
          </div>

          <div className="my-2">
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight flex items-baseline gap-1.5">
              <span className={isSurplusPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {isSurplusPositive ? '+' : '-'} ৳
              </span>
              <span>
                {isBn ? formatBanglaNumber(Math.abs(monthlySurplus)) : Math.abs(monthlySurplus).toLocaleString()}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 mt-1.5 font-medium flex items-center gap-1.5">
              <span>{currentMonthName}</span>
              <span>•</span>
              <span>{isBn ? 'মার্জিন:' : 'Margin:'} {surplusMarginPercent}%</span>
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-200">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <ArrowDownLeft className="w-4 h-4" />
            <span>জমা: ৳{isBn ? formatBanglaNumber(thisMonthIncome) : thisMonthIncome.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
            <ArrowUpRight className="w-4 h-4" />
            <span>ব্যয়: ৳{isBn ? formatBanglaNumber(thisMonthExpense) : thisMonthExpense.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CARD 2: TOTAL PENDING FEES (ছাত্রদের মোট বকেয়া ফি) */}
      {/* ==================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/90 p-5 flex flex-col justify-between transition-all duration-200">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              {isBn ? 'মোট বকেয়া ফি' : 'Total Pending Fees'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              {collectionRatePercent}% {isBn ? 'আদায়' : 'Collected'}
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-amber-900 dark:text-amber-200 flex items-baseline gap-1">
              <span>৳</span>
              <span>{isBn ? formatBanglaNumber(totalPendingFees) : totalPendingFees.toLocaleString()}</span>
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 font-medium flex items-center gap-1.5">
              <span>
                {isBn
                  ? `চলতি মাসের ফি ৳${formatBanglaNumber(currentMonthDueFees)} (এই মাস শেষে বকেয়া হবে)`
                  : `This month's fee ৳${currentMonthDueFees.toLocaleString()} (becomes due when the month ends)`}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 font-medium flex items-center gap-1.5">
              <span>
                {isBn 
                  ? `${formatBanglaNumber(pendingStudentsCount)} জন ছাত্রের ফি দেওয়া বাকি` 
                  : `${pendingStudentsCount} students pending`}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-amber-100 dark:border-amber-900/60 space-y-2">
          {/* Progress bar */}
          <ProgressBar value={collectionRatePercent} tone="amber" size="md" />
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-semibold">
            <span>আদায়: ৳{isBn ? formatBanglaNumber(totalCollectedFeesThisMonth) : totalCollectedFeesThisMonth.toLocaleString()}</span>
            {onQuickCollectFee && (
              <button
                onClick={onQuickCollectFee}
                className="text-[var(--color-brand)] dark:text-teal-300 hover:text-[var(--color-brand)] font-bold hover:underline"
              >
                {isBn ? 'ফি গ্রহণ করুন →' : 'Collect Fee →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CARD 3: TOTAL NET CASH IN-HAND (সর্বমোট সংরক্ষিত স্থিতি) */}
      {/* ==================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between transition-all duration-200">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              {isBn ? 'সর্বমোট সংরক্ষিত ক্যাশ স্থিতি' : 'Total Cash Liquidity'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-brand-light)] dark:bg-teal-950/50 text-[var(--color-brand)] dark:text-teal-300 border border-[var(--color-brand-ring)] dark:border-teal-800">
              {isBn ? '৬টি ফান্ড' : '6 Funds'}
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white flex items-baseline gap-1">
              <span className="text-[var(--color-brand)] dark:text-teal-300">৳</span>
              <span>{isBn ? formatBanglaNumber(totalCashReserve) : totalCashReserve.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
          <span>সর্বমোট জমা: ৳{isBn ? formatBanglaNumber(totalAllTimeIncome) : totalAllTimeIncome.toLocaleString()}</span>
          <span>ব্যয়: ৳{isBn ? formatBanglaNumber(totalAllTimeExpense) : totalAllTimeExpense.toLocaleString()}</span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CARD 4: STUDENT FEES & DONATIONS MOMENTUM */}
      {/* ==================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between transition-all duration-200">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              {isBn ? 'ছাত্র ফি আদায়ের অগ্রগতি' : 'Collection Momentum'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{paidStudentsCount}/{activeStudentsCount} {isBn ? 'পরিশোধ' : 'Paid'}</span>
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-400 flex items-baseline gap-1">
              <span>{collectionRatePercent}%</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 font-medium">
              {isBn 
                ? `চলতি মাসে মোট ৳${formatBanglaNumber(totalCollectedFeesThisMonth)} ফি আদায় হয়েছে`
                : `৳${totalCollectedFeesThisMonth.toLocaleString()} collected this month`}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <span>মোট শিক্ষার্থী: {isBn ? formatBanglaNumber(activeStudentsCount) : activeStudentsCount} জন</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400">
            {isBn ? 'ফি কালেকশন সক্রিয়' : 'Active Collection'}
          </span>
        </div>
      </div>
    </div>
  );
};
