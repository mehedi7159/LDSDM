import React from 'react';

export const ShimmerBlock: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = 'h-4 w-full', rounded = 'rounded-lg' }) => {
  return (
    <div
      className={`bg-slate-200/80 dark:bg-slate-800/80 animate-pulse relative overflow-hidden ${rounded} ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" />
    </div>
  );
};

export const SkeletonStatCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <ShimmerBlock className="h-3.5 w-24" />
          <ShimmerBlock className="h-7 w-32" />
        </div>
      </div>
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
        <ShimmerBlock className="h-3 w-28" />
        <ShimmerBlock className="h-3 w-12" />
      </div>
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
        <ShimmerBlock className="h-4 w-36" />
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-8 w-24" rounded="rounded-xl" />
          <ShimmerBlock className="h-8 w-20" rounded="rounded-xl" />
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShimmerBlock className="h-9 w-9 shrink-0" rounded="rounded-xl" />
              <div className="space-y-1.5">
                <ShimmerBlock className="h-3.5 w-32 sm:w-44" />
                <ShimmerBlock className="h-2.5 w-20 sm:w-28" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ShimmerBlock className="h-3.5 w-16 hidden sm:block" />
              <ShimmerBlock className="h-6 w-16" rounded="rounded-full" />
              <ShimmerBlock className="h-7 w-7" rounded="rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonList: React.FC<{ items?: number }> = ({ items = 4 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <ShimmerBlock className="h-10 w-10 shrink-0" rounded="rounded-xl" />
            <div className="space-y-1.5">
              <ShimmerBlock className="h-3.5 w-36" />
              <ShimmerBlock className="h-2.5 w-24" />
            </div>
          </div>
          <ShimmerBlock className="h-7 w-20" rounded="rounded-xl" />
        </div>
      ))}
    </div>
  );
};
