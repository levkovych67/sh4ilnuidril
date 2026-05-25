'use client';

import { forwardRef } from 'react';
import { BuyOverlay } from '@/components/BuyOverlay/BuyOverlay';
import type { Product } from '@/lib/products';
import styles from './ProductCarousel.module.css';

export const ProductSlide = forwardRef<HTMLElement, { product: Product }>(
  function ProductSlide({ product }, ref) {
    return (
      <section
        ref={ref}
        className={styles.slide}
        role="group"
        aria-roledescription="slide"
        aria-label={product.productName}
      >
        <video
          className={styles.slideVideo}
          src={product.productVideoUrl}
          poster={product.productVideoPosterUrl}
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
  },
);
