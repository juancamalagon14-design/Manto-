import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  variant?: 'default' | 'compact';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label,
  variant = 'default',
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-cta transition-all duration-300 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {variant === 'default' && (
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-semibold text-navy-900">
            {label || `Paso ${current} de ${total}`}
          </span>
          <span className="text-slate-500 font-medium">
            {Math.round(percentage)}%
          </span>
        </div>
      )}

      {variant === 'compact' && (
        <p className="text-center text-xs font-medium text-slate-500">
          {current} de {total}
        </p>
      )}
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
