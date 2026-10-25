import type { Metadata } from 'next';
import { Fredoka, JetBrains_Mono, Lexend } from 'next/font/google';
import './globals.css';

// next/font downloads the fonts at build time and serves them locally, so the built app works offline.
const display = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = Lexend({ subsets: ['latin'], variable: '--font-body' });
const data = JetBrains_Mono({ subsets: ['latin'], variable: '--font-data' });

export const metadata: Metadata = {
  title: 'MissionLab — Mars mission simulator for students',
  description:
    'Keep four people alive on Mars for 72 hours. A 3D mission simulator that teaches how life-support systems depend on each other.',
  icons: { icon: '/brand/logo-mark.png' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable} ${data.variable}`}>
      <body className="min-h-screen bg-space text-cream antialiased">{children}</body>
    </html>
  );
}
