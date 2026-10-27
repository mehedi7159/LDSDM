import React from 'react';

// The one standard segmented control for filter / view switches across the
// app: a wrapping pill group (never a horizontal scroll row), slate track,
// white active pill with teal text. Behaviour is the caller's: same option
// ids flow back through onChange, so swapping an old select or button row
// for this component changes looks only, never what a choice does.
export interface SegmentedOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  title?: string;
}

export const SegmentedControl: React.FC<{
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}> = ({ options, value, onChange, ariaLabel }) => {
  return (
    <div
      data-segmented
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
    >
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              active
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                active
                  ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}>
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
