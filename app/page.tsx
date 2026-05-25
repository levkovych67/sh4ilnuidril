import { CartProvider } from '@/components/Cart/CartProvider';
import { CartDrawer } from '@/components/Cart/CartDrawer';
import { CheckoutProvider } from '@/components/Checkout/CheckoutProvider';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { ProductCarousel } from '@/components/Carousel/ProductCarousel';
import { PRODUCTS } from '@/lib/catalog';
import styles from './page.module.css';

export default function Home() {
  return (
    <CartProvider>
      <CheckoutProvider>
        <main className={styles.page}>
          <h1 className={styles.srOnly}>
            too much яром too much долиною — оверсайз-футболка Sasha Chemerov × Димна Суміш, Drop 01
          </h1>
          <Header />
          <ProductCarousel products={PRODUCTS} />
          <Footer />
        </main>
        <CartDrawer />
      </CheckoutProvider>
    </CartProvider>
  );
}
