import { lazy, type ComponentType } from 'react';

/**
 * lazyWithRetry — drop-in replacement for React.lazy for tab/route chunks.
 *
 * Why this exists (the 23 Oct 2026 white-screen incident): the app is a
 * PWA whose service worker precaches every chunk and activates updates
 * immediately (autoUpdate + skipWaiting + clientsClaim +
 * cleanupOutdatedCaches). When a deploy lands while a phone still holds
 * the previous page in memory, that page lazily imports chunks by their
 * OLD content-hash names — names that no longer exist in the new
 * precache nor on the server (Vercel replaces the deployment atomically).
 * The import rejects ("Failed to fetch dynamically imported module"),
 * and because the tree has no error boundary, React unmounts everything:
 * a completely white page (seen on the accountant's StaffMobileApp home
 * and on the StudentManager page).
 *
 * The standard cure, applied here: on a chunk-load failure, reload the
 * page ONCE — the reload fetches the current index.html and chunk set,
 * which is always self-consistent — instead of dying white. A
 * sessionStorage stamp guards against reload loops: if a chunk fails
 * again within 30 s of a reload (i.e. the chunk is genuinely broken, not
 * merely stale), the original error is rethrown rather than reloading
 * forever.
 */
const RELOAD_STAMP_KEY = 'ldsdm_chunk_reload_stamp';
const RELOAD_WINDOW_MS = 30_000;

/** Environment seam so the retry policy is unit-testable outside a browser. */
export interface ChunkRetryEnv {
  now: () => number;
  getStamp: () => number;
  setStamp: (t: number) => void;
  clearStamp: () => void;
  reload: () => void;
  canReload: boolean;
}

let memoryStamp = 0;
const browserEnv: ChunkRetryEnv = {
  now: () => Date.now(),
  getStamp: () => {
    try {
      return Number(sessionStorage.getItem(RELOAD_STAMP_KEY) || 0);
    } catch {
      return memoryStamp;
    }
  },
  setStamp: (t: number) => {
    memoryStamp = t;
    try {
      sessionStorage.setItem(RELOAD_STAMP_KEY, String(t));
    } catch {
      /* memory fallback above still applies */
    }
  },
  clearStamp: () => {
    memoryStamp = 0;
    try {
      sessionStorage.removeItem(RELOAD_STAMP_KEY);
    } catch {
      /* ignore */
    }
  },
  reload: () => {
    window.location.reload();
  },
  canReload:
    typeof window !== 'undefined' &&
    typeof window.location?.reload === 'function'
};

/**
 * Run a dynamic import with the stale-chunk recovery policy:
 * success → clear the stamp, return the module;
 * failure → if a reload is allowed and none happened in the last
 * RELOAD_WINDOW_MS, stamp + reload and never settle (the page is being
 * replaced; Suspense keeps its fallback meanwhile); otherwise rethrow.
 */
export async function importWithChunkRetry<T>(
  factory: () => Promise<T>,
  env: ChunkRetryEnv = browserEnv
): Promise<T> {
  try {
    const mod = await factory();
    env.clearStamp();
    return mod;
  } catch (err) {
    if (env.canReload && env.now() - env.getStamp() >= RELOAD_WINDOW_MS) {
      env.setStamp(env.now());
      env.reload();
      return new Promise<T>(() => {});
    }
    throw err;
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() => importWithChunkRetry(factory));
}
