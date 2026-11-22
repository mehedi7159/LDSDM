import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * PageHeader — the standard page/section hero header (see DESIGN_NOTES in
 * components/ui/index.ts). Two tones, one shared light pattern:
 *  - 'brand': flat LIGHT hero — white / dark slate-900 card, dark title,
 *    muted subtitle, teal icon chip from the theme tokens. Use for a
 *    screen's main greeting header.
 *  - 'plain': standard white/dark card header with a brand-soft icon chip.
 * Children render as the controls/actions area (right side on wide screens).
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  tone?: 'brand' | 'plain';
  children?: React.ReactNode;
  /** Full-width area below the title row (e.g. quick-action tiles in a hero). */
  footer?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  tone = 'plain',
  children,
  footer,
  className = ''
}) => {
  if (tone === 'brand') {
    return (
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 ${className}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 min-w-0">
            {eyebrow && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border"
                style={{
                  backgroundColor: 'var(--color-brand-light)',
                  color: 'var(--color-brand)',
                  borderColor: 'var(--color-brand-ring)'
                }}
              >
                {eyebrow}
              </span>
            )}
            <div className="flex items-center gap-3 pt-0.5">
              {Icon && (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                >
                  <Icon className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {children && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {children}
            </div>
          )}
        </div>

        {footer && <div className="mt-5 pt-5 border-t border-slate-200/80 dark:border-slate-800">{footer}</div>}
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          {eyebrow && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border"
              style={{
                backgroundColor: 'var(--color-brand-light)',
                color: 'var(--color-brand)',
                borderColor: 'var(--color-brand-ring)'
              }}
            >
              {eyebrow}
            </span>
          )}
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {children && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {children}
          </div>
        )}
      </div>

      {footer && <div>{footer}</div>}
    </div>
  );
};
