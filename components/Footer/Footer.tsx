import Link from 'next/link';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.linksRow}>
        <Link href="/offer">Публічна оферта</Link>
        <Link href="/returns">Умови повернення</Link>
      </div>
    </footer>
  );
}
