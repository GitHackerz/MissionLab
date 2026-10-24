import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MissionLab — Interactive Mars Mission Training Platform',
  description: 'Deterministic 3D Mars mission simulator for LUMEN 2.0 Beyond 2030',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="antialiased h-full flex flex-col bg-[#120705] text-stone-100">
        {children}
      </body>
    </html>
  );
}
