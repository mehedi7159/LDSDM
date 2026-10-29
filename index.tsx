import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';

// ---------------------------------------------------------------------------
// PWA updates — NEVER force-reload (29 Oct 2026, permanent fix).
//
// The old behaviour (registerType 'autoUpdate' + skipWaiting +
// clientsClaim + controllerchange reload) made EVERY deploy reload
// every open phone mid-task: the grey/white flash the owner kept
// seeing again and again, and — when a chunk set changed under a
// running page — the stuck white screen. A deploy must never
// interrupt a task again, so:
//
//  1. Discovery (unchanged) — the existing registration is asked to
//     check for an update whenever the app returns to the foreground
//     (visibilitychange -> visible, and window focus) and on a
//     30-minute timer. Discovery only DOWNLOADS; it never reloads.
//  2. Reaction (changed) — with registerType 'prompt' the new worker
//     stops in the WAITING state instead of taking control. The
//     watcher below announces it (flag + 'ldsdm:update-ready' event)
//     and PwaUpdatePrompt shows a banner. Nothing reloads until the
//     user taps "আপডেট করুন", which posts SKIP_WAITING; only then
//     does the controllerchange handler below reload — once, stamped,
//     at a moment the user chose. Dismissing the banner only hides it
//     for this page session; the old version keeps working
//     self-consistently meanwhile, so a deploy can never strand a
//     page or lose unsaved form state again.
//  3. Safety nets (unchanged) — lazyWithRetry still recovers genuine
//     chunk-load failures, and AppErrorBoundary still catches render
//     errors, so a true crash shows a recovery screen, never white.
//     Loop safety is shared with utils/lazyWithRetry.ts through the
//     sessionStorage stamp ('ldsdm_chunk_reload_stamp', 30 s window).
//     The first install never reloads: the boot-time snapshot below
//     sees no controller on an uncontrolled page, and the initial
//     claim is ignored.
// ---------------------------------------------------------------------------
const PWA_RELOAD_STAMP_KEY = 'ldsdm_chunk_reload_stamp'; // shared with utils/lazyWithRetry.ts
const PWA_RELOAD_WINDOW_MS = 30_000; // must match lazyWithRetry's RELOAD_WINDOW_MS
const PWA_UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;

if ('serviceWorker' in navigator) {
  const hadControllerAtBoot = !!navigator.serviceWorker.controller;
  let pwaReloadInFlight = false;

  const readReloadStamp = (): number => {
    try {
      return Number(sessionStorage.getItem(PWA_RELOAD_STAMP_KEY) || 0);
    } catch {
      return 0;
    }
  };

  const writeReloadStamp = () => {
    try {
      sessionStorage.setItem(PWA_RELOAD_STAMP_KEY, String(Date.now()));
    } catch {
      /* the in-memory flag above still prevents a same-page loop */
    }
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First install: the page was not controlled at boot, so this claim
    // is not an update — never reload for it.
    if (!hadControllerAtBoot || pwaReloadInFlight) return;
    // A reload already happened inside the shared window (lazyWithRetry's
    // chunk recovery, or an earlier controllerchange) — do not stack
    // another one on top of it.
    if (Date.now() - readReloadStamp() < PWA_RELOAD_WINDOW_MS) return;
    pwaReloadInFlight = true;
    writeReloadStamp();
    window.location.reload();
  });

  const checkForPwaUpdate = () => {
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {
        /* offline, or registration not in place yet — next trigger retries */
      });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForPwaUpdate();
  });
  window.addEventListener('focus', checkForPwaUpdate);
  window.setInterval(checkForPwaUpdate, PWA_UPDATE_CHECK_INTERVAL_MS);
  // Waiting-worker watcher: announce a downloaded update to the banner.
  // The banner also checks on mount, so an event fired before React
  // mounts is never lost (flag + event + mount check).
  const notifyUpdateReady = () => {
    try {
      (window as any).__ldsdmUpdateReady = true;
      window.dispatchEvent(new CustomEvent('ldsdm:update-ready'));
    } catch {
      /* banner mount-check still covers this */
    }
  };
  navigator.serviceWorker
    .getRegistration()
    .then((registration) => {
      if (!registration) return;
      if (registration.waiting) notifyUpdateReady();
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && registration.waiting) notifyUpdateReady();
        });
      });
    })
    .catch(() => {
      /* no registration yet — next trigger retries */
    });
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
