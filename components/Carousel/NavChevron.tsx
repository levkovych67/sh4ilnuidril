'use client';

import styles from './ProductCarousel.module.css';

type Direction = 'prev' | 'next';

interface Props {
  direction: Direction;
  onClick: () => void;
  visible: boolean;
}

export function NavChevron({ direction, onClick, visible }: Props) {
  return (
    <button
      type="button"
      className={direction === 'prev' ? styles.chevronPrev : styles.chevronNext}
      onClick={onClick}
      aria-label={direction === 'prev' ? 'Попередній товар' : 'Наступний товар'}
      hidden={!visible}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === 'prev' ? (
          <path d="M12 4 L6 10 L12 16" />
        ) : (
          <path d="M8 4 L14 10 L8 16" />
        )}
      </svg>
    </button>
  );
}
