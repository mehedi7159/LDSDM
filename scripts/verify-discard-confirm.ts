/**
 * verify-discard-confirm.ts — scripted proof for the pending-payload
 * Discard confirm fix (Fix master #4, 🔴).
 *
 * Bug: "বাদ দিন" on a pending sync payload called
 * discardPendingPayload(item.id) on one click — deleting the only
 * copy of data that had not reached the cloud yet, with only a
 * tooltip as warning.
 *
 * Rule under test: the Discard button only OPENS a ConfirmDialog
 * (never discards directly); the dialog warns that the payload has
 * not reached the cloud and cannot be recovered, shows which
 * payload (field / record count), and only the dialog's confirm
 * calls discardPendingPayload for that item.
 *
 * Run: npx tsx scripts/verify-discard-confirm.ts
 */
import { readFileSync } from 'fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const src = readFileSync('components/CloudSyncWidget.tsx', 'utf8');
check("no one-click discard: button does not call discardPendingPayload directly",
  !src.includes('onClick={() => discardPendingPayload(item.id)}'));
check('Discard button opens the confirm state',
  src.includes('setConfirmDiscardPayload(item)'));
check('confirm state holds the pending payload',
  /const \[confirmDiscardPayload, setConfirmDiscardPayload\] = useState<PendingPayloadItem \| null>\(null\)/.test(src));
check("dialog warns the payload has not reached the cloud and is unrecoverable",
  src.includes('এই অপেক্ষমাণ তথ্য cloud-এ যায়নি — বাদ দিলে আর ফিরে পাওয়া যাবে না'));
check('dialog shows which payload (field / record count)',
  src.includes('pendingPayloadLabel(confirmDiscardPayload)'));
check("only the dialog confirm discards, for the confirmed item",
  src.includes('discardPendingPayload(confirmDiscardPayload.id)'));

console.log(failures === 0 ? '\nALL DISCARD-CONFIRM CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
