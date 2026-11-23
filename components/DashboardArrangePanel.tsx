// "ড্যাশবোর্ড সাজান" — arrange-your-own-dashboard panel (22 Nov 2026,
// principal's word). Lives inside My Settings (SettingsPage), ungated,
// so every role gets it. The SYSTEM is copied from the reference app
// (visible list with up/down + red hide, "লুকানো অংশ" with green show,
// reset button, saves as soon as it changes) — the reference's PURPLE
// is NOT copied: LDSDM's own flat teal, Anek Bangla, no gradient/glass.
//
// Saving is immediate and separate from SettingsPage's draft/save bar
// below (language/appearance/notifications still use their draft):
// every tap calls saveDashboardLayout — cloud first, local fallback —
// and dispatches 'dashboard-layout-changed' so the Dashboard (and the
// mobile home) re-reads the layout at once. There is no save button
// here. The status line says honestly whether the layout reached the
// cloud or stayed on this device only.
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Banknote,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutGrid,
  LayoutTemplate,
  ListChecks,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  UserCheck,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import {
  arrangeableSections,
  dashboardRoleKey,
  defaultLayout,
  loadDashboardLayout,
  loadDashboardLayoutLocal,
  moveSection,
  resetLayout,
  retryDashboardLayoutCloudSave,
  saveDashboardLayout,
  toggleSectionHidden,
  type DashboardLayout,
  type DashboardSectionId
} from '../services/dashboardLayout';

const ICONS: Record<DashboardSectionId, LucideIcon> = {
  hero: LayoutGrid,
  mobileStats: BarChart3,
  notices: Bell,
  approvals: UserCheck,
  tasks: ListChecks,
  academic: GraduationCap,
  finance: Wallet,
  attendance: ClipboardCheck,
  incomeExpense: Scale,
  feeCollection: Banknote,
  reports: FileSpreadsheet,
  doors: LayoutTemplate
};

export const DashboardArrangePanel: React.FC = () => {
  const { currentUser, currentMember, isOwnerAdmin, isSuperAdmin, language } = useApp();
  const isBn = language === 'bn';
  const userId = currentUser?.id || 'anonymous';
  const role = dashboardRoleKey(currentUser?.role, currentMember?.roleId, isOwnerAdmin || isSuperAdmin);

  const [layout, setLayout] = useState<DashboardLayout>(() =>
    loadDashboardLayoutLocal(userId) ?? defaultLayout()
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'cloud' | 'local'>('idle');
  // Fresh status for the background listeners without re-subscribing.
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;

  useEffect(() => {
    let cancelled = false;
    loadDashboardLayout(userId).then(({ layout: cloudLayout, source }) => {
      if (cancelled) return;
      setLayout(cloudLayout);
      if (source !== 'cloud') {
        // Cloud has no layout for this user (or the read failed) but
        // this device kept one: push it now. Before this, a single
        // failed save stayed local forever — the next manual change
        // was the only retry, so "পরে আবার চেষ্টা হবে" never happened.
        void retryDashboardLayoutCloudSave(userId).then(where => {
          if (!cancelled && where !== 'none') setSaveStatus(where);
        });
      }
    });
    const onRetry = () => {
      if (saveStatusRef.current === 'local') {
        void retryDashboardLayoutCloudSave(userId).then(where => {
          if (!cancelled && where !== 'none') setSaveStatus(where);
        });
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') onRetry(); };
    window.addEventListener('online', onRetry);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onRetry);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  const apply = (next: DashboardLayout) => {
    setLayout(next);
    setSaveStatus('saving');
    saveDashboardLayout(userId, next).then(where => {
      setSaveStatus(where);
      window.dispatchEvent(new Event('dashboard-layout-changed'));
    });
  };

  const sections = arrangeableSections(layout, role);
  const visible = sections.filter(s => !s.hidden);
  const hidden = sections.filter(s => s.hidden);
  const heroHidden = hidden.some(s => s.def.id === 'hero');

  const statusText =
    saveStatus === 'saving' ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
    : saveStatus === 'cloud' ? (isBn ? 'ক্লাউডে সংরক্ষিত হয়েছে' : 'Saved to cloud')
    : saveStatus === 'local' ? (isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — ক্লাউডে যায়নি, পরে আবার চেষ্টা হবে' : 'Saved on this device only — not to the cloud yet, will retry later')
    : '';

  return (
    <section className="bg-white border border-slate-100 p-4 mb-3" style={{ borderRadius: 'var(--ldsdm-radius, 1rem)' }}>
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1.5">
        <LayoutGrid size={17} style={{ color: 'var(--color-brand)' }} />
        {isBn ? 'ড্যাশবোর্ড সাজান' : 'Arrange Dashboard'}
      </h2>
      <p className="text-xs text-slate-500 mb-1">
        {isBn
          ? 'কোন অংশ কোথায় থাকবে আর কোনটা দেখাবে না — নিজের মতো সাজিয়ে নিন। বদলালেই সেভ হয়ে যাবে।'
          : 'Choose which parts show and in what order — arrange it your way. It saves as soon as you change it.'}
      </p>
      {statusText && (
        <p className={`text-xs font-bold mb-2 ${saveStatus === 'local' ? 'text-amber-600' : 'text-teal-700'}`}>{statusText}</p>
      )}

      <div className="divide-y divide-slate-100">
        {visible.map(({ def }, i) => {
          const Icon = ICONS[def.id];
          return (
            <div key={def.id} className="flex items-center gap-2 py-2.5">
              <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Icon size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 truncate">{isBn ? def.titleBn : def.titleEn}</span>
                {def.subtitleBn && (
                  <span className="block text-[11px] text-slate-500 truncate">{def.subtitleBn}</span>
                )}
              </span>
              <button
                type="button"
                aria-label={isBn ? `${def.titleBn} উপরে নিন` : `Move ${def.titleEn} up`}
                disabled={i === 0}
                onClick={() => apply(moveSection(layout, def.id, 'up'))}
                className="w-11 h-11 min-h-[44px] rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 disabled:opacity-30 cursor-pointer"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                aria-label={isBn ? `${def.titleBn} নিচে নিন` : `Move ${def.titleEn} down`}
                disabled={i === visible.length - 1}
                onClick={() => apply(moveSection(layout, def.id, 'down'))}
                className="w-11 h-11 min-h-[44px] rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 disabled:opacity-30 cursor-pointer"
              >
                <ChevronDown size={18} />
              </button>
              <button
                type="button"
                aria-label={isBn ? `${def.titleBn} লুকান` : `Hide ${def.titleEn}`}
                onClick={() => apply(toggleSectionHidden(layout, def.id))}
                className="w-11 h-11 min-h-[44px] rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Minus size={18} />
              </button>
            </div>
          );
        })}
      </div>

      {hidden.length > 0 && (
        <>
          <p className="text-xs font-bold text-slate-500 mt-3 mb-1">{isBn ? 'লুকানো অংশ' : 'Hidden sections'}</p>
          <div className="divide-y divide-slate-100">
            {hidden.map(({ def }) => {
              const Icon = ICONS[def.id];
              return (
                <div key={def.id} className="flex items-center gap-2 py-2.5">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-400 truncate">{isBn ? def.titleBn : def.titleEn}</span>
                    {def.subtitleBn && (
                      <span className="block text-[11px] text-slate-400 truncate">{def.subtitleBn}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={isBn ? `${def.titleBn} দেখান` : `Show ${def.titleEn}`}
                    onClick={() => apply(toggleSectionHidden(layout, def.id))}
                    className="w-11 h-11 min-h-[44px] rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {heroHidden && (
        <p className="text-[11px] text-amber-600 font-semibold mt-2">
          {isBn ? 'হিরো লুকানো আছে — দ্রুত কাজের বোতামগুলোও ড্যাশবোর্ডে দেখাবে না।' : 'The hero is hidden — the quick-action buttons will not show on the dashboard either.'}
        </p>
      )}

      <button
        type="button"
        onClick={() => apply(resetLayout())}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        <RotateCcw size={16} />
        {isBn ? 'আগের মতো সাজানোতে ফেরান' : 'Reset to the previous arrangement'}
      </button>
    </section>
  );
};
