'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-500/60 bg-red-500/10 text-red-200',
  info: 'border-neutral-700 bg-neutral-800/90 text-neutral-100'
};

export function Toast({ message, variant = 'info', onDismiss }: ToastProps): React.ReactElement {
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-4 rounded-lg border px-4 py-3 text-sm shadow-lg shadow-black/40 backdrop-blur',
        variantStyles[variant]
      )}
      role='status'
    >
      <span className='flex-1'>{message}</span>
      {onDismiss ? (
        <button
          type='button'
          onClick={onDismiss}
          className='rounded-md border border-current px-2 py-1 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950'
        >
          Cerrar
        </button>
      ) : null}
    </div>
  );
}
