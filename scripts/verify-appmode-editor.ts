/**
 * verify-appmode-editor.ts — scripted proof for the AppMode 'editor'
 * fix (Fix master #2).
 *
 * Bug: AppContext set `mode` to 'editor' in both login paths
 * (email login ~:1932, phone/session login ~:3859), but AppMode is
 * 'admin' | 'viewer' — 'editor' is outside the type — and nothing
 * reads `mode` from useApp() anywhere, so the value was dead state.
 * The claims listener already uses 'admin' for the same case.
 *
 * Rule under test: no setModeState call passes 'editor'; both login
 * paths set 'admin' for administrative users (matching the claims
 * listener); the AppMode type is unchanged.
 *
 * Behaviour-neutral by construction: `mode` is exposed in the
 * provider but never read by any component, and this change touches
 * no login path, permission, or gate — only the dead value.
 *
 * Run: npx tsx scripts/verify-appmode-editor.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const src = readFileSync('context/AppContext.tsx', 'utf8');
const editorSets = (src.match(/setModeState\([^)]*'editor'[^)]*\)/g) || []).length;
check("no setModeState call passes 'editor'", editorSets === 0, `${editorSets} occurrence(s)`);
const adminSets = (src.match(/setModeState\(isAdministrative \? 'admin' : 'viewer'\)/g) || []).length;
check("both login paths set 'admin' for administrative users", adminSets === 2, `found ${adminSets}`);
check("claims listener still sets 'admin'",
  src.includes("setModeState(hasAdminAccess ? 'admin' : 'viewer')"));
check("AppMode type unchanged ('admin' | 'viewer')",
  src.includes("export type AppMode = 'admin' | 'viewer';"));
check("no 'editor' string remains in AppContext",
  !src.includes("'editor'"));

console.log(failures === 0 ? '\nALL APPMODE-EDITOR CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
