// ফি আদায় ও ব্যাচ — fee collection by class (22 Nov 2026).
// A fee collection is a real transaction with a studentId (see
// types.ts: FinanceTransaction — student fee collections carry the
// student link) and a non-expense type. The total is real even when
// it is ৳0; classes are grouped by the transaction's own classLevel
// ("ব্যাচ"). A class with no collection shows ৳0 collected — a real
// computed zero, not an invented figure.
import React, { useMemo } from 'react';
import { Banknote } from 'lucide-react';
import { SectionCard } from './ui/SectionCard';
import { classNamesMatch } from '../services/classNames';
import type { FinanceTransaction } from '../types';
import type { SchoolClass } from '../types';
import type { Language } from '../services/translations';

const toBn = (num: number | string, language: Language) => {
  const str = String(num);
  if (language !== 'bn') return str;
  return str.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
};

interface Props {
  transactions: FinanceTransaction[];
  classes: SchoolClass[];
  language: Language;
}

export const DashboardFeeCollectionReport: React.FC<Props> = ({ transactions, classes, language }) => {
  const isBn = language === 'bn';

  const { total, count, byClass } = useMemo(() => {
    const feeTx = (transactions || []).filter(t =>
      t && t.studentId && t.type !== 'EXPENSE' && t.type !== 'OUTFLOW'
    );
    const byClass = (classes || [])
      .filter(c => c && c.status !== 'INACTIVE')
      .map(c => ({
        className: isBn ? (c.nameBn || c.name) : c.name,
        amount: feeTx
          .filter(t => classNamesMatch(t.classLevel, c.name))
          .reduce((s, t) => s + (Number(t.amount) || 0), 0),
        n: feeTx.filter(t => classNamesMatch(t.classLevel, c.name)).length
      }))
      .filter(r => r.n > 0 || r.amount > 0);
    return {
      total: feeTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      count: feeTx.length,
      byClass
    };
  }, [transactions, classes, isBn]);

  return (
    <SectionCard
      title={isBn ? 'ফি আদায় ও ব্যাচ' : 'Fee Collection & Batch'}
      icon={Banknote}
      iconTone="emerald"
      bodyClassName="space-y-2"
      action={
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          ৳{toBn(total.toLocaleString(), language)}
        </span>
      }
    >
      {count === 0 && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">
          {isBn ? 'এখনো কোনো ফি আদায় হয়নি।' : 'No fee collected yet.'}
        </p>
      )}
      {byClass.map(r => (
        <div key={r.className} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-900 dark:text-white truncate">
            {r.className}
            <span className="block text-[11px] font-medium text-slate-400">
              {toBn(r.n, language)} {isBn ? 'টি আদায়' : 'collections'}
            </span>
          </span>
          <span className="font-black text-emerald-700 dark:text-emerald-300 shrink-0">
            ৳{toBn(r.amount.toLocaleString(), language)}
          </span>
        </div>
      ))}
    </SectionCard>
  );
};
