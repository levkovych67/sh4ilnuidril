import { CartProvider } from '@/components/Cart/CartProvider';
import { CartDrawer } from '@/components/Cart/CartDrawer';
import { CheckoutProvider } from '@/components/Checkout/CheckoutProvider';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { ProductCarousel } from '@/components/Carousel/ProductCarousel';
import { listProducts, type Product } from '@/lib/products';
import { SITE_URL } from '@/lib/config';
import styles from './page.module.css';

export default async function Home() {
  const products = await listProducts();

  return (
    <CartProvider products={products}>
      <CheckoutProvider>
        <main className={styles.page}>
          <h1 className={styles.srOnly}>
            too much яром too much долиною — оверсайз-футболка Sasha Chemerov × Димна Суміш, Drop 01
          </h1>
          <Header />
          <ProductCarousel products={products} />
          <Footer />
        </main>
        <CartDrawer />
      </CheckoutProvider>

      {products.map((p) => (
        <script
          key={p.productId}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd(p)) }}
        />
      ))}
    </CartProvider>
  );
}

function productLd(p: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_URL}/#product-${p.productId}`,
    name: p.productName,
    sku: p.productId,
    brand: { '@type': 'Brand', name: 'Sasha Chemerov × Димна Суміш' },
    image: [`${SITE_URL}${encodeURI(p.productPictures[0]?.url ?? '')}`],
    description:
      'Оверсайз-футболка "too much яром too much долиною" — лімітований дроп Sasha Chemerov × Димна Суміш.',
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/`,
      priceCurrency: 'UAH',
      price: String(p.productPrice),
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
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'UAH' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        },
      },
    },
  };
}
