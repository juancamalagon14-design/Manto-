import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-orange-cta hover:bg-orange-hover text-white shadow-sm hover:shadow active:scale-[0.98]',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-navy-900 shadow-xs active:scale-[0.98]',
  outline: 'border border-slate-300 text-navy-900 hover:bg-slate-50 active:scale-[0.98]',
  ghost: 'text-slate-600 hover:text-navy-900 hover:bg-slate-100',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-[0.98]',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 font-semibold',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2 font-semibold',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2.5 font-bold',
  xl: 'px-8 py-4 text-lg rounded-2xl gap-3 font-bold',
};

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
        className={cn(
          'inline-flex items-center justify-center transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-cta focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
