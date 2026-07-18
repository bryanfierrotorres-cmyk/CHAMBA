import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CHAMBA Telemetry',
  description: 'Torre de Control y Analíticas de CHAMBA',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark h-full">
      <body className={`${inter.className} bg-slate-950 text-slate-100 flex h-full overflow-hidden`}>
        <Sidebar />
        <main className="flex-1 overflow-auto h-full">
          {children}
        </main>
      </body>
    </html>
  );
}
