/**
 * New-notice button in Viewer Mode — self-check (12 Nov 2026).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-notice-button-viewer.ts
 * (or npm run test:notice-button-viewer).
 *
 * Bug: in Viewer Mode (principal account missing the admin claim, so
 * the session is read-only) the "নতুন নোটিশ" button rendered but was
 * inert — click opened no form and showed no message (silent failure).
 *
 * Fix contract (both notice surfaces — the full NoticeBoard and the
 * dashboard DashboardNoticeWidget):
 *  - The new-notice button renders in Viewer Mode too, so the action
 *    exists to be refused with words instead of vanishing / dying.
 *  - Clicking it in Viewer Mode (mode === 'viewer' from useApp())
 *    shows an error toast via the existing useTheme().showToast —
 *    the same mechanism ExamManager uses for a refused save — with a
 *    clear Bengali message that notices cannot be added in Viewer Mode.
 *    The compose modal must NOT open on that path.
 *  - Admin behaviour is unchanged: non-viewer clicks still open the
 *    compose modal; no auth/login logic, no Firestore Rules and no
 *    admin-role activation flow is touched.
 *
 * The components are React, so this is covered by source-order
 * assertions (the repo's established grep-proof style).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

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

const VIEWER_MSG = 'ভিউয়ার মোডে নোটিশ যোগ করা যাবে না';

function boardSrc() { return readSource('components/NoticeBoard.tsx'); }
function widgetSrc() { return readSource('components/DashboardNoticeWidget.tsx'); }

console.log('--- Viewer Mode is read from useApp() mode ---');

check('NoticeBoard reads mode from useApp()', () => {
  const src = boardSrc();
  assert.ok(src.includes('mode,') || src.includes('mode }') || src.includes('mode,'), 'NoticeBoard must destructure mode from useApp()');
  assert.ok(src.includes("mode === 'viewer'"), "NoticeBoard must test mode === 'viewer'");
});

check('DashboardNoticeWidget reads mode from useApp()', () => {
  const src = widgetSrc();
  assert.ok(src.includes("mode === 'viewer'"), "DashboardNoticeWidget must test mode === 'viewer'");
});

console.log('--- Blocked click shows a clear Bengali error toast, no modal ---');

check('NoticeBoard new-notice path toasts the Viewer Mode message and returns before opening the modal', () => {
  const src = boardSrc();
  assert.ok(src.includes("showToast({"), 'NoticeBoard must use the existing showToast mechanism');
  assert.ok(src.includes(VIEWER_MSG), `toast message must say: ${VIEWER_MSG}`);
  assert.ok(src.includes("type: 'error'"), 'Viewer Mode refusal must be an error toast');
  // The guard lives in openCompose and returns before the modal opens,
  // but only for a NEW notice — editing an existing one is untouched.
  const at = src.indexOf('const openCompose = ');
  assert.ok(at > -1, 'openCompose must exist');
  const body = src.slice(at, src.indexOf('\n  };', at));
  assert.ok(body.includes('isViewerMode'), 'openCompose must test the viewer flag');
  assert.ok(src.includes("const isViewerMode = mode === 'viewer'"), "isViewerMode must mean mode === 'viewer'");
  assert.ok(body.includes('!noticeToEdit'), 'viewer guard must apply to new notices only');
  assert.ok(body.includes(VIEWER_MSG), 'openCompose must toast the Viewer Mode message');
  assert.ok(body.indexOf('return;') < body.indexOf('setIsComposeModalOpen(true)'), 'guard must return before the modal opens');
});

check('DashboardNoticeWidget new-notice click toasts the Viewer Mode message and does not open the modal', () => {
  const src = widgetSrc();
  assert.ok(src.includes("showToast({"), 'DashboardNoticeWidget must use the existing showToast mechanism');
  assert.ok(src.includes(VIEWER_MSG), `toast message must say: ${VIEWER_MSG}`);
  assert.ok(src.includes("type: 'error'"), 'Viewer Mode refusal must be an error toast');
  const at = src.indexOf('handleNewNoticeClick');
  assert.ok(at > -1, 'widget must have a new-notice click handler');
  const body = src.slice(at, src.indexOf('\n  };', at));
  assert.ok(body.includes('isViewerMode'), 'handler must test the viewer flag');
  assert.ok(src.includes("const isViewerMode = mode === 'viewer'"), "isViewerMode must mean mode === 'viewer'");
  assert.ok(body.indexOf('return;') < body.indexOf('setIsComposeModalOpen(true)'), 'handler must return before the modal opens');
});

console.log('--- Button renders in Viewer Mode (refusable, not invisible) ---');

check('NoticeBoard new-notice button renders for viewers too', () => {
  const src = boardSrc();
  assert.ok(src.includes('canManage || isViewerMode'), 'NoticeBoard button must render when canManage || isViewerMode');
});

check('DashboardNoticeWidget new-notice button renders for viewers too', () => {
  const src = widgetSrc();
  assert.ok(src.includes('canManage || isViewerMode'), 'widget button must render when canManage || isViewerMode');
});

console.log('--- Admin behaviour unchanged, guardrails intact ---');

check('NoticeBoard still opens the compose modal for non-viewers', () => {
  const src = boardSrc();
  assert.ok(src.includes('setIsComposeModalOpen(true)'), 'compose modal must still open');
});

check('no auth/login, admin-activation or rules change in either file', () => {
  for (const src of [boardSrc(), widgetSrc()]) {
    assert.ok(!src.includes('activateOwnerAdmin') && !src.includes('Activate Owner Admin'), 'must not touch the admin-role activation flow');
    assert.ok(!src.includes('signInWith'), 'must not touch login logic');
  }
  assert.ok(!readSource('firestore.rules').includes('notices'), 'firestore.rules must be untouched by this job (no notices rule)');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:notice-button-viewer'], 'tsx scripts/verify-notice-button-viewer.ts', 'npm run test:notice-button-viewer must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: notice-button-viewer self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
