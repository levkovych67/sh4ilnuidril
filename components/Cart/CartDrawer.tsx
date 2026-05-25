'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { useCart } from './CartProvider';
import { useCheckout } from '@/components/Checkout/CheckoutProvider';
import { PRODUCT } from '@/lib/config';
import { MAX_QUANTITY } from '@/lib/cart';
import styles from './CartDrawer.module.css';

const EXIT_MS = 420;

export function CartDrawer() {
  const { items, add, setQty, remove, totalAmount, isDrawerOpen, closeDrawer } = useCart();
  const { open: openCheckout } = useCheckout();
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

  function handleCheckout() {
    if (isEmpty) return;
    closeDrawer();
    openCheckout();
  }

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

          {isEmpty ? (
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
          ) : (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.sku} className={styles.line}>
                  <div className={styles.lineThumb}>
                    <Image
                      src="/too-much-яром-too-much-долиною.jpg"
                      alt=""
                      fill
                      sizes="80px"
                      className={styles.lineImg}
                    />
                  </div>
                  <div className={styles.lineInfo}>
                    <div className={styles.lineName}>{item.name}</div>
                    <div className={`${styles.lineSpec} mono`}>OVERSIZE · ОДИН РОЗМІР</div>
                  </div>
                  <div className={styles.lineControls}>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        onClick={() => {
                          if (item.quantity <= 1) return;
                          setQty(item.sku, item.quantity - 1);
                        }}
                        aria-disabled={item.quantity <= 1}
                        aria-label="Зменшити кількість"
                      >
                        −
                      </button>
                      <span className={styles.qty}>{item.quantity}</span>
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        onClick={() => {
                          if (item.quantity >= MAX_QUANTITY) return;
                          setQty(item.sku, item.quantity + 1);
                        }}
                        aria-disabled={item.quantity >= MAX_QUANTITY}
                        aria-label="Збільшити кількість"
                      >
                        +
                      </button>
                    </div>
                    <div className={styles.lineTotal}>{item.price * item.quantity} ₴</div>
                    <button
                      type="button"
                      className={styles.lineRemove}
                      onClick={() => remove(item.sku)}
                      aria-label="Видалити з кошика"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.totalRow}>
            <span className={`${styles.totalLabel} mono`}>Разом</span>
            <span className={styles.totalAmount}>{totalAmount} ₴</span>
          </div>
          <button
            type="button"
            className={styles.checkout}
            aria-disabled={isEmpty}
            onClick={handleCheckout}
          >
            ОФОРМИТИ
          </button>
        </div>
      </div>
    </div>
  );
}
