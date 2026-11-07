import React, { useState, useRef } from 'react';
import { 
  HeartHandshake, 
  Sparkles, 
  Printer, 
  ShieldCheck, 
  Coins, 
  User, 
  Phone, 
  Globe, 
  Building, 
  CheckCircle2, 
  CreditCard 
} from 'lucide-react';
import { FinanceTransaction, FundType, IncomeCategory } from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { feeCloudFailureMessage, FEE_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';
import { FUND_METAS } from './types';
import { Button } from '../ui/Button';

interface DonationEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  // 7 Nov 2026 Job 4 (optimistic save, Job 1 salary template): the
  // confirm runs in the BACKGROUND — the local receipt applies and
  // opens at once, marked local-only until the confirm lands. A
  // local-only receipt must never print as if it reached the cloud.
  // This is confirmFeeCloudSync from context (raw error text).
  onConfirmTransactions: (next: FinanceTransaction[], failureMessage?: string) => Promise<{ success: boolean; message?: string; rawMessage?: string }>;
  // Mirrors StudentFeeCollection: false while the receipt is local-only,
  // true once the background confirm lands (live-updates the open receipt).
  onReceiptCloudStatus?: (confirmed: boolean) => void;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const DonationEntry: React.FC<DonationEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onConfirmTransactions,
  onReceiptCloudStatus,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [donorName, setDonorName] = useState<string>('');
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [donorAddress, setDonorAddress] = useState<string>('');
  const [amount, setAmount] = useState<number>(1000);
  const [fundType, setFundType] = useState<FundType>('GENERAL');
  const [category, setCategory] = useState<IncomeCategory>('GENERAL_DONATION');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [collectedBy, setCollectedBy] = useState<string>('অধ্যক্ষ / হিসাবরক্ষক');
  // Job 4 (optimistic save): cloud-confirm failure state. The receipt
  // stays local (visible in the list, badged in the ledger) and the
  // retry below re-confirms the SAME transaction list — resubmitting
  // would mint a second receipt.
  const [voucherConfirmError, setVoucherConfirmError] = useState<string | null>(null);
  const [voucherPendingTx, setVoucherPendingTx] = useState<FinanceTransaction | null>(null);
  // 7 Nov 2026 Job 4: NO blocking isSaving state — the old pattern sat
  // on a dead screen for 60-90s on a slow connection. The double-create
  // guard below is a synchronous fingerprint check instead: an identical
  // submission (same donor, fund, category, amount, date, method,
  // reference) is refused while its background confirm is still in
  // flight, or within 10s of the last submit — a double-tap can never
  // mint a second receipt, while a genuinely different donation always
  // goes through at once.
  const lastSubmitRef = useRef<{ fp: string; at: number } | null>(null);
  const confirmPendingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message — a generic message
  // after a long silent wait is what made the Save button look dead.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, দান সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the donation save did not finish. Try again on a better connection.')
      : (result.message || FEE_CLOUD_FAILURE_MESSAGE));

  // Quick Preset Amounts
  const presetAmounts = [500, 1000, 2000, 5000, 10000, 25000, 50000];

  const handleFundChange = (fund: FundType) => {
    setFundType(fund);
    if (fund === 'ZAKAT') {
      setCategory('ZAKAT_FITRA');
    } else if (fund === 'DEVELOPMENT') {
      setCategory('BUILDING_CONSTRUCTION');
    } else if (fund === 'ORPHAN_AID') {
      setCategory('ORPHAN_SPONSOR');
    } else if (fund === 'MAHFIL') {
      setCategory('MAHFIL_COLLECTION');
    } else {
      setCategory('GENERAL_DONATION');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim()) {
      showToast(isBn ? 'দয়া করে দানকারী / দাতার নাম লিখুন!' : 'Please enter donor name!');
      return;
    }
    if (!amount || amount <= 0) {
      showToast(isBn ? 'দানের পরিমাণ সঠিক নয়!' : 'Please enter a valid amount!');
      return;
    }

    // Double-create guard (synchronous — set BEFORE the local add, so a
    // double-tap in the same tick is refused too). Identical donation
    // while its confirm is in flight, or within 10s of the last submit.
    const fingerprint = [donorName.trim(), fundType, category, amount, date, paymentMethod, referenceNo.trim()].join('|');
    const now = Date.now();
    if (
      lastSubmitRef.current?.fp === fingerprint &&
      (now - lastSubmitRef.current.at < 10000 || confirmPendingRef.current)
    ) {
      showToast(isBn ? 'এই দানটি ইতিমধ্যে জমা দেওয়া হয়েছে — আবার চাপবেন না।' : 'This donation was already submitted — please do not submit it again.');
      return;
    }
    lastSubmitRef.current = { fp: fingerprint, at: now };

    const nextVoucher = generateVoucherNo('INCOME', transactions);
    const categoryLabels: Record<string, string> = {
      GENERAL_DONATION: 'সাধারণ দান ও অনুদান',
      ZAKAT_FITRA: 'ছাত্রকল্যাণ, যাকাত ও সদকা ফান্ড',
      BUILDING_CONSTRUCTION: 'ক্যাম্পাস ও ভবন নির্মাণ অনুদান',
      MONTHLY_DONOR: 'আজীবন / দাতা সদস্য মাসিক অনুদান',
      QURBANI_LEATHER: 'কোরবানির চামড়া বাবদ দান',
      ORPHAN_SPONSOR: 'ছাত্রকল্যাণ ও এতিম তহবিল দান',
      MAHFIL_COLLECTION: 'বার্ষিক ক্রীড়া, সাংস্কৃতিক ও সিরাত মাহফিল ফান্ড',
      MISC_INCOME: 'বিবিধ অনুদান',
    };

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'INCOME',
      category,
      categoryName: categoryLabels[category] || 'দান ও অনুদান',
      fundType,
      amount: Number(amount),
      date,
      paymentMethod,
      referenceNo,
      payerOrPayee: donorAddress ? `${donorName} (${donorAddress})` : donorName,
      contactNo: donorPhone,
      description: description || `${categoryLabels[category] || 'দান'} বাবদ এককালীন প্রাপ্তি`,
      collectedBy,
    };

    // 7 Nov 2026 Job 4 (instant save, Job 1 salary template): the form
    // used to show a 'সফলভাবে তৈরি' toast and print the receipt as
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
    showToast(isBn ? `দান রসিদ নং ${nextVoucher} এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…` : `Donation receipt ${nextVoucher} saved on this device — syncing to cloud…`);
    onShowReceipt(created);

    // Reset Form
    setDonorName('');
    setDonorPhone('');
    setDonorAddress('');
    setDescription('');
    setReferenceNo('');

    const failureMsg = isBn
      ? feeCloudFailureMessage(nextVoucher)
      : `Donation receipt ${nextVoucher} saved on this device only — not yet in the cloud. Please retry.`;

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
      showToast(isBn ? `দান রসিদ নং ${nextVoucher} সফলভাবে তৈরি হয়েছে!` : `Donation receipt ${nextVoucher} created!`);
    }).catch((err) => {
      confirmPendingRef.current = false;
      console.error('Background donation cloud confirm failed:', err);
      setVoucherConfirmError(isBn
        ? `দান cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Donation did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    });
  };

  // Job 4: donation retry — re-confirm only, never a second receipt.
  // The pending receipt is deduped out of the list (it already landed
  // in local state), so the confirm writes each receipt exactly once.
  const handleRetryVoucherConfirm = async () => {
    if (!voucherPendingTx || isRetrying) return;
    setIsRetrying(true);
    try {
      const failureMsg = isBn
        ? feeCloudFailureMessage(voucherPendingTx.voucherNo)
        : `Donation receipt ${voucherPendingTx.voucherNo} saved on this device only — not yet in the cloud. Please retry.`;
      const list = [voucherPendingTx, ...transactions.filter((t) => t.id !== voucherPendingTx.id)];
      const result = await onConfirmTransactions(list, failureMsg);
      if (!result.success) {
        setVoucherConfirmError(confirmErrorMessage(result));
        return;
      }
      setVoucherPendingTx(null);
      setVoucherConfirmError(null);
      onReceiptCloudStatus?.(true);
      showToast(isBn ? `দান রসিদ নং ${voucherPendingTx.voucherNo} সফলভাবে তৈরি হয়েছে!` : `Donation receipt ${voucherPendingTx.voucherNo} created!`);
      onShowReceipt(voucherPendingTx);
    } catch (err) {
      console.error('Failed to retry donation confirm:', err);
      setVoucherConfirmError(isBn
        ? `দান cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Donation did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Form (8 Cols) */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isBn ? 'দান, সদকা, যাকাত ও অনুদান কাউন্টার' : 'Donations, Sadaqa & Grants Counter'}
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fund Selector Pills */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
              {isBn ? 'দানের তহবিল ও ফান্ড নির্বাচন করুন *' : 'Select Target Fund *'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(Object.keys(FUND_METAS) as FundType[]).map(fund => {
                const info = FUND_METAS[fund];
                const isSelected = fundType === fund;
                return (
                  <button
                    key={fund}
                    type="button"
                    onClick={() => handleFundChange(fund)}
                    className={`text-left p-3 rounded-xl border text-sm font-bold transition-all duration-200 ${
                      isSelected 
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 scale-[1.01]'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{isBn ? info.nameBn : info.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Quick Amount Buttons */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
              {isBn ? 'দানের পরিমাণ নির্বাচন বা টাইপ করুন (টাকা) *' : 'Donation Amount (BDT) *'}
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {presetAmounts.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all ${
                    amount === val 
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                  }`}
                >
                  ৳{isBn ? formatBanglaNumber(val) : val.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-base">৳</span>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-3 text-lg text-slate-900 dark:text-white font-black font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Row: Donor Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'দানকারী / দাতার নাম *' : 'Donor Name *'}
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder={isBn ? 'যেমন: হাজী মো. আব্দুল হাই' : 'e.g. Haji Md. Abdul Hai'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'মোবাইল নম্বর' : 'Phone / Mobile'}
              </label>
              <input
                type="text"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Donor Address & Specific Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'ঠিকানা / পরিচিতি / দেশ' : 'Address / Organization / Country'}
              </label>
              <input
                type="text"
                value={donorAddress}
                onChange={(e) => setDonorAddress(e.target.value)}
                placeholder={isBn ? 'যেমন: যুক্তরাজ্য প্রবাসী / গ্রাম: মিরপুর' : 'e.g. UK Expatriate / Local'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'দানের নির্দিষ্ট খাত *' : 'Donation Category *'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="GENERAL_DONATION">{isBn ? 'সাধারণ দান ও অনুদান' : 'General Donation'}</option>
                <option value="ZAKAT_FITRA">{isBn ? 'ছাত্রকল্যাণ, যাকাত ও সদকা' : 'Student Welfare & Zakat'}</option>
                <option value="BUILDING_CONSTRUCTION">{isBn ? 'ক্যাম্পাস ও ভবন নির্মাণ অনুদান' : 'Campus Construction'}</option>
                <option value="MONTHLY_DONOR">{isBn ? 'আজীবন / দাতা সদস্য মাসিক অনুদান' : 'Monthly Donor'}</option>
                <option value="QURBANI_LEATHER">{isBn ? 'কোরবানির চামড়া বাবদ দান' : 'Qurbani Skin'}</option>
                <option value="ORPHAN_SPONSOR">{isBn ? 'ছাত্রকল্যাণ ও এতিম তহবিল দান' : 'Student Welfare Sponsor'}</option>
                <option value="MAHFIL_COLLECTION">{isBn ? 'বার্ষিক ক্রীড়া, সাংস্কৃতিক ও সিরাত মাহফিল' : 'Annual Sports & Seerat Event'}</option>
                <option value="MISC_INCOME">{isBn ? 'অন্যান্য অনুদান' : 'Other Donation'}</option>
              </select>
            </div>
          </div>

          {/* Payment Method, Date, Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক হিসাব' : 'Bank Transfer'}</option>
                <option value="CHEQUE">{isBn ? 'চেক (Cheque)' : 'Cheque'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'তারিখ *' : 'Date *'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'চেক / ট্রানজেকশন নং' : 'Reference / TrxID'}
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description & Collector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'মন্তব্য / উদ্দেশ্য' : 'Description / Remarks'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isBn ? 'যেমন: মরহুম পিতার ইসালে সওয়াবের নিয়তে দান' : 'Remarks'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'গ্রহণকারী কর্মকর্তা' : 'Received By'}
              </label>
              <input
                type="text"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <Button
              type="submit"
              size="md"
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 font-bold text-sm transition-all"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isBn ? 'দান গ্রহণ করুন ও রসিদ দিন' : 'Accept Donation & Print Receipt'}
            </Button>
          </div>

          {/* Job 4 (optimistic save): the background cloud confirm failed
              — receipt stays local (badged in the ledger), retry
              re-confirms the same receipt (never a second one). */}
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

      {/* Right Column (4 Cols): Benefits & Shariah Note */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-emerald-900 text-white rounded-2xl p-6">
          <h3 className="text-base font-extrabold text-emerald-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            {isBn ? 'স্বচ্ছ ও বরকতময় হিসাবরক্ষণ' : 'Shariah Fund Management'}
          </h3>

          <p className="mt-3 text-sm text-emerald-100/90 leading-relaxed font-medium">
            {isBn 
              ? 'প্রতিটি দানের জন্য অফিস কপি ও দাতা কপি সহ রসিদ তৈরি হয়।'
              : 'An office copy and a donor copy receipt are generated for every donation.'}
          </p>

          <div className="mt-4 pt-4 border-t border-emerald-700/80 space-y-3 text-sm font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isBn ? 'যাকাত ও ফিতরা ফান্ড পৃথক সংরক্ষণ' : 'Strict Zakat Segregation'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isBn ? 'ডিজিটাল ভাউচার ও সিরিয়াল ট্র্যাকিং' : 'Sequential Voucher Generation'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isBn ? 'দাতা সদস্যদের স্থায়ী ডাটাবেজ' : 'Permanent Donor Records'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
