import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      icon,
      helperText,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {label}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            className={cn(
              'w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900',
              'transition-colors duration-150',
              'focus:outline-none',
              'border-slate-300 bg-white placeholder-slate-400',
              'focus:border-orange-cta focus:ring-1 focus:ring-orange-cta',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
              icon && 'pl-10',
              className
            )}
            {...props}
          />
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-600">{error}</p>
        )}

        {helperText && !error && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
