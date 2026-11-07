import React, { useState, useRef } from 'react';
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
import { feeCloudFailureMessage, FEE_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';
import { FUND_METAS } from './types';
import { Button } from '../ui/Button';

interface GeneralVoucherEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  // 7 Nov 2026 Job 4 (optimistic save, Job 1 salary template): the
  // confirm runs in the BACKGROUND — the local voucher applies and the
  // receipt opens at once, marked local-only until the confirm lands.
  // A local-only voucher must never print as if it reached the cloud.
  // This is confirmFeeCloudSync from context (raw error text).
  onConfirmTransactions: (next: FinanceTransaction[], failureMessage?: string) => Promise<{ success: boolean; message?: string; rawMessage?: string }>;
  // Mirrors StudentFeeCollection: false while the voucher is local-only,
  // true once the background confirm lands (live-updates the open receipt).
  onReceiptCloudStatus?: (confirmed: boolean) => void;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const GeneralVoucherEntry: React.FC<GeneralVoucherEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onConfirmTransactions,
  onReceiptCloudStatus,
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
  // Job 4 (optimistic save): cloud-confirm failure state. The voucher
  // stays local (visible in the list, badged in the ledger) and the
  // retry below re-confirms the SAME transaction list — resubmitting
  // would mint a second voucher.
  const [voucherConfirmError, setVoucherConfirmError] = useState<string | null>(null);
  const [voucherPendingTx, setVoucherPendingTx] = useState<FinanceTransaction | null>(null);
  // 7 Nov 2026 Job 4: NO blocking isSaving state — the old pattern sat
  // on a dead screen for 60-90s on a slow connection. The double-create
  // guard below is a synchronous fingerprint check instead: an identical
  // submission (same type, fund, category, amount, date, person,
  // reference) is refused while its background confirm is still in
  // flight, or within 10s of the last submit — a double-tap can never
  // mint a second voucher, while a genuinely different voucher always
  // goes through at once.
  const lastSubmitRef = useRef<{ fp: string; at: number } | null>(null);
  const confirmPendingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message — a generic message
  // after a long silent wait is what made the Save button look dead.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, ভাউচার সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the voucher save did not finish. Try again on a better connection.')
      : (result.message || FEE_CLOUD_FAILURE_MESSAGE));

  const incomeCategoriesList: { value: IncomeCategory; label: string }[] = [
    { value: 'GENERAL_DONATION', label: 'সাধারণ দান ও অনুদান' },
    { value: 'ZAKAT_FITRA', label: 'ছাত্রকল্যাণ ও যাকাত ফান্ড' },
    { value: 'MONTHLY_DONOR', label: 'দাতা সদস্য মাসিক চাঁদা' },
    { value: 'QURBANI_LEATHER', label: 'কোরবানির চামড়া বাবদ দান' },
    { value: 'BUILDING_CONSTRUCTION', label: 'ক্যাম্পাস ও ভবন নির্মাণ অনুদান' },
    { value: 'ORPHAN_SPONSOR', label: 'ছাত্রকল্যাণ ও এতিম তহবিল দান' },
    { value: 'PROPERTY_RENT', label: 'দোকান ও জমি ভাড়া বাবদ আয়' },
    { value: 'MAHFIL_COLLECTION', label: 'বার্ষিক ক্রীড়া, সাংস্কৃতিক ও সিরাত মাহফিল ফান্ড' },
    { value: 'GOV_GRANT', label: 'সরকারি অনুদান' },
    { value: 'BOOK_STATIONERY', label: 'লাইব্রেরি ও পাঠ্যবই খাত' },
    { value: 'MISC_INCOME', label: 'বিবিধ আয়' },
    { value: 'OTHER_INCOME', label: 'অন্যান্য বিশেষ আয়' },
  ];

  const expenseCategoriesList: { value: ExpenseCategory; label: string }[] = [
    { value: 'BOARDING_MESS', label: 'ছাত্রাবাস ও হোস্টেল মেস ডাইনিং খরচ (চাল, ডাল, তেল)' },
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
      showToast(isBn ? (txType === 'INCOME' ? 'দয়া করে দানকারী/দাতার নাম দিন!' : 'দয়া করে প্রাপক/দোকানের নাম দিন!') : 'Please enter person/vendor name!');
      return;
    }
    if (!amount || amount <= 0) {
      showToast(isBn ? 'টাকার পরিমাণ সঠিক নয়!' : 'Please enter a valid amount!');
      return;
    }

    // Double-create guard (synchronous — set BEFORE the local add, so a
    // double-tap in the same tick is refused too). Identical voucher
    // while its confirm is in flight, or within 10s of the last submit.
    const fingerprint = [txType, fundType, category, amount, date, paymentMethod, payerOrPayee.trim(), referenceNo.trim()].join('|');
    const now = Date.now();
    if (
      lastSubmitRef.current?.fp === fingerprint &&
      (now - lastSubmitRef.current.at < 10000 || confirmPendingRef.current)
    ) {
      showToast(isBn ? 'এই ভাউচারটি ইতিমধ্যে জমা দেওয়া হয়েছে — আবার চাপবেন না।' : 'This voucher was already submitted — please do not submit it again.');
      return;
    }
    lastSubmitRef.current = { fp: fingerprint, at: now };

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

    // 7 Nov 2026 Job 4 (instant save, Job 1 salary template): the form
    // used to show a 'সফলভাবে সংরক্ষিত' toast and print the receipt as
    // cloud-confirmed with NO confirm at all — the write depended on
    // background auto-sync. Now the local transaction applies and the
    // receipt opens AT ONCE (marked local-only); the confirm runs in
    // the BACKGROUND via confirmFeeCloudSync (raw error text). On
    // failure it queues the payload, the ledger row shows the amber
    // 'cloud-এ যায়নি' badge, and the banner below offers Retry. The
    // receipt flips to cloud-confirmed live when the background
    // confirm lands. The success toast fires ONLY then — never a false
    // 'saved to cloud'.
    const created = onAddTransaction(newTx);
    setVoucherPendingTx(created);
    setVoucherConfirmError(null);
    confirmPendingRef.current = true;
    onReceiptCloudStatus?.(false);
    showToast(isBn ? `ভাউচার নং ${nextVoucher} এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…` : `Voucher ${nextVoucher} saved on this device — syncing to cloud…`);
    onShowReceipt(created);

    // Reset Form
    setPayerOrPayee('');
    setContactNo('');
    setReferenceNo('');
    setDescription('');
    setCustomCategoryName('');

    const failureMsg = isBn
      ? feeCloudFailureMessage(nextVoucher)
      : `Voucher ${nextVoucher} saved on this device only — not yet in the cloud. Please retry.`;

    // Background confirm — fire and forget from the UI's point of view.
    // On failure confirmFeeCloudSync queues the payload (via
    // confirmUpsertFailure), so the ledger badge appears and the
    // Diagnostics queue can retry it.
    void onConfirmTransactions([created, ...transactions], failureMsg).then((result) => {
      confirmPendingRef.current = false;
      if (!result.success) {
        setVoucherConfirmError(confirmErrorMessage(result));
        return;
      }
      setVoucherPendingTx(null);
      setVoucherConfirmError(null);
      onReceiptCloudStatus?.(true);
      showToast(isBn ? `ভাউচার নং ${nextVoucher} সফলভাবে সংরক্ষিত হয়েছে!` : `Voucher ${nextVoucher} created!`);
    }).catch((err) => {
      confirmPendingRef.current = false;
      console.error('Background voucher cloud confirm failed:', err);
      setVoucherConfirmError(isBn
        ? `ভাউচার cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Voucher did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    });
  };

  // Job 4: voucher retry — re-confirm only, never a second voucher.
  // The pending voucher is deduped out of the list (it already landed
  // in local state), so the confirm writes each voucher exactly once.
  const handleRetryVoucherConfirm = async () => {
    if (!voucherPendingTx || isRetrying) return;
    setIsRetrying(true);
    try {
      const failureMsg = isBn
        ? feeCloudFailureMessage(voucherPendingTx.voucherNo)
        : `Voucher ${voucherPendingTx.voucherNo} saved on this device only — not yet in the cloud. Please retry.`;
      const list = [voucherPendingTx, ...transactions.filter((t) => t.id !== voucherPendingTx.id)];
      const result = await onConfirmTransactions(list, failureMsg);
      if (!result.success) {
        setVoucherConfirmError(confirmErrorMessage(result));
        return;
      }
      setVoucherPendingTx(null);
      setVoucherConfirmError(null);
      onReceiptCloudStatus?.(true);
      showToast(isBn ? `ভাউচার নং ${voucherPendingTx.voucherNo} সফলভাবে সংরক্ষিত হয়েছে!` : `Voucher ${voucherPendingTx.voucherNo} created!`);
      onShowReceipt(voucherPendingTx);
    } catch (err) {
      console.error('Failed to retry voucher confirm:', err);
      setVoucherConfirmError(isBn
        ? `ভাউচার cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Voucher did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txType === 'INCOME' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400'}`}>
            {txType === 'INCOME' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isBn ? 'সাধারণ ও অন্যান্য খাতের আয়/ব্যয় ভাউচার' : 'General Voucher Entry (All Categories)'}
            </h2>
          </div>
        </div>

        {/* Type Toggle */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => handleTypeChange('INCOME')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              txType === 'INCOME' 
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
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
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
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
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'তহবিল নির্বাচন করুন *' : 'Target Fund *'}
            </label>
            <select
              value={fundType}
              onChange={(e) => setFundType(e.target.value as FundType)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {(Object.keys(FUND_METAS) as FundType[]).map(f => (
                <option key={f} value={f}>
                  {isBn ? FUND_METAS[f].nameBn : FUND_METAS[f].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'আয়/ব্যয়ের নির্দিষ্ট খাত *' : 'Category / Head *'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'টাকার পরিমাণ *' : 'Amount (BDT) *'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-sm">৳</span>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-base text-slate-900 dark:text-white font-black font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'তারিখ *' : 'Date *'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Row 3: Payer/Payee & Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {txType === 'INCOME' 
                ? (isBn ? 'কার কাছ থেকে গ্রহণ করা হলো (দাতার নাম) *' : 'Received From (Payer Name) *') 
                : (isBn ? 'কাকে পরিশোধ করা হলো (দোকান / প্রাপকের নাম) *' : 'Paid To (Payee / Vendor Name) *')}
            </label>
            <input
              type="text"
              value={payerOrPayee}
              onChange={(e) => setPayerOrPayee(e.target.value)}
              placeholder={isBn ? (txType === 'INCOME' ? 'দাতার নাম' : 'দোকান বা ব্যক্তির নাম') : 'Name'}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
            </label>
            <input
              type="text"
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Row 4: Method, Reference, Collector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
              <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
              <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
              <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'}</option>
              <option value="CHEQUE">{isBn ? 'চেক (Cheque)' : 'Cheque'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'মেমো / চেক / ট্রানজেকশন নং' : 'Memo / TrxID / Cheque'}
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'আদায়কারী / হিসাবরক্ষক' : 'Officer / Cashier'}
            </label>
            <input
              type="text"
              value={collectedBy}
              onChange={(e) => setCollectedBy(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            {isBn ? 'বিস্তারিত বিবরণ ও মন্তব্য' : 'Description / Remarks'}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isBn ? 'যেমন: মেসের ৫০ কেজি মিনিকেট চাল ক্রয়' : 'Details'}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
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

        {/* Job 4 (optimistic save): the background cloud confirm failed
            — voucher stays local (badged in the ledger), retry
            re-confirms the same voucher (never a second one). */}
        {voucherConfirmError && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">{voucherConfirmError}</span>
            <button
              type="button"
              onClick={handleRetryVoucherConfirm}
              disabled={isRetrying}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-bold shrink-0 cursor-pointer"
            >
              {isRetrying ? (isBn ? 'চেষ্টা চলছে…' : 'Retrying…') : (isBn ? 'আবার চেষ্টা করুন' : 'Retry')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
