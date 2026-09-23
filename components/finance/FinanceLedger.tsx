import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Trash2, 
  Calendar, 
  Layers, 
  GraduationCap, 
  HeartHandshake, 
  CreditCard, 
  Building2, 
  ArrowDownLeft, 
  ArrowUpRight,
  FileSpreadsheet
} from 'lucide-react';
import { 
  FinanceTransaction, 
  FundType, 
  TransactionType 
} from '../../types';
import { formatBanglaNumber } from '../../services/utils';
import { FUND_METAS, FinanceFilterCategory } from './types';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { LedgerStatementModal } from './LedgerStatementModal';

interface FinanceLedgerProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onShowReceipt: (tx: FinanceTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  showToast: (msg: string) => void;
}

export const FinanceLedger: React.FC<FinanceLedgerProps> = ({
  transactions,
  language,
  onShowReceipt,
  onDeleteTransaction,
  showToast,
}) => {
  const { schoolProfile } = useApp();
  const isBn = language === 'bn';

  const [pillarFilter, setPillarFilter] = useState<FinanceFilterCategory>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [fundFilter, setFundFilter] = useState<'ALL' | FundType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);

  // Compute Last Month Str
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Type Filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;

      // Fund Filter
      if (fundFilter !== 'ALL' && tx.fundType !== fundFilter) return false;

      // Pillar Filter
      const cat = tx.category as string;
      const isStudentFee = [
        'STUDENT_TUITION', 'ADMISSION_FEE', 'EXAM_FEE', 
        'BOARDING_FEE', 'BOOK_STATIONERY', 'BOOK_PURCHASE_FEE'
      ].includes(cat) || Boolean(tx.studentId || tx.feeBreakdown);

      const isDonation = [
        'GENERAL_DONATION', 'ZAKAT_FITRA', 'QURBANI_LEATHER', 
        'MONTHLY_DONOR', 'ORPHAN_SPONSOR', 'MAHFIL_COLLECTION'
      ].includes(cat);

      const isTeacherSalary = cat === 'STAFF_SALARY' || tx.categoryName?.includes('বেতন') || tx.categoryName?.includes('হাদিয়া');

      const isDevelopment = ['BUILDING_MAINTENANCE', 'BUILDING_REPAIR', 'BUILDING_CONSTRUCTION'].includes(cat) || 
                            tx.fundType === 'DEVELOPMENT' || tx.categoryName?.includes('নির্মাণ') || tx.categoryName?.includes('উন্নয়ন');

      if (pillarFilter === 'STUDENT_FEES' && !isStudentFee) return false;
      if (pillarFilter === 'DONATIONS' && !isDonation) return false;
      if (pillarFilter === 'TEACHER_SALARY' && !isTeacherSalary) return false;
      if (pillarFilter === 'DEVELOPMENT' && !isDevelopment) return false;
      if (pillarFilter === 'OTHERS' && (isStudentFee || isDonation || isTeacherSalary || isDevelopment)) return false;

      // Date Range Filter
      if (dateFilterMode === 'TODAY' && tx.date !== todayStr) return false;
      if (dateFilterMode === 'THIS_MONTH' && !tx.date.startsWith(currentMonthStr)) return false;
      if (dateFilterMode === 'LAST_MONTH' && !tx.date.startsWith(lastMonthStr)) return false;
      if (dateFilterMode === 'CUSTOM') {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchVoucher = tx.voucherNo.toLowerCase().includes(q);
        const matchPayer = tx.payerOrPayee?.toLowerCase().includes(q);
        const matchStudent = (tx.studentName && tx.studentName.toLowerCase().includes(q)) || (tx.studentNameBn && tx.studentNameBn.includes(q)) || tx.studentCode?.includes(q);
        const matchCategory = (tx.categoryName && tx.categoryName.toLowerCase().includes(q)) || tx.category.toLowerCase().includes(q);
        const matchDesc = tx.description?.toLowerCase().includes(q);
        const matchRef = tx.referenceNo?.toLowerCase().includes(q);
        return matchVoucher || matchPayer || matchStudent || matchCategory || matchDesc || matchRef;
      }

      return true;
    });
  }, [transactions, typeFilter, fundFilter, pillarFilter, dateFilterMode, startDate, endDate, searchQuery, todayStr, currentMonthStr, lastMonthStr]);

  // Aggregate stats
  const aggregates = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(tx => {
      if (tx.type === 'INCOME') income += tx.amount;
      else expense += tx.amount;
    });
    return { income, expense, balance: income - expense, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const handlePrintCashBook = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Voucher No', 'Date', 'Type', 'Category', 'Fund', 'Payer/Payee', 'Student ID', 'Class', 'Amount', 'Payment Method', 'Ref', 'Description'];
    const rows = filteredTransactions.map(tx => [
      tx.voucherNo,
      tx.date,
      tx.type,
      `"${(tx.categoryName || tx.category).replace(/"/g, '""')}"`,
      tx.fundType,
      `"${(tx.payerOrPayee || '').replace(/"/g, '""')}"`,
      tx.studentCode || '',
      tx.classLevel || '',
      tx.amount,
      tx.paymentMethod,
      tx.referenceNo || '',
      `"${(tx.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `madrasah_ledger_${dateFilterMode}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(isBn ? 'রোজনামচা এক্সপোর্ট সফল হয়েছে!' : 'Exported to CSV successfully!');
  };

  const handleDelete = (id: string, voucher: string) => {
    if (confirm(isBn ? `আপনি কি নিশ্চিতভাবে ভাউচার নং ${voucher} মুছে ফেলতে চান?` : `Are you sure you want to delete voucher ${voucher}?`)) {
      onDeleteTransaction(id);
      showToast(isBn ? `ভাউচার ${voucher} মুছে ফেলা হয়েছে!` : `Voucher ${voucher} deleted!`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pillar Selection Chips */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setPillarFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              pillarFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBn ? 'সকল হিসাব (All)' : 'All Records'}</span>
          </button>

          <button
            onClick={() => setPillarFilter('STUDENT_FEES')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              pillarFilter === 'STUDENT_FEES'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>{isBn ? '🎓 ছাত্র ফি ও বেতন' : 'Student Fees'}</span>
          </button>

          <button
            onClick={() => setPillarFilter('DONATIONS')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              pillarFilter === 'DONATIONS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>{isBn ? '🤲 দান, সদকা ও যাকাত' : 'Donations'}</span>
          </button>

          <button
            onClick={() => setPillarFilter('TEACHER_SALARY')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              pillarFilter === 'TEACHER_SALARY'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{isBn ? '👨‍🏫 উস্তাদদের হাদিয়া ও বেতন' : 'Teacher Salaries'}</span>
          </button>

          <button
            onClick={() => setPillarFilter('DEVELOPMENT')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              pillarFilter === 'DEVELOPMENT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isBn ? '🏗️ মাদ্রাসা উন্নয়ন ও নির্মাণ' : 'Development'}</span>
          </button>

          <button
            onClick={() => setPillarFilter('OTHERS')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              pillarFilter === 'OTHERS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isBn ? '📋 অন্যান্য আয়/ব্যয়' : 'Other Heads'}</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'রসিদ নং, ছাত্রের নাম, দাতা বা খাত খুঁজুন...' : 'Search voucher, name, donor...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">{isBn ? 'সকল ধরন (All Type)' : 'All Type'}</option>
              <option value="INCOME">{isBn ? 'শুধু জমা / আয় (Income)' : 'Income Only'}</option>
              <option value="EXPENSE">{isBn ? 'শুধু খরচ / ব্যয় (Expense)' : 'Expense Only'}</option>
            </select>
          </div>

          {/* Fund Filter */}
          <div className="lg:col-span-3">
            <select
              value={fundFilter}
              onChange={(e) => setFundFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">{isBn ? 'সকল তহবিল (All Funds)' : 'All Funds'}</option>
              {(Object.keys(FUND_METAS) as FundType[]).map(f => (
                <option key={f} value={f}>
                  {isBn ? FUND_METAS[f].nameBn : FUND_METAS[f].name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Mode */}
          <div className="lg:col-span-3">
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="THIS_MONTH">{isBn ? 'চলতি মাস' : 'This Month'}</option>
              <option value="TODAY">{isBn ? 'আজকের দিন' : 'Today'}</option>
              <option value="LAST_MONTH">{isBn ? 'গত মাস' : 'Last Month'}</option>
              <option value="ALL">{isBn ? 'শুরু থেকে সব (All Time)' : 'All Time'}</option>
              <option value="CUSTOM">{isBn ? 'নির্দিষ্ট তারিখ সীমা (Custom)' : 'Custom Range'}</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilterMode === 'CUSTOM' && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">{isBn ? 'তারিখ নির্বাচন:' : 'Select Range:'}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
            />
            <span className="text-slate-400">থেকে</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
            />
          </div>
        )}

        {/* Action Buttons: Export & Print */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <span>{isBn ? `মোট এন্ট্রি: ${aggregates.count} টি` : `Total Entries: ${aggregates.count}`}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCSV}
              size="sm"
              variant="secondary"
              className="text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              <span>{isBn ? 'এক্সেল / CSV' : 'Export CSV'}</span>
            </Button>
            <Button
              onClick={() => setShowStatementModal(true)}
              size="sm"
              variant="primary"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span>{isBn ? 'স্টেটমেন্ট ও পিডিএফ রিপোর্ট' : 'Statement & PDF'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Aggregate Stats Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase block">{isBn ? 'ফিল্টারকৃত মোট আয়' : 'Total Inflow'}</span>
            <span className="text-lg font-black text-emerald-900 font-mono">
              + ৳{isBn ? formatBanglaNumber(aggregates.income) : aggregates.income.toLocaleString()}
            </span>
          </div>
          <ArrowDownLeft className="w-6 h-6 text-emerald-600 opacity-80" />
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-800 uppercase block">{isBn ? 'ফিল্টারকৃত মোট ব্যয়' : 'Total Outflow'}</span>
            <span className="text-lg font-black text-rose-900 font-mono">
              - ৳{isBn ? formatBanglaNumber(aggregates.expense) : aggregates.expense.toLocaleString()}
            </span>
          </div>
          <ArrowUpRight className="w-6 h-6 text-rose-600 opacity-80" />
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 uppercase block">{isBn ? 'নিট ক্যাশ স্থিতি' : 'Net Surplus'}</span>
            <span className={`text-lg font-black font-mono ${aggregates.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ৳{isBn ? formatBanglaNumber(aggregates.balance) : aggregates.balance.toLocaleString()}
            </span>
          </div>
          <Receipt className="w-6 h-6 text-slate-400 opacity-80" />
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 font-bold">{isBn ? 'ভাউচার নং' : 'Voucher'}</th>
                <th className="py-3 px-3 font-bold">{isBn ? 'তারিখ' : 'Date'}</th>
                <th className="py-3 px-3 font-bold">{isBn ? 'তহবিল ও খাত' : 'Fund & Category'}</th>
                <th className="py-3 px-3 font-bold">{isBn ? 'দাতা / ছাত্র / প্রাপক' : 'Person / Student'}</th>
                <th className="py-3 px-3 font-bold">{isBn ? 'বিবরণ / উদ্দেশ্য' : 'Description'}</th>
                <th className="py-3 px-3 font-bold text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                <th className="py-3 px-3 font-bold text-center">{isBn ? 'একশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {isBn ? 'কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।' : 'No transactions found.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const fundMeta = FUND_METAS[tx.fundType] || FUND_METAS.GENERAL;
                  const isIncome = tx.type === 'INCOME';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                        {tx.voucherNo}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="font-bold text-slate-800">{tx.categoryName || tx.category}</span>
                        </div>
                        <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded border ${fundMeta.bg} ${fundMeta.border} ${fundMeta.color}`}>
                          {isBn ? fundMeta.nameBn : fundMeta.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-medium">
                        {tx.studentNameBn || tx.studentName || tx.payerOrPayee}
                        {tx.classLevel && <span className="ml-1 text-[10px] text-slate-500">[{tx.classLevel}]</span>}
                        {tx.contactNo && <div className="text-[10px] text-slate-400 font-mono">{tx.contactNo}</div>}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={tx.description}>
                        {tx.description || '---'}
                      </td>
                      <td className="py-3 px-3 text-right font-black font-mono whitespace-nowrap">
                        <span className={isIncome ? 'text-emerald-700' : 'text-rose-700'}>
                          {isIncome ? '+' : '-'} ৳{isBn ? formatBanglaNumber(tx.amount) : tx.amount.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400 font-normal font-sans">
                          {tx.paymentMethod}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onShowReceipt(tx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={isBn ? 'রসিদ প্রিন্ট করুন' : 'Print Voucher'}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id, tx.voucherNo)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Statement & PDF Modal */}
      {showStatementModal && (
        <LedgerStatementModal
          transactions={filteredTransactions}
          schoolProfile={schoolProfile}
          filterMeta={{
            pillar: pillarFilter,
            fund: fundFilter,
            dateMode: dateFilterMode,
            startDate: dateFilterMode === 'CUSTOM' ? startDate : undefined,
            endDate: dateFilterMode === 'CUSTOM' ? endDate : undefined,
          }}
          language={language}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </div>
  );
};
