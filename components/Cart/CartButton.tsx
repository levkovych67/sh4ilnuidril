'use client';

import { useCart } from '@/components/Cart/CartProvider';
import styles from '@/components/Header/Header.module.css';

// Ukrainian noun agreement for "товар" with a quantity.
// 1 → "товар", 2–4 → "товари", everything else → "товарів",
// except 11–14 which always take "товарів".
function pluralUkr(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'товарів';
  const last = n % 10;
  if (last === 1) return 'товар';
  if (last >= 2 && last <= 4) return 'товари';
  return 'товарів';
}

export function CartButton() {
  const { totalQuantity, openDrawer } = useCart();
  const ariaLabel =
    totalQuantity === 0 ? 'Кошик' : `Кошик, ${totalQuantity} ${pluralUkr(totalQuantity)}`;

  return (
    <button type="button" className={styles.cartButton} aria-label={ariaLabel} onClick={openDrawer}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7a3 3 0 1 1 6 0" />
      </svg>
      {totalQuantity > 0 && (
        <span className={styles.cartBadge} aria-hidden="true">
          {totalQuantity}
        </span>
      )}
    </button>
  );
}
