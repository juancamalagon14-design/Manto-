import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

/**
 * Input Component
 *
 * A styled input field with label, error, and helper text support.
 * Used throughout the chat and form interfaces.
 *
 * @example
 * <Input
 *   label="Pet Name"
 *   placeholder="Firulais"
 *   error={errors.name}
 * />
 */
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
      <div className="w-full space-y-2">
        {label && (
          <label className="block text-sm font-semibold text-gray-900">
            {label}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            className={clsx(
              // Base
              'w-full px-4 py-3 rounded-lg border-2 text-base',
              'font-body transition-all duration-300',
              'focus:outline-none',

              // Default state
              'border-gray-200 bg-white text-gray-900',
              'placeholder-gray-500',

              // Focus state
              'focus:border-manto-primary focus:ring-2 focus:ring-manto-primary/10',

              // Error state
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/10',

              // Icon offset
              icon && 'pl-10',

              // Custom
              className
            )}
            {...props}
          />
        </div>

        {error && (
          <p className="text-sm font-medium text-red-500">{error}</p>
        )}

        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
