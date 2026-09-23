import React, { useState } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
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

export const FinanceManager: React.FC = () => {
  const { 
    schoolProfile, 
    students, 
    classes, 
    transactions, 
    feeStructures, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    updateFeeStructure, 
    language, 
    isAdmin 
  } = useApp();

  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<FinanceTransaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const navTabs: { id: FinanceTab; labelBn: string; labelEn: string; icon: any; isCore?: boolean }[] = [
    { id: 'overview', labelBn: 'ড্যাশবোর্ড সারসংক্ষেপ', labelEn: 'Overview', icon: Wallet },
    { id: 'student-fee', labelBn: 'ছাত্র ফি আদায়', labelEn: 'Student Fees', icon: GraduationCap, isCore: true },
    { id: 'donation', labelBn: 'দান ও সদকা', labelEn: 'Donations', icon: HeartHandshake, isCore: true },
    { id: 'salary', labelBn: 'উস্তাদদের হাদিয়া / বেতন', labelEn: 'Teacher Salary', icon: CreditCard, isCore: true },
    { id: 'development', labelBn: 'মাদ্রাসা উন্নয়ন ও নির্মাণ', labelEn: 'Development', icon: Building2, isCore: true },
    { id: 'general-entry', labelBn: 'সাধারণ ভাউচার এন্ট্রি', labelEn: 'General Voucher', icon: PlusCircle },
    { id: 'ledger', labelBn: 'রোজনামচা / হিসাব খাতা', labelEn: 'Cash Book & Ledger', icon: BookOpen },
    { id: 'fee-settings', labelBn: 'ফি নির্ধারণ', labelEn: 'Fee Rates', icon: Settings2 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Finance Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/10">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {isBn ? 'মাদ্রাসা ফাইন্যান্স ও ডিজিটাল হিসাবরক্ষণ' : 'Madrasah Finance Management'}
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {isBn ? 'স্মার্ট ও আধুনিক' : 'Smart & Modern'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isBn 
                ? 'ছাত্র ফি, দান-সদকা, উস্তাদদের হাদিয়া ও মাদ্রাসা উন্নয়নের স্বয়ংক্রিয় ভাউচার ও রোজনামচা' 
                : 'Smart accounting for student fees, donations, teacher salaries & infrastructure'}
            </p>
          </div>
        </div>

        {/* Quick Shortcut Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('student-fee')}
            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>{isBn ? 'ফি আদায়' : 'Collect Fee'}</span>
          </button>

          <button
            onClick={() => setActiveTab('donation')}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isBn ? 'দান রসিদ' : 'Donation'}</span>
          </button>

          <button
            onClick={() => setActiveTab('salary')}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <CreditCard className="w-3.5 h-3.5 text-rose-600" />
            <span>{isBn ? 'বেতন ভাউচার' : 'Salary'}</span>
          </button>

          <button
            onClick={() => setActiveTab('development')}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-600" />
            <span>{isBn ? 'উন্নয়ন খরচ' : 'Development'}</span>
          </button>
        </div>
      </div>

      {/* High-Impact Summary Metric Cards (Dynamic Net Monthly Surplus & Total Pending Fees) */}
      <HighImpactSummaryCards
        transactions={transactions}
        students={students}
        feeStructures={feeStructures}
        language={language}
        onQuickCollectFee={() => setActiveTab('student-fee')}
      />

      {/* Navigation Sub-Tabs Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1 min-w-max">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                {tab.isCore && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="mt-2">
        {activeTab === 'overview' && (
          <FinanceOverview
            transactions={transactions}
            language={language}
            onNavigateTab={(t) => setActiveTab(t)}
            onOpenReceipt={(tx) => setSelectedVoucherForPrint(tx)}
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
          />
        )}

        {activeTab === 'donation' && (
          <DonationEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'salary' && (
          <TeacherSalaryEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'development' && (
          <DevelopmentExpenseEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'general-entry' && (
          <GeneralVoucherEntry
            transactions={transactions}
            language={language}
            onAddTransaction={addTransaction}
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            showToast={showToast}
          />
        )}

        {activeTab === 'ledger' && (
          <FinanceLedger
            transactions={transactions}
            language={language}
            onShowReceipt={(tx) => setSelectedVoucherForPrint(tx)}
            onDeleteTransaction={deleteTransaction}
            showToast={showToast}
          />
        )}

        {activeTab === 'fee-settings' && (
          <ClassFeeSettings
            classes={classes}
            feeStructures={feeStructures}
            language={language}
            onUpdateFeeStructure={updateFeeStructure}
            showToast={showToast}
          />
        )}
      </div>

      {/* Voucher Print Modal */}
      {selectedVoucherForPrint && (
        <VoucherPrintModal
          transaction={selectedVoucherForPrint}
          schoolProfile={schoolProfile}
          language={language}
          onClose={() => setSelectedVoucherForPrint(null)}
        />
      )}
    </div>
  );
};
