'use client';

import { useEffect, useState } from 'react';
import { useCheckout } from './CheckoutProvider';
import { CheckoutForm } from './CheckoutForm';
import styles from './CheckoutModal.module.css';

const EXIT_MS = 420;

export function CheckoutModal() {
  const { isOpen, close } = useCheckout();
  const [mounted, setMounted] = useState(false);

  // Mount on open; keep mounted through the exit animation, then unmount.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    if (mounted) {
      const t = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen, mounted]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  if (!mounted) return null;

  // The element mounts directly with data-state="open" — the keyframe
  // animation runs the moment it renders, no frame-timing trickery needed.
  const state = isOpen ? 'open' : 'closing';

  return (
    <div className={styles.overlay} data-state={state} onClick={close}>
      <div
        className={styles.panel}
        data-state={state}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.grab} />
        <div className={styles.scroll}>
          <div className={styles.head}>
            <span className={`${styles.title} display`}>ЗАМОВЛЕННЯ</span>
            <button className={styles.x} onClick={close} aria-label="Закрити">✕</button>
          </div>
          <CheckoutForm />
        </div>
      </div>
    </div>
  );
}
