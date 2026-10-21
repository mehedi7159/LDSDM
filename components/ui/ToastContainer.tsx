import React from 'react';
import { CheckCircle2, Trash2, RotateCcw, AlertTriangle, Info, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useTheme();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isDelete = toast.type === 'delete';
        const isRestore = toast.type === 'restore';
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';
        const isSuccess = toast.type === 'success' || (!isDelete && !isRestore && !isError && !isInfo);

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in group"
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {isSuccess && (
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              )}
              {isDelete && (
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 size={16} />
                </div>
              )}
              {isRestore && (
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <RotateCcw size={16} />
                </div>
              )}
              {isError && (
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200/60 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <AlertTriangle size={16} />
                </div>
              )}
              {isInfo && (
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Info size={16} />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-0.5">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {toast.message}
              </p>

              {/* Undo action button */}
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onUndo?.();
                    removeToast(toast.id);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-900 dark:text-white transition cursor-pointer active:scale-95 min-h-[32px]"
                >
                  <RotateCcw size={12} />
                  <span>পুনরুদ্ধার করুন (Undo)</span>
                </button>
              )}
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="Close toast"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
