'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductSlide } from './ProductSlide';
import { PaginationDots } from './PaginationDots';
import { NavChevron } from './NavChevron';
import type { Product } from '@/lib/products';
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
    const clamped = Math.max(0, Math.min(products.length - 1, index));
    const width = scroller.clientWidth;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: width * clamped, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  // Arrow-key navigation. Only fires when no input/textarea/contenteditable is
  // focused — otherwise typing in the checkout form would scroll the hero.
  useEffect(() => {
    function isTextEntryActive(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTextEntryActive()) return;
      e.preventDefault();
      scrollToSlide(active + (e.key === 'ArrowRight' ? 1 : -1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, products.length]);

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
            key={product.productId}
            product={product}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
          />
        ))}
      </div>
      <NavChevron
        direction="prev"
        visible={active > 0}
        onClick={() => scrollToSlide(active - 1)}
      />
      <NavChevron
        direction="next"
        visible={active < products.length - 1}
        onClick={() => scrollToSlide(active + 1)}
      />
      <PaginationDots count={products.length} active={active} onSelect={scrollToSlide} />
    </div>
  );
}
