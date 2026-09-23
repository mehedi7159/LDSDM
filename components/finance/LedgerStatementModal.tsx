import React, { useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Loader2, 
  FileText, 
  BookOpen, 
  Calendar, 
  Building2, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FinanceTransaction, FundType } from '../../types';
import { formatBanglaNumber } from '../../services/utils';
import { FUND_METAS, FinanceFilterCategory } from './types';
import { Button } from '../ui/Button';

interface LedgerStatementModalProps {
  transactions: FinanceTransaction[];
  schoolProfile: {
    name: string;
    nameBn?: string;
    address: string;
    phone?: string;
    email?: string;
  };
  filterMeta: {
    pillar: FinanceFilterCategory;
    fund: 'ALL' | FundType;
    dateMode: string;
    startDate?: string;
    endDate?: string;
  };
  language: 'en' | 'bn';
  onClose: () => void;
}

export const LedgerStatementModal: React.FC<LedgerStatementModalProps> = ({
  transactions,
  schoolProfile,
  filterMeta,
  language,
  onClose,
}) => {
  const isBn = language === 'bn';
  const printContentRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Calculate aggregates
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(t => {
    if (t.type === 'INCOME') totalIncome += t.amount;
    else totalExpense += t.amount;
  });
  const netBalance = totalIncome - totalExpense;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printContentRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);

    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-9999px';
    stage.style.top = '-9999px';
    stage.style.width = '794px'; // A4 width
    stage.style.backgroundColor = '#ffffff';
    stage.style.zIndex = '-1000';
    document.body.appendChild(stage);

    try {
      const clone = printContentRef.current.cloneNode(true) as HTMLElement;
      clone.style.width = '794px';
      clone.style.margin = '0';
      clone.style.padding = '24px';
      clone.style.backgroundColor = '#ffffff';
      clone.style.boxSizing = 'border-box';

      clone.querySelectorAll('*').forEach((el: any) => {
        if (el.style) {
          el.style.boxShadow = 'none';
          if (el.style.outline) el.style.outline = 'none';
        }
        el.classList.remove('shadow-2xl', 'shadow-xl', 'shadow-lg', 'shadow-md', 'shadow-sm', 'shadow');
      });

      stage.appendChild(clone);
      await new Promise(resolve => setTimeout(resolve, 80));

      const canvas = await html2canvas(clone, {
        scale: 2.0,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Handle multi-page if statement is long
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = 297;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      pdf.save(`Finance_Statement_${todayStr}.pdf`);
    } catch (err) {
      console.error('Statement PDF error, fallback to print:', err);
      window.print();
    } finally {
      if (document.body.contains(stage)) {
        document.body.removeChild(stage);
      }
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:w-full">
        
        {/* Toolbar (Hidden on print) */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs print:hidden gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {isBn ? 'আর্থিক স্টেটমেন্ট ও রোজনামচা রিপোর্ট' : 'Finance Statement & Cash Book Report'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? `মোট লেনদেন: ${formatBanglaNumber(transactions.length)} টি` : `Total Entries: ${transactions.length}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              size="sm"
              variant="secondary"
              className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 text-xs font-bold"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              <span>{isDownloadingPdf ? (isBn ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating...') : (isBn ? 'পিডিএফ ডাউনলোড' : 'Download PDF')}</span>
            </Button>

            <Button
              onClick={handlePrint}
              size="sm"
              variant="primary"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span>{isBn ? 'স্টেটমেন্ট প্রিন্ট' : 'Print Statement'}</span>
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================================================== */}
        {/* PRINTABLE STATEMENT CONTAINER (Class: print-container) */}
        {/* ==================================================== */}
        <div className="print-container bg-white">
          <div 
            ref={printContentRef}
            className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white max-w-[800px] mx-auto print:p-4 print:space-y-4 print:max-w-none"
          >
            
            {/* Statement Header */}
            <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
              <div className="text-xs font-bold font-serif text-slate-700 mb-1">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {schoolProfile.nameBn || schoolProfile.name}
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                {schoolProfile.address}
                {schoolProfile.phone && ` • মোবা: ${schoolProfile.phone}`}
              </p>
              <div className="inline-block mt-2 px-4 py-1 rounded-full bg-slate-900 text-white text-xs font-bold tracking-wide uppercase">
                {isBn ? 'আর্থিক হিসাব বিবরণী ও রোজনামচা (Official Financial Statement)' : 'FINANCIAL STATEMENT & CASH BOOK'}
              </div>
            </div>

            {/* Statement Filter & Date Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 bg-slate-50 rounded-xl border border-slate-200 font-medium">
              <div>
                <span className="text-slate-500">{isBn ? 'প্রতিবেদন তৈরির তারিখ: ' : 'Generated On: '}</span>
                <span className="font-bold text-slate-900">{new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">{isBn ? 'হিসাব পরিসর: ' : 'Filter Range: '}</span>
                <span className="font-bold text-slate-900">
                  {filterMeta.startDate && filterMeta.endDate 
                    ? `${filterMeta.startDate} থেকে ${filterMeta.endDate}` 
                    : (isBn ? 'চলতি সময়ের সকল হিসাব' : 'Current Active Scope')}
                </span>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-emerald-300 bg-emerald-50/60 rounded-xl p-2.5 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">{isBn ? 'মোট আদায় / আয়' : 'Total Inflow'}</span>
                <span className="text-sm sm:text-base font-black text-emerald-900 font-mono">
                  + ৳ {isBn ? formatBanglaNumber(totalIncome) : totalIncome.toLocaleString()}
                </span>
              </div>

              <div className="border border-rose-300 bg-rose-50/60 rounded-xl p-2.5 text-center">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">{isBn ? 'মোট খরচ / ব্যয়' : 'Total Outflow'}</span>
                <span className="text-sm sm:text-base font-black text-rose-900 font-mono">
                  - ৳ {isBn ? formatBanglaNumber(totalExpense) : totalExpense.toLocaleString()}
                </span>
              </div>

              <div className="border border-slate-800 bg-slate-900 text-white rounded-xl p-2.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">{isBn ? 'নিট সমাপনী স্থিতি' : 'Net Balance'}</span>
                <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                  ৳ {isBn ? formatBanglaNumber(netBalance) : netBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Main Statement Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10">নং</th>
                    <th className="py-2.5 px-2.5">ভাউচার</th>
                    <th className="py-2.5 px-2">তারিখ</th>
                    <th className="py-2.5 px-2.5">খাত ও তহবিল</th>
                    <th className="py-2.5 px-2.5">দাতা / ছাত্র / প্রাপক</th>
                    <th className="py-2.5 px-2.5 text-right">জমা (+)</th>
                    <th className="py-2.5 px-2.5 text-right">খরচ (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {isBn ? 'কোনো লেনদেন পাওয়া যায়নি' : 'No transactions recorded'}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => {
                      const isIncome = tx.type === 'INCOME';
                      const fund = FUND_METAS[tx.fundType] || FUND_METAS.GENERAL;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px]">
                            {isBn ? formatBanglaNumber(idx + 1) : idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-bold font-mono text-slate-900 text-[11px]">
                            {tx.voucherNo}
                          </td>
                          <td className="py-2 px-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-2 px-2.5">
                            <span className="font-bold text-slate-800 block text-[11px]">{tx.categoryName || tx.category}</span>
                            <span className="text-[10px] text-slate-500">{isBn ? fund.nameBn : fund.name}</span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 text-[11px]">
                            <span className="font-semibold">{tx.studentNameBn || tx.studentName || tx.payerOrPayee}</span>
                            {tx.classLevel && <span className="text-[10px] text-slate-500 ml-1">[{tx.classLevel}]</span>}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                            {isIncome ? `৳ ${isBn ? formatBanglaNumber(tx.amount) : tx.amount.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-rose-700">
                            {!isIncome ? `৳ ${isBn ? formatBanglaNumber(tx.amount) : tx.amount.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 text-right">
                      {isBn ? 'সর্বমোট যোগফল:' : 'Total Sum:'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-emerald-800">
                      ৳ {isBn ? formatBanglaNumber(totalIncome) : totalIncome.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-rose-800">
                      ৳ {isBn ? formatBanglaNumber(totalExpense) : totalExpense.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Official Certification & Signatures */}
            <div className="grid grid-cols-3 gap-6 pt-10 mt-6 text-xs text-center font-bold text-slate-700">
              <div>
                <div className="border-t border-slate-600 w-36 mx-auto pt-1">
                  {isBn ? 'হিসাবরক্ষক' : 'Accountant'}
                </div>
              </div>
              <div>
                <div className="border-t border-slate-600 w-36 mx-auto pt-1">
                  {isBn ? 'অভ্যন্তরীণ নিরীক্ষক' : 'Internal Auditor'}
                </div>
              </div>
              <div>
                <div className="border-t border-slate-600 w-36 mx-auto pt-1">
                  {isBn ? 'মুহতামিম / সভাপতি' : 'Principal / President'}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
