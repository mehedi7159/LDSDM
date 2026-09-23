import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend 
} from 'recharts';
import { PieChart as ChartIcon, Calendar, ArrowUpRight, ArrowDownLeft, Sparkles, TrendingUp, Info } from 'lucide-react';
import { FinanceTransaction } from '../../types';
import { formatBanglaNumber } from '../../services/utils';

interface FinanceBudgetDonutChartsProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
}

export const FinanceBudgetDonutCharts: React.FC<FinanceBudgetDonutChartsProps> = ({
  transactions,
  language,
}) => {
  const isBn = language === 'bn';
  const [timeframe, setTimeframe] = useState<'THIS_MONTH' | 'ALL_TIME'>('THIS_MONTH');

  const currentYearMonth = new Date().toISOString().slice(0, 7);

  // Filter transactions according to selected timeframe
  const relevantTransactions = useMemo(() => {
    if (timeframe === 'THIS_MONTH') {
      return transactions.filter(t => t.date.startsWith(currentYearMonth));
    }
    return transactions;
  }, [transactions, timeframe, currentYearMonth]);

  // Income Breakdown: 'Student Fees' vs 'Donations' vs 'Other'
  const incomeData = useMemo(() => {
    let studentFees = 0;
    let donations = 0;
    let others = 0;

    relevantTransactions.forEach(t => {
      if (t.type !== 'INCOME') return;
      const cat = t.category as string;

      const isFee = [
        'STUDENT_TUITION', 'ADMISSION_FEE', 'EXAM_FEE', 
        'BOARDING_FEE', 'BOOK_STATIONERY', 'BOOK_PURCHASE_FEE'
      ].includes(cat) || Boolean(t.studentId || t.feeBreakdown);

      const isDonation = [
        'GENERAL_DONATION', 'ZAKAT_FITRA', 'QURBANI_LEATHER', 
        'MONTHLY_DONOR', 'ORPHAN_SPONSOR', 'MAHFIL_COLLECTION'
      ].includes(cat);

      if (isFee) {
        studentFees += t.amount;
      } else if (isDonation) {
        donations += t.amount;
      } else {
        others += t.amount;
      }
    });

    const total = studentFees + donations + others;

    return {
      total,
      items: [
        {
          name: isBn ? 'ছাত্র ফি ও বেতন' : 'Student Fees',
          nameEn: 'Student Fees',
          value: studentFees,
          color: '#2563eb', // Blue-600
          bgLight: 'bg-blue-50',
          textColor: 'text-blue-700',
          percent: total > 0 ? Math.round((studentFees / total) * 100) : 0,
        },
        {
          name: isBn ? 'দান ও সদকা' : 'Donations & Sadaqa',
          nameEn: 'Donations',
          value: donations,
          color: '#059669', // Emerald-600
          bgLight: 'bg-emerald-50',
          textColor: 'text-emerald-700',
          percent: total > 0 ? Math.round((donations / total) * 100) : 0,
        },
        {
          name: isBn ? 'অন্যান্য আয়' : 'Other Income',
          nameEn: 'Other Income',
          value: others,
          color: '#8b5cf6', // Purple-500
          bgLight: 'bg-purple-50',
          textColor: 'text-purple-700',
          percent: total > 0 ? Math.round((others / total) * 100) : 0,
        },
      ].filter(item => item.value > 0),
    };
  }, [relevantTransactions, isBn]);

  // Expense Breakdown: 'Salary' vs 'Development' vs 'Other'
  const expenseData = useMemo(() => {
    let salary = 0;
    let development = 0;
    let others = 0;

    relevantTransactions.forEach(t => {
      if (t.type !== 'EXPENSE') return;
      const cat = t.category as string;

      const isSalary = cat === 'STAFF_SALARY' || t.categoryName?.includes('বেতন') || t.categoryName?.includes('হাদিয়া');

      const isDev = ['BUILDING_MAINTENANCE', 'BUILDING_REPAIR', 'BUILDING_CONSTRUCTION'].includes(cat) || 
                    t.fundType === 'DEVELOPMENT' || t.categoryName?.includes('নির্মাণ') || t.categoryName?.includes('উন্নয়ন');

      if (isSalary) {
        salary += t.amount;
      } else if (isDev) {
        development += t.amount;
      } else {
        others += t.amount;
      }
    });

    const total = salary + development + others;

    return {
      total,
      items: [
        {
          name: isBn ? 'উস্তাদ ও স্টাফ বেতন' : 'Teacher & Staff Salary',
          nameEn: 'Salary',
          value: salary,
          color: '#e11d48', // Rose-600
          bgLight: 'bg-rose-50',
          textColor: 'text-rose-700',
          percent: total > 0 ? Math.round((salary / total) * 100) : 0,
        },
        {
          name: isBn ? 'মাদ্রাসা উন্নয়ন ও নির্মাণ' : 'Development & Construction',
          nameEn: 'Development',
          value: development,
          color: '#d97706', // Amber-600
          bgLight: 'bg-amber-50',
          textColor: 'text-amber-700',
          percent: total > 0 ? Math.round((development / total) * 100) : 0,
        },
        {
          name: isBn ? 'অন্যান্য পরিচালনা ব্যয়' : 'Other Expenses',
          nameEn: 'Other Expense',
          value: others,
          color: '#64748b', // Slate-500
          bgLight: 'bg-slate-50',
          textColor: 'text-slate-700',
          percent: total > 0 ? Math.round((others / total) * 100) : 0,
        },
      ].filter(item => item.value > 0),
    };
  }, [relevantTransactions, isBn]);

  // Custom Chart Tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs z-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="font-bold">{data.name}</span>
          </div>
          <div className="font-mono text-sm font-black text-amber-300">
            ৳ {isBn ? formatBanglaNumber(data.value) : data.value.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            {isBn ? 'মোট বাজেটের অংশ:' : 'Budget Share:'} <span className="font-bold text-white">{data.percent}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
      {/* Header with Timeframe Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ChartIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {isBn ? 'ডায়নামিক বাজেট ভিজ্যুয়ালাইজার (আয় ও ব্যয় ডোনাট চার্ট)' : 'Dynamic Budget Breakdown Donut Charts'}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Recharts
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {isBn 
                ? 'আয়ের উৎস (ছাত্র ফি বনাম দান) এবং ব্যয়ের খাত (শিক্ষক বেতন বনাম উন্নয়ন) এর আনুপাতিক চিত্র' 
                : 'Budget visibility: Student Fees vs Donations and Teacher Salary vs Madrasah Development'}
            </p>
          </div>
        </div>

        {/* Timeframe selector pill */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setTimeframe('THIS_MONTH')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              timeframe === 'THIS_MONTH'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>{isBn ? 'চলতি মাস' : 'This Month'}</span>
          </button>
          <button
            onClick={() => setTimeframe('ALL_TIME')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              timeframe === 'ALL_TIME'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isBn ? 'সর্বমোট সময়' : 'All Time'}</span>
          </button>
        </div>
      </div>

      {/* Dual Donut Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DONUT 1: INCOME BREAKDOWN */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900">
                {isBn ? 'আয়ের উৎস বিভাজন (Student Fees vs Donations)' : 'Income Breakdown (Fees vs Donations)'}
              </span>
            </div>
            <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              ৳ {isBn ? formatBanglaNumber(incomeData.total) : incomeData.total.toLocaleString()}
            </span>
          </div>

          {/* Chart Canvas */}
          <div className="h-64 w-full relative flex items-center justify-center my-2">
            {incomeData.items.length === 0 ? (
              <div className="text-center text-slate-400 text-xs">
                {isBn ? 'চলতি সময়ে কোনো আয়ের তথ্য নেই' : 'No income data for this period'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={renderCustomTooltip} />
                  <Pie
                    data={incomeData.items}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {incomeData.items.map((entry, index) => (
                      <Cell key={`income-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Centered Total Overlay */}
            {incomeData.items.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {isBn ? 'মোট আয়' : 'Total Inflow'}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
                  ৳{isBn ? formatBanglaNumber(incomeData.total) : (incomeData.total >= 1000 ? `${(incomeData.total/1000).toFixed(1)}k` : incomeData.total)}
                </span>
              </div>
            )}
          </div>

          {/* Slices Legend Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-200/60">
            {incomeData.items.map((item, idx) => (
              <div key={idx} className={`p-2 rounded-xl border border-slate-200/60 bg-white flex items-center justify-between text-xs`}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <span className="font-bold text-slate-800 text-[11px] block">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{item.percent}% অংশ</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  ৳{isBn ? formatBanglaNumber(item.value) : item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* DONUT 2: EXPENSE BREAKDOWN */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900">
                {isBn ? 'ব্যয়ের খাত বিভাজন (Salary vs Development)' : 'Expense Breakdown (Salary vs Development)'}
              </span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
              ৳ {isBn ? formatBanglaNumber(expenseData.total) : expenseData.total.toLocaleString()}
            </span>
          </div>

          {/* Chart Canvas */}
          <div className="h-64 w-full relative flex items-center justify-center my-2">
            {expenseData.items.length === 0 ? (
              <div className="text-center text-slate-400 text-xs">
                {isBn ? 'চলতি সময়ে কোনো ব্যয়ের তথ্য নেই' : 'No expense data for this period'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={renderCustomTooltip} />
                  <Pie
                    data={expenseData.items}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {expenseData.items.map((entry, index) => (
                      <Cell key={`expense-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Centered Total Overlay */}
            {expenseData.items.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {isBn ? 'মোট ব্যয়' : 'Total Outflow'}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
                  ৳{isBn ? formatBanglaNumber(expenseData.total) : (expenseData.total >= 1000 ? `${(expenseData.total/1000).toFixed(1)}k` : expenseData.total)}
                </span>
              </div>
            )}
          </div>

          {/* Slices Legend Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-200/60">
            {expenseData.items.map((item, idx) => (
              <div key={idx} className={`p-2 rounded-xl border border-slate-200/60 bg-white flex items-center justify-between text-xs`}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <span className="font-bold text-slate-800 text-[11px] block">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{item.percent}% অংশ</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  ৳{isBn ? formatBanglaNumber(item.value) : item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
