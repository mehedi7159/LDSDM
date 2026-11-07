import React, { useState, useRef } from 'react';
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
import { feeCloudFailureMessage, FEE_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';
import { Button } from '../ui/Button';

interface DevelopmentExpenseEntryProps {
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

export const DevelopmentExpenseEntry: React.FC<DevelopmentExpenseEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onConfirmTransactions,
  onReceiptCloudStatus,
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
  const [approvedBy, setApprovedBy] = useState<string>('উন্নয়ন কমিটি / অধ্যক্ষ');
  // Job 4 (optimistic save): cloud-confirm failure state. The voucher
  // stays local (visible in the list, badged in the ledger) and the
  // retry below re-confirms the SAME transaction list — resubmitting
  // would mint a second voucher.
  const [voucherConfirmError, setVoucherConfirmError] = useState<string | null>(null);
  const [voucherPendingTx, setVoucherPendingTx] = useState<FinanceTransaction | null>(null);
  // 7 Nov 2026 Job 4: NO blocking isSaving state — the old pattern sat
  // on a dead screen for 60-90s on a slow connection. The double-create
  // guard below is a synchronous fingerprint check instead: an identical
  // submission (same project, payee, amount, date, method, memo) is
  // refused while its background confirm is still in flight, or within
  // 10s of the last submit — a double-tap can never mint a second
  // voucher, while a genuinely different expense always goes through
  // at once.
  const lastSubmitRef = useRef<{ fp: string; at: number } | null>(null);
  const confirmPendingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message — a generic message
  // after a long silent wait is what made the Save button look dead.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, উন্নয়ন ভাউচার সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the development voucher save did not finish. Try again on a better connection.')
      : (result.message || FEE_CLOUD_FAILURE_MESSAGE));

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

    // Double-create guard (synchronous — set BEFORE the local add, so a
    // double-tap in the same tick is refused too). Identical expense
    // while its confirm is in flight, or within 10s of the last submit.
    const fingerprint = [projectHead, payeeName.trim(), amount, date, paymentMethod, memoNo.trim()].join('|');
    const now = Date.now();
    if (
      lastSubmitRef.current?.fp === fingerprint &&
      (now - lastSubmitRef.current.at < 10000 || confirmPendingRef.current)
    ) {
      showToast(isBn ? 'এই উন্নয়ন ভাউচারটি ইতিমধ্যে জমা দেওয়া হয়েছে — আবার চাপবেন না।' : 'This development voucher was already submitted — please do not submit it again.');
      return;
    }
    lastSubmitRef.current = { fp: fingerprint, at: now };

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

    // 7 Nov 2026 Job 4 (instant save, Job 1 salary template): the form
    // used to show a 'সফলভাবে জমা' toast and print the voucher as
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
    showToast(isBn ? `উন্নয়ন ভাউচার নং ${nextVoucher} এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…` : `Development voucher ${nextVoucher} saved on this device — syncing to cloud…`);
    onShowReceipt(created);

    // Reset Form
    setPayeeName('');
    setPayeePhone('');
    setMemoNo('');
    setDescription('');

    const failureMsg = isBn
      ? feeCloudFailureMessage(nextVoucher)
      : `Development voucher ${nextVoucher} saved on this device only — not yet in the cloud. Please retry.`;

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
      showToast(isBn ? `উন্নয়ন ভাউচার নং ${nextVoucher} সফলভাবে জমা হয়েছে!` : `Development voucher ${nextVoucher} created!`);
    }).catch((err) => {
      confirmPendingRef.current = false;
      console.error('Background development voucher cloud confirm failed:', err);
      setVoucherConfirmError(isBn
        ? `উন্নয়ন ভাউচার cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Development voucher did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    });
  };

  // Job 4: development retry — re-confirm only, never a second voucher.
  // The pending voucher is deduped out of the list (it already landed
  // in local state), so the confirm writes each voucher exactly once.
  const handleRetryVoucherConfirm = async () => {
    if (!voucherPendingTx || isRetrying) return;
    setIsRetrying(true);
    try {
      const failureMsg = isBn
        ? feeCloudFailureMessage(voucherPendingTx.voucherNo)
        : `Development voucher ${voucherPendingTx.voucherNo} saved on this device only — not yet in the cloud. Please retry.`;
      const list = [voucherPendingTx, ...transactions.filter((t) => t.id !== voucherPendingTx.id)];
      const result = await onConfirmTransactions(list, failureMsg);
      if (!result.success) {
        setVoucherConfirmError(confirmErrorMessage(result));
        return;
      }
      setVoucherPendingTx(null);
      setVoucherConfirmError(null);
      onReceiptCloudStatus?.(true);
      showToast(isBn ? `উন্নয়ন ভাউচার নং ${voucherPendingTx.voucherNo} সফলভাবে জমা হয়েছে!` : `Development voucher ${voucherPendingTx.voucherNo} created!`);
      onShowReceipt(voucherPendingTx);
    } catch (err) {
      console.error('Failed to retry development voucher confirm:', err);
      setVoucherConfirmError(isBn
        ? `উন্নয়ন ভাউচার cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Development voucher did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Form (8 Cols) */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isBn ? 'মাদ্রাসা উন্নয়ন, নির্মাণ ও সংস্কার ব্যয়' : 'Madrasah Development & Construction'}
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Head Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'উন্নয়ন কাজের সুনির্দিষ্ট খাত *' : 'Development Work Category *'}
            </label>
            <select
              value={projectHead}
              onChange={(e) => setProjectHead(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {developmentProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'খরচের পরিমাণ (টাকা) *' : 'Amount (BDT) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-sm">৳</span>
                <input
                  type="number"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-base text-slate-900 dark:text-white font-black font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'খরচের তারিখ *' : 'Date *'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Payee / Vendor & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'সরবরাহকারী প্রতিষ্ঠান / ঠিকাদার / মিস্ত্রির নাম *' : 'Vendor / Contractor / Mason Name *'}
              </label>
              <input
                type="text"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder={isBn ? 'যেমন: মেসার্স রহিম স্টিল / মোজাম্মেল রাজমিস্ত্রি' : 'e.g. Rahim Steel / Mason Leader'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
              </label>
              <input
                type="text"
                value={payeePhone}
                onChange={(e) => setPayeePhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Memo No, Payment Method, Approval */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'দোকানের ক্যাশ মেমো / চালান নং' : 'Challan / Memo No'}
              </label>
              <input
                type="text"
                value={memoNo}
                onChange={(e) => setMemoNo(e.target.value)}
                placeholder={isBn ? 'যেমন: মেমো-৪৫২১' : 'e.g. Memo #452'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক হিসাব' : 'Bank Transfer'}</option>
                <option value="CHEQUE">{isBn ? 'চেক (Cheque)' : 'Cheque'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'অনুমোদনকারী / কমিটি' : 'Approved By'}
              </label>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {isBn ? 'কাজের বিস্তারিত বিবরণ ও মালপত্রের তালিকা' : 'Material & Work Description'}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isBn ? 'যেমন: নিচতলার বারান্দার জন্য ১০ বস্তা সিমেন্ট ও ৫০০ পিস ইট ক্রয়' : 'Details'}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
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

      {/* Right Column (4 Cols): Info Box */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-amber-800 text-white rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-300" />
            {isBn ? 'উন্নয়ন ও নির্মাণ তহবিল' : 'Development Fund Tracking'}
          </h3>

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
