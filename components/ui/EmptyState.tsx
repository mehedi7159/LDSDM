import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  badge?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon = Sparkles,
  secondaryActionLabel,
  onSecondaryAction,
  badge,
  className = ''
}) => {
  return (
    <div className={`p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/60 to-white flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}>
      {/* Icon with soft animated glow */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <Icon size={32} className="text-indigo-600 animate-pulse" />
        </div>
        {badge && (
          <span className="absolute -top-1.5 -right-2 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
            {badge}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-black text-slate-800 tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>

      {/* Call to Action Buttons */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              className="px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
            >
              <ActionIcon size={15} />
              <span>{actionLabel}</span>
            </Button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
