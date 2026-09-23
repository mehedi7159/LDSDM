import React from 'react';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  HeartHandshake, 
  GraduationCap, 
  Building2, 
  Layers, 
  PlusCircle, 
  Printer, 
  Sparkles, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { FinanceTransaction, FundType } from '../../types';
import { formatBanglaNumber } from '../../services/utils';
import { FUND_METAS, FinanceTab } from './types';
import { Button } from '../ui/Button';
import { FinanceBudgetDonutCharts } from './FinanceBudgetDonutCharts';

interface FinanceOverviewProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onNavigateTab: (tab: FinanceTab) => void;
  onOpenReceipt: (tx: FinanceTransaction) => void;
}

export const FinanceOverview: React.FC<FinanceOverviewProps> = ({
  transactions,
  language,
  onNavigateTab,
  onOpenReceipt,
}) => {
  const isBn = language === 'bn';
  const currentYearMonth = new Date().toISOString().slice(0, 7);

  // Core calculations
  let totalIncome = 0;
  let totalExpense = 0;
  let thisMonthIncome = 0;
  let thisMonthExpense = 0;

  // The 4 Core Focus Streams
  let studentFeesIncome = 0;
  let studentFeesThisMonth = 0;

  let donationsIncome = 0;
  let donationsThisMonth = 0;

  let teacherSalaryExpense = 0;
  let teacherSalaryThisMonth = 0;

  let developmentExpense = 0;
  let developmentThisMonth = 0;

  // Other streams
  let otherIncome = 0;
  let otherExpense = 0;

  const fundBalances: Record<FundType, { income: number; expense: number; balance: number }> = {
    GENERAL: { income: 0, expense: 0, balance: 0 },
    ZAKAT: { income: 0, expense: 0, balance: 0 },
    DEVELOPMENT: { income: 0, expense: 0, balance: 0 },
    ORPHAN_AID: { income: 0, expense: 0, balance: 0 },
    BOOK_BANK: { income: 0, expense: 0, balance: 0 },
    MAHFIL: { income: 0, expense: 0, balance: 0 },
  };

  transactions.forEach(tx => {
    const isThisMonth = tx.date.startsWith(currentYearMonth);
    const fund = tx.fundType || 'GENERAL';
    const cat = tx.category as string;

    if (tx.type === 'INCOME') {
      totalIncome += tx.amount;
      if (isThisMonth) thisMonthIncome += tx.amount;

      if (fundBalances[fund]) {
        fundBalances[fund].income += tx.amount;
        fundBalances[fund].balance += tx.amount;
      }

      // Check if student fee related
      const isStudentFee = [
        'STUDENT_TUITION', 'ADMISSION_FEE', 'EXAM_FEE', 
        'BOARDING_FEE', 'BOOK_STATIONERY', 'BOOK_PURCHASE_FEE'
      ].includes(cat) || Boolean(tx.studentId || tx.feeBreakdown);

      // Check if donation related
      const isDonation = [
        'GENERAL_DONATION', 'ZAKAT_FITRA', 'QURBANI_LEATHER', 
        'MONTHLY_DONOR', 'ORPHAN_SPONSOR', 'MAHFIL_COLLECTION'
      ].includes(cat);

      if (isStudentFee) {
        studentFeesIncome += tx.amount;
        if (isThisMonth) studentFeesThisMonth += tx.amount;
      } else if (isDonation) {
        donationsIncome += tx.amount;
        if (isThisMonth) donationsThisMonth += tx.amount;
      } else {
        otherIncome += tx.amount;
      }
    } else {
      totalExpense += tx.amount;
      if (isThisMonth) thisMonthExpense += tx.amount;

      if (fundBalances[fund]) {
        fundBalances[fund].expense += tx.amount;
        fundBalances[fund].balance -= tx.amount;
      }

      // Check if teacher salary related
      const isTeacherSalary = cat === 'STAFF_SALARY' || tx.categoryName?.includes('বেতন') || tx.categoryName?.includes('হাদিয়া');

      // Check if development related
      const isDevelopment = ['BUILDING_MAINTENANCE', 'BUILDING_REPAIR', 'BUILDING_CONSTRUCTION'].includes(cat) || 
                            fund === 'DEVELOPMENT' || tx.categoryName?.includes('নির্মাণ') || tx.categoryName?.includes('উন্নয়ন');

      if (isTeacherSalary) {
        teacherSalaryExpense += tx.amount;
        if (isThisMonth) teacherSalaryThisMonth += tx.amount;
      } else if (isDevelopment) {
        developmentExpense += tx.amount;
        if (isThisMonth) developmentThisMonth += tx.amount;
      } else {
        otherExpense += tx.amount;
      }
    }
  });

  const netBalance = totalIncome - totalExpense;
  const incomePercent = totalIncome + totalExpense > 0 ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100) : 50;
  const expensePercent = 100 - incomePercent;

  return (
    <div className="space-y-6">
      {/* Dynamic Donut Charts (Recharts) */}
      <FinanceBudgetDonutCharts 
        transactions={transactions} 
        language={language} 
      />

      {/* Cash Flow Distribution Ratio Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-bold text-slate-800">
            {isBn ? 'আয় ও ব্যয় অনুপাত এবং প্রবাহ বিশ্লেষণ (Cash Flow Distribution)' : 'Inflow vs Outflow Ratio'}
          </span>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              {isBn ? 'জমা:' : 'In:'} {incomePercent}%
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              {isBn ? 'ব্যয়:' : 'Out:'} {expensePercent}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200/60">
          <div 
            style={{ width: `${incomePercent}%` }} 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" 
          />
          <div 
            style={{ width: `${expensePercent}%` }} 
            className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-500" 
          />
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4 CORE FOCUS PILLARS (Spotlight) */}
      {/* ==================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {isBn ? 'মাদ্রাসার প্রধান ৪টি আর্থিক খাত (Core Financial Pillars)' : 'Core Financial Streams'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isBn ? 'ছাত্র ফি, দান-সদকা, উস্তাদদের হাদিয়া ও মাদ্রাসা উন্নয়নের ডেডিকেটেড সারসংক্ষেপ' : 'Quick access and analytics for primary inflow and expense channels'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1: Student Fees (ছাত্রদের বেতন ও ফি) */}
          <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {isBn ? 'মূল আয় ১' : 'Income 1'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'ছাত্র ফি ও বেতন' : 'Student Fees'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isBn ? 'মাসিক বেতন, খাবার, ভর্তি ও পরীক্ষা ফি' : 'Tuition, Food, Admission & Exam'}
              </p>
              
              <div className="mt-4">
                <div className="text-xl font-black text-blue-900">
                  ৳{isBn ? formatBanglaNumber(studentFeesIncome) : studentFeesIncome.toLocaleString()}
                </div>
                <div className="text-[11px] text-blue-700 mt-0.5 font-medium">
                  {isBn ? 'চলতি মাসে আদায়:' : 'This Month:'} ৳{isBn ? formatBanglaNumber(studentFeesThisMonth) : studentFeesThisMonth.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-blue-200/70">
              <Button 
                onClick={() => onNavigateTab('student-fee')} 
                size="sm" 
                variant="primary" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-center text-xs font-bold"
              >
                <Receipt className="w-3.5 h-3.5 mr-1.5" />
                {isBn ? 'ফি আদায় ও রসিদ' : 'Collect Fee'}
              </Button>
            </div>
          </div>

          {/* Pillar 2: Dan, Sadaqa & Zakat (দান, সদকা ও যাকাত) */}
          <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/70 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isBn ? 'মূল আয় ২' : 'Income 2'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'দান, সদকা ও যাকাত' : 'Dan & Sadaqa'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isBn ? 'সাধারণ দান, যাকাত, চামড়া ও সদস্য চাঁদা' : 'General Hadya, Zakat, Skin & Donors'}
              </p>
              
              <div className="mt-4">
                <div className="text-xl font-black text-emerald-900">
                  ৳{isBn ? formatBanglaNumber(donationsIncome) : donationsIncome.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                  {isBn ? 'চলতি মাসে দান:' : 'This Month:'} ৳{isBn ? formatBanglaNumber(donationsThisMonth) : donationsThisMonth.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200/70">
              <Button 
                onClick={() => onNavigateTab('donation')} 
                size="sm" 
                variant="primary" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-center text-xs font-bold"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                {isBn ? 'দান রসিদ কাটুন' : 'Enter Donation'}
              </Button>
            </div>
          </div>

          {/* Pillar 3: Teacher Salary & Hadya (উস্তাদ ও স্টাফ বেতন) */}
          <div className="bg-gradient-to-br from-rose-50/70 to-pink-50/70 border border-rose-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {isBn ? 'মূল ব্যয় ১' : 'Expense 1'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'উস্তাদদের হাদিয়া ও বেতন' : 'Teacher Salary'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isBn ? 'উস্তাদ ও কর্মচারীদের মাসিক হাদিয়া/বেতন' : 'Monthly Teacher & Staff Salaries'}
              </p>
              
              <div className="mt-4">
                <div className="text-xl font-black text-rose-900">
                  ৳{isBn ? formatBanglaNumber(teacherSalaryExpense) : teacherSalaryExpense.toLocaleString()}
                </div>
                <div className="text-[11px] text-rose-700 mt-0.5 font-medium">
                  {isBn ? 'চলতি মাসে হাদিয়া:' : 'This Month:'} ৳{isBn ? formatBanglaNumber(teacherSalaryThisMonth) : teacherSalaryThisMonth.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-rose-200/70">
              <Button 
                onClick={() => onNavigateTab('salary')} 
                size="sm" 
                variant="primary" 
                className="w-full bg-rose-600 hover:bg-rose-700 text-white justify-center text-xs font-bold"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                {isBn ? 'বেতন পরিশোধ' : 'Disburse Salary'}
              </Button>
            </div>
          </div>

          {/* Pillar 4: Madrasah Development & Construction (মাদ্রাসা উন্নয়ন ও নির্মাণ) */}
          <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {isBn ? 'মূল ব্যয় ২' : 'Expense 2'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'মাদ্রাসা উন্নয়ন ও নির্মাণ' : 'Development Fund'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isBn ? 'ভবন নির্মাণ, মেরামত ও মসজিদ উন্নয়ন' : 'Construction, Mosque & Maintenance'}
              </p>
              
              <div className="mt-4">
                <div className="text-xl font-black text-amber-900">
                  ৳{isBn ? formatBanglaNumber(developmentExpense) : developmentExpense.toLocaleString()}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {isBn ? 'চলতি মাসে উন্নয়ন:' : 'This Month:'} ৳{isBn ? formatBanglaNumber(developmentThisMonth) : developmentThisMonth.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200/70">
              <Button 
                onClick={() => onNavigateTab('development')} 
                size="sm" 
                variant="primary" 
                className="w-full bg-amber-600 hover:bg-amber-700 text-white justify-center text-xs font-bold"
              >
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                {isBn ? 'উন্নয়ন খরচ এন্ট্রি' : 'Log Project Cost'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Madrasah Dedicated Fund Balances */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              {isBn ? 'মাদ্রাসা বিশেষায়িত তহবিল ও ফান্ডের বিস্তারিত স্থিতি' : 'Fund Balances (Segregated Accounting)'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {isBn ? 'শরীয়াহ অনুযায়ী প্রতিটি ফান্ডের আলাদা জমা-খরচের স্বচ্ছ হিসাব' : 'Strict Shariah-compliant fund segregation'}
            </p>
          </div>
          <Button 
            onClick={() => onNavigateTab('general-entry')} 
            size="sm" 
            variant="secondary"
            className="text-xs"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            {isBn ? 'অন্যান্য খাতে এন্ট্রি' : 'Other Entry'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {(Object.keys(FUND_METAS) as FundType[]).map(key => {
            const info = FUND_METAS[key];
            const data = fundBalances[key] || { income: 0, expense: 0, balance: 0 };
            return (
              <div key={key} className={`rounded-xl border p-4 ${info.bg} ${info.border}`}>
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-bold ${info.color}`}>
                    {isBn ? info.nameBn : info.name}
                  </span>
                </div>

                <div className="mt-2.5">
                  <div className="text-xl font-extrabold text-slate-900 font-mono">
                    ৳{isBn ? formatBanglaNumber(data.balance) : data.balance.toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <div className="flex items-center gap-1 text-emerald-700">
                    <ArrowDownLeft className="w-3 h-3" />
                    <span>জমা: ৳{isBn ? formatBanglaNumber(data.income) : data.income.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-rose-700">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>খরচ: ৳{isBn ? formatBanglaNumber(data.expense) : data.expense.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent 5 Transactions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            {isBn ? 'সাম্প্রতিক লেনদেন' : 'Recent Transactions'}
          </h3>
          <Button 
            onClick={() => onNavigateTab('ledger')} 
            size="sm" 
            variant="secondary"
            className="text-xs"
          >
            {isBn ? 'সব খাতা দেখুন' : 'Full Ledger'}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{isBn ? 'ভাউচার নং' : 'Voucher No'}</th>
                <th className="py-2.5 px-3 font-semibold">{isBn ? 'তারিখ' : 'Date'}</th>
                <th className="py-2.5 px-3 font-semibold">{isBn ? 'ধরন ও খাত' : 'Category'}</th>
                <th className="py-2.5 px-3 font-semibold">{isBn ? 'দাতা / প্রাপক' : 'Payer / Payee'}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                <th className="py-2.5 px-3 font-semibold text-center">{isBn ? 'রসিদ' : 'Receipt'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-bold font-mono text-slate-800">
                    {tx.voucherNo}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${tx.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="font-semibold text-slate-800">{tx.categoryName || tx.category}</span>
                      <span className="text-[10px] text-slate-400">({FUND_METAS[tx.fundType]?.nameBn || tx.fundType})</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {tx.studentNameBn || tx.studentName || tx.payerOrPayee}
                    {tx.classLevel && <span className="text-[10px] text-slate-400 ml-1">({tx.classLevel})</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold font-mono">
                    <span className={tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}>
                      {tx.type === 'INCOME' ? '+' : '-'} ৳{isBn ? formatBanglaNumber(tx.amount) : tx.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => onOpenReceipt(tx)}
                      className="p-1 rounded-md text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-1 text-[11px] font-medium"
                      title={isBn ? 'রসিদ প্রিন্ট' : 'Print Receipt'}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isBn ? 'রসিদ' : 'Receipt'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
