import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

// Update prompt — the permanent end of forced reloads (29 Oct 2026).
// Deploys used to force a reload on every open phone (autoUpdate +
// skipWaiting + clientsClaim + controllerchange reload): the grey/white
// flash mid-task, and — when a chunk set changed under a running page
// — the stuck white screen. Now a new build only downloads into a
// WAITING worker (registerType 'prompt'); nothing reloads until the
// user taps the small reload button at the top. The old version keeps
// working self-consistently meanwhile, so a deploy can never interrupt
// a task or strand a page again. The button only shows while an update
// waits; tapping it applies the waiting update, same as before.
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

  // Small reload button at the top instead of the full update banner —
  // same job: applies the waiting update, then reloads onto it.
  return (
    <button
      type="button"
      onClick={() => void applyUpdate()}
      disabled={updating}
      aria-label="নতুন সংস্করণ লোড করুন"
      title="নতুন সংস্করণ লোড করুন"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white flex items-center justify-center shadow-lg cursor-pointer transition-colors"
    >
      <RotateCw size={18} className={updating ? 'animate-spin' : undefined} />
    </button>
  );
}
