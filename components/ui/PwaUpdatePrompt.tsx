import { useEffect, useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';

// Update prompt — the permanent end of forced reloads (29 Oct 2026).
// Deploys used to force a reload on every open phone (autoUpdate +
// skipWaiting + clientsClaim + controllerchange reload): the grey/white
// flash mid-task, and — when a chunk set changed under a running page
// — the stuck white screen. Now a new build only downloads into a
// WAITING worker (registerType 'prompt'); nothing reloads until the
// user taps "আপডেট করুন". The old version keeps working
// self-consistently meanwhile, so a deploy can never interrupt a task
// or strand a page again. Dismissing ("পরে") only hides the banner for
// this page session; it reappears on next mount while an update waits.
// Mounted at the App root so it shows for every role and every tab.
export function PwaUpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let alive = true;
    const show = () => {
      if (alive) setVisible(true);
    };
    // Flag (set by index.tsx before React mounts) + live registration
    // check + event: whichever fires first shows the banner.
    if ((window as any).__ldsdmUpdateReady) show();
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (alive && reg?.waiting) show();
      })
      .catch(() => {
        /* no registration — nothing to update */
      });
    window.addEventListener('ldsdm:update-ready', show);
    return () => {
      alive = false;
      window.removeEventListener('ldsdm:update-ready', show);
    };
  }, []);

  if (!visible) return null;

  const applyUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // The controllerchange handler in index.tsx reloads once the
        // new worker takes control. Fallback: reload after a delay in
        // case that event is missed (or was stamp-blocked) — the new
        // worker already controls by then, so this still lands on the
        // new version, never a second reload on top of the first.
        window.setTimeout(() => window.location.reload(), 3000);
      } else {
        // No waiting worker (another tab already updated, or the new
        // worker already controls): a plain reload lands on it.
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
          <DownloadCloud size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">নতুন সংস্করণ এসেছে</div>
          <div className="text-[11px] text-slate-300 leading-snug">
            আপডেট করলে নতুন সুবিধা ও ঠিক করা জিনিসগুলো পাবেন।
          </div>
        </div>
        <button
          type="button"
          onClick={() => void applyUpdate()}
          disabled={updating}
          className="shrink-0 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer transition-colors"
        >
          {updating ? 'আপডেট হচ্ছে…' : 'আপডেট করুন'}
        </button>
        <button
          type="button"
          aria-label="পরে"
          onClick={() => setVisible(false)}
          className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
