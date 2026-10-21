import React from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface StickyActionFooterProps {
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  isSaving?: boolean;
  isDirty?: boolean;
  disabled?: boolean;
  statusMessage?: string;
  extraActions?: React.ReactNode;
  className?: string;
}

export const StickyActionFooter: React.FC<StickyActionFooterProps> = ({
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
  isSaving = false,
  isDirty = true,
  disabled = false,
  statusMessage,
  extraActions,
  className = ''
}) => {
  const { language } = useApp();
  const isBn = language === 'bn';

  const defaultSaveText = isBn ? 'সংরক্ষণ করুন' : 'Save Changes';
  const defaultCancelText = isBn ? 'বাতিল' : 'Cancel';

  return (
    <div
      className={`sticky bottom-0 left-0 right-0 z-30 -mx-3.5 sm:-mx-6 -mb-3.5 sm:-mb-6 mt-6 p-3 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {/* Left side: status or unsaved changes indicator */}
      <div className="flex items-center gap-2 text-xs">
        {statusMessage ? (
          <span className="text-slate-500 dark:text-slate-400 font-medium">{statusMessage}</span>
        ) : isDirty ? (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{isBn ? 'সংরক্ষণ বাকি রয়েছে' : 'Unsaved changes'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <Check size={14} />
            <span>{isBn ? 'সকল তথ্য সংরক্ষিত' : 'All changes saved'}</span>
          </div>
        )}
      </div>

      {/* Right side: buttons with 44px min touch targets */}
      <div className="flex items-center gap-2.5 ml-auto">
        {extraActions}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            {cancelLabel || defaultCancelText}
          </button>
        )}

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled || isSaving}
            className="min-h-[44px] min-w-[100px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            style={{
              backgroundColor: 'var(--color-brand, #4f46e5)'
            }}
          >
            {isSaving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{saveLabel || defaultSaveText}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
