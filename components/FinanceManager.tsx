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
      labelBn: 'ড্যাশবোর্ড সারসংক্ষেপ', 
      labelEn: 'Overview', 
      icon: Wallet,
      activeClass: 'bg-slate-900 text-white shadow-md',
      inactiveClass: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      iconColor: 'text-emerald-400'
    },
    { 
      id: 'student-fee', 
      labelBn: 'ছাত্র ফি ও বকেয়া', 
      labelEn: 'Student Fees', 
      icon: GraduationCap,
      badge: isBn ? 'ফি গ্রহণ' : 'Collection',
      activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-500/20',
      inactiveClass: 'text-blue-900 hover:bg-blue-50 hover:text-blue-700',
      iconColor: 'text-blue-600'
    },
    { 
      id: 'donation', 
      labelBn: 'দান ও সদকা', 
      labelEn: 'Donations', 
      icon: HeartHandshake,
      badge: isBn ? 'রসিদ' : 'Receipt',
      activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20',
      inactiveClass: 'text-emerald-900 hover:bg-emerald-50 hover:text-emerald-700',
      iconColor: 'text-emerald-600'
    },
    { 
      id: 'salary', 
      labelBn: 'উস্তাদদের বেতন / হাদিয়া', 
      labelEn: 'Teacher Salary', 
      icon: CreditCard,
      activeClass: 'bg-rose-600 text-white shadow-md shadow-rose-500/20',
      inactiveClass: 'text-rose-900 hover:bg-rose-50 hover:text-rose-700',
      iconColor: 'text-rose-600'
    },
    { 
      id: 'development', 
      labelBn: 'মাদ্রাসা উন্নয়ন ও নির্মাণ', 
      labelEn: 'Development', 
      icon: Building2,
      activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-500/20',
      inactiveClass: 'text-amber-950 hover:bg-amber-50 hover:text-amber-800',
      iconColor: 'text-amber-600'
    },
    { 
      id: 'general-entry', 
      labelBn: 'সাধারণ ভাউচার এন্ট্রি', 
      labelEn: 'General Voucher', 
      icon: PlusCircle,
      activeClass: 'bg-cyan-700 text-white shadow-md shadow-cyan-600/20',
      inactiveClass: 'text-cyan-950 hover:bg-cyan-50 hover:text-cyan-800',
      iconColor: 'text-cyan-600'
    },
    { 
      id: 'ledger', 
      labelBn: 'ক্যাশ বুক ও হিসাব খাতা', 
      labelEn: 'Cash Book & Ledger', 
      icon: BookOpen,
      activeClass: 'bg-violet-700 text-white shadow-md shadow-violet-600/20',
      inactiveClass: 'text-violet-950 hover:bg-violet-50 hover:text-violet-800',
      iconColor: 'text-violet-600'
    },
    { 
      id: 'fee-settings', 
      labelBn: 'ফি নির্ধারণ সেটিংস', 
      labelEn: 'Fee Rates', 
      icon: Settings2,
      activeClass: 'bg-slate-700 text-white shadow-md',
      inactiveClass: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      iconColor: 'text-slate-600'
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Finance Header & Modern Top Sub-Menu Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isBn ? 'হিসাব ও অর্থ ব্যবস্থাপনা' : 'Finance & Accounts'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isBn ? 'সহজ ও স্বয়ংক্রিয়' : 'Easy & Automated'}
                </span>
              </div>
              <p className="text-sm text-slate-600 font-medium mt-0.5">
                {isBn 
                  ? 'ছাত্র ফি, দান-সদকা, উস্তাদদের বেতন ও মাদ্রাসা খরচের সহজ ও পরিষ্কার হিসাব' 
                  : 'Intuitive accounting for student fees, donations, teacher salaries & projects'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Prominent Navigation Menu Bar */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2.5 whitespace-nowrap border ${
                    isActive 
                      ? `${tab.activeClass} border-transparent scale-[1.02]` 
                      : `${tab.inactiveClass} bg-slate-50/70 border-slate-200/70 hover:scale-[1.01]`
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.iconColor}`} />
                  <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                  {tab.badge && !isActive && (
                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Content - Purely context-isolated per page */}
      <div className="mt-1">
        {activeTab === 'overview' && (
          <FinanceOverview
            transactions={transactions}
            students={students}
            feeStructures={feeStructures}
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
            onNavigateTab={(t) => setActiveTab(t)}
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
