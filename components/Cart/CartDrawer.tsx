'use client';

import { useEffect, useId, useState } from 'react';
import { useCart } from './CartProvider';
import { PRODUCT } from '@/lib/config';
import styles from './CartDrawer.module.css';

// Mirrors CheckoutModal: panel stays mounted through the exit animation
// for this many ms, then unmounts.
const EXIT_MS = 420;

export function CartDrawer() {
  const { items, add, isDrawerOpen, closeDrawer } = useCart();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (isDrawerOpen) {
      setMounted(true);
      return;
    }
    if (mounted) {
      const t = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isDrawerOpen, mounted]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isDrawerOpen, closeDrawer]);

  if (!mounted) return null;

  const state = isDrawerOpen ? 'open' : 'closing';
  const isEmpty = items.length === 0;

  return (
    <div className={styles.overlay} data-state={state} onClick={closeDrawer}>
      <div
        className={styles.panel}
        data-state={state}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.grab} />
        <div className={styles.scroll}>
          <div className={styles.head}>
            <span id={titleId} className={`${styles.title} display`}>КОШИК</span>
            <button className={styles.x} onClick={closeDrawer} aria-label="Закрити">
              ✕
            </button>
          </div>

          {isEmpty && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Кошик порожній</p>
              <p className={`${styles.emptySub} mono`}>
                Додайте футболку, щоб оформити замовлення
              </p>
              <button
                type="button"
                className={styles.emptyAdd}
                onClick={() =>
                  add({ sku: PRODUCT.sku, name: PRODUCT.name, price: PRODUCT.price }, 1)
                }
              >
                Додати футболку
              </button>
            </div>
          )}

          {/* Line items + footer are added in Task 8 */}
        </div>
      </div>
    </div>
  );
}
