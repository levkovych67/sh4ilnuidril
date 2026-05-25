'use client';

import { ProductSlide } from './ProductSlide';
import type { Product } from '@/lib/catalog';
import styles from './ProductCarousel.module.css';

export function ProductCarousel({ products }: { products: readonly Product[] }) {
  return (
    <div className={styles.stage}>
      <div
        className={styles.scroller}
        role="region"
        aria-roledescription="carousel"
        aria-label="Каталог товарів"
      >
        {products.map((product) => (
          <ProductSlide key={product.sku} product={product} />
        ))}
      </div>
    </div>
  );
}
