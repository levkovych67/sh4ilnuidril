'use client';

import { useCart } from '@/components/Cart/CartProvider';
import { useCheckout } from '@/components/Checkout/CheckoutProvider';
import type { Product } from '@/lib/products';
import styles from './BuyOverlay.module.css';

export function BuyOverlay({ product }: { product: Product }) {
  const { add, openDrawer, closeDrawer, items } = useCart();
  const { open: openCheckout } = useCheckout();

  const hasThisProduct = items.some((i) => i.sku === product.productId);

  function handleBuyNow() {
    if (!hasThisProduct) {
      add(
        { sku: product.productId, name: product.productName, price: product.productPrice },
        1,
      );
    }
    closeDrawer();
    openCheckout();
  }

  function handleAddToCart() {
    add(
      { sku: product.productId, name: product.productName, price: product.productPrice },
      1,
    );
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
