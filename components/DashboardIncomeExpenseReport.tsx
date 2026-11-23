// আয়-ব্যয় রিপোর্ট — income vs expense (22 Nov 2026).
// The figures come from the Dashboard's OWN financeMetrics memo
// (same income definition — INCOME/INFLOW/FEE-category/no-type —
// reused, NOT redefined here). With no transactions yet the figures
// read "—" and the card says so honestly; nothing is invented.
import React from 'react';
import { Scale } from 'lucide-react';
import { SectionCard } from './ui/SectionCard';
import type { Language } from '../services/translations';

const toBn = (num: number | string, language: Language) => {
  const str = String(num);
  if (language !== 'bn') return str;
  return str.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
};

interface Props {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
  language: Language;
}

export const DashboardIncomeExpenseReport: React.FC<Props> = ({ totalIncome, totalExpense, netBalance, transactionCount, language }) => {
  const isBn = language === 'bn';
  const hasData = transactionCount > 0;
  const money = (n: number) => (hasData ? `৳${toBn(n.toLocaleString(), language)}` : '—');

  return (
    <SectionCard
      title={isBn ? 'আয়-ব্যয় রিপোর্ট' : 'Income-Expense Report'}
      icon={Scale}
      iconTone="emerald"
      bodyClassName="space-y-2"
      action={
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          {isBn ? 'নিট' : 'Net'} {money(netBalance)}
        </span>
      }
    >
      {!hasData && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">
          {isBn ? 'এখনো কোনো লেনদেন নেই — আয়-ব্যয়ের হিসাব এখানে দেখাবে।' : 'No transactions yet — income and expense will show here.'}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">{isBn ? 'আয়' : 'Income'}</span>
          <span className="text-base font-bold text-emerald-950 dark:text-emerald-100">{money(totalIncome)}</span>
        </div>
        <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 block">{isBn ? 'ব্যয়' : 'Expense'}</span>
          <span className="text-base font-bold text-rose-950 dark:text-rose-100">{money(totalExpense)}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">{isBn ? 'নিট' : 'Net'}</span>
          <span className="text-base font-bold text-slate-900 dark:text-white">{money(netBalance)}</span>
        </div>
      </div>
      {hasData && (
        <p className="text-[11px] text-slate-400">
          {toBn(transactionCount, language)} {isBn ? 'টি লেনদেন' : 'transactions'}
        </p>
      )}
    </SectionCard>
  );
};
