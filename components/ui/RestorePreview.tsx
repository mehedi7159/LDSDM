import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import type { RestorePreview } from '../../services/multiStorePersistence';

interface RestorePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  titleBn: string;
  titleEn: string;
  preview: RestorePreview | null;
  language: string;
}

/**
 * Phase 3 (sync hardening): the restore preview shown BEFORE any
 * restore runs, on every restore path (vault rollback, file restore,
 * cloud snapshot restore). Current-vs-snapshot counts, degraded
 * warnings, field-completeness warnings, and exactly which lists
 * will shrink. Nothing here writes anything — confirm is the caller's
 * job, and the caller passes this preview's confirmed shrink map to
 * the restore writer, which refuses any shrink the preview did not
 * confirm. Rows wrap (no horizontal scroll) on mobile.
 */
export const RestorePreviewModal: React.FC<RestorePreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  titleBn,
  titleEn,
  preview,
  language,
}) => {
  if (!isOpen || !preview) return null;
  const bn = language === 'bn';
  const warnings = bn ? preview.warningsBn : preview.warningsEn;
  const shrinkCount = Object.keys(preview.shrinks).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {bn ? titleBn : titleEn}
            </h3>
            {preview.sourceLabel ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {bn ? 'উৎস: ' : 'Source: '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{preview.sourceLabel}</span>
                {preview.sourceTime ? ` • ${new Date(preview.sourceTime).toLocaleString(bn ? 'bn-BD' : 'en-US')}` : ''}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{bn ? 'সতর্কতা — ভালো করে দেখুন' : 'Warnings — read carefully'}</span>
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="leading-relaxed">• {w}</div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            <span className="flex-1">{bn ? 'তথ্য' : 'Data'}</span>
            <span className="w-20 text-right">{bn ? 'বর্তমান' : 'Current'}</span>
            <span className="w-20 text-right">{bn ? 'স্ন্যাপশট' : 'Snapshot'}</span>
          </div>
          {preview.rows.map((row) => {
            const shrinking = typeof row.from === 'number' && typeof row.to === 'number' && row.to < row.from;
            return (
              <div
                key={row.key}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl text-xs ${
                  shrinking ? 'bg-rose-50 dark:bg-rose-950/40 font-semibold text-rose-900 dark:text-rose-200' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="flex-1 font-semibold">{bn ? row.labelBn : row.labelEn}</span>
                <span className="w-20 text-right tabular-nums">{typeof row.from === 'number' ? row.from : '—'}</span>
                <span className="w-20 text-right tabular-nums">
                  {typeof row.to === 'number' ? row.to : '—'}
                  {shrinking ? ' ▼' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {typeof preview.completenessPct === 'number' && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            {bn
              ? `স্ন্যাপশটের শিক্ষার্থী রেকর্ডের সম্পূর্ণতা: ${preview.completenessPct}%`
              : `Snapshot student record completeness: ${preview.completenessPct}%`}
          </p>
        )}

        <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed flex items-start gap-2">
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>
            {bn
              ? 'রিস্টোরের আগে বর্তমান অবস্থার একটি সেফটি স্ন্যাপশট ভল্ট ও ক্লাউডে বানানো হবে — ভুল রিস্টোর হলেও আগের অবস্থায় ফেরা যাবে। রিস্টোরের পর ক্লাউড থেকে আবার পড়ে যাচাই করা হবে।'
              : 'Before restoring, a safety snapshot of the current state is saved to the vault and the cloud — a bad restore can be undone. After restoring, the cloud is re-read to verify the counts.'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            {bn ? 'বাতিল' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={`px-5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 ${
              preview.isDegraded || shrinkCount > 0
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isConfirming
              ? (bn ? 'রিস্টোর হচ্ছে...' : 'Restoring...')
              : preview.isDegraded
                ? (bn ? 'বুঝেছি, তারপরও রিস্টোর করুন' : 'Understood — restore anyway')
                : (bn ? 'হ্যাঁ, রিস্টোর করুন' : 'Yes, restore')}
          </button>
        </div>
      </div>
    </div>
  );
};
