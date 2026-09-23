import React, { useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  ShieldCheck, 
  Download, 
  Loader2, 
  FileText, 
  Sparkles,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  CreditCard
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FinanceTransaction } from '../../types';
import { formatBanglaNumber, amountToBengaliWords, amountToEnglishWords } from '../../services/utils';
import { FUND_METAS } from './types';
import { Button } from '../ui/Button';

interface VoucherPrintModalProps {
  transaction: FinanceTransaction;
  schoolProfile: {
    name: string;
    nameBn?: string;
    address: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
    headMasterName?: string;
    headMasterNameBn?: string;
  };
  language: 'en' | 'bn';
  onClose: () => void;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({
  transaction,
  schoolProfile,
  language,
  onClose,
}) => {
  const isBn = language === 'bn';
  const printContentRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const fundInfo = FUND_METAS[transaction.fundType] || FUND_METAS.GENERAL;
  const isIncome = transaction.type === 'INCOME';

  const titleBn = isIncome ? 'মানি রসিদ (আদায় ও জমা)' : 'ডেবিট ভাউচার (খরচ ও প্রদান)';
  const titleEn = isIncome ? 'MONEY RECEIPT (INCOME)' : 'DEBIT VOUCHER (EXPENSE)';

  // Native Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Direct PDF Download Handler
  const handleDownloadPdf = async () => {
    if (!printContentRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);

    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-9999px';
    stage.style.top = '-9999px';
    stage.style.width = '794px'; // Standard A4 width in px at 96 DPI
    stage.style.backgroundColor = '#ffffff';
    stage.style.zIndex = '-1000';
    document.body.appendChild(stage);

    try {
      // Clone the printable voucher content
      const clone = printContentRef.current.cloneNode(true) as HTMLElement;
      clone.style.width = '794px';
      clone.style.margin = '0';
      clone.style.padding = '20px 24px';
      clone.style.backgroundColor = '#ffffff';
      clone.style.boxSizing = 'border-box';

      // Remove shadows that can create artifacts on canvas
      clone.querySelectorAll('*').forEach((el: any) => {
        if (el.style) {
          el.style.boxShadow = 'none';
          if (el.style.outline) el.style.outline = 'none';
        }
        el.classList.remove('shadow-2xl', 'shadow-xl', 'shadow-lg', 'shadow-md', 'shadow-sm', 'shadow');
      });

      stage.appendChild(clone);

      // Wait a tick for fonts/layout to settle
      await new Promise(resolve => setTimeout(resolve, 80));

      const canvas = await html2canvas(clone, {
        scale: 2.2, // ~210 DPI for crisp typography
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

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(297, pdfHeight));

      const safeName = (transaction.studentName || transaction.studentNameBn || transaction.payerOrPayee || 'Voucher')
        .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
      const filename = `${isIncome ? 'MoneyReceipt' : 'DebitVoucher'}_${transaction.voucherNo}_${safeName}.pdf`;

      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation error, falling back to window.print():', err);
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
      
      {/* Modal Container */}
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:w-full">
        
        {/* Modal Toolbar (Strictly hidden during print) */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs print:hidden gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{isBn ? titleBn : titleEn}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {transaction.voucherNo}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? 'স্বয়ংক্রিয় ২-কপি প্রিন্ট ও হাই-কোয়ালিটি পিডিএফ' : 'Dual-copy print & crisp vector PDF'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span>{isBn ? 'প্রিন্ট রসিদ' : 'Print Voucher'}</span>
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
              title={isBn ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================================================== */}
        {/* PRINTABLE DUAL-COPY VOUCHER (Wrapped in print-container) */}
        {/* ==================================================== */}
        <div className="print-container bg-white">
          <div 
            ref={printContentRef} 
            className="p-4 sm:p-6 space-y-4 text-slate-900 bg-white max-w-[800px] mx-auto print:p-2 print:space-y-3 print:max-w-none"
          >

            {/* ============================================== */}
            {/* COPY 1: CUSTOMER / STUDENT COPY (গ্রাহক কপি) */}
            {/* ============================================== */}
            <div className={`rounded-xl p-4 sm:p-5 relative overflow-hidden border-2 bg-white ${
              isIncome ? 'border-emerald-800' : 'border-slate-800'
            }`}>
              
              {/* Subtle Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none text-4xl sm:text-5xl font-black text-slate-900 uppercase">
                {schoolProfile.nameBn || schoolProfile.name}
              </div>

              {/* Bismillah & Copy Identifier */}
              <div className="flex items-center justify-between text-[11px] font-bold border-b border-slate-300 pb-1.5 mb-2.5">
                <span className="font-serif tracking-wider text-slate-700">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase text-white ${
                  isIncome ? 'bg-emerald-800' : 'bg-slate-800'
                }`}>
                  {isIncome ? (isBn ? 'গ্রাহক / ছাত্র কপি (Student Copy)' : 'STUDENT / PAYER COPY') : (isBn ? 'অফিস ভাউচার (Office Copy)' : 'OFFICE VOUCHER')}
                </span>
              </div>

              {/* Madrasah Header */}
              <div className="text-center mb-3">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {schoolProfile.nameBn || schoolProfile.name}
                </h2>
                <p className="text-[11px] text-slate-600 font-medium">
                  {schoolProfile.address}
                  {schoolProfile.phone && ` • মোবা: ${schoolProfile.phone}`}
                </p>
                <div className="inline-block mt-1 px-3.5 py-0.5 rounded-full border border-slate-900 text-xs font-black bg-slate-50 text-slate-900 uppercase tracking-wide">
                  {isIncome ? (isBn ? 'মানি রসিদ (আদায় ও জমা)' : 'MONEY RECEIPT') : (isBn ? 'ডেবিট ভাউচার (খরচ রসিদ)' : 'DEBIT VOUCHER')}
                </div>
              </div>

              {/* Meta Details Row */}
              <div className="grid grid-cols-3 gap-2 text-xs py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-200 font-medium mb-3">
                <div>
                  <span className="text-slate-500">{isBn ? 'ভাউচার নং: ' : 'Voucher No: '}</span>
                  <span className="font-bold text-slate-900 font-mono">{transaction.voucherNo}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-500">{isBn ? 'তহবিল: ' : 'Fund: '}</span>
                  <span className={`font-bold ${fundInfo.color}`}>{isBn ? fundInfo.nameBn : fundInfo.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">{isBn ? 'তারিখ: ' : 'Date: '}</span>
                  <span className="font-bold text-slate-900 font-mono">{transaction.date}</span>
                </div>
              </div>

              {/* Body Details */}
              <div className="space-y-2 text-xs">
                {/* Person / Student Name */}
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 font-semibold min-w-[105px]">
                    {isIncome ? (isBn ? 'নাম / ছাত্রের নাম:' : 'Payer / Student:') : (isBn ? 'প্রাপক / সুবিধাভোগী:' : 'Payee Name:')}
                  </span>
                  <div className="flex-1 font-bold text-slate-900 border-b border-dotted border-slate-400 pb-0.5">
                    <span>{transaction.studentNameBn || transaction.studentName || transaction.payerOrPayee}</span>
                    {transaction.classLevel && (
                      <span className="ml-2 px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded text-[11px] font-semibold border border-blue-200">
                        {isBn ? `শ্রেণি: ${transaction.classLevel}` : `Class: ${transaction.classLevel}`}
                      </span>
                    )}
                    {transaction.studentCode && (
                      <span className="ml-2 text-slate-500 font-mono text-[11px]">
                        (ID: {transaction.studentCode})
                      </span>
                    )}
                    {transaction.contactNo && (
                      <span className="ml-2 text-slate-600 font-mono text-[11px]">
                        📞 {transaction.contactNo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fee Breakdown (If Available) */}
                {transaction.feeBreakdown && transaction.feeBreakdown.length > 0 ? (
                  <div className="mt-2 bg-slate-50/80 rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="font-bold text-slate-800 mb-1 flex items-center justify-between border-b border-slate-200 pb-1">
                      <span>{isBn ? 'আদায়কৃত ফি সমূহের বিস্তারিত বিভাজন:' : 'Fee Breakdown Details:'}</span>
                      {transaction.feeMonth && (
                        <span className="text-[11px] text-blue-700 font-semibold">
                          {isBn ? `বেতন মাস: ${transaction.feeMonth}` : `Month: ${transaction.feeMonth}`}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                      {transaction.feeBreakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between border-b border-slate-100 py-0.5">
                          <span className="text-slate-700">{isBn ? item.nameBn : item.name}:</span>
                          <span className="font-bold font-mono text-slate-900">৳ {isBn ? formatBanglaNumber(item.amount) : item.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-600 font-semibold min-w-[105px]">
                      {isBn ? 'খাত ও বিবরণ:' : 'Purpose / Head:'}
                    </span>
                    <span className="text-slate-800 flex-1 border-b border-dotted border-slate-400 pb-0.5">
                      <strong className="text-slate-900">{transaction.categoryName || transaction.category}</strong>
                      {transaction.description ? ` — ${transaction.description}` : ''}
                    </span>
                  </div>
                )}

                {/* In Words */}
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-slate-600 font-semibold min-w-[105px]">
                    {isBn ? 'কথায় (In Words):' : 'Amount in Words:'}
                  </span>
                  <span className="font-bold text-emerald-900 flex-1 border-b border-dotted border-slate-400 pb-0.5 italic">
                    {amountToBengaliWords(transaction.amount)}
                  </span>
                </div>

                {/* Payment Method & Total Amount Box */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-600 font-medium">
                    <span>{isBn ? 'পরিশোধ মাধ্যম: ' : 'Payment Mode: '}</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {transaction.paymentMethod}
                    </span>
                    {transaction.referenceNo && (
                      <span className="ml-2 font-mono text-[11px] text-slate-500">
                        (Ref/Trx: {transaction.referenceNo})
                      </span>
                    )}
                  </div>

                  <div className={`text-base sm:text-lg font-black font-mono px-4 py-1 rounded-xl border flex items-baseline gap-1 ${
                    isIncome 
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                      : 'bg-rose-50 text-rose-900 border-rose-300'
                  }`}>
                    <span>৳</span>
                    <span>{isBn ? formatBanglaNumber(transaction.amount) : transaction.amount.toLocaleString()}</span>
                    <span className="text-xs font-serif ml-0.5 font-bold">/-</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-10 pt-7 mt-3 text-[11px] text-center font-bold text-slate-700">
                <div>
                  <div className="border-t border-slate-600 w-36 mx-auto pt-1">
                    {isBn ? 'আদায়কারী / হিসাবরক্ষক' : 'Received By / Cashier'}
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-600 w-36 mx-auto pt-1">
                    {isBn ? 'মুহতামিম / অধ্যক্ষ' : 'Principal / Superintendent'}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================== */}
            {/* PERFORATED CUT LINE (কাটার দাগ) */}
            {/* ============================================== */}
            <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold py-1 select-none">
              <span className="border-t border-dashed border-slate-400 flex-1"></span>
              <span className="bg-white px-2 text-slate-500">
                ✂ {isBn ? 'কাটার দাগ (অফিস ও গ্রাহক কপি পৃথকীকরণ)' : 'Cut here (Office Copy Below)'} ✂
              </span>
              <span className="border-t border-dashed border-slate-400 flex-1"></span>
            </div>

            {/* ============================================== */}
            {/* COPY 2: MADRASAH OFFICE COPY (মাদ্রাসা অফিস কপি) */}
            {/* ============================================== */}
            <div className="rounded-xl p-4 sm:p-5 relative overflow-hidden border-2 border-slate-700 bg-slate-50/40">
              
              {/* Header */}
              <div className="flex items-center justify-between text-[11px] font-bold border-b border-slate-300 pb-1 mb-2">
                <span className="font-serif text-slate-700">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold uppercase">
                  {isBn ? 'মাদ্রাসা অফিস কপি (Madrasah Office Record)' : 'MADRASAH OFFICE COPY'}
                </span>
              </div>

              <div className="text-center mb-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {schoolProfile.nameBn || schoolProfile.name}
                </h3>
                <p className="text-[10px] text-slate-500">{schoolProfile.address}</p>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-3 gap-2 text-xs py-1 px-2 bg-white rounded border border-slate-200 font-medium mb-2">
                <div>
                  <span className="text-slate-500">{isBn ? 'ভাউচার নং: ' : 'Voucher: '}</span>
                  <span className="font-bold text-slate-900 font-mono">{transaction.voucherNo}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-500">{isBn ? 'তহবিল: ' : 'Fund: '}</span>
                  <span className="font-bold text-slate-800">{isBn ? fundInfo.nameBn : fundInfo.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">{isBn ? 'তারিখ: ' : 'Date: '}</span>
                  <span className="font-bold text-slate-900 font-mono">{transaction.date}</span>
                </div>
              </div>

              {/* Content Rows */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
                  <span className="text-slate-600 font-semibold">{isBn ? 'নাম / ছাত্র:' : 'Name / Student:'}</span>
                  <span className="font-bold text-slate-900">
                    {transaction.studentNameBn || transaction.studentName || transaction.payerOrPayee}
                    {transaction.classLevel && ` [${transaction.classLevel}]`}
                    {transaction.studentCode && ` (ID: ${transaction.studentCode})`}
                  </span>
                </div>

                <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
                  <span className="text-slate-600 font-semibold">{isBn ? 'বাবদ / উদ্দেশ্য:' : 'Purpose:'}</span>
                  <span className="text-slate-800 font-medium">
                    {transaction.categoryName || transaction.category} {transaction.description ? `(${transaction.description})` : ''}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <div className="text-[11px] text-slate-600">
                    <span>{isBn ? 'মাধ্যম: ' : 'Method: '}</span>
                    <span className="font-bold text-slate-800">{transaction.paymentMethod}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-600 font-bold">{isBn ? 'মোট টাকা:' : 'Total:'}</span>
                    <span className="text-sm sm:text-base font-black text-slate-900 bg-white border border-slate-300 px-3 py-0.5 rounded-lg font-mono">
                      ৳ {isBn ? formatBanglaNumber(transaction.amount) : transaction.amount.toLocaleString()} /-
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-5 mt-2 text-[10px] text-center font-bold text-slate-700">
                <div>
                  <div className="border-t border-slate-500 w-32 mx-auto pt-1">
                    {isBn ? 'আদায়কারী' : 'Received By'}
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-500 w-32 mx-auto pt-1">
                    {isBn ? 'অডিট / হিসাবরক্ষক' : 'Audited By'}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
