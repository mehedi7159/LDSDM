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

interface HighImpactSummaryCardsProps {
  transactions: FinanceTransaction[];
  students: Student[];
  feeStructures: ClassFeeStructure[];
  language: 'en' | 'bn';
  onQuickCollectFee?: () => void;
}

export const HighImpactSummaryCards: React.FC<HighImpactSummaryCardsProps> = ({
  transactions,
  students,
  feeStructures,
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

  // 2. Dynamic Calculations: Total Pending Fees
  const { 
    totalExpectedTuition, 
    totalCollectedFeesThisMonth, 
    totalPendingFees, 
    activeStudentsCount, 
    paidStudentsCount, 
    pendingStudentsCount,
    collectionRatePercent 
  } = useMemo(() => {
    // Active students
    const activeStudents = students.filter(s => s.status !== 'Inactive' && s.status !== 'Former');
    const activeCount = activeStudents.length;

    // Class fee structure map
    const feeMap = new Map<string, number>();
    feeStructures.forEach(fs => {
      feeMap.set(fs.classLevel, fs.monthlyTuition || 700);
    });

    // Total expected tuition for current month
    let expectedTuition = 0;
    activeStudents.forEach(s => {
      const classFee = feeMap.get(s.classLevel) || 700;
      expectedTuition += classFee;
    });

    // If there are no students or structures yet, use reasonable minimum benchmark
    if (expectedTuition === 0 && activeCount > 0) {
      expectedTuition = activeCount * 700;
    }

    // Collected student fees this month
    let collectedFees = 0;
    const paidStudentIds = new Set<string>();

    transactions.forEach(tx => {
      if (tx.type === 'INCOME') {
        const isStudentFee = [
          'STUDENT_TUITION', 'ADMISSION_FEE', 'EXAM_FEE', 
          'BOARDING_FEE', 'BOOK_STATIONERY', 'BOOK_PURCHASE_FEE'
        ].includes(tx.category as string) || Boolean(tx.studentId || tx.feeBreakdown);

        const matchesMonth = tx.feeMonth ? tx.feeMonth.startsWith(currentYearMonth) : tx.date.startsWith(currentYearMonth);

        if (isStudentFee && matchesMonth) {
          collectedFees += tx.amount;
          if (tx.studentId) {
            paidStudentIds.add(tx.studentId);
          }
        }
      }
    });

    const pending = Math.max(0, expectedTuition - collectedFees);
    const paidCount = paidStudentIds.size;
    const pendingCount = Math.max(0, activeCount - paidCount);
    const collectionRate = expectedTuition > 0 
      ? Math.min(100, Math.round((collectedFees / expectedTuition) * 100)) 
      : (collectedFees > 0 ? 100 : 0);

    return {
      totalExpectedTuition: expectedTuition,
      totalCollectedFeesThisMonth: collectedFees,
      totalPendingFees: pending,
      activeStudentsCount: activeCount,
      paidStudentsCount: paidCount,
      pendingStudentsCount: pendingCount,
      collectionRatePercent: collectionRate,
    };
  }, [students, feeStructures, transactions, currentYearMonth]);

  const isSurplusPositive = monthlySurplus >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* ==================================================== */}
      {/* CARD 1: NET MONTHLY SURPLUS (চলতি মাসের নিট উদ্বৃত্ত) */}
      {/* ==================================================== */}
      <div className={`rounded-2xl p-5 shadow-sm border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${
        isSurplusPositive 
          ? 'bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white border-emerald-500/40' 
          : 'bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 text-white border-rose-500/40'
      }`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {isBn ? 'চলতি মাসের নিট উদ্বৃত্ত' : 'Net Monthly Surplus'}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${
              isSurplusPositive 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
                : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
            }`}>
              {isSurplusPositive ? (isBn ? 'উদ্বৃত্ত (Surplus)' : 'Surplus') : (isBn ? 'ঘাটতি (Deficit)' : 'Deficit')}
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight flex items-baseline gap-1.5">
              <span className={isSurplusPositive ? 'text-emerald-400' : 'text-rose-400'}>
                {isSurplusPositive ? '+' : '-'} ৳
              </span>
              <span>
                {isBn ? formatBanglaNumber(Math.abs(monthlySurplus)) : Math.abs(monthlySurplus).toLocaleString()}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 font-medium flex items-center gap-1.5">
              <span>{currentMonthName}</span>
              <span>•</span>
              <span>{isBn ? 'মার্জিন:' : 'Margin:'} {surplusMarginPercent}%</span>
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs sm:text-sm text-slate-200">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <ArrowDownLeft className="w-4 h-4" />
            <span>জমা: ৳{isBn ? formatBanglaNumber(thisMonthIncome) : thisMonthIncome.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400 font-bold">
            <ArrowUpRight className="w-4 h-4" />
            <span>ব্যয়: ৳{isBn ? formatBanglaNumber(thisMonthExpense) : thisMonthExpense.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CARD 2: TOTAL PENDING FEES (ছাত্রদের মোট বকেয়া ফি) */}
      {/* ==================================================== */}
      <div className="bg-white rounded-2xl border border-amber-200/90 p-5 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              {isBn ? 'ছাত্রদের চলতি বকেয়া ফি' : 'Total Pending Fees'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              {collectionRatePercent}% {isBn ? 'আদায়' : 'Collected'}
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-amber-900 flex items-baseline gap-1">
              <span>৳</span>
              <span>{isBn ? formatBanglaNumber(totalPendingFees) : totalPendingFees.toLocaleString()}</span>
            </div>
            <div className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>
                {isBn 
                  ? `${formatBanglaNumber(pendingStudentsCount)} জন ছাত্রের ফি দেওয়া বাকি` 
                  : `${pendingStudentsCount} students pending`}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-amber-100 space-y-2">
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${collectionRatePercent}%` }} 
            />
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 font-semibold">
            <span>আদায়: ৳{isBn ? formatBanglaNumber(totalCollectedFeesThisMonth) : totalCollectedFeesThisMonth.toLocaleString()}</span>
            {onQuickCollectFee && (
              <button
                onClick={onQuickCollectFee}
                className="text-blue-700 hover:text-blue-800 font-bold hover:underline"
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
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-600" />
              {isBn ? 'সর্বমোট সংরক্ষিত ক্যাশ স্থিতি' : 'Total Cash Liquidity'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
              {isBn ? '৬টি ফান্ড' : '6 Funds'}
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 flex items-baseline gap-1">
              <span className="text-blue-600">৳</span>
              <span>{isBn ? formatBanglaNumber(totalCashReserve) : totalCashReserve.toLocaleString()}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
              {isBn ? 'সাধারণ, যাকাত, লিল্লাহ ও উন্নয়ন ফান্ডের নিট ব্যালেন্স' : 'Consolidated net balance across all funds'}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm text-slate-600 font-medium">
          <span>সর্বমোট জমা: ৳{isBn ? formatBanglaNumber(totalAllTimeIncome) : totalAllTimeIncome.toLocaleString()}</span>
          <span>ব্যয়: ৳{isBn ? formatBanglaNumber(totalAllTimeExpense) : totalAllTimeExpense.toLocaleString()}</span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CARD 4: STUDENT FEES & DONATIONS MOMENTUM */}
      {/* ==================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              {isBn ? 'ছাত্র ফি আদায়ের অগ্রগতি' : 'Collection Momentum'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{paidStudentsCount}/{activeStudentsCount} {isBn ? 'পরিশোধ' : 'Paid'}</span>
            </span>
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-700 flex items-baseline gap-1">
              <span>{collectionRatePercent}%</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
              {isBn 
                ? `চলতি মাসে মোট ৳${formatBanglaNumber(totalCollectedFeesThisMonth)} ফি আদায় হয়েছে`
                : `৳${totalCollectedFeesThisMonth.toLocaleString()} collected this month`}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm text-slate-600">
          <span>মোট শিক্ষার্থী: {isBn ? formatBanglaNumber(activeStudentsCount) : activeStudentsCount} জন</span>
          <span className="font-bold text-emerald-700">
            {isBn ? 'ফি কালেকশন সক্রিয়' : 'Active Collection'}
          </span>
        </div>
      </div>
    </div>
  );
};
