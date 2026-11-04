import React from 'react';

/**
 * Phase 1 (sync hardening) — visible marker for a record whose cloud
 * confirm failed and whose payload sits in the payload queue. The
 * record is local-only until the retry lands it; the badge makes that
 * state visible instead of letting the row pass for cloud-saved.
 */
export const UnconfirmedBadge: React.FC<{ isBn?: boolean }> = ({ isBn = true }) => (
  <span
    className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
    title={
      isBn
        ? 'এই তথ্য এখনো শুধু এই ডিভাইসে আছে — cloud-এ যায়নি। ইন্টারনেট ফিরলে স্বয়ংক্রিয়ভাবে যাবে।'
        : 'This record is only on this device so far — it has not reached the cloud yet. It will retry automatically.'
    }
  >
    {isBn ? 'cloud-এ যায়নি' : 'Not in cloud yet'}
  </span>
);
