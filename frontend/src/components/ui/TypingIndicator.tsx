import React from 'react';
import { PawPrint } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TypingIndicatorProps {
  className?: string;
  senderName?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  className,
  senderName = 'Nuquí',
}) => {
  return (
    <div className={cn('flex items-center gap-2 py-2 px-1 text-slate-500 text-xs animate-pulse', className)}>
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-canvas-pure text-navy-500">
        <PawPrint className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <span className="font-medium text-slate-500">{senderName} está escribiendo</span>
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-300" style={{ animationDelay: '0ms' }} />
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-300" style={{ animationDelay: '150ms' }} />
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-300" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
