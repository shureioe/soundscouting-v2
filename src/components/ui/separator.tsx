import React from 'react';
import { cn } from '@/lib/utils';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps): React.ReactElement {
  return (
    <div
      className={cn(
        'bg-neutral-800',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      role='separator'
      aria-orientation={orientation}
      {...props}
    />
  );
}
