import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const VARIANT_STYLES = {
  default: 'bg-white border border-slate-200/90 shadow-xs',
  elevated: 'bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow',
  outlined: 'bg-white border-2 border-slate-200',
  subtle: 'bg-canvas border border-slate-200/80',
};

const PADDING_STYLES = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-200',
          VARIANT_STYLES[variant],
          PADDING_STYLES[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
