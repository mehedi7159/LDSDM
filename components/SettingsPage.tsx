import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme, ACCENT_THEMES } from '../context/ThemeContext';
import type { AccentThemeId } from '../context/ThemeContext';
import { SegmentedControl } from './ui/SegmentedControl';
import {
  loadUserPrefs,
  saveUserPrefs,
  applyPrefPreview,
  TEXT_SIZE_ZOOM,
  type UserPrefs,
  type TextSizeId,
  type CornerStyleId,
  type NotificationPrefs
} from '../services/userPreferences';
import type { Language } from '../services/translations';
import { Bell, Check, ClipboardList, Globe, Palette, RotateCcw, Save, X } from 'lucide-react';

// Personal settings (Phase 1). Draft model, like the reference video:
// edits update a draft + live preview; the bottom bar shows the change
// count with Discard / Review; the Review sheet lists each change
// (label + before -> after); Save persists to localStorage only.
// Notification toggles are stored preferences only — there is no push
// backend, so nothing here claims delivery works.

type Draft = {
  language: Language;
  accent: AccentThemeId;
  textSize: TextSizeId;
  corner: CornerStyleId;
  notifications: NotificationPrefs;
};

const LANG_NAMES: Record<Language, string> = { bn: 'বাংলা', en: 'English', ar: 'العربية' };

const ACCENT_ORDER: AccentThemeId[] = ['teal', 'emerald', 'blue', 'indigo', 'amber', 'rose', 'purple', 'orange', 'cyan', 'pink'];

const ACCENT_NAMES_AR: Record<AccentThemeId, string> = {
  teal: 'تركوازي',
  emerald: 'زمردي',
  blue: 'أزرق',
  indigo: 'نيلي',
  amber: 'كهرماني',
  rose: 'وردي',
  purple: 'بنفسجي',
  orange: 'برتقالي',
  cyan: 'سماوي',
  pink: 'زهري'
};

type Strings = {
  title: string;
  langSection: string;
  appearanceSection: string;
  notifSection: string;
  notifNote: string;
  textSize: string;
  corner: string;
  accent: string;
  push: string;
  messages: string;
  promos: string;
  sound: string;
  vibration: string;
  changes: (n: number) => string;
  discard: string;
  review: string;
  reviewTitle: string;
  save: string;
  saved: string;
  before: string;
  after: string;
  on: string;
  off: string;
  textSizeName: Record<TextSizeId, string>;
  cornerName: Record<CornerStyleId, string>;
  accentName: (id: AccentThemeId) => string;
};

const STR: Record<Language, Strings> = {
  bn: {
    title: 'সেটিংস',
    langSection: 'ভাষা',
    appearanceSection: 'চেহারা',
    notifSection: 'নোটিফিকেশন',
    notifNote: 'এগুলো শুধু পছন্দ সংরক্ষণ করে',
    textSize: 'টেক্সট সাইজ',
    corner: 'কর্নার স্টাইল',
    accent: 'অ্যাকসেন্ট রঙ',
    push: 'পুশ নোটিফিকেশন',
    messages: 'মেসেজ',
    promos: 'প্রমোশন',
    sound: 'শব্দ',
    vibration: 'ভাইব্রেশন',
    changes: (n) => `${n}টি পরিবর্তন`,
    discard: 'বাতিল',
    review: 'পর্যালোচনা',
    reviewTitle: 'পরিবর্তন পর্যালোচনা',
    save: 'সংরক্ষণ',
    saved: 'সংরক্ষিত হয়েছে',
    before: 'আগে',
    after: 'পরে',
    on: 'চালু',
    off: 'বন্ধ',
    textSizeName: { small: 'ছোট', medium: 'মাঝারি', large: 'বড়' },
    cornerName: { rounded: 'রাউন্ডেড', soft: 'সফট', crisp: 'ক্রিস্প' },
    accentName: (id) => ACCENT_THEMES.find((a) => a.id === id)?.nameBn || id
  },
  en: {
    title: 'Settings',
    langSection: 'Language',
    appearanceSection: 'Appearance',
    notifSection: 'Notifications',
    notifNote: 'These only save your preferences',
    textSize: 'Text size',
    corner: 'Corner style',
    accent: 'Accent colour',
    push: 'Push notifications',
    messages: 'Messages',
    promos: 'Promotions',
    sound: 'Sound',
    vibration: 'Vibration',
    changes: (n) => `${n} changes`,
    discard: 'Discard',
    review: 'Review',
    reviewTitle: 'Review changes',
    save: 'Save',
    saved: 'Saved',
    before: 'Before',
    after: 'After',
    on: 'On',
    off: 'Off',
    textSizeName: { small: 'Small', medium: 'Medium', large: 'Large' },
    cornerName: { rounded: 'Rounded', soft: 'Soft', crisp: 'Crisp' },
    accentName: (id) => ACCENT_THEMES.find((a) => a.id === id)?.nameEn || id
  },
  ar: {
    title: 'الإعدادات',
    langSection: 'اللغة',
    appearanceSection: 'المظهر',
    notifSection: 'الإشعارات',
    notifNote: 'هذه تحفظ تفضيلاتك فقط',
    textSize: 'حجم النص',
    corner: 'نمط الزوايا',
    accent: 'لون التمييز',
    push: 'إشعارات الدفع',
    messages: 'الرسائل',
    promos: 'العروض',
    sound: 'الصوت',
    vibration: 'الاهتزاز',
    changes: (n) => `${n} تغييرات`,
    discard: 'تجاهل',
    review: 'مراجعة',
    reviewTitle: 'مراجعة التغييرات',
    save: 'حفظ',
    saved: 'تم الحفظ',
    before: 'قبل',
    after: 'بعد',
    on: 'تشغيل',
    off: 'إيقاف',
    textSizeName: { small: 'صغير', medium: 'متوسط', large: 'كبير' },
    cornerName: { rounded: 'مستدير', soft: 'ناعم', crisp: 'حاد' },
    accentName: (id) => ACCENT_NAMES_AR[id] || id
  }
};

const NOTIF_KEYS: (keyof NotificationPrefs)[] = ['push', 'messages', 'promos', 'sound', 'vibration'];
const TEXT_SIZES: TextSizeId[] = ['small', 'medium', 'large'];
const CORNERS: CornerStyleId[] = ['rounded', 'soft', 'crisp'];

// Apply a draft to the live page without saving: document direction,
// accent variables (same values ThemeContext applies), preference vars.
function applyDraftPreview(draft: Draft): void {
  const root = document.documentElement;
  root.dir = draft.language === 'ar' ? 'rtl' : 'ltr';
  root.lang = draft.language;
  const theme = ACCENT_THEMES.find((a) => a.id === draft.accent) || ACCENT_THEMES[0];
  root.setAttribute('data-theme', theme.id);
  root.style.setProperty('--color-brand', theme.primary);
  root.style.setProperty('--color-brand-hover', theme.hover);
  root.style.setProperty('--color-brand-light', theme.light);
  root.style.setProperty('--color-brand-ring', theme.ring);
  applyPrefPreview({ textSize: draft.textSize, corner: draft.corner });
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="shrink-0 w-12 h-7 rounded-full flex items-center transition-colors"
      style={{ backgroundColor: on ? 'var(--color-brand)' : '#cbd5e1', justifyContent: on ? 'flex-end' : 'flex-start' }}
    >
      <span className="w-5 h-5 bg-white rounded-full shadow mx-1 transition-transform" />
    </button>
  );
}

export const SettingsPage: React.FC = () => {
  const { language, setLanguage } = useApp();
  const { accentTheme, setAccentTheme, showSuccess } = useTheme();
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showReview, setShowReview] = useState(false);
  const savedRef = useRef<Draft | null>(null);

  // Initialise draft from saved values (app language + accent + prefs).
  useEffect(() => {
    const prefs = loadUserPrefs();
    const initial: Draft = {
      language,
      accent: accentTheme,
      textSize: prefs.textSize,
      corner: prefs.corner,
      notifications: prefs.notifications
    };
    setSaved(initial);
    setDraft(initial);
    savedRef.current = initial;
    applyDraftPreview(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  // Live preview on every draft change; leaving the page without saving
  // restores the saved values.
  useEffect(() => {
    if (draft) applyDraftPreview(draft);
  }, [draft]);

  useEffect(() => {
    return () => {
      if (savedRef.current) applyDraftPreview(savedRef.current);
    };
  }, []);

  const s: Strings = STR[draft?.language || 'en'];
  const isAr = draft?.language === 'ar';

  const changes = useMemo(() => {
    if (!saved || !draft) return [];
    const list: { id: string; label: string; old: string; next: string }[] = [];
    if (draft.language !== saved.language) {
      list.push({ id: 'language', label: s.langSection, old: LANG_NAMES[saved.language], next: LANG_NAMES[draft.language] });
    }
    if (draft.accent !== saved.accent) {
      list.push({ id: 'accent', label: s.accent, old: s.accentName(saved.accent), next: s.accentName(draft.accent) });
    }
    if (draft.textSize !== saved.textSize) {
      list.push({ id: 'textSize', label: s.textSize, old: s.textSizeName[saved.textSize], next: s.textSizeName[draft.textSize] });
    }
    if (draft.corner !== saved.corner) {
      list.push({ id: 'corner', label: s.corner, old: s.cornerName[saved.corner], next: s.cornerName[draft.corner] });
    }
    for (const key of NOTIF_KEYS) {
      if (draft.notifications[key] !== saved.notifications[key]) {
        list.push({
          id: `notif_${key}`,
          label: s[key],
          old: saved.notifications[key] ? s.on : s.off,
          next: draft.notifications[key] ? s.on : s.off
        });
      }
    }
    return list;
  }, [saved, draft, s]);

  const handleSave = () => {
    if (!draft) return;
    if (draft.language !== saved?.language) setLanguage(draft.language);
    if (draft.accent !== saved?.accent) setAccentTheme(draft.accent);
    saveUserPrefs({ textSize: draft.textSize, corner: draft.corner, notifications: draft.notifications });
    setSaved(draft);
    savedRef.current = draft;
    setShowReview(false);
    showSuccess(STR[draft.language].saved);
  };

  const handleDiscard = () => {
    if (!saved) return;
    setDraft(saved);
    setShowReview(false);
  };

  if (!draft) return null;

  const cardStyle: React.CSSProperties = { borderRadius: 'var(--ldsdm-radius, 1rem)' };

  return (
    <>
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`mx-auto max-w-2xl px-4 py-4 pb-8 ${isAr ? 'font-arabic' : ''}`}
      style={{ zoom: TEXT_SIZE_ZOOM[draft.textSize] }}
    >
      <h1 className="text-xl font-black text-slate-900 mb-4">{s.title}</h1>

      {/* Language */}
      <section className="bg-white shadow-sm border border-slate-100 p-4 mb-3" style={cardStyle}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Globe size={17} style={{ color: 'var(--color-brand)' }} />
          {s.langSection}
        </h2>
        <div className="flex flex-col gap-2">
          {(['bn', 'en', 'ar'] as Language[]).map((lang) => {
            const active = draft.language === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setDraft({ ...draft, language: lang })}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                  active ? 'border-transparent text-white' : 'border-slate-200 text-slate-700'
                }`}
                style={active ? { backgroundColor: 'var(--color-brand)' } : undefined}
              >
                <span className={lang === 'ar' ? 'font-arabic' : lang === 'bn' ? 'font-bangla' : ''}>{LANG_NAMES[lang]}</span>
                {active && <Check size={17} />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-white shadow-sm border border-slate-100 p-4 mb-3" style={cardStyle}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Palette size={17} style={{ color: 'var(--color-brand)' }} />
          {s.appearanceSection}
        </h2>
        <p className="text-xs font-bold text-slate-500 mb-1.5">{s.textSize}</p>
        <SegmentedControl
          ariaLabel={s.textSize}
          value={draft.textSize}
          onChange={(id) => setDraft({ ...draft, textSize: id as TextSizeId })}
          options={TEXT_SIZES.map((id) => ({ id, label: s.textSizeName[id] }))}
        />
        <p className="text-xs font-bold text-slate-500 mb-1.5 mt-4">{s.corner}</p>
        <SegmentedControl
          ariaLabel={s.corner}
          value={draft.corner}
          onChange={(id) => setDraft({ ...draft, corner: id as CornerStyleId })}
          options={CORNERS.map((id) => ({ id, label: s.cornerName[id] }))}
        />
        <p className="text-xs font-bold text-slate-500 mb-1.5 mt-4">{s.accent}</p>
        <div className="flex flex-wrap items-center gap-3">
          {ACCENT_ORDER.map((id) => {
            const theme = ACCENT_THEMES.find((a) => a.id === id)!;
            const active = draft.accent === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={s.accentName(id)}
                title={s.accentName(id)}
                onClick={() => setDraft({ ...draft, accent: id })}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-shadow ${
                  active ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{ backgroundColor: theme.primary, ['--tw-ring-color' as string]: theme.primary }}
              >
                {active && <Check size={17} className="text-white" />}
              </button>
            );
          })}
          <span className="text-xs font-bold text-slate-600">{s.accentName(draft.accent)}</span>
        </div>
      </section>

      {/* Notifications (stored preferences only) */}
      <section className="bg-white shadow-sm border border-slate-100 p-4 mb-3" style={cardStyle}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1.5">
          <Bell size={17} style={{ color: 'var(--color-brand)' }} />
          {s.notifSection}
        </h2>
        <p className="text-xs text-slate-500 mb-3">{s.notifNote}</p>
        <div className="flex flex-col gap-3">
          {NOTIF_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-700">{s[key]}</span>
              <Toggle
                label={s[key]}
                on={draft.notifications[key]}
                onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, [key]: v } })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Draft bottom bar */}
      {changes.length > 0 && (
        <div className="sticky bottom-24 md:bottom-0 z-30 -mx-4 px-4 pt-3 pb-1">
          <div
            className="flex items-center justify-between gap-2 bg-white shadow-lg border border-slate-100 px-3 py-2.5"
            style={cardStyle}
          >
            <span className="text-xs font-bold text-slate-700">{s.changes(changes.length)}</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                <RotateCcw size={14} />
                {s.discard}
              </button>
              <button
                type="button"
                onClick={() => setShowReview(true)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--color-brand)' }}
              >
                <ClipboardList size={14} />
                {s.review}
              </button>
            </span>
          </div>
        </div>
      )}

    </div>

    {/* Review sheet (outside the zoomed wrapper so it stays viewport-fixed
        and above the mobile bottom nav) */}
      {showReview && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" dir={isAr ? 'rtl' : 'ltr'}>
          <button
            type="button"
            aria-label={s.reviewTitle}
            onClick={() => setShowReview(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            className={`relative w-full max-w-2xl max-h-[75vh] overflow-y-auto bg-white shadow-xl p-4 pb-6 ${isAr ? 'font-arabic' : ''}`}
            style={{ borderTopLeftRadius: 'var(--ldsdm-radius, 1rem)', borderTopRightRadius: 'var(--ldsdm-radius, 1rem)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-slate-900">{s.reviewTitle}</h2>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {changes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-bold text-slate-700">{c.label}</span>
                  <span className="text-xs text-slate-500 text-end">
                    {s.before}: <span className="font-bold text-slate-700">{c.old}</span>
                    {' → '}
                    {s.after}: <span className="font-bold text-slate-900">{c.next}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 border border-slate-200"
              >
                <RotateCcw size={16} />
                {s.discard}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-[2] inline-flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--color-brand)' }}
              >
                <Save size={16} />
                {s.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
