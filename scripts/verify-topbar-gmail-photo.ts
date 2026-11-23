/**
 * Topbar Gmail profile photo — self-check (23 Nov 2026).
 *
 * Problem (Sagor, 23 Nov 2026, 18:12): "na egula lagbe na mail er
 * profile pic dekhalei hobe na hole dekhate hobe na age jemon silo
 * omn e logo rakho" — NO to a user-photo upload feature and NO to
 * the madrasa logo. Just: show the MAIL's (Gmail/Google account's)
 * profile pic in the topbar button when available; otherwise show
 * nothing extra — keep the logo exactly as it was before (teal box
 * + first letter). AND he reports the button itself is missing on
 * his desktop screen.
 *
 * What the investigation found (Part 1): the button renders only
 * when `authUser` is set (`{authUser && (...)}` in
 * components/Layout.tsx) — authUser is the Firebase User, set by
 * onAuthStateChanged. The chip has existed since 3 Nov 2026
 * (cefbe73) in every bundle since, so a stale bundle alone does
 * NOT hide it. On Sagor's desktop the Firebase Auth state is
 * missing (local-only session restored from localStorage —
 * AppContext.tsx:2265-2282 explicitly sets authUser to null and
 * drops to viewer mode when the Firebase user is null), so the
 * button is hidden AND Firestore writes are rejected (rules need
 * an authenticated user) — the same root cause as the "cloud-এ
 * যায়নি" reports. The fix on HIS PC is a fresh sign-in (fresh /
 * incognito window), not a code change — so the `{authUser && ...}`
 * gate is deliberately UNCHANGED here. The live bundle already
 * contains the button ("আমার তথ্য" 1×, "লগ আউট" 1× in
 * index-BY2H1YcU.js) and the 23 Nov morning audit verified the
 * panel live in a fresh load.
 *
 * Fix (Part 2, smallest complete version): the identity button
 * shows authUser.photoURL (the Google account's profile pic,
 * present only after a Google sign-in) as a 6×6 rounded image in
 * the exact place of the teal initial box; a load error falls back
 * to the initials. When photoURL is empty the button looks EXACTLY
 * as before — teal box + first letter. No upload feature, no
 * AppUser photo field, no madrasa-logo change.
 *
 * Honest limit: the principal signs in with email+password, so
 * his Auth photoURL is empty — the initials stay until he signs
 * in with Google (same email ldsdm.2003@gmail.com).
 *
 * Run: npx tsx scripts/verify-topbar-gmail-photo.ts
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Dynamic import on purpose: before the fix this helper does not exist
// yet, and a static import would crash the whole script instead of
// reporting RED check by check.
let topbarAvatarKind: any = null;
try {
  ({ topbarAvatarKind } = await import('../services/profileAvatar'));
} catch { /* stays null until the fix lands */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

const layout = readSource('components/Layout.tsx');
const types = readSource('types.ts');

// --- Identity-button slice: from the "User identity" comment to the panel ---
const btnStart = layout.indexOf('User identity (compact)');
const panelStart = layout.indexOf('{isProfileMenuOpen && (', btnStart >= 0 ? btnStart : 0);
const button = btnStart >= 0 && panelStart > btnStart
  ? layout.slice(btnStart, panelStart)
  : '';

console.log('--- photo-or-initial decision (runtime) ---');
check('photoURL present + load OK -> photo', () => {
  assert.ok(topbarAvatarKind, 'services/profileAvatar.ts must export topbarAvatarKind');
  assert.strictEqual(topbarAvatarKind('https://lh3.googleusercontent.com/a-/photo', false), 'photo');
});
check('photoURL null -> initial', () => {
  assert.strictEqual(topbarAvatarKind(null, false), 'initial');
});
check('photoURL empty string -> initial', () => {
  assert.strictEqual(topbarAvatarKind('', false), 'initial');
});
check('photoURL whitespace-only -> initial', () => {
  assert.strictEqual(topbarAvatarKind('   ', false), 'initial');
});
check('photoURL present but load failed -> initial (no broken image)', () => {
  assert.strictEqual(topbarAvatarKind('https://lh3.googleusercontent.com/a-/photo', true), 'initial');
});

console.log('--- Layout wiring (static) ---');
check('button renders the Gmail photo from authUser.photoURL', () => {
  assert.ok(button.length > 0, 'identity button block must exist in Layout');
  assert.ok(button.includes('authUser.photoURL'), 'button must read authUser.photoURL');
  assert.ok(button.includes('<img'), 'button must render an <img> for the photo');
  assert.ok(button.includes('src={authUser.photoURL'), 'img src must be authUser.photoURL');
});
check('photo img keeps the exact 6x6 rounded box (button size unchanged)', () => {
  assert.ok(button.includes('w-6 h-6 rounded-lg object-cover'), 'photo img must be w-6 h-6 rounded-lg object-cover');
});
check('photo load error falls back to initials', () => {
  assert.ok(button.includes('onError'), 'photo img must have an onError fallback');
  assert.ok(button.includes('topbarAvatarKind('), 'button must decide via topbarAvatarKind');
});
check('without a photo the EXACT old initials look stays', () => {
  assert.ok(button.includes('bg-[var(--color-brand)]'), 'initials box must keep the teal background');
  assert.ok(button.includes('[0].toUpperCase()'), 'initials must still be the first letter uppercased');
  assert.ok(button.includes("authUser.displayName ||"), 'initials must still derive from displayName/email');
});
check('the authUser gate is UNCHANGED (missing button = missing Firebase auth, fixed by re-sign-in, not by code)', () => {
  assert.ok(layout.includes('{authUser && ('), 'button must still render only when authUser is set');
});
check('panel still opens on click (toggle, aria-expanded)', () => {
  assert.ok(layout.includes('onClick={() => setIsProfileMenuOpen(v => !v)}'), 'button must toggle the menu on click');
  assert.ok(layout.includes('aria-expanded={isProfileMenuOpen}'), 'button must expose aria-expanded');
  assert.ok(layout.includes('আমার তথ্য'), 'button must keep the আমার তথ্য label');
});
check('NO new photo-upload feature and NO madrasa-logo change', () => {
  assert.ok(!layout.includes('type="file"'), 'Layout must not add a file-upload input');
  assert.ok(!layout.includes('logoUrl'), 'Layout must not touch the madrasa logo');
  assert.ok(!/photo\s*:\s*string/.test(types) && !types.includes('photoUrl?: string'),
    'AppUser must not gain a photo field (Gmail photoURL only)');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
