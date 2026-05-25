'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductSlide } from './ProductSlide';
import { PaginationDots } from './PaginationDots';
import type { Product } from '@/lib/catalog';
import styles from './ProductCarousel.module.css';

export function ProductCarousel({ products }: { products: readonly Product[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const slides = slideRefs.current.filter((el): el is HTMLElement => el !== null);
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIdx = active;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            const idx = slides.indexOf(entry.target as HTMLElement);
            if (idx !== -1) bestIdx = idx;
          }
        }
        if (bestRatio > 0.6) setActive(bestIdx);
      },
      { root: scroller, threshold: [0.2, 0.4, 0.6, 0.8, 1.0] },
    );

    for (const slide of slides) observer.observe(slide);
    return () => observer.disconnect();
  }, [products.length]);

  function scrollToSlide(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const width = scroller.clientWidth;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: width * index, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  return (
    <div className={styles.stage}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        role="region"
        aria-roledescription="carousel"
        aria-label="Каталог товарів"
      >
        {products.map((product, i) => (
          <ProductSlide
            key={product.sku}
            product={product}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
          />
        ))}
      </div>
      <PaginationDots count={products.length} active={active} onSelect={scrollToSlide} />
    </div>
  );
}
