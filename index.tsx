import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ---------------------------------------------------------------------------
// PWA freshness — make a resumed/installed app actually pick up new builds.
//
// Registration is deliberately NOT done here: vite-plugin-pwa
// (registerType 'autoUpdate') injects /registerSW.js into index.html,
// which registers /sw.js; the generated worker uses skipWaiting +
// clientsClaim, so a discovered update activates and takes control
// immediately. (Importing registerSW from 'virtual:pwa-register' on top
// of that would register the same worker a second time, so this block
// hooks the existing registration through the raw serviceWorker API.)
//
// What was missing is the discovery + reaction side:
//
//  1. Discovery — a page that never re-navigates never re-checks sw.js.
//     The owner resumes the installed PWA from Android recents many times
//     a day, so we ask the existing registration to check for an update
//     whenever the app returns to the foreground (visibilitychange →
//     visible, and window focus) and on a 30-minute timer.
//  2. Reaction — when a NEW worker takes control of a page that was
//     already controlled (controllerchange after an update, as opposed
//     to the first install claiming an uncontrolled page), reload once
//     so the user actually sees the new build instead of the stale
//     in-memory page.
//
// Loop safety is shared with utils/lazyWithRetry.ts: both mechanisms
// reload through the same sessionStorage stamp
// ('ldsdm_chunk_reload_stamp', 30 s window). Whoever reloads first
// writes the stamp; the other mechanism sees a fresh stamp and stands
// down, so the two can never stack back-to-back reloads. The first
// install never reloads: the boot-time snapshot below sees no controller
// on an uncontrolled page, and the initial claim is ignored.
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
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
