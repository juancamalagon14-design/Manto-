import React from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const VARIANT_STYLES = {
  primary: 'bg-manto-primary hover:bg-manto-primary-dark text-white shadow-cta hover:shadow-cta-hover',
  secondary: 'bg-manto-secondary hover:bg-manto-secondary-dark text-white shadow-cta hover:shadow-cta-hover',
  outline: 'border-2 border-manto-primary text-manto-primary hover:bg-manto-primary/5',
  ghost: 'text-manto-primary hover:bg-manto-primary/10',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-cta hover:shadow-cta-hover',
};

const SIZE_STYLES = {
  sm: 'px-3 py-2 text-sm rounded-md gap-2',
  md: 'px-4 py-3 text-base rounded-lg gap-2',
  lg: 'px-6 py-4 text-lg rounded-xl gap-3',
  xl: 'px-8 py-5 text-lg rounded-2xl gap-3',
};

/**
 * Button Component
 *
 * A versatile button with multiple variants and sizes.
 * Supports loading state, icons, and full-width layouts.
 *
 * @example
 * <Button variant="primary" size="lg">Contratar Ahora</Button>
 * <Button variant="outline" loading>Procesando...</Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      icon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={clsx(
          // Base styles
          'inline-flex items-center justify-center font-semibold transition-all duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variant
          VARIANT_STYLES[variant],

          // Size
          SIZE_STYLES[size],

          // Full width
          fullWidth && 'w-full',

          // Custom class
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span className="animate-spin">⚙️</span>
            <span>{children}</span>
          </>
        ) : (
          <>
            {icon && <span>{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
