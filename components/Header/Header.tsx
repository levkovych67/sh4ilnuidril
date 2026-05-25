import { CartButton } from '@/components/Cart/CartButton';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Саша Чемеров — Димна Суміш" className={styles.logo} />
      <CartButton />
    </header>
  );
}
