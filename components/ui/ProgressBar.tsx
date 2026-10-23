import React from 'react';

/**
 * ProgressBar — the standard progress track/fill (see DESIGN_NOTES in
 * components/ui/index.ts). Value is clamped to 0–100. Prefer semantic
 * tones (emerald = healthy/complete, indigo/brand = in progress,
 * amber = attention, rose = critical) so colour means the same thing
 * on every screen.
 */
export type ProgressTone = 'brand' | 'indigo' | 'emerald' | 'amber' | 'rose';

const TONE_FILL: Record<Exclude<ProgressTone, 'brand'>, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500'
};

interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  tone = 'brand',
  size = 'sm',
  className = ''
}) => {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={`w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ${size === 'md' ? 'h-2' : 'h-1.5'} ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${tone !== 'brand' ? TONE_FILL[tone] : ''}`}
        style={{
          width: `${pct}%`,
          ...(tone === 'brand' ? { backgroundColor: 'var(--color-brand)' } : {})
        }}
      />
    </div>
  );
};

/** Semantic tone for a completion percentage (shared dashboard rule). */
export const progressToneFor = (pct: number): ProgressTone =>
  pct >= 90 ? 'emerald' : pct >= 50 ? 'indigo' : 'amber';
