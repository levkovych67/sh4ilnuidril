'use client';

import { BuyOverlay } from '@/components/BuyOverlay/BuyOverlay';
import type { Product } from '@/lib/catalog';
import styles from './ProductCarousel.module.css';

export function ProductSlide({ product }: { product: Product }) {
  return (
    <section
      className={styles.slide}
      role="group"
      aria-roledescription="slide"
      aria-label={product.name}
    >
      <video
        className={styles.slideVideo}
        src={product.videoSrc}
        poster={product.posterSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <BuyOverlay product={product} />
    </section>
  );
}
