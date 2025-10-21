import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import React from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SoundScouting',
  description: 'Gestión de proyectos y localizaciones de sonido'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='es' className={inter.className}>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
