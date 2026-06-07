import Link from 'next/link';
import styles from './LegalPage.module.css';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <Link href="/" className={`${styles.back} mono`}>← На головну</Link>
      <h1 className={`${styles.title} display`}>{title}</h1>
      <article className={styles.body}>{children}</article>
    </main>
  );
}
