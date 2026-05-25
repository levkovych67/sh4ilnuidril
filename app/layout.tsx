import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat, Oswald, IBM_Plex_Mono } from 'next/font/google';
import Script from 'next/script';
import { PRODUCTS } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const display = Montserrat({ subsets: ['latin', 'cyrillic'], weight: ['900'], variable: '--font-display' });
const oswald = Oswald({ subsets: ['latin', 'cyrillic'], weight: ['600', '700'], variable: '--font-oswald' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500'], variable: '--font-mono' });

const featured = PRODUCTS[0];

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
    images: [featured.imageSrc],
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

function productLd(sku: string, name: string, price: number, currency: string, imagePath: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_URL}/#product-${sku}`,
    name,
    sku,
    brand: { '@type': 'Brand', name: 'Sasha Chemerov × Димна Суміш' },
    image: [`${SITE_URL}${encodeURI(imagePath)}`],
    description:
      'Оверсайз-футболка "too much яром too much долиною" — лімітований дроп Sasha Chemerov × Димна Суміш.',
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/`,
      priceCurrency: currency,
      price: String(price),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${SITE_URL}/#organization` },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'UA',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'UA' },
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        },
      },
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${display.variable} ${oswald.variable} ${mono.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        {PRODUCTS.map((p) => (
          <script
            key={p.sku}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(productLd(p.sku, p.name, p.price, p.currency, p.imageSrc)),
            }}
          />
        ))}
        <Script src="https://secure.wayforpay.com/server/pay-widget.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
