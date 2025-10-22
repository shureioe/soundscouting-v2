import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SoundScouting',
  description: 'Gestión de proyectos y localizaciones de sonido'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='es'>
      <body className='font-sans'>
        <main>{children}</main>
      </body>
    </html>
  );
}
