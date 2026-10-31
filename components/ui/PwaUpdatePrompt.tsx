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
  return null;
}

