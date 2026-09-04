import type { Metadata, Viewport } from 'next';
import { Cairo, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { type ReactNode } from 'react';

import '@tamam/ui-tokens/css';
import './globals.css';

import { type Locale, localeDirection } from '@/i18n/locale';
import { env, LOCALE_COOKIE_NAME } from '@/lib/env';
import { THEME_BOOT_SCRIPT } from '@/lib/theme-script';

import { Providers } from './providers';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'TAMAM Admin', template: '%s · TAMAM Admin' },
  description: 'TAMAM operations console',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#5D3EBC' };

export default function RootLayout({ children }: { children: ReactNode }) {
  const cookieLocale = cookies().get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale =
    cookieLocale === 'en' ? 'en' : cookieLocale === 'ar' ? 'ar' : env.defaultLocale;
  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={`${cairo.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
