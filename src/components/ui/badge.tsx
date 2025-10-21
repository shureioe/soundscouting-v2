'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'danger';
};

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-neutral-800 text-neutral-100',
  success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  danger: 'bg-red-500/20 text-red-300 border border-red-500/40'
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide', variants[variant], className)}
      {...props}
    />
  );
}
