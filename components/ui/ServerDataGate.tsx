import React from 'react';
import { useApp } from '../../context/AppContext';

// ---------------------------------------------------------------------------
// Server-only display gate (1 Nov 2026, user's explicit rule: ONLY server
// data is visible anywhere in the system — never localStorage-derived rows,
// not on boot, not after a timeout, not offline).
//
// - Until the first main_store snapshot lands: a plain syncing panel naming
//   the data being loaded. A slow connection keeps the spinner — the
//   unavailable panel appears ONLY when the listener actually errors or
//   the 30 s backstop expires with still no snapshot (3 Nov 2026
//   false-unavailable fix; the old 6 s timer fired while a ~2.5 MB doc
//   was merely still downloading).
// - After a listener error / the 30 s backstop with no snapshot: a
//   server-unavailable panel (retry = full reload, which re-runs the
//   feed). NEVER stale rows.
// - Once hydrated, children render directly (fragment) so parent layout
//   classes like space-y keep working unchanged.
// - This gates DISPLAY only. It does not change applyRemoteData, auto-sync,
//   login session persistence, or the pending-confirm retry queue.
// ---------------------------------------------------------------------------

export const ServerUnavailablePanel: React.FC<{ dataNameBn?: string; dataNameEn?: string }> = ({ dataNameBn, dataNameEn }) => {
  const { language } = useApp();
  const isBn = language === 'bn';
  const name = isBn ? (dataNameBn || 'সার্ভার তথ্য') : (dataNameEn || 'Server data');
  return (
    <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700 rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
      <p className="text-sm font-black text-rose-800 dark:text-rose-200">
        {isBn ? 'সার্ভার ডাটা পাওয়া যাচ্ছে না — ইন্টারনেট চেক করো' : 'Server data unavailable — check your internet connection'}
      </p>
      <p className="text-xs leading-relaxed text-rose-700 dark:text-rose-300">
        {isBn
          ? `${name} দেখানো যাচ্ছে না, কারণ সার্ভার থেকে তথ্য আসেনি। পুরোনো তথ্য দেখানো হচ্ছে না।`
          : `${name} cannot be shown because no data arrived from the server. No old data is shown.`}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-1 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
      >
        {isBn ? 'আবার চেষ্টা করুন' : 'Try again'}
      </button>
    </div>
  );
};

export const ServerDataGate: React.FC<{ dataNameBn: string; dataNameEn: string; children: React.ReactNode }> = ({ dataNameBn, dataNameEn, children }) => {
  const { cloudHydrated, cloudHydrationTimedOut, language } = useApp();
  const isBn = language === 'bn';
  if (cloudHydrated) return <>{children}</>;
  if (cloudHydrationTimedOut) return <ServerUnavailablePanel dataNameBn={dataNameBn} dataNameEn={dataNameEn} />;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center gap-3 text-center">
      <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" />
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
        {isBn ? `${dataNameBn} লোড হচ্ছে — সার্ভার থেকে আসছে` : `Loading ${dataNameEn} from server…`}
      </p>
    </div>
  );
};
