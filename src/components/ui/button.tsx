'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400',
  secondary: 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
  ghost: 'bg-transparent text-neutral-100 hover:bg-neutral-900'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
