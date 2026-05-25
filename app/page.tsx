import { CartProvider } from '@/components/Cart/CartProvider';
import { CartDrawer } from '@/components/Cart/CartDrawer';
import { CheckoutProvider } from '@/components/Checkout/CheckoutProvider';
import { Header } from '@/components/Header/Header';
import { BuyOverlay } from '@/components/BuyOverlay/BuyOverlay';
import { Footer } from '@/components/Footer/Footer';
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
          <video
            className={styles.fill}
            src="/tshirt.mp4"
            poster="/video.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <BuyOverlay />
          <Footer />
        </main>
        <CartDrawer />
      </CheckoutProvider>
    </CartProvider>
  );
}
