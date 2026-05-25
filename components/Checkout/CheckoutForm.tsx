'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { findProduct } from '@/lib/catalog';
import type { CheckoutInput } from '@/lib/types';
import { validateCheckout } from '@/lib/validateCheckout';
import { useCart } from '@/components/Cart/CartProvider';
import styles from './CheckoutModal.module.css';
import { NovaPoshtaPicker } from './NovaPoshtaPicker';

type FieldKey = keyof CheckoutInput;
type LocalState = Omit<CheckoutInput, 'items'>;

const EMPTY: LocalState = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  cityRef: '',
  deliveryType: 'warehouse',
  warehouse: '',
  street: '',
  building: '',
  flat: '',
};

type ZoomTarget = 'front' | 'back' | null;

function formatUkrainianPhone(raw: string, prev: string): string {
  if (raw === '') return '';
  if (raw.length < prev.length && raw.length < 4) return '';

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('380')) digits = digits.slice(3);
  else if (digits.startsWith('80')) digits = digits.slice(2);
  else if (digits.startsWith('8')) digits = digits.slice(1);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  else if (digits.startsWith('3')) digits = digits.slice(1);

  digits = digits.slice(0, 9);
  return '+380' + digits;
}

export function CheckoutForm() {
  const cart = useCart();
  const [local, setLocal] = useState<LocalState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [zoomed, setZoomed] = useState<ZoomTarget>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Items are derived from the cart — the form does not own them.
  const items = cart.items.map((i) => ({ sku: i.sku, quantity: i.quantity }));
  const data: CheckoutInput = { ...local, items };

  const markTouched = (k: FieldKey) =>
    setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const patch = (p: Partial<LocalState>) => setLocal((d) => ({ ...d, ...p }));

  const set = (k: 'fullName' | 'email') => (e: React.ChangeEvent<HTMLInputElement>) =>
    patch({ [k]: e.target.value });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal((d) => ({ ...d, phone: formatUkrainianPhone(e.target.value, d.phone) }));
  };

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  const errors = validateCheckout(data);
  const valid = Object.keys(errors).length === 0;
  const visibleError = (k: FieldKey): string | undefined =>
    errors[k] && (touched[k] || submitAttempted) ? errors[k] : undefined;

  // Single-thumb summary for now: shows whichever item is first in the cart.
  // Task 5 replaces this with a per-line list.
  const firstItem = cart.items[0];
  const firstProduct = firstItem ? findProduct(firstItem.sku) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!valid) {
      setSubmitAttempted(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('checkout failed');
      const params = await res.json();
      if (!window.Wayforpay) throw new Error('widget not loaded');
      new window.Wayforpay().run(params);
      cart.clear();
    } catch {
      alert('Не вдалося почати оплату. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.order}>
        {firstProduct && (
          <div className={styles.thumbBtn}>
            <Image
              src={firstProduct.imageSrc}
              alt=""
              fill
              sizes="(min-width: 768px) 220px, 33vw"
              className={styles.thumb}
            />
          </div>
        )}

        <div className={styles.orderInfo}>
          <div className={styles.orderName}>
            <span>TOO MUCH ЯРОМ TOO MUCH ДОЛИНОЮ</span>
          </div>
          <div className={`${styles.orderMeta} mono`}>
            OVERSIZE · ОДИН РОЗМІР · ×{cart.totalQuantity}
          </div>
        </div>
      </div>

      <fieldset className={styles.block}>
        <Field
          label="ІМ'Я І ПРІЗВИЩЕ"
          value={data.fullName}
          onChange={set('fullName')}
          onBlur={() => markTouched('fullName')}
          autoComplete="name"
          autoCapitalize="words"
          error={visibleError('fullName')}
        />

        <label className={styles.field}>
          <span className={`${styles.fieldLabel} mono`}>Телефон</span>
          <input
            className={styles.input}
            data-invalid={visibleError('phone') ? 'true' : undefined}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={data.phone}
            onChange={handlePhoneChange}
            onBlur={() => markTouched('phone')}
            maxLength={13}
            placeholder="+380XXXXXXXXX"
          />
          {visibleError('phone') && (
            <span className={`${styles.fieldError} mono`}>{visibleError('phone')}</span>
          )}
        </label>

        <Field
          label="ЕМЕЙЛ"
          value={data.email}
          onChange={set('email')}
          onBlur={() => markTouched('email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={visibleError('email')}
          hint="ЧЕК СЮДИ"
        />
      </fieldset>

      <fieldset className={styles.block}>
        <NovaPoshtaPicker
          value={data}
          onChange={(p) => patch(p as Partial<LocalState>)}
          onBlur={markTouched}
          errors={{ city: visibleError('city'), warehouse: visibleError('warehouse') }}
        />
      </fieldset>

      <button type="submit" className={styles.pay} aria-disabled={!valid || submitting}>
        {submitting ? 'ЗАЧЕКАЙТЕ…' : `${cart.totalAmount} ₴`}
      </button>

      {zoomed &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles.zoomBackdrop}
            onClick={() => setZoomed(null)}
            role="dialog"
            aria-label="Збільшене фото"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomed === 'front' ? '/front.webp' : '/back.webp'}
              alt="t-shirt"
              className={styles.zoomImage}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </form>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  type?: string;
  inputMode?: 'tel' | 'email' | 'text';
  autoComplete?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  spellCheck?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      <span className={`${styles.fieldLabel} mono`}>{props.label}</span>
      <input
        className={styles.input}
        data-invalid={props.error ? 'true' : undefined}
        type={props.type ?? 'text'}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        autoCapitalize={props.autoCapitalize}
        spellCheck={props.spellCheck}
        value={props.value}
        onChange={props.onChange}
        onBlur={props.onBlur}
      />
      {props.error ? (
        <span className={`${styles.fieldError} mono`}>{props.error}</span>
      ) : (
        props.hint && <span className={`${styles.fieldHint} mono`}>{props.hint}</span>
      )}
    </label>
  );
}
