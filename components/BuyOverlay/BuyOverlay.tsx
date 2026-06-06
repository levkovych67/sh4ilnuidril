'use client';

import { useState } from 'react';
import { useCart } from '@/components/Cart/CartProvider';
import { useCheckout } from '@/components/Checkout/CheckoutProvider';
import type { Product } from '@/lib/products';
import styles from './BuyOverlay.module.css';

export function BuyOverlay({ product }: { product: Product }) {
  const { add, openDrawer, closeDrawer, items } = useCart();
  const { open: openCheckout } = useCheckout();

  const sizes = product.productSizes;
  const oneSize = sizes.length === 0;
  const [selectedSize, setSelectedSize] = useState('');
  const size = oneSize ? '' : selectedSize;
  const needsSize = !oneSize && selectedSize === '';

  const hasThisProduct = items.some(
    (i) => i.sku === product.productId && i.size === size,
  );

  function addToCart() {
    add(
      {
        sku: product.productId,
        name: product.productName,
        price: product.productPrice,
        size,
      },
      1,
    );
  }

  function handleBuyNow() {
    if (needsSize) return;
    if (!hasThisProduct) addToCart();
    closeDrawer();
    openCheckout();
  }

  function handleAddToCart() {
    if (needsSize) return;
    addToCart();
    openDrawer();
  }

  return (
    <div className={styles.overlay}>
      {!oneSize && (
        <div className={styles.sizes} role="group" aria-label="Розмір">
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.sizePill}
              data-selected={s === selectedSize ? 'true' : undefined}
              aria-pressed={s === selectedSize}
              onClick={() => setSelectedSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.buyPrimary}
          onClick={handleBuyNow}
          disabled={needsSize}
          aria-disabled={needsSize}
        >
          Забрати
        </button>
        <button
          type="button"
          className={styles.buySecondary}
          onClick={handleAddToCart}
          disabled={needsSize}
          aria-disabled={needsSize}
        >
          В кошик
        </button>
      </div>
    </div>
  );
}
