import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'button') {
      return (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 text-xs sm:text-sm transition-all active:scale-95 ${className}`}
        >
          <Download size={16} className="animate-bounce" />
          <span>{isInstalling ? 'ইনস্টল হচ্ছে...' : 'অ্যাপ ইনস্টল করুন (Install App)'}</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        title="স্মার্টফোন বা পিসিতে অ্যাপ হিসেবে ইনস্টল করুন"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition shadow-sm ${className}`}
      >
        <Download size={14} className="text-emerald-600" />
        <span className="hidden sm:inline">অ্যাপ ইনস্টল</span>
        <span className="sm:hidden">ইনস্টল</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${className}`}
        >
          <Smartphone size={14} className="text-indigo-500" />
          <span className="hidden sm:inline">iOS ইনস্টল</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">iPhone / iPad এ ইনস্টল</h3>
                  <p className="text-[11px] text-slate-500">Safari ব্রাউজার দিয়ে হোমস্ক্রিনে যোগ করুন</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <span className="font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-950 rounded-full w-5 h-5 flex items-center justify-center shrink-0">1</span>
                  <span>Safari এর নিচের মেনুতে <strong>Share (শেয়ার)</strong> আইকনে ট্যাপ করুন।</span>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <span className="font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-950 rounded-full w-5 h-5 flex items-center justify-center shrink-0">2</span>
                  <span>নিচে স্ক্রোল করে <strong>Add to Home Screen (হোম স্ক্রিনে যোগ করুন)</strong> নির্বাচন করুন।</span>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <span className="font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-950 rounded-full w-5 h-5 flex items-center justify-center shrink-0">3</span>
                  <span>উপরে <strong>Add</strong> চাপলেই আপনার ফোনে মোবাইল অ্যাপ তৈরি হয়ে যাবে।</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                ঠিক আছে (Close)
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
