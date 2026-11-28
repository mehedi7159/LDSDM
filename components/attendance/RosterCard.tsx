// Shared roll-call roster card — the mobile student attendance card,
// extracted so every attendance view renders the same card (U1).
// Presentational only: status handlers come from the caller; no
// save/confirm logic lives here — the existing save flow is untouched.
import React from 'react';
import { Phone } from 'lucide-react';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
import { toBengali } from '../../services/utils';
import type { AttendanceStatus } from '../../services/dailyAttendanceService';

// Card shell (was attCardCls in StaffMobileApp).
export const attCardCls = 'bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/5 rounded-2xl';

// Avatar tints (pastel bg + dark text, hashed by id) — moved from StaffMobileApp.
export const ATT_AVATAR_TINTS = [
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#fee2e2', color: '#b91c1c' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#ffedd5', color: '#c2410c' },
] as const;
export const attAvatarTint = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ATT_AVATAR_TINTS[h % ATT_AVATAR_TINTS.length];
};
export const attInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Status look — single source of truth for every roll-call view.
// solid = tapped state, soft = untapped state, badge = the status pill.
export const ROSTER_STATUS_META: Record<AttendanceStatus, {
  labelEn: string; labelBn: string; solidCls: string; softCls: string; badgeCls: string;
}> = {
  PRESENT: {
    labelEn: 'Present', labelBn: 'উপস্থিত',
    solidCls: 'bg-[#10b981] text-white w-full',
    softCls: 'bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300 w-full',
    badgeCls: 'bg-[#d1fae5] dark:bg-emerald-500/15 text-[#10b981] dark:text-emerald-300',
  },
  ABSENT: {
    labelEn: 'Absent', labelBn: 'অনুপস্থিত',
    solidCls: 'bg-[#ef4444] text-white w-full',
    softCls: 'bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 w-full',
    badgeCls: 'bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300',
  },
  LATE: {
    labelEn: 'Late', labelBn: 'দেরি',
    solidCls: 'bg-[#f59e0b] text-white w-full',
    softCls: 'bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 w-full',
    badgeCls: 'bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300',
  },
  LEAVE: {
    labelEn: 'Leave', labelBn: 'ছুটি',
    solidCls: 'bg-[#3b82f6] text-white w-full',
    softCls: 'bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300 w-full',
    badgeCls: 'bg-[#dbeafe] dark:bg-blue-500/15 text-[#3b82f6] dark:text-blue-300',
  },
};
export const ROSTER_UNMARKED_BADGE_CLS = 'bg-[#f4f6fb] dark:bg-white/5 text-[#8a93a8] dark:text-slate-400';

const ROSTER_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

export interface RosterCardProps {
  id: string;
  name: string;
  /** Phone • roll line, built by the caller (keeps i18n + digit formatting there). */
  subLine: React.ReactNode;
  status?: AttendanceStatus;
  lateMinutes?: number;
  isEn: boolean;
  /** True when the record is local-only (cloud confirm pending/failed). */
  unconfirmed?: boolean;
  onSelect: (status: AttendanceStatus) => void;
  /** LATE opens the caller's drum picker instead of stamping at once. */
  onLatePress: () => void;
}

export const RosterCard: React.FC<RosterCardProps> = (props) => {
  const { id, name, subLine, status, lateMinutes, isEn, unconfirmed, onSelect, onLatePress } = props;
  const tint = attAvatarTint(id);
  const badgeCls = status === undefined ? ROSTER_UNMARKED_BADGE_CLS : ROSTER_STATUS_META[status].badgeCls;
  const badgeLabel = status === undefined
    ? (isEn ? 'Not marked' : 'চিহ্নিত নয়')
    : status === 'PRESENT'
    ? (isEn ? 'Present' : 'উপস্থিত')
    : status === 'ABSENT'
    ? (isEn ? 'Absent' : 'অনুপস্থিত')
    : status === 'LATE'
    ? (lateMinutes ? `${isEn ? 'Late' : 'দেরি'} · ${isEn ? String(lateMinutes) : toBengali(lateMinutes)} ${isEn ? 'min' : 'মিনিট'}` : (isEn ? 'Late' : 'দেরি'))
    : (isEn ? 'Leave' : 'ছুটি');
  return (
    <div className={`${attCardCls} p-4`}>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0"
          style={{ background: tint.bg, color: tint.color }}
        >
          {attInitials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] truncate">{name}</p>
          <p className="flex items-center gap-1 text-[12px] mt-0.5 text-[#5b6478] dark:text-slate-400">
            <Phone size={12} className="shrink-0" />
            <span className="truncate">{subLine}</span>
          </p>
          {unconfirmed && <UnconfirmedBadge isBn={!isEn} />}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${badgeCls}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {ROSTER_STATUSES.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => s === 'LATE' ? onLatePress() : onSelect(s)}
            className={`h-11 rounded-xl text-[13px] font-bold cursor-pointer active:scale-[0.98] transition-all ${status === s ? ROSTER_STATUS_META[s].solidCls : ROSTER_STATUS_META[s].softCls}`}
          >
            {isEn ? ROSTER_STATUS_META[s].labelEn : ROSTER_STATUS_META[s].labelBn}
          </button>
        ))}
      </div>
    </div>
  );
};

export interface RosterQuickActionsProps {
  /** No students in the roster. */
  disabled: boolean;
  /** Nothing marked yet. */
  resetDisabled: boolean;
  isEn: boolean;
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onReset: () => void;
}

export function RosterQuickActions(props: RosterQuickActionsProps) {
  const { disabled, resetDisabled, isEn, onMarkAllPresent, onMarkAllAbsent, onReset } = props;
  return (
    <>
      <button
        type="button"
        onClick={onMarkAllPresent}
        disabled={disabled}
        className="flex-1 min-w-[130px] h-10 rounded-xl text-[13px] font-bold disabled:opacity-50 bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 cursor-pointer"
      >
        ✓ {isEn ? 'ALL PRESENT' : 'সবাই উপস্থিত'}
      </button>
      <button
        type="button"
        onClick={onMarkAllAbsent}
        disabled={disabled}
        className="flex-1 min-w-[130px] h-10 rounded-xl text-[13px] font-bold disabled:opacity-50 bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 cursor-pointer"
      >
        ✗ {isEn ? 'ALL ABSENT' : 'সবাই অনুপস্থিত'}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={resetDisabled}
        className="h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-50 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 cursor-pointer"
      >
        {isEn ? 'Reset' : 'রিসেট'}
      </button>
    </>
  );
}

export interface RosterSummaryStats {
  present: number;
  late: number;
  absent: number;
  leave: number;
  unmarked: number;
}

export function RosterSummaryChips(props: { stats: RosterSummaryStats; isEn: boolean }) {
  const { stats, isEn } = props;
  return (
    <div className="flex gap-2 flex-wrap">
      {([
        { label: isEn ? 'Present' : 'উপস্থিত', value: stats.present, cls: 'text-[#10b981] dark:text-emerald-300' },
        { label: isEn ? 'Late' : 'দেরি', value: stats.late, cls: 'text-[#d97706] dark:text-amber-300' },
        { label: isEn ? 'Absent' : 'অনুপস্থিত', value: stats.absent, cls: 'text-[#dc2626] dark:text-rose-300' },
        { label: isEn ? 'Leave' : 'ছুটি', value: stats.leave, cls: 'text-[#3b82f6] dark:text-blue-300' },
        { label: isEn ? 'Unmarked' : 'চিহ্নিত নয়', value: stats.unmarked, cls: 'text-[#5b6478] dark:text-slate-400' },
      ] as const).map(c => (
        <div key={c.label} className="flex-1 min-w-[70px] rounded-xl px-2 py-2 text-center bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10">
          <p className={`text-[15px] font-bold ${c.cls}`}>{isEn ? String(c.value) : toBengali(c.value)}</p>
          <p className="text-[11px] text-[#5b6478] dark:text-slate-400">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
