'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { PRODUCT } from '@/lib/config';
import { MAX_QUANTITY as CART_MAX } from '@/lib/cart';
import type { CheckoutInput } from '@/lib/types';
import { validateCheckout } from '@/lib/validateCheckout';
import { useCart } from '@/components/Cart/CartProvider';
import styles from './CheckoutModal.module.css';
import { NovaPoshtaPicker } from './NovaPoshtaPicker';

type FieldKey = keyof CheckoutInput;

// Local state holds every CheckoutInput field except `quantity`.
// `quantity` is derived from the cart on every render — single source of truth.
type LocalState = Omit<CheckoutInput, 'quantity'>;

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

// Upper bound for the stepper — mirrored from the cart, which mirrors the
// server-side clamp in /api/checkout.
const MAX_QUANTITY = CART_MAX;

type ZoomTarget = 'front' | 'back' | null;

/**
 * Normalises any user input into the Ukrainian "+380XXXXXXXXX" form.
 * (Behaviour unchanged from the pre-cart version.)
 */
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
  // Derived: cart is the source of truth. Fallback to 1 if cart is empty
  // (shouldn't happen given the flows, but keeps the form usable in isolation).
  const quantity = cart.totalQuantity > 0 ? cart.totalQuantity : 1;

  const [local, setLocal] = useState<LocalState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [zoomed, setZoomed] = useState<ZoomTarget>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const priceRef = useRef<HTMLSpanElement>(null);

  // Full CheckoutInput for validation and submission.
  const data: CheckoutInput = { ...local, quantity };

  const markTouched = (k: FieldKey) =>
    setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const patch = (p: Partial<LocalState>) => setLocal((d) => ({ ...d, ...p }));

  const set = (k: 'fullName' | 'email') => (e: React.ChangeEvent<HTMLInputElement>) =>
    patch({ [k]: e.target.value });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal((d) => ({ ...d, phone: formatUkrainianPhone(e.target.value, d.phone) }));
  };

  // ± now writes through the cart. The pulse animation stays.
  const handleIncrease = () => {
    cart.setQty(PRODUCT.sku, quantity + 1);
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    priceRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  };

  const handleDecrease = () => {
    // Never drop below 1 from the form's stepper — to clear the cart entirely,
    // the user uses the cart drawer's × button.
    if (quantity <= 1) return;
    cart.setQty(PRODUCT.sku, quantity - 1);
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

  const total = PRODUCT.price * quantity;

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
      // Clear the cart at the moment we hand off to WayForPay. If the user
      // cancels the widget, they re-add via the hero — acceptable for a
      // single-SKU site.
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
        <div className={styles.thumbBtn}>
          <Image
            src="/too-much-яром-too-much-долиною.jpg"
            alt=""
            fill
            sizes="(min-width: 768px) 220px, 33vw"
            className={styles.thumb}
          />
        </div>

        <div className={styles.orderInfo}>
          <div className={styles.orderName}>
            <span>TOO MUCH ЯРОМ TOO MUCH ДОЛИНОЮ</span>
          </div>
          <div className={`${styles.orderMeta} mono`}>OVERSIZE · ОДИН РОЗМІР · ×{quantity}</div>
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

      <div className={styles.payRow}>
        <button
          type="button"
          className={styles.qtyBtn}
          aria-disabled={!valid || submitting || quantity <= 1}
          onClick={() => {
            if (submitting) return;
            if (!valid) {
              setSubmitAttempted(true);
              return;
            }
            if (quantity <= 1) return;
            handleDecrease();
          }}
          aria-label="Зменшити кількість"
        >
          −
        </button>
        <button type="submit" className={styles.pay} aria-disabled={!valid || submitting}>
          {submitting ? (
            'ЗАЧЕКАЙТЕ…'
          ) : (
            <span ref={priceRef} className={styles.payAmount}>
              {total} ₴ (×{quantity})
            </span>
          )}
        </button>
        <button
          type="button"
          className={styles.qtyBtn}
          aria-disabled={!valid || submitting || quantity >= MAX_QUANTITY}
          onClick={() => {
            if (submitting) return;
            if (!valid) {
              setSubmitAttempted(true);
              return;
            }
            if (quantity >= MAX_QUANTITY) return;
            handleIncrease();
          }}
          aria-label="Збільшити кількість"
        >
          +
        </button>
      </div>

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
              alt={PRODUCT.name}
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
