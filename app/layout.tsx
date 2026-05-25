import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat, Oswald, IBM_Plex_Mono } from 'next/font/google';
import Script from 'next/script';
import { SITE_URL } from '@/lib/config';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const display = Montserrat({ subsets: ['latin', 'cyrillic'], weight: ['900'], variable: '--font-display' });
const oswald = Oswald({ subsets: ['latin', 'cyrillic'], weight: ['600', '700'], variable: '--font-oswald' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'too much яром too much долиною — Sasha Chemerov',
  description: 'Дроп 01 — оверсайз-футболка від Саші Чемерова та гурту «Димна Суміш».',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'too much яром too much долиною — Sasha Chemerov',
    description: 'Дроп 01 — оверсайз-футболка.',
    url: `${SITE_URL}/`,
    images: ['/product1/too-much-яром-too-much-долиною.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#FAFAFA',
  colorScheme: 'light',
};

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Sasha Chemerov × Димна Суміш',
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/logo.png`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${display.variable} ${oswald.variable} ${mono.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <Script src="https://secure.wayforpay.com/server/pay-widget.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
