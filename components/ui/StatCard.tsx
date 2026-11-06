import React, { useState, useEffect } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface StatCardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  subtitle?: string;
  badge?: string;
  onClick?: () => void;
  className?: string;
}

export const CountUpNumber: React.FC<{
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}> = ({ target, duration = 1000, prefix = '', suffix = '' }) => {
  const { language } = useApp();
  const [current, setCurrent] = useState<number>(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.floor(easedProgress * target));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };
    window.requestAnimationFrame(step);
  }, [target, duration]);

  // Bengali numerals conversion
  const formatVal = (val: number): string => {
    const formatted = val.toLocaleString('en-US');
    if (language !== 'bn') return formatted;
    const digitsMap: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return formatted.replace(/[0-9]/g, (d) => digitsMap[d] || d);
  };

  return (
    <span className="tabular-nums font-mono">
      {prefix}{formatVal(current)}{suffix}
    </span>
  );
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  trend,
  subtitle,
  badge,
  onClick,
  className = ''
}) => {
  const isNumeric = typeof value === 'number';

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 transition-all duration-200 flex flex-col justify-between group ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-normal block">
            {label}
          </span>
          <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white flex items-baseline gap-1">
            {isNumeric ? (
              <CountUpNumber target={value as number} prefix={prefix} suffix={suffix} />
            ) : (
              <span className="tabular-nums font-mono">{prefix}{value}{suffix}</span>
            )}
          </div>
        </div>

      </div>

      {(trend || subtitle || badge) && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`inline-flex items-center gap-0.5 font-semibold text-[11px] ${
                  trend.isPositive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.isPositive !== false ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>{trend.value}</span>
              </span>
              {trend.label && (
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  {trend.label}
                </span>
              )}
            </div>
          ) : subtitle ? (
            <span className="text-slate-400 dark:text-slate-500 text-[11px] truncate">
              {subtitle}
            </span>
          ) : <div />}

          {badge && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
