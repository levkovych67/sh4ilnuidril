'use client';

import { useCart } from '@/components/Cart/CartProvider';
import { useCheckout } from '@/components/Checkout/CheckoutProvider';
import { PRODUCT } from '@/lib/config';
import styles from './BuyOverlay.module.css';

export function BuyOverlay() {
  const { add, openDrawer, closeDrawer, totalQuantity } = useCart();
  const { open: openCheckout } = useCheckout();

  function handleBuyNow() {
    if (totalQuantity === 0) {
      add({ sku: PRODUCT.sku, name: PRODUCT.name, price: PRODUCT.price }, 1);
    }
    closeDrawer();
    openCheckout();
  }

  function handleAddToCart() {
    add({ sku: PRODUCT.sku, name: PRODUCT.name, price: PRODUCT.price }, 1);
    openDrawer();
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.buttons}>
        <button type="button" className={styles.buyPrimary} onClick={handleBuyNow}>
          Забрати
        </button>
        <button type="button" className={styles.buySecondary} onClick={handleAddToCart}>
          В кошик
        </button>
      </div>
    </div>
  );
}
