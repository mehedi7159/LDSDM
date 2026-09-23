import React, { useRef } from 'react';
import { Printer, X, CheckCircle2, Building, ShieldCheck } from 'lucide-react';
import { FinanceTransaction } from '../../types';
import { formatBanglaNumber, amountToBengaliWords } from '../../services/utils';
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
  const printStageRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const fundInfo = FUND_METAS[transaction.fundType] || FUND_METAS.GENERAL;
  const isIncome = transaction.type === 'INCOME';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Modal Toolbar (hidden on print) */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isIncome 
                  ? (isBn ? 'মানি রসিদ (আদায় রসিদ)' : 'Money Receipt') 
                  : (isBn ? 'ডেবিট ভাউচার (খরচ রসিদ)' : 'Debit Voucher')}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono font-medium">
                {transaction.voucherNo} • {transaction.date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handlePrint}
              size="sm" 
              variant="primary" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              {isBn ? 'প্রিন্ট রসিদ' : 'Print Receipt'}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DUAL-COPY VOUCHER */}
        <div ref={printStageRef} className="p-5 sm:p-6 space-y-5 text-slate-900 print:p-0 print:space-y-4">
          
          {/* COPY 1: CUSTOMER / STUDENT COPY */}
          <div className="border-2 border-emerald-900/80 rounded-xl p-4 sm:p-5 relative overflow-hidden bg-emerald-50/20">
            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none text-5xl sm:text-6xl font-black text-emerald-950 uppercase">
              {schoolProfile.nameBn || 'MADRASAH'}
            </div>

            {/* Top Bismillah & Copy Badge */}
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 border-b border-emerald-900/30 pb-1 mb-2">
              <span>{isBn ? 'বিসমিল্লাহির রাহমানির রাহিম' : 'Bismillahir Rahmanir Rahim'}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-800 text-white text-[10px] font-bold">
                {isIncome ? (isBn ? 'গ্রাহক / ছাত্র কপি' : 'Student / Payer Copy') : (isBn ? 'অফিস ভাউচার' : 'Office Voucher')}
              </span>
            </div>

            {/* Madrasah Header */}
            <div className="text-center space-y-0.5 mb-3">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {schoolProfile.nameBn || schoolProfile.name}
              </h2>
              <p className="text-[11px] text-slate-600">{schoolProfile.address}</p>
              <div className="inline-block border border-slate-800 bg-white/80 px-3 py-0.5 rounded-full text-xs font-bold text-slate-900 mt-1">
                {isIncome 
                  ? (isBn ? 'মানি রসিদ (আদায় রশিদ)' : 'MONEY RECEIPT') 
                  : (isBn ? 'খরচ ভাউচার (DEBIT VOUCHER)' : 'DEBIT VOUCHER')}
              </div>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-3 gap-2 text-xs py-1.5 border-y border-dashed border-slate-300 font-medium mb-3">
              <div>
                <span className="text-slate-500">{isBn ? 'রসিদ নং: ' : 'Voucher: '}</span>
                <span className="font-bold text-slate-900 font-mono">{transaction.voucherNo}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500">{isBn ? 'তহবিল: ' : 'Fund: '}</span>
                <span className="font-bold text-emerald-800">{isBn ? fundInfo.nameBn : fundInfo.name}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">{isBn ? 'তারিখ: ' : 'Date: '}</span>
                <span className="font-bold text-slate-900">{transaction.date}</span>
              </div>
            </div>

            {/* Content Details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="text-slate-600 font-semibold min-w-[95px]">
                  {isIncome ? (isBn ? 'নাম / ছাত্রের নাম:' : 'Payer / Student:') : (isBn ? 'প্রাপকের নাম:' : 'Payee Name:')}
                </span>
                <span className="font-bold text-slate-900 flex-1 border-b border-dotted border-slate-400 pb-0.5">
                  {transaction.studentNameBn || transaction.studentName || transaction.payerOrPayee}
                  {transaction.classLevel && <span className="ml-2 font-normal text-slate-600">[{transaction.classLevel}]</span>}
                  {transaction.studentCode && <span className="ml-2 font-normal text-slate-600">(আইডি: {transaction.studentCode})</span>}
                </span>
              </div>

              {transaction.feeBreakdown && transaction.feeBreakdown.length > 0 ? (
                <div className="mt-2 bg-white/80 rounded border border-slate-200 p-2 text-xs">
                  <div className="font-bold text-slate-700 mb-1">{isBn ? 'আদায়কৃত ফি এর বিবরণ:' : 'Fee Breakdown:'}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {transaction.feeBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between border-b border-slate-100 py-0.5">
                        <span>{isBn ? item.nameBn : item.name}:</span>
                        <span className="font-bold font-mono">৳{isBn ? formatBanglaNumber(item.amount) : item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 font-semibold min-w-[95px]">
                    {isBn ? 'বাবদ / উদ্দেশ্য:' : 'Purpose / Head:'}
                  </span>
                  <span className="text-slate-800 flex-1 border-b border-dotted border-slate-400 pb-0.5">
                    {transaction.categoryName || transaction.category} {transaction.description ? `— ${transaction.description}` : ''}
                  </span>
                </div>
              )}

              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-slate-600 font-semibold min-w-[95px]">
                  {isBn ? 'টাকার পরিমাণ:' : 'In Words:'}
                </span>
                <span className="font-bold text-emerald-900 flex-1 border-b border-dotted border-slate-400 pb-0.5">
                  {amountToBengaliWords(transaction.amount)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-600 font-medium">
                  <span>পরিশোধ মাধ্যম: </span>
                  <span className="font-bold text-slate-900">{transaction.paymentMethod}</span>
                  {transaction.referenceNo && <span className="ml-2 font-mono text-[11px]">(Ref: {transaction.referenceNo})</span>}
                </div>

                <div className="text-base font-black text-slate-900 bg-emerald-100/90 px-4 py-1 rounded-lg border border-emerald-300">
                  ৳ {isBn ? formatBanglaNumber(transaction.amount) : transaction.amount.toLocaleString()} /-
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 mt-4 text-[11px] text-center font-bold text-slate-700">
              <div>
                <div className="border-t border-slate-700 w-36 mx-auto pt-1">
                  {isBn ? 'আদায়কারী / হিসাবরক্ষক' : 'Accountant'}
                </div>
              </div>
              <div>
                <div className="border-t border-slate-700 w-36 mx-auto pt-1">
                  {isBn ? 'মুহতামিম / সুপারিনটেনডেন্ট' : 'Superintendent / Principal'}
                </div>
              </div>
            </div>
          </div>

          {/* Perforated Cut Line for Print */}
          <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold">
            <span className="border-t border-dashed border-slate-300 flex-1"></span>
            <span>✂ {isBn ? 'কাটার দাগ (অফিস ও গ্রাহক কপি পৃথকীকরণ)' : 'Cut here (Office Copy Below)'}</span>
            <span className="border-t border-dashed border-slate-300 flex-1"></span>
          </div>

          {/* COPY 2: OFFICE COPY */}
          <div className="border-2 border-slate-700 rounded-xl p-4 sm:p-5 relative overflow-hidden bg-slate-50/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 border-b border-slate-300 pb-1 mb-2">
              <span>{isBn ? 'বিসমিল্লাহির রাহমানির রাহিম' : 'Bismillahir Rahmanir Rahim'}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold">
                {isBn ? 'মাদ্রাসা অফিস কপি' : 'Madrasah Office Copy'}
              </span>
            </div>

            {/* Header */}
            <div className="text-center space-y-0.5 mb-2">
              <h3 className="text-base font-bold text-slate-900">
                {schoolProfile.nameBn || schoolProfile.name}
              </h3>
              <p className="text-[10px] text-slate-500">{schoolProfile.address}</p>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-3 gap-2 text-xs py-1 border-y border-dashed border-slate-300 font-medium mb-2">
              <div>
                <span className="text-slate-500">{isBn ? 'রসিদ নং: ' : 'Voucher: '}</span>
                <span className="font-bold text-slate-900 font-mono">{transaction.voucherNo}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500">{isBn ? 'তহবিল: ' : 'Fund: '}</span>
                <span className="font-bold text-slate-800">{isBn ? fundInfo.nameBn : fundInfo.name}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">{isBn ? 'তারিখ: ' : 'Date: '}</span>
                <span className="font-bold text-slate-900">{transaction.date}</span>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
                <span className="text-slate-600 font-semibold">{isBn ? 'নাম / ছাত্র:' : 'Name / Student:'}</span>
                <span className="font-bold text-slate-900">
                  {transaction.studentNameBn || transaction.studentName || transaction.payerOrPayee}
                  {transaction.classLevel && ` (${transaction.classLevel})`}
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
                <span className="text-slate-600 font-semibold">{isBn ? 'বাবদ:' : 'Purpose:'}</span>
                <span className="text-slate-800">{transaction.categoryName || transaction.category}</span>
              </div>

              <div className="flex justify-between items-baseline pt-1">
                <span className="text-slate-600 font-semibold">{isBn ? 'মোট টাকা:' : 'Total Amount:'}</span>
                <span className="text-sm font-black text-slate-900 bg-slate-200/90 px-3 py-0.5 rounded font-mono">
                  ৳ {isBn ? formatBanglaNumber(transaction.amount) : transaction.amount.toLocaleString()} /-
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 mt-3 text-[10px] text-center font-bold text-slate-700">
              <div>
                <div className="border-t border-slate-500 w-32 mx-auto pt-1">
                  {isBn ? 'আদায়কারী' : 'Received By'}
                </div>
              </div>
              <div>
                <div className="border-t border-slate-500 w-32 mx-auto pt-1">
                  {isBn ? 'অডিট / মুহতামিম' : 'Verified By'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
