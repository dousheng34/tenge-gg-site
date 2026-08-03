import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';

import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ToastProvider } from '@/components/ui/toast';

// Шрифты хостятся Next локально: нет обращения к fonts.googleapis.com,
// нет лишних DNS/TLS в критической цепочке и нет FOUT на LCP-заголовке.
const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font-sans', weight: ['400', '500', '600'] });
const playfair = Playfair_Display({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font-display', weight: ['600'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://tenge.gg'),
  title: { default: 'tenge.gg — игровой маркетплейс Казахстана', template: '%s · tenge.gg' },
  description: 'Донат, аккаунты и игровая валюта через Kaspi QR. Escrow-защита каждой сделки, комиссия 5%, арбитраж 24/7.',
  openGraph: { type: 'website', locale: 'ru_KZ', siteName: 'tenge.gg' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

// Тема применяется до первой отрисовки — иначе белая вспышка в тёмной теме.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-neutral-900 focus:bg-white focus:px-3 focus:py-2 focus:text-xs"
        >
          Перейти к содержимому
        </a>

        <ToastProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
