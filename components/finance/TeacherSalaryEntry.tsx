import React, { useState, useRef } from 'react';
import { 
  CreditCard, 
  Sparkles, 
  Printer, 
  UserCheck, 
  ShieldCheck, 
  Coins, 
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { FinanceTransaction } from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { FEE_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';
import { Button } from '../ui/Button';

interface TeacherSalaryEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  // 7 Nov 2026 Job 1 (optimistic save): the confirm runs in the
  // BACKGROUND — the local voucher applies and the receipt opens at
  // once, marked local-only until the confirm lands. A local-only
  // voucher must never print as if it reached the cloud.
  onConfirmTransactions: (next: FinanceTransaction[]) => Promise<{ success: boolean; message?: string; rawMessage?: string }>;
  // Mirrors StudentFeeCollection: false while the voucher is local-only,
  // true once the background confirm lands (live-updates the open receipt).
  onReceiptCloudStatus?: (confirmed: boolean) => void;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const TeacherSalaryEntry: React.FC<TeacherSalaryEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onConfirmTransactions,
  onReceiptCloudStatus,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [staffName, setStaffName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('মুদাররিস (শিক্ষক)');
  const [phone, setPhone] = useState<string>('');
  const [salaryMonth, setSalaryMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Salary Components
  const [basicSalary, setBasicSalary] = useState<number>(12000);
  const [allowance, setAllowance] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'BANK_TRANSFER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('অধ্যক্ষ / সুপারিনটেনডেন্ট');
  // Phase 5: cloud-confirm failure state. The voucher stays local
  // (visible in the list, badged in the ledger) and the retry below
  // re-confirms the SAME transaction list — resubmitting would mint
  // a second voucher.
  const [salaryConfirmError, setSalaryConfirmError] = useState<string | null>(null);
  const [salaryPendingTx, setSalaryPendingTx] = useState<FinanceTransaction | null>(null);
  // 7 Nov 2026 Job 1 (optimistic save): NO blocking isSaving state —
  // the old block-await sat on 'সংরক্ষণ হচ্ছে…' for 60-90s on a slow
  // connection. The double-create guard below is a synchronous
  // fingerprint check instead: an identical submission (same staff,
  // month, date, amount, method, reference) is refused while its
  // background confirm is still in flight, or within 10s of the last
  // submit — a double-tap can never mint a second voucher, while a
  // genuinely different payment always goes through at once.
  const lastSubmitRef = useRef<{ fp: string; at: number } | null>(null);
  const confirmPendingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message — a generic message
  // after a long silent wait is what made the Save button look dead.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, বেতন সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the salary save did not finish. Try again on a better connection.')
      : (result.message || FEE_CLOUD_FAILURE_MESSAGE));

  // Common designations in Alia Madrasah & School
  const commonDesignations = [
    'অধ্যক্ষ (Principal)',
    'উপাধ্যক্ষ (Vice Principal)',
    'সুপারিনটেনডেন্ট / সুপার (Superintendent)',
    'সহকারী সুপারিনটেনডেন্ট (Assistant Super)',
    'প্রভাষক (Lecturer - Arabic/English/Bangla)',
    'সহকারী মৌলভী (Assistant Moulvi)',
    'সহকারী শিক্ষক (Assistant Teacher - General)',
    'সহকারী শিক্ষক (বিজ্ঞান ও গণিত)',
    'সহকারী শিক্ষক (ইংরেজি)',
    'আইসিটি শিক্ষক (ICT Teacher)',
    'ক্বারী / ক্বেরাত শিক্ষক (Qari)',
    'হিসাবরক্ষক (Accountant)',
    'অফিস সহকারী ও কম্পিউটার অপারেটর (Office Assistant)',
    'এমএলএসএস / অফিস সহায়ক (Support Staff)'
  ];

  const netPayable = Math.max(0, (Number(basicSalary) || 0) + (Number(allowance) || 0) - (Number(deduction) || 0));

  // 7 Nov 2026 Job 1 (instant save, student Job 0 template): the form
  // used to block-await the cloud confirm — getDoc of the full ~341 KB
  // main_store + setDoc of the full transactions array — and the prop
  // was missing at the FinanceManager call site, so EVERY submit threw
  // a TypeError on the awaited call with no toast, no receipt, and the
  // form still full — re-submit minted a second voucher. Now the local
  // transaction applies and the receipt opens AT ONCE (marked
  // local-only); the confirm runs in the BACKGROUND via the same
  // confirmFeeCloudSync (raw error text). On failure it queues the
  // payload, the ledger row shows the amber 'cloud-এ যায়নি' badge,
  // and the banner below offers Retry. The receipt flips to
  // cloud-confirmed live when the background confirm lands. The
  // success toast fires ONLY then — never a false 'saved to cloud'.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      showToast(isBn ? 'দয়া করে উস্তাদ বা স্টাফের নাম লিখুন!' : 'Please enter staff name!');
      return;
    }
    if (netPayable <= 0) {
      showToast(isBn ? 'বেতনের পরিমাণ সঠিক নয়!' : 'Net salary must be greater than 0!');
      return;
    }

    // Double-create guard (synchronous — set BEFORE the local add, so a
    // double-tap in the same tick is refused too). Identical payment
    // while its confirm is in flight, or within 10s of the last submit.
    const fingerprint = [staffName.trim(), designation, salaryMonth, payDate, netPayable, paymentMethod, referenceNo.trim()].join('|');
    const now = Date.now();
    if (
      lastSubmitRef.current?.fp === fingerprint &&
      (now - lastSubmitRef.current.at < 10000 || confirmPendingRef.current)
    ) {
      showToast(isBn ? 'এই বেতনটি ইতিমধ্যে জমা দেওয়া হয়েছে — আবার চাপবেন না।' : 'This salary was already submitted — please do not submit it again.');
      return;
    }
    lastSubmitRef.current = { fp: fingerprint, at: now };

    const nextVoucher = generateVoucherNo('EXPENSE', transactions);

    const desc = `${salaryMonth} মাসের বেতন/হাদিয়া পরিশোধ (মূল: ৳${basicSalary}${allowance > 0 ? `, ভাতা: ৳${allowance}` : ''}${deduction > 0 ? `, কর্তন: ৳${deduction}` : ''}) ${notes ? `— ${notes}` : ''}`;

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'EXPENSE',
      category: 'STAFF_SALARY',
      categoryName: isBn ? 'উস্তাদ ও স্টাফদের বেতন / হাদিয়া' : 'Staff Salary & Allowance',
      fundType: 'GENERAL',
      amount: netPayable,
      date: payDate,
      paymentMethod,
      referenceNo,
      payerOrPayee: `${staffName} [${designation}]`,
      contactNo: phone,
      description: desc,
      collectedBy: approvedBy,
    };

    // Local mutation first — the voucher exists and the receipt opens
    // at once. The cloud confirm below never blocks this path.
    const created = onAddTransaction(newTx);
    setSalaryPendingTx(created);
    setSalaryConfirmError(null);
    confirmPendingRef.current = true;
    onReceiptCloudStatus?.(false);
    showToast(isBn ? `ভাউচার নং ${nextVoucher} এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…` : `Voucher ${nextVoucher} saved on this device — syncing to cloud…`);
    onShowReceipt(created);

    // Reset fields
    setStaffName('');
    setNotes('');
    setReferenceNo('');
    setAllowance(0);
    setDeduction(0);

    // Background confirm — fire and forget from the UI's point of view.
    // On failure confirmFeeCloudSync queues the payload (via
    // confirmUpsertFailure), so the ledger badge appears and the
    // Diagnostics queue can retry it.
    void onConfirmTransactions([created, ...transactions]).then((result) => {
      confirmPendingRef.current = false;
      if (!result.success) {
        setSalaryConfirmError(confirmErrorMessage(result));
        return;
      }
      setSalaryPendingTx(null);
      setSalaryConfirmError(null);
      onReceiptCloudStatus?.(true);
      showToast(isBn ? `বেতন ভাউচার নং ${nextVoucher} সফলভাবে পরিশোধ হয়েছে!` : `Salary voucher ${nextVoucher} created!`);
    }).catch((err) => {
      confirmPendingRef.current = false;
      console.error('Background salary cloud confirm failed:', err);
      setSalaryConfirmError(isBn
        ? `বেতন cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Salary did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
    });
  };

  // Phase 5: payroll retry — re-confirm only, never a second voucher.
  // The pending voucher is deduped out of the list (it already landed
  // in local state), so the confirm writes each voucher exactly once.
  const handleRetrySalaryConfirm = async () => {
    if (!salaryPendingTx || isRetrying) return;
    setIsRetrying(true);
    try {
      const list = [salaryPendingTx, ...transactions.filter((t) => t.id !== salaryPendingTx.id)];
      const result = await onConfirmTransactions(list);
      if (!result.success) {
        setSalaryConfirmError(confirmErrorMessage(result));
        return;
      }
      setSalaryPendingTx(null);
      setSalaryConfirmError(null);
      onReceiptCloudStatus?.(true);
      showToast(isBn ? `বেতন ভাউচার নং ${salaryPendingTx.voucherNo} সফলভাবে পরিশোধ হয়েছে!` : `Salary voucher ${salaryPendingTx.voucherNo} created!`);
      onShowReceipt(salaryPendingTx);
      setStaffName('');
      setNotes('');
      setReferenceNo('');
      setAllowance(0);
      setDeduction(0);
    } catch (err) {
      console.error('Failed to retry salary confirm:', err);
      setSalaryConfirmError(isBn
        ? `বেতন cloud-এ যায়নি (${err instanceof Error ? err.message : 'অজানা ত্রুটি'}) — আবার চেষ্টা করুন।`
        : `Salary did not reach cloud (${err instanceof Error ? err.message : 'unknown error'}) — please retry.`);
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
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isBn ? 'উস্তাদ ও স্টাফদের বেতন / হাদিয়া প্রদান' : 'Teacher & Staff Salary Disbursement'}
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Teacher Name & Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'উস্তাদ / স্টাফের নাম *' : 'Teacher / Staff Name *'}
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder={isBn ? 'যেমন: মাওলানা মাহমুদুল হাসান' : 'e.g. Maulana Mahmudul Hasan'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'পদবি / দায়িত্ব *' : 'Designation *'}
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                {commonDesignations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Month, Date & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'বেতনের মাস *' : 'Salary Month *'}
              </label>
              <input
                type="month"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'প্রদানের তারিখ *' : 'Payment Date *'}
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Salary Breakdown Block */}
          <div className="bg-rose-50/40 border border-rose-100 dark:border-rose-900/60 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold text-rose-950 dark:text-rose-200 block">
              {isBn ? 'হাদিয়া ও ভাতার বিস্তারিত বিভাজন:' : 'Salary Breakdown:'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-200/80">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isBn ? 'মূল হাদিয়া / বেতন *' : 'Basic Salary *'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-xs">৳</span>
                  <input
                    type="number"
                    value={basicSalary || ''}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-2 py-1.5 text-xs text-right font-black font-mono focus:ring-1 focus:ring-rose-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200/80">
                <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                  {isBn ? '+ অন্যান্য ভাতা / মেহমানদারি' : '+ Allowances / Bonus'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-xs">৳</span>
                  <input
                    type="number"
                    value={allowance || ''}
                    onChange={(e) => setAllowance(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-2 py-1.5 text-xs text-right font-black font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/80">
                <label className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                  {isBn ? '- অগ্রিম / ঋণ কর্তন' : '- Deduction / Advance'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-xs">৳</span>
                  <input
                    type="number"
                    value={deduction || ''}
                    onChange={(e) => setDeduction(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg pl-6 pr-2 py-1.5 text-xs text-right font-black font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'চেক / ট্রানজেকশন আইডি' : 'TrxID / Cheque'}
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isBn ? 'অনুমোদনকারী' : 'Approved By'}
              </label>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
              <span>{isBn ? 'নিট পরিশোধযোগ্য হাদিয়া: ' : 'Net Payable: '}</span>
              <span className="text-xl sm:text-2xl text-rose-700 dark:text-rose-400 font-black font-mono">
                ৳{isBn ? formatBanglaNumber(netPayable) : netPayable.toLocaleString()}
              </span>
            </div>

            <Button
              type="submit"
              size="md"
              variant="primary"
              className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white px-8 font-bold text-xs"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isBn ? 'বেতন পরিশোধ করুন ও ভাউচার প্রিন্ট' : 'Disburse & Print Voucher'}
            </Button>
          </div>

          {/* Job 1 (optimistic save): the background cloud confirm failed
              — voucher stays local (badged in the ledger), retry
              re-confirms the same voucher (never a second one). */}
          {salaryConfirmError && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">{salaryConfirmError}</span>
              <button
                type="button"
                onClick={handleRetrySalaryConfirm}
                disabled={isRetrying}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-bold shrink-0 cursor-pointer"
              >
                {isRetrying ? (isBn ? 'চেষ্টা চলছে…' : 'Retrying…') : (isBn ? 'আবার চেষ্টা করুন' : 'Retry')}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Right Column (4 Cols): Summary */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <h3 className="text-sm font-bold text-rose-200 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-rose-400" />
            {isBn ? 'পে-রোল ও হাদিয়া ভাউচার' : 'Payroll Voucher Status'}
          </h3>

          <div className="mt-4 space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
            <div className="flex justify-between">
              <span>{isBn ? 'উস্তাদের নাম:' : 'Name:'}</span>
              <span className="font-bold text-white">{staffName || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'পদবি:' : 'Designation:'}</span>
              <span className="font-semibold text-rose-200">{designation}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'বেতনের মাস:' : 'Month:'}</span>
              <span className="font-bold text-white">{salaryMonth}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'মূল হাদিয়া:' : 'Basic:'}</span>
              <span className="font-semibold text-white">৳{basicSalary || 0}</span>
            </div>
            {allowance > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>{isBn ? 'ভাতা:' : 'Allowance:'}</span>
                <span>+ ৳{allowance}</span>
              </div>
            )}
            {deduction > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>{isBn ? 'কর্তন:' : 'Deduction:'}</span>
                <span>- ৳{deduction}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-800">
              <span className="font-bold text-white">{isBn ? 'সর্বমোট প্রদেয়:' : 'Net Paid:'}</span>
              <span className="font-black text-rose-400 text-base font-mono">
                ৳{isBn ? formatBanglaNumber(netPayable) : netPayable.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
