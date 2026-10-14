import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient';
  padding?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const VARIANT_STYLES = {
  default: 'bg-white border border-gray-100',
  elevated: 'bg-white shadow-card hover:shadow-card-hover',
  outlined: 'bg-transparent border-2 border-manto-primary',
  gradient: 'bg-gradient-to-br from-manto-primary to-manto-secondary text-white',
};

const PADDING_STYLES = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * Card Component
 *
 * A flexible container component for grouping related content.
 * Supports multiple visual styles and padding levels.
 *
 * @example
 * <Card variant="elevated" padding="lg">
 *   <h3>Pet Information</h3>
 *   <p>Details about your pet</p>
 * </Card>
 */
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
        className={clsx(
          // Base
          'rounded-2xl transition-all duration-300',

          // Variant
          VARIANT_STYLES[variant],

          // Padding
          PADDING_STYLES[padding],

          // Custom
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
