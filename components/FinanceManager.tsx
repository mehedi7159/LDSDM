import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  Receipt, 
  HeartHandshake, 
  GraduationCap, 
  CreditCard, 
  Building2, 
  PlusCircle, 
  BookOpen, 
  Settings2, 
  CheckCircle2, 
  Sparkles,
  Layers,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Sliders,
  DollarSign,
  Download,
  Printer
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from './ui/PageHeader';
import { FinanceTransaction } from '../types';
import { FinanceTab } from './finance/types';
import { FinanceOverview } from './finance/FinanceOverview';
import { StudentFeeCollection } from './finance/StudentFeeCollection';
import { DonationEntry } from './finance/DonationEntry';
import { TeacherSalaryEntry } from './finance/TeacherSalaryEntry';
import { DevelopmentExpenseEntry } from './finance/DevelopmentExpenseEntry';
import { GeneralVoucherEntry } from './finance/GeneralVoucherEntry';
import { FinanceLedger } from './finance/FinanceLedger';
import { ClassFeeSettings } from './finance/ClassFeeSettings';
import { VoucherPrintModal } from './finance/VoucherPrintModal';
import { HighImpactSummaryCards } from './finance/HighImpactSummaryCards';
import { FinanceReportView } from './FinanceReportView';
import { formatNumber } from '../services/utils';
import { calculateSingleStudentDue } from '../services/studentDuesService';

interface FinanceManagerProps {
  initialTab?: FinanceTab;
  onNavigateTab?: (tab: string) => void;
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({ 
  initialTab = 'overview',
  onNavigateTab 
}) => {
  const { 
    schoolProfile, 
    students = [], 
    classes = [], 
    transactions = [], 
    feeStructures = [], 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    updateFeeStructure, 
    feeTypes = [],
    updateFeeTypes,
    confirmFeeStructuresCloudSync,
    confirmFeeTypesCloudSync,
    language, 
    isAdmin,
    confirmFeeCloudSync
  } = useApp();

  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<FinanceTransaction | null>(null);
  // Truthful receipt (25 Oct 2026): false only when the fee collection's
  // awaited cloud confirmation failed. Reset on every other voucher open
  // and on close, so unrelated entries never inherit a stale flag.
  const [voucherCloudConfirmed, setVoucherCloudConfirmed] = useState(true);
  const openVoucher = (tx: FinanceTransaction) => {
    setVoucherCloudConfirmed(true);
    setSelectedVoucherForPrint(tx);
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Real-time KPI calculations
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthStr = todayStr.slice(0, 7);

    let todayIncome = 0;
    let todayExpense = 0;
    let monthIncome = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      const type = (t.type || '').toUpperCase();
      const d = t.date ? String(t.date).slice(0, 10) : '';

      if (type === 'INCOME') {
        totalIncome += amt;
        if (d === todayStr) todayIncome += amt;
        if (d.startsWith(monthStr)) monthIncome += amt;
      } else if (type === 'EXPENSE') {
        totalExpense += amt;
        if (d === todayStr) todayExpense += amt;
      }
    });

    const netBalance = totalIncome - totalExpense;

    // Pending dues — computed by the ONE canonical dues service (the same
    // calculation the fee-collection screen and the staff mobile app use:
    // class fee structure − this month's recorded payments). This replaces
    // the old placeholder formula (per-student monthlyFee × 0.35) which was
    // disconnected from both the fee structures and the transaction ledger.
    let totalDues = 0;
    students.forEach(st => {
      if (st.status === 'Active' && !st.isFormer) {
        totalDues += calculateSingleStudentDue(st, feeStructures, transactions, undefined, feeTypes).dueThisMonth;
      }
    });

    return {
      todayIncome,
      todayExpense,
      netBalance,
      monthIncome,
      totalDues: Math.round(totalDues),
      totalTransactions: transactions.length
    };
  }, [transactions, students, feeStructures, feeTypes]);

  const navTabs: { 
    id: FinanceTab; 
    labelBn: string; 
    labelEn: string; 
    icon: any; 
    badge?: string;
    activeClass: string;
    inactiveClass: string;
    iconColor: string;
  }[] = [
    { 
      id: 'overview', 
      labelBn: 'সারসংক্ষেপ', 
      labelEn: 'Overview', 
      icon: Wallet,
      activeClass: 'bg-slate-900 text-white',
      inactiveClass: 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:text-slate-900',
      iconColor: 'text-emerald-400'
    },
    { 
      id: 'student-fee', 
      labelBn: 'ফি আদায়', 
      labelEn: 'Fees', 
      icon: GraduationCap,
      activeClass: 'bg-blue-600 text-white',
      inactiveClass: 'text-blue-900 dark:text-blue-200 hover:bg-blue-50 hover:text-blue-700',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    { 
      id: 'donation', 
      labelBn: 'দান', 
      labelEn: 'Donations', 
      icon: HeartHandshake,
      activeClass: 'bg-emerald-600 text-white',
      inactiveClass: 'text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 hover:text-emerald-700',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    { 
      id: 'salary', 
      labelBn: 'বেতন', 
      labelEn: 'Salary', 
      icon: CreditCard,
      activeClass: 'bg-rose-600 text-white',
      inactiveClass: 'text-rose-900 dark:text-rose-200 hover:bg-rose-50 hover:text-rose-700',
      iconColor: 'text-rose-600 dark:text-rose-400'
    },
    { 
      id: 'development', 
      labelBn: 'উন্নয়ন', 
      labelEn: 'Development', 
      icon: Building2,
      activeClass: 'bg-amber-600 text-white',
      inactiveClass: 'text-amber-950 dark:text-amber-200 hover:bg-amber-50 hover:text-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400'
    },
    { 
      id: 'general-entry', 
      labelBn: 'ভাউচার', 
      labelEn: 'Vouchers', 
      icon: PlusCircle,
      activeClass: 'bg-cyan-700 text-white',
      inactiveClass: 'text-cyan-950 dark:text-cyan-200 hover:bg-cyan-50 hover:text-cyan-800',
      iconColor: 'text-cyan-600 dark:text-cyan-400'
    },
    { 
      id: 'ledger', 
      labelBn: 'ক্যাশ বুক', 
      labelEn: 'Cash Book', 
      icon: BookOpen,
      activeClass: 'bg-violet-700 text-white',
      inactiveClass: 'text-violet-950 dark:text-violet-200 hover:bg-violet-50 hover:text-violet-800',
      iconColor: 'text-violet-600 dark:text-violet-400'
    },
    { 
      id: 'fee-settings', 
      labelBn: 'ফি কাঠামো', 
      labelEn: 'Fee Setup', 
      icon: Settings2,
      activeClass: 'bg-slate-700 text-white',
      inactiveClass: 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:text-slate-900',
      iconColor: 'text-slate-600 dark:text-slate-300'
    },
    { 
      id: 'reports', 
      labelBn: 'রিপোর্ট', 
      labelEn: 'Reports', 
      icon: FileSpreadsheet,
      activeClass: 'bg-emerald-700 text-white',
      inactiveClass: 'text-emerald-950 dark:text-emerald-200 hover:bg-emerald-50 hover:text-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Header: Step 5 • Finance & Accounts Suite */}
      <PageHeader
        tone="brand"
        icon={Wallet}
        title={isBn ? 'হিসাব, ফি ও অর্থ ব্যবস্থাপনা কেন্দ্র' : 'Finance, Fees & Accounts Suite'}
        footer={
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'আজকের মোট আয়' : "Today's Income"}</div>
            <div className="text-xl font-black text-emerald-300 mt-0.5">৳{formatNumber(kpis.todayIncome, language)}</div>
            <div className="text-[10px] text-emerald-400 font-medium">{isBn ? 'তাৎক্ষণিক ক্যাশ' : 'Cash In'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'আজকের মোট ব্যয়' : "Today's Expense"}</div>
            <div className="text-xl font-black text-rose-300 mt-0.5">৳{formatNumber(kpis.todayExpense, language)}</div>
            <div className="text-[10px] text-rose-400 font-medium">{isBn ? 'ভাউচার অনুমোদিত' : 'Disbursed'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'ক্যাশ ব্যালেন্স' : 'Net Balance'}</div>
            <div className={`text-xl font-black mt-0.5 ${kpis.netBalance >= 0 ? 'text-teal-300' : 'text-amber-300'}`}>
              ৳{formatNumber(kpis.netBalance, language)}
            </div>
            <div className="text-[10px] text-teal-300 font-medium">{isBn ? 'মোট তহবিল স্থিতি' : 'In Treasury'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'চলতি মাসে আদায়' : 'Month Inflow'}</div>
            <div className="text-xl font-black text-white mt-0.5">৳{formatNumber(kpis.monthIncome, language)}</div>
            <div className="text-[10px] text-teal-300 font-medium">{isBn ? 'মাসিক জমা' : 'This Month'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'বকেয়া ফি (সম্ভাব্য)' : 'Pending Dues'}</div>
            <div className="text-xl font-black text-amber-300 mt-0.5">৳{formatNumber(kpis.totalDues, language)}</div>
            <div className="text-[10px] text-amber-200 font-medium">{isBn ? 'তাগাদা অ্যালার্ট' : 'Dues Alert'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মোট লেনদেন' : 'Vouchers'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.totalTransactions, language)}</div>
            <div className="text-[10px] text-slate-300 font-medium">{isBn ? 'সংরক্ষিত ভাউচার' : 'Recorded'}</div>
          </div>
        </div>
        }
      >
<div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('student-fee')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap size={14} className="text-blue-300" />
              <span>{isBn ? 'ছাত্র ফি আদায়' : 'Collect Fee'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('donation')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <HeartHandshake size={14} className="text-emerald-300" />
              <span>{isBn ? 'দান ও সদকা' : 'Donations'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('salary')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard size={14} className="text-rose-300" />
              <span>{isBn ? 'উস্তাদ বেতন' : 'Salary'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-teal-300" />
              <span>{isBn ? 'আর্থিক বিবরণী' : 'Reports'}</span>
            </button>
          </div>
      </PageHeader>

{/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-1.5 gap-1">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive 
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-emerald-400' : tab.iconColor} />
              <span>{isBn ? tab.labelBn : tab.labelEn}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content - Purely context-isolated per page */}
      <div className="mt-1">
        {activeTab === 'overview' && (
          <FinanceOverview
            transactions={transactions}
            students={students}
            feeStructures={feeStructures}
            language={language}
            onNavigateTab={(t) => setActiveTab(t as FinanceTab)}
            onOpenReceipt={openVoucher}
          />
        )}

        {activeTab === 'student-fee' && (
          <StudentFeeCollection
            students={students}
            classes={classes}
            feeStructures={feeStructures}
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
            onNavigateTab={(t) => setActiveTab(t as FinanceTab)}
            onConfirmFeeCloudSync={confirmFeeCloudSync}
            onReceiptCloudStatus={setVoucherCloudConfirmed}
          />
        )}

        {activeTab === 'donation' && (
          <DonationEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onConfirmTransactions={confirmFeeCloudSync}
            onReceiptCloudStatus={setVoucherCloudConfirmed}
            // Job 4: NOT openVoucher — it resets voucherCloudConfirmed
            // to true, which would erase the false the form sets just
            // before opening (same-tick batching). Direct setter, like
            // student-fee, so the receipt opens local-only until the
            // background confirm lands.
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'salary' && (
          <TeacherSalaryEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onConfirmTransactions={confirmFeeCloudSync}
            onReceiptCloudStatus={setVoucherCloudConfirmed}
            // Job 1 receipt gap (7 Nov 2026): NOT openVoucher — it resets
            // voucherCloudConfirmed to true, which would erase the false
            // the form sets just before opening (same-tick batching).
            // Direct setter, like student-fee, so the receipt opens
            // local-only until the background confirm lands.
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'development' && (
          <DevelopmentExpenseEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onConfirmTransactions={confirmFeeCloudSync}
            onReceiptCloudStatus={setVoucherCloudConfirmed}
            // Job 4: NOT openVoucher — see donation tab above.
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'general-entry' && (
          <GeneralVoucherEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onConfirmTransactions={confirmFeeCloudSync}
            onReceiptCloudStatus={setVoucherCloudConfirmed}
            // Job 4: NOT openVoucher — see donation tab above.
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'ledger' && (
          <FinanceLedger
            transactions={transactions}
            language={language}
            onShowReceipt={openVoucher}
            onDeleteTransaction={deleteTransaction}
            showToast={showToast}
          />
        )}

        {activeTab === 'fee-settings' && (
          <ClassFeeSettings
            classes={classes}
            feeStructures={feeStructures}
            feeTypes={feeTypes}
            language={language}
            onUpdateFeeStructure={updateFeeStructure}
            onUpdateFeeTypes={updateFeeTypes}
            onConfirmFeeStructures={confirmFeeStructuresCloudSync}
            onConfirmFeeTypes={confirmFeeTypesCloudSync}
            showToast={showToast}
          />
        )}

        {activeTab === 'reports' && (
          <FinanceReportView />
        )}
      </div>

      {/* Voucher Print Modal */}
      {selectedVoucherForPrint && (
        <VoucherPrintModal
          transaction={selectedVoucherForPrint}
          schoolProfile={schoolProfile}
          language={language}
          cloudConfirmed={voucherCloudConfirmed}
          onClose={() => { setSelectedVoucherForPrint(null); setVoucherCloudConfirmed(true); }}
        />
      )}
    </div>
  );
};
