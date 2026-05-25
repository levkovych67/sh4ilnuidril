'use client';

import styles from './ProductCarousel.module.css';

interface Props {
  count: number;
  active: number;
  onSelect: (index: number) => void;
}

export function PaginationDots({ count, active, onSelect }: Props) {
  return (
    <div className={styles.dots} role="tablist">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          className={styles.dot}
          aria-current={i === active ? 'true' : undefined}
          aria-label={`Перейти до товару ${i + 1}`}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
