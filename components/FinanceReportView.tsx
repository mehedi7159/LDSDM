import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Printer, 
  Download, 
  Calendar, 
  Filter, 
  Search, 
  PieChart as PieIcon, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  FileText,
  Building,
  CreditCard
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export const FinanceReportView: React.FC = () => {
  const { transactions = [], schoolProfile, language, t } = useApp();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toBanglaDigits = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = typeof num === 'number' ? num.toLocaleString() : String(num);
    if (language !== 'bn') return str;
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
      ',': ','
    };
    return str.split('').map(char => banglaNums[char] || char).join('');
  };

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      if (!tx) return false;
      if (selectedType !== 'all' && tx.type !== selectedType) return false;
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false;
      if (dateRange.start && tx.date < dateRange.start) return false;
      if (dateRange.end && tx.date > dateRange.end) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchPayer = (tx.payerOrPayee || '').toLowerCase().includes(q);
        const matchVoucher = (tx.voucherNo || '').toLowerCase().includes(q);
        if (!matchDesc && !matchPayer && !matchVoucher) return false;
      }
      return true;
    });
  }, [transactions, selectedType, selectedCategory, dateRange, searchQuery]);

  // Totals
  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [filteredTransactions]);

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalExpense;

  // Category breakdown for Pie Chart
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(tx => {
      map[tx.category] = (map[tx.category] || 0) + (Number(tx.amount) || 0);
    });

    const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
    return Object.entries(map).map(([cat, amount], idx) => ({
      name: cat,
      amount,
      color: colors[idx % colors.length]
    }));
  }, [filteredTransactions]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Voucher No', 'Date', 'Type', 'Category', 'Payer/Payee', 'Description', 'Payment Method', 'Amount'];
    const rows = filteredTransactions.map(t => [
      t.voucherNo || '',
      t.date,
      t.type,
      `"${t.category}"`,
      `"${t.payerOrPayee || ''}"`,
      `"${t.description || ''}"`,
      t.paymentMethod || '',
      t.amount
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `finance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-800 via-indigo-900 to-slate-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-violet-200 text-xs font-bold uppercase tracking-wider mb-1">
            <Wallet size={16} />
            <span>{language === 'bn' ? 'আর্থিক হিসাব ও বিবরণী' : 'Financial Statement & Audit Reports'}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'আর্থিক রিপোর্ট ও আয়-ব্যয় বিবরণী' : 'Financial Reports & Statements'}
          </h1>
          <p className="text-xs text-violet-100/80 mt-1 max-w-xl">
            {language === 'bn'
              ? 'মাদ্রাসার সামগ্রিক তহবিল, খাতভিত্তিক আয় ও ব্যয়ের সুনির্দিষ্ট অডিট লেজার ও ক্যাশ বিবরণী।'
              : 'Complete financial health overview, ledger audit records, and category breakdown.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-xs"
          >
            <Download size={15} />
            <span>{language === 'bn' ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-white text-violet-950 hover:bg-violet-50 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/20"
          >
            <Printer size={15} />
            <span>{language === 'bn' ? 'স্টেটমেন্ট প্রিন্ট' : 'Print Statement'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'মোট আয় / রাজস্ব' : 'Total Income'}</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">৳ {toBanglaDigits(totalIncome)}</h3>
            <p className="text-[10px] text-emerald-600/80 mt-0.5 flex items-center gap-1">
              <ArrowUpRight size={12} /> {language === 'bn' ? 'ফি ও অনুদান অন্তর্ভুক্তি' : 'Fees & Donations'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'মোট ব্যয় / খরচ' : 'Total Expense'}</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">৳ {toBanglaDigits(totalExpense)}</h3>
            <p className="text-[10px] text-rose-600/80 mt-0.5 flex items-center gap-1">
              <ArrowDownRight size={12} /> {language === 'bn' ? 'বেতন ও প্রাতিষ্ঠানিক ব্যয়' : 'Salaries & Bills'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'নিট ব্যালেন্স / তহবিল' : 'Net Fund Balance'}</p>
            <h3 className={`text-2xl font-black mt-1 ${netBalance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              ৳ {toBanglaDigits(netBalance)}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {netBalance >= 0 ? (language === 'bn' ? 'উদ্বৃত্ত তহবিল' : 'Surplus') : (language === 'bn' ? 'ঘাটতি' : 'Deficit')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'bn' ? 'ভাউচার, বিবরণ বা নাম খুঁজুন...' : 'Search voucher, description...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সকল লেনদেন' : 'All Types'}</option>
            <option value="INCOME">{language === 'bn' ? 'আয় (Income)' : 'Income'}</option>
            <option value="EXPENSE">{language === 'bn' ? 'ব্যয় (Expense)' : 'Expense'}</option>
          </select>

          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
            title="শুরুর তারিখ"
          />

          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
            title="শেষ তারিখ"
          />
        </div>

        <div className="text-xs font-bold text-slate-500">
          {language === 'bn' ? 'মোট এন্ট্রি:' : 'Entries:'} <span className="text-violet-600 font-mono font-black">{toBanglaDigits(filteredTransactions.length)}</span>
        </div>
      </div>

      {/* Printable Statement Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Printable Header */}
        <div className="p-6 border-b border-slate-100 hidden print:block text-center">
          <h2 className="text-xl font-black text-slate-900">{schoolProfile.nameBn || schoolProfile.name}</h2>
          <p className="text-xs text-slate-600">{schoolProfile.address}</p>
          <h3 className="text-sm font-bold text-slate-800 mt-2 underline">
            {language === 'bn' ? 'প্রাতিষ্ঠানিক আর্থিক বিবরণী ও লেজার খতিয়ান' : 'Official Financial Statement & Ledger'}
          </h3>
          <p className="text-[10px] text-slate-500">
            {language === 'bn' ? 'তারিখ:' : 'Date:'} {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-center">#</th>
                <th className="py-3 px-4">{language === 'bn' ? 'তারিখ' : 'Date'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'ভাউচার নং' : 'Voucher No'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'খাত / ক্যাটাগরি' : 'Category'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'গ্রহীতা / দাতা' : 'Payer/Payee'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'মাধ্যম' : 'Method'}</th>
                <th className="py-3 px-4 text-right">{language === 'bn' ? 'আয় (টাকা)' : 'Income'}</th>
                <th className="py-3 px-4 text-right">{language === 'bn' ? 'ব্যয় (টাকা)' : 'Expense'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {language === 'bn' ? 'কোনো লেনদেনের রেকর্ড পাওয়া যায়নি' : 'No transaction records found'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{toBanglaDigits(idx + 1)}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{tx.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{tx.voucherNo || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{tx.category}</td>
                    <td className="py-3 px-4 text-slate-700">{tx.payerOrPayee || '-'}</td>
                    <td className="py-3 px-4 text-slate-500 capitalize">{tx.paymentMethod || 'cash'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {tx.type === 'INCOME' ? `৳ ${toBanglaDigits(tx.amount)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      {tx.type === 'EXPENSE' ? `৳ ${toBanglaDigits(tx.amount)}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredTransactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                  <td colSpan={6} className="py-3 px-4 text-right uppercase text-[11px] text-slate-700">
                    {language === 'bn' ? 'মোট যোগফল:' : 'Total Amount:'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                    ৳ {toBanglaDigits(totalIncome)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-rose-700">
                    ৳ {toBanglaDigits(totalExpense)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
