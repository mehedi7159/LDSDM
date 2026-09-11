import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, ShieldAlert, KeyRound, Check, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'primary';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  highlightText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  highlightText,
  confirmLabel = 'হ্যাঁ, নিশ্চিত করুন',
  cancelLabel = 'বাতিল',
  variant = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="text-rose-600" size={24} />,
          iconBg: 'bg-rose-100/80 text-rose-600',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-500/20',
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="text-amber-600" size={24} />,
          iconBg: 'bg-amber-100/80 text-amber-600',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-500/20',
          badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
        };
      case 'primary':
        return {
          icon: <KeyRound className="text-indigo-600" size={24} />,
          iconBg: 'bg-indigo-100/80 text-indigo-600',
          confirmBtn: 'bg-[#5438dc] hover:bg-[#472fc4] active:bg-[#3d27aa] text-white shadow-indigo-500/20',
          badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
        };
      default:
        return {
          icon: <HelpCircle className="text-blue-600" size={24} />,
          iconBg: 'bg-blue-100/80 text-blue-600',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/20',
          badgeBg: 'bg-blue-50 text-blue-900 border-blue-200',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${styles.iconBg}`}>
            {styles.icon}
          </div>
          <div className="pr-6">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed font-bangla">
              {message}
            </p>
          </div>
        </div>

        {highlightText && (
          <div className={`my-4 p-3 rounded-xl border text-xs font-semibold font-bangla flex items-center gap-2 ${styles.badgeBg}`}>
            <span className="truncate">{highlightText}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 active:bg-slate-200 transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5 ${styles.confirmBtn}`}
          >
            {isLoading ? (
              <span>প্রক্রিয়াধীন...</span>
            ) : (
              <>
                <Check size={15} />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
