import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * PageHeader — the standard page/section hero header (see DESIGN_NOTES in
 * components/ui/index.ts). Two tones:
 *  - 'brand': gradient hero driven by the accent-theme CSS variables
 *    (--color-brand / --color-brand-hover from ThemeContext), white text,
 *    glass-style controls. Use for a screen's main greeting header.
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
        className={`rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-white/10 ${className}`}
        style={{ backgroundImage: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))' }}
      >
        {/* Decorative glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 min-w-0">
            {eyebrow && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 border border-white/20 px-3 py-1 rounded-full">
                {eyebrow}
              </span>
            )}
            <div className="flex items-center gap-3 pt-0.5">
              {Icon && (
                <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-white shadow-md shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-white/85 font-medium mt-0.5">
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

        {footer && <div className="relative z-10">{footer}</div>}
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm ${className}`}>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
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
