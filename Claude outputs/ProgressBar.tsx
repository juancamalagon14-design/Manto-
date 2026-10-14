import React from 'react';
import clsx from 'clsx';

interface ProgressBarProps {
  current: number;
  total: number;
  variant?: 'default' | 'compact';
}

/**
 * ProgressBar Component
 *
 * Shows progress through the guided chat flow (e.g., Paso 1/5, Paso 2/5).
 * Helps users understand where they are in the questionnaire.
 *
 * @example
 * <ProgressBar current={2} total={5} />  // Paso 2/5
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  variant = 'default',
}) => {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full space-y-2">
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full bg-gradient-to-r from-manto-primary to-manto-secondary',
            'transition-all duration-500 ease-out'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Text */}
      {variant === 'default' && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold text-manto-primary">
            Paso {current}/{total}
          </span>
          <span className="text-xs text-gray-500">
            {Math.round(percentage)}%
          </span>
        </div>
      )}

      {variant === 'compact' && (
        <p className="text-center text-xs font-medium text-gray-600">
          {current} de {total}
        </p>
      )}
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
