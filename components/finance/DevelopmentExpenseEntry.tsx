import React, { useState } from 'react';
import { 
  Building2, 
  Sparkles, 
  Printer, 
  Wrench, 
  Hammer, 
  Truck, 
  ShieldCheck, 
  FileText,
  User
} from 'lucide-react';
import { FinanceTransaction } from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { Button } from '../ui/Button';

interface DevelopmentExpenseEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const DevelopmentExpenseEntry: React.FC<DevelopmentExpenseEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [projectHead, setProjectHead] = useState<string>('মসজিদ ও ভবন নির্মাণ (রড, সিমেন্ট, ইট)');
  const [payeeName, setPayeeName] = useState<string>('');
  const [payeePhone, setPayeePhone] = useState<string>('');
  const [memoNo, setMemoNo] = useState<string>('');
  const [amount, setAmount] = useState<number>(5000);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [description, setDescription] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('নির্মাণ কমিটি / মুহতামিম');

  const developmentProjects = [
    'মসজিদ ও ভবন নির্মাণ (রড, সিমেন্ট, ইট)',
    'রাজমিস্ত্রি ও নির্মাণ শ্রমিকদের দৈনিক/চুক্তি মজুরি',
    'ফ্লোর টাইলস, মার্বেল ও প্লাস্টারিং কাজ',
    'ইলেকট্রিক ওয়্যারিং, ফ্যান ও লাইটিং কাজ',
    'প্লাম্বিং, পানির পাম্প ও স্যানিটারি ফিটিংস',
    'রঙ, পেইন্টিং ও ডেকোরেশন কাজ',
    'কাঠ, দরজা-জানালা ও গ্রিল ফিটিংস',
    'ছাদ ঢালাই ও সেন্টারিং সরঞ্জাম ভাড়া',
    'মাদ্রাসার সার্বিক মেরামত ও সংস্কার কাজ'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeName.trim()) {
      showToast(isBn ? 'দয়া করে সরবরাহকারী / মিস্ত্রি / প্রাপকের নাম লিখুন!' : 'Please enter payee/contractor name!');
      return;
    }
    if (!amount || amount <= 0) {
      showToast(isBn ? 'খরচের পরিমাণ সঠিক নয়!' : 'Please enter a valid amount!');
      return;
    }

    const nextVoucher = generateVoucherNo('EXPENSE', transactions);

    const desc = `${projectHead} বাবদ ব্যয় ${memoNo ? `(মেমো নং: ${memoNo})` : ''} ${description ? `— ${description}` : ''}`;

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'EXPENSE',
      category: 'BUILDING_CONSTRUCTION',
      categoryName: isBn ? 'মাদ্রাসা উন্নয়ন ও নির্মাণ ব্যয়' : 'Madrasah Development & Construction',
      fundType: 'DEVELOPMENT',
      amount: Number(amount),
      date,
      paymentMethod,
      referenceNo: memoNo,
      payerOrPayee: payeeName,
      contactNo: payeePhone,
      description: desc,
      collectedBy: approvedBy,
    };

    const created = onAddTransaction(newTx);
    showToast(isBn ? `উন্নয়ন ভাউচার নং ${nextVoucher} সফলভাবে জমা হয়েছে!` : `Development voucher ${nextVoucher} created!`);
    onShowReceipt(created);

    // Reset Form
    setPayeeName('');
    setPayeePhone('');
    setMemoNo('');
    setDescription('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Form (8 Cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isBn ? 'মাদ্রাসা উন্নয়ন, নির্মাণ ও সংস্কার ব্যয়' : 'Madrasah Development & Construction'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? 'ভবন নির্মাণ সামগ্রী, মিস্ত্রি মজুরি ও সংস্কার খরচের ডেবিট ভাউচার' : 'Record building, hardware, renovation and contractor fees'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Head Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'উন্নয়ন কাজের সুনির্দিষ্ট খাত *' : 'Development Work Category *'}
            </label>
            <select
              value={projectHead}
              onChange={(e) => setProjectHead(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {developmentProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'খরচের পরিমাণ (টাকা) *' : 'Amount (BDT) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
                <input
                  type="number"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-base text-slate-900 font-black font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'খরচের তারিখ *' : 'Date *'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Payee / Vendor & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'সরবরাহকারী প্রতিষ্ঠান / ঠিকাদার / মিস্ত্রির নাম *' : 'Vendor / Contractor / Mason Name *'}
              </label>
              <input
                type="text"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder={isBn ? 'যেমন: মেসার্স রহিম স্টিল / মোজাম্মেল রাজমিস্ত্রি' : 'e.g. Rahim Steel / Mason Leader'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
              </label>
              <input
                type="text"
                value={payeePhone}
                onChange={(e) => setPayeePhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Memo No, Payment Method, Approval */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'দোকানের ক্যাশ মেমো / চালান নং' : 'Challan / Memo No'}
              </label>
              <input
                type="text"
                value={memoNo}
                onChange={(e) => setMemoNo(e.target.value)}
                placeholder={isBn ? 'যেমন: মেমো-৪৫২১' : 'e.g. Memo #452'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক হিসাব' : 'Bank Transfer'}</option>
                <option value="CHEQUE">{isBn ? 'চেক (Cheque)' : 'Cheque'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'অনুমোদনকারী / কমিটি' : 'Approved By'}
              </label>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'কাজের বিস্তারিত বিবরণ ও মালপত্রের তালিকা' : 'Material & Work Description'}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isBn ? 'যেমন: নিচতলার বারান্দার জন্য ১০ বস্তা সিমেন্ট ও ৫০০ পিস ইট ক্রয়' : 'Details'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <Button
              type="submit"
              size="md"
              variant="primary"
              className="bg-amber-600 hover:bg-amber-700 text-white px-8 font-bold text-xs"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isBn ? 'খরচ ভাউচার তৈরি ও প্রিন্ট' : 'Create & Print Debit Voucher'}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Column (4 Cols): Info Box */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-gradient-to-br from-amber-700 to-amber-900 text-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-300" />
            {isBn ? 'উন্নয়ন ও নির্মাণ তহবিল' : 'Development Fund Tracking'}
          </h3>

          <p className="mt-3 text-xs text-amber-100/90 leading-relaxed">
            {isBn 
              ? 'মাদ্রাসার নতুন ভবন নির্মাণ, মসজিদ সম্প্রসারণ ও সংস্কারের খরচের হিসাব সম্পূর্ণ সুরক্ষিত থাকে।' 
              : 'Dedicated development accounting ensures every brick, bag of cement and mason payment is audited.'}
          </p>

          <div className="mt-4 pt-3 border-t border-amber-600/80 space-y-2 text-xs">
            <div className="flex justify-between">
              <span>{isBn ? 'তহবিল লিংক:' : 'Fund Link:'}</span>
              <span className="font-bold text-white">উন্নয়ন তহবিল (Development)</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'ভাউচার ফরম্যাট:' : 'Voucher:'}</span>
              <span className="font-mono font-bold text-amber-200">DV-YYYY-XXXX</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
