import { Component } from 'react';
import { AlertTriangle, RefreshCw, DownloadCloud } from 'lucide-react';

// App-level error boundary — the one safety net the app never had.
// Until now, ANY render error anywhere (a failed lazy chunk after a
// deploy, a bad data shape reaching a component) unmounted the whole
// React tree and left a permanent white page with no way back — the
// 23 Oct 2026 white-screen incident, and the blank flicker in the
// 27 Oct morning video, are both this failure mode.
//
// This boundary catches those errors and shows a recovery screen
// instead of white. It deliberately uses no app context (the tree may
// be broken) and no network data — only window APIs:
//  - "আবার চেষ্টা করুন": soft retry, for transient render errors.
//  - "নতুন সংস্করণ লোড করুন": the real stale-version cure — it
//    unregisters every service worker, deletes every cache, clears
//    the chunk-reload stamp and reloads, so the browser fetches a
//    self-consistent current build from the network.
// Nothing here reloads on its own: automatic reloads are what turned
// a stale chunk into a flicker, so recovery is always one tap.
//
// NOTE ON THE .jsx EXTENSION: this project ships React 19 without
// @types/react, so a .tsx class boundary cannot typecheck here
// (Component resolves without setState/props). Plain .jsx keeps the
// safety net with zero dependency changes; do not "fix" it back to
// .tsx without installing @types/react first.
async function hardRefresh() {
  try {
    sessionStorage.removeItem('ldsdm_chunk_reload_stamp');
  } catch {
    /* storage unavailable — continue anyway */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* continue to cache clear + reload */
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* continue to reload */
  }
  window.location.reload();
}

export class AppErrorBoundary extends Component {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(err) {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(err, info) {
    try {
      console.error('[LDSDM] App render error:', err, info.componentStack);
    } catch {
      /* logging must never throw */
    }
  }

  retry = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">পেজটি খুলতে সমস্যা হয়েছে</h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              সাধারণত পুরনো সংস্করণের ফাইল আটকে থাকলে এমন হয়। নিচের বোতামে ঠিক হয়ে যাওয়া উচিত।
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void hardRefresh()}
              className="w-full px-4 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <DownloadCloud size={16} />
              <span>নতুন সংস্করণ লোড করুন</span>
            </button>
            <button
              type="button"
              onClick={this.retry}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw size={14} />
              <span>আবার চেষ্টা করুন</span>
            </button>
          </div>
          {this.state.message && (
            <details className="text-left">
              <summary className="text-[11px] font-bold text-slate-400 cursor-pointer">
                কী ভুল হয়েছে (বিস্তারিত)
              </summary>
              <p className="text-[11px] text-slate-500 break-words mt-1">{this.state.message}</p>
            </details>
          )}
        </div>
      </div>
    );
  }
}
