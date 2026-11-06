/**
 * ============================================================================
 * DESIGN_NOTES — LDSDM desktop/mobile design standard (Phase 3 foundation)
 * ============================================================================
 * One visual language everywhere. When adding or restyling a screen, use
 * these primitives instead of hand-rolled markup:
 *
 *  - PageHeader   — a screen's greeting/title header. tone='brand' is the
 *                   flat hero (quick-action tiles live inside it);
 *                   tone='plain' is the standard card header.
 *  - SectionCard  — every content block: bg-white / dark:bg-slate-900,
 *                   rounded-2xl, border slate-200/80 / dark:slate-800,
 *                   shadow-sm, p-5 sm:p-6, icon-chip + title header.
 *  - StatCard     — simple KPI tiles (big value, soft label).
 *                   Richer bento cards may be hand-built but must reuse
 *                   the same surface recipe and CountUpNumber.
 *  - ProgressBar  — the only progress bar; semantic tones only
 *                   (emerald ≥90/healthy, indigo/brand in-progress,
 *                   amber attention, rose critical).
 *  - EmptyState   — every "no data" block; ShimmerSkeleton for loading.
 *  - Button       — all actions; Toast + ConfirmDialog for feedback.
 *
 * Rules:
 *  1. Colours come from the accent-theme variables set by ThemeContext
 *     (--color-brand, --color-brand-hover, --color-brand-light,
 *     --color-brand-ring). NEVER hardcode a brand colour or a
 *     light-only surface (e.g. bg-white without dark:bg-slate-900):
 *     light and dark modes must both be correct.
 *  2. NEVER window.alert() / window.confirm(). User feedback goes
 *     through useTheme().showToast({ type, title, message }) and
 *     destructive confirmations through ui/ConfirmDialog.
 *  3. Every user-visible string is a bn/en pair
 *     (language === 'bn' ? '…' : '…') until the P3-6 i18n migration.
 *  4. Numbers use CountUpNumber / the local toBanglaDigits helper so
 *     Bangla numerals stay consistent.
 * ============================================================================
 */
export { Button } from './Button';
export { ConfirmDialog } from './ConfirmDialog';
export { EmptyState } from './EmptyState';
export { StatCard, CountUpNumber } from './StatCard';
export { PageHeader } from './PageHeader';
export { SectionCard } from './SectionCard';
export type { SectionCardTone } from './SectionCard';
export { ProgressBar, progressToneFor } from './ProgressBar';
export type { ProgressTone } from './ProgressBar';
export { ToastContainer } from './ToastContainer';
export { ShimmerBlock, SkeletonStatCard, SkeletonTable, SkeletonList } from './ShimmerSkeleton';
export { StickyActionFooter } from './StickyActionFooter';
export { OfflineIndicator } from './OfflineIndicator';
export { PWAInstallButton } from './PWAInstallButton';
export { MobileMoreSheet } from './MobileMoreSheet';
export { ThemeSwitcherModal } from './ThemeSwitcherModal';
