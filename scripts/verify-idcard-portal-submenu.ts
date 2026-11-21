/**
 * verify-idcard-portal-submenu.ts — scripted proof for the ID-card
 * generator sidebar fix (components/Layout.tsx only).
 *
 * Bug (morning audits 17–18 Nov 2026): the ID-card generator page
 * could not be opened from the sidebar — its submenu entry "appeared
 * once then vanished", and sidebar search found no "আইডি কার্ড".
 * The generator itself WORKS via the Student Management "আইডি কার্ড"
 * button (StudentManager.tsx) — only the sidebar path was broken.
 *
 * Root cause (read, not guessed): the desktop sidebar has exactly ONE
 * submenu — the Student Management floating flyout (RailFlyoutMenu) —
 * and it listed only 'শিক্ষার্থী তালিকা' and 'প্রোফাইল'; there was no
 * ID-card entry at all. (No "আইডি কার্ড জেনারেটর" label exists
 * anywhere in the code, and no Portal flyout exists — the flyout the
 * audit saw vanish is this transient Student Management one: it
 * closes on navigation, hover-leave, rail toggle and ESC by design.)
 * Sidebar search only matches a menu's own titles / targetTab, plus
 * one special case surfacing Student Management for 'প্রোফাইল' — so
 * searching 'আইডি কার্ড' matched nothing, even though
 * 'student_id_cards' sits in that group's associatedTabs.
 *
 * Fix: add the 'আইডি কার্ড' entry to the flyout (same tab the
 * Student Management button opens, 'student_id_cards'), and extend
 * the search special case so 'আইডি কার্ড' / 'id card' surfaces the
 * Student Management group. The generator itself is untouched.
 *
 * Cases (all source-level — the menu is a static list + filter):
 *   (1) Flyout has a student_id_cards entry
 *   (2) Its label is 'আইডি কার্ড' (bn) / 'ID Cards' (en)
 *   (3) It navigates to the 'student_id_cards' tab
 *   (4) It shows active while that tab is open
 *   (5) Sidebar search surfaces Student Management for 'আইডি কার্ড',
 *       'আইডি' and 'id card'
 *   (6) The target tab renders the generator (App.tsx case)
 *   (7) The flyout entry sits beside the existing entries (list +
 *       profile), not in some other menu
 *
 * Run: npx tsx scripts/verify-idcard-portal-submenu.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const layout = read('components/Layout.tsx');
const app = read('App.tsx');

// The flyout items block.
const flyout = (layout.match(/<RailFlyoutMenu[\s\S]*?\/>/) || [''])[0];

// (1) Flyout has a student_id_cards entry.
check('(1) Flyout has a student_id_cards entry',
  /key: 'student_id_cards'/.test(flyout));

// (2) Its label is 'আইডি কার্ড' / 'ID Cards'.
check("(2) Flyout entry is labelled 'আইডি কার্ড' / 'ID Cards'",
  /key: 'student_id_cards'[\s\S]{0,300}আইডি কার্ড/.test(flyout) &&
  /key: 'student_id_cards'[\s\S]{0,300}ID Cards/.test(flyout));

// (3) It navigates to the 'student_id_cards' tab.
check("(3) Flyout entry navigates to 'student_id_cards'",
  /key: 'student_id_cards'[\s\S]{0,400}handleTabClick\('student_id_cards'\)/.test(flyout));

// (4) It shows active while that tab is open.
check('(4) Flyout entry is active on the student_id_cards tab',
  /key: 'student_id_cards'[\s\S]{0,400}active: activeTab === 'student_id_cards'/.test(flyout));

// (5) Sidebar search surfaces Student Management for ID-card queries.
{
  const searchBlock = (layout.match(/if \(menu\.id === 'students'\) \{[\s\S]*?\n      \}/) || [''])[0];
  check("(5) Search matches 'আইডি কার্ড'",
    /আইডি কার্ড/.test(searchBlock));
  check("(5) Search matches 'id card'",
    /id card/.test(searchBlock));
  check("(5) Search still matches 'প্রোফাইল' (existing behaviour)",
    /প্রোফাইল/.test(searchBlock));
}

// (6) The target tab renders the generator.
check("(6) App 'student_id_cards' case renders StudentIDCardGenerator",
  /case 'student_id_cards':[\s\S]{0,300}<StudentIDCardGenerator \/>/.test(app));

// (7) The entry sits in the Student Management flyout, beside list + profile.
check('(7) Flyout still lists students + profile beside the new entry',
  /key: 'students'/.test(flyout) && /key: 'student_profile'/.test(flyout));

console.log(failures === 0 ? '\nALL IDCARD-PORTAL-SUBMENU CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
