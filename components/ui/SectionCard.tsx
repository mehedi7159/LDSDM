import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * SectionCard — the standard content card (see DESIGN_NOTES in
 * components/ui/index.ts). White in light mode, slate-900 in dark mode,
 * rounded-2xl, hairline border, soft shadow. Optional header with an
 * icon chip + title/subtitle on the left and an action node on the right.
 * For a titled card the header carries the standard divider; body spacing
 * is left to the children (wrap in space-y-* as needed).
 */
export type SectionCardTone =
  | 'brand' | 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'teal' | 'slate';

const TONE_CHIP: Record<SectionCardTone, string> = {
  brand: '',
  indigo: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800',
  blue: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
  teal: 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
};

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconTone?: SectionCardTone;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'brand',
  action,
  children,
  className = '',
  bodyClassName = ''
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONE_CHIP[iconTone]}`}
                style={iconTone === 'brand' ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' } : undefined}
              >
                <Icon size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                {title}
              </h3>
              {subtitle && (
                <span className="text-xs text-slate-400 dark:text-slate-500 block truncate">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};
