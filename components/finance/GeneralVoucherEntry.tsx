import React, { useState } from 'react';
import { 
  PlusCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Printer, 
  FileText, 
  Layers, 
  CheckCircle2, 
  HelpCircle 
} from 'lucide-react';
import { 
  FinanceTransaction, 
  FundType, 
  TransactionType, 
  IncomeCategory, 
  ExpenseCategory 
} from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { FUND_METAS } from './types';
import { Button } from '../ui/Button';

interface GeneralVoucherEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const GeneralVoucherEntry: React.FC<GeneralVoucherEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [fundType, setFundType] = useState<FundType>('GENERAL');
  const [category, setCategory] = useState<string>('BOARDING_MESS');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [amount, setAmount] = useState<number>(1000);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [payerOrPayee, setPayerOrPayee] = useState<string>('');
  const [contactNo, setContactNo] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [collectedBy, setCollectedBy] = useState<string>('হিসাবরক্ষক');

  const incomeCategoriesList: { value: IncomeCategory; label: string }[] = [
    { value: 'GENERAL_DONATION', label: 'সাধারণ দান ও অনুদান' },
    { value: 'ZAKAT_FITRA', label: 'যাকাত ও ফিতরা ফান্ড' },
    { value: 'MONTHLY_DONOR', label: 'দাতা সদস্য মাসিক চাঁদা' },
    { value: 'QURBANI_LEATHER', label: 'কোরবানির চামড়া বাবদ দান' },
    { value: 'BUILDING_CONSTRUCTION', label: 'মসজিদ ও ভবন নির্মাণ অনুদান' },
    { value: 'ORPHAN_SPONSOR', label: 'এতিম ও লিল্লাহ বোর্ডিং দান' },
    { value: 'PROPERTY_RENT', label: 'দোকান ও জমি ভাড়া বাবদ আয়' },
    { value: 'MAHFIL_COLLECTION', label: 'বার্ষিক মাহফিল ও জলসা ফান্ড' },
    { value: 'GOV_GRANT', label: 'সরকারি অনুদান' },
    { value: 'BOOK_STATIONERY', label: 'কিতাব ও খাতা বিক্রয় আয়' },
    { value: 'MISC_INCOME', label: 'বিবিধ আয়' },
    { value: 'OTHER_INCOME', label: 'অন্যান্য বিশেষ আয়' },
  ];

  const expenseCategoriesList: { value: ExpenseCategory; label: string }[] = [
    { value: 'BOARDING_MESS', label: 'বোর্ডিং ও মেস বাজার খরচ (চাল, ডাল, তেল)' },
    { value: 'UTILITY_BILL', label: 'বিদ্যুৎ, গ্যাস ও পানির বিল' },
    { value: 'BOOKS_LIBRARY', label: 'কিতাব ও পাঠাগার সংক্রান্ত ব্যয়' },
    { value: 'EXAM_EXPENSE', label: 'পরীক্ষার প্রশ্নপত্র ও খাতা খরচ' },
    { value: 'MAHFIL_EXPENSE', label: 'বার্ষিক ওয়াজ ও মাহফিল খরচ' },
    { value: 'HOSPITALITY', label: 'মেহমানদারি ও বিশেষ আপ্যায়ন' },
    { value: 'MEDICAL_STUDENT', label: 'অসচ্ছল শিক্ষার্থীদের চিকিৎসা ও ওষুধ' },
    { value: 'OFFICE_STATIONERY', label: 'স্টেশনারি ও অফিস সরঞ্জাম' },
    { value: 'CONVEYANCE', label: 'যাতায়াত ও যাতায়াত ভাড়া' },
    { value: 'INTERNET_COMM', label: 'ইন্টারনেট, মোবাইল ও যোগাযোগ' },
    { value: 'MISC_EXPENSE', label: 'বিবিধ খরচ' },
    { value: 'OTHER_EXPENSE', label: 'অন্যান্য খরচ' },
  ];

  const handleTypeChange = (type: TransactionType) => {
    setTxType(type);
    if (type === 'INCOME') {
      setCategory('GENERAL_DONATION');
    } else {
      setCategory('BOARDING_MESS');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerOrPayee.trim()) {
      alert(isBn ? (txType === 'INCOME' ? 'দয়া করে দানকারী/দাতার নাম দিন!' : 'দয়া করে প্রাপক/দোকানের নাম দিন!') : 'Please enter person/vendor name!');
      return;
    }
    if (!amount || amount <= 0) {
      alert(isBn ? 'টাকার পরিমাণ সঠিক নয়!' : 'Please enter a valid amount!');
      return;
    }

    const nextVoucher = generateVoucherNo(txType, transactions);
    const catObj = txType === 'INCOME' 
      ? incomeCategoriesList.find(c => c.value === category)
      : expenseCategoriesList.find(c => c.value === category);

    const catName = customCategoryName.trim() || catObj?.label || category;

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: txType,
      category,
      categoryName: catName,
      fundType,
      amount: Number(amount),
      date,
      paymentMethod,
      referenceNo,
      payerOrPayee,
      contactNo,
      description: description || `${catName} বাবদ লেনদেন`,
      collectedBy,
    };

    const created = onAddTransaction(newTx);
    showToast(isBn ? `ভাউচার নং ${nextVoucher} সফলভাবে সংরক্ষিত হয়েছে!` : `Voucher ${nextVoucher} created!`);
    onShowReceipt(created);

    // Reset Form
    setPayerOrPayee('');
    setContactNo('');
    setReferenceNo('');
    setDescription('');
    setCustomCategoryName('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txType === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {txType === 'INCOME' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isBn ? 'সাধারণ ও অন্যান্য খাতের আয়/ব্যয় ভাউচার' : 'General Voucher Entry (All Categories)'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isBn ? 'মেস বাজার, বিদ্যুৎ বিল, স্টেশনারি ও বিবিধ খরচের পূর্ণাঙ্গ ভাউচার এন্ট্রি' : 'Comprehensive ledger entry for all general income and operational expenses'}
            </p>
          </div>
        </div>

        {/* Type Toggle */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => handleTypeChange('INCOME')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              txType === 'INCOME' 
                ? 'bg-emerald-600 text-white shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>{isBn ? 'জমা / আয় (Income)' : 'Income'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('EXPENSE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              txType === 'EXPENSE' 
                ? 'bg-rose-600 text-white shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{isBn ? 'খরচ / ব্যয় (Expense)' : 'Expense'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Fund & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'তহবিল নির্বাচন করুন *' : 'Target Fund *'}
            </label>
            <select
              value={fundType}
              onChange={(e) => setFundType(e.target.value as FundType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {(Object.keys(FUND_METAS) as FundType[]).map(f => (
                <option key={f} value={f}>
                  {isBn ? FUND_METAS[f].nameBn : FUND_METAS[f].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'আয়/ব্যয়ের নির্দিষ্ট খাত *' : 'Category / Head *'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {txType === 'INCOME' ? (
                incomeCategoriesList.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))
              ) : (
                expenseCategoriesList.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Row 2: Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'টাকার পরিমাণ *' : 'Amount (BDT) *'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-base text-slate-900 font-black font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'তারিখ *' : 'Date *'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Row 3: Payer/Payee & Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {txType === 'INCOME' 
                ? (isBn ? 'কার কাছ থেকে গ্রহণ করা হলো (দাতার নাম) *' : 'Received From (Payer Name) *') 
                : (isBn ? 'কাকে পরিশোধ করা হলো (দোকান / প্রাপকের নাম) *' : 'Paid To (Payee / Vendor Name) *')}
            </label>
            <input
              type="text"
              value={payerOrPayee}
              onChange={(e) => setPayerOrPayee(e.target.value)}
              placeholder={isBn ? (txType === 'INCOME' ? 'দাতার নাম' : 'দোকান বা ব্যক্তির নাম') : 'Name'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
            </label>
            <input
              type="text"
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Row 4: Method, Reference, Collector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
              <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
              <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
              <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'}</option>
              <option value="CHEQUE">{isBn ? 'চেক (Cheque)' : 'Cheque'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'মেমো / চেক / ট্রানজেকশন নং' : 'Memo / TrxID / Cheque'}
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'আদায়কারী / হিসাবরক্ষক' : 'Officer / Cashier'}
            </label>
            <input
              type="text"
              value={collectedBy}
              onChange={(e) => setCollectedBy(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {isBn ? 'বিস্তারিত বিবরণ ও মন্তব্য' : 'Description / Remarks'}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isBn ? 'যেমন: মেসের ৫০ কেজি মিনিকেট চাল ক্রয়' : 'Details'}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <Button
            type="submit"
            size="md"
            variant="primary"
            className={`${txType === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white px-8 font-bold text-xs`}
          >
            <Printer className="w-4 h-4 mr-2" />
            {isBn ? 'ভাউচার সেভ করুন ও প্রিন্ট' : 'Save & Print Voucher'}
          </Button>
        </div>
      </form>
    </div>
  );
};
