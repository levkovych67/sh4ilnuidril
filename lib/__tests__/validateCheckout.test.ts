import { describe, it, expect } from 'vitest';
import { validateCheckout } from '../validateCheckout';
import type { CheckoutInput } from '../checkoutSchema';

const valid: CheckoutInput = {
  fullName: 'Іван Іванов',
  phone: '+380671234567',
  email: 'a@b.com',
  items: [{ sku: 'DROP01-OVERSIZE', quantity: 1 }],
  city: 'Львів',
  cityRef: 'ref-1',
  deliveryType: 'warehouse',
  warehouse: 'Відділення №1',
  street: '',
  building: '',
  flat: '',
};

describe('validateCheckout', () => {
  it('returns an empty object for valid data', () => {
    expect(validateCheckout(valid)).toEqual({});
  });

  it('returns the phone length message for "+380124"', () => {
    const errs = validateCheckout({ ...valid, phone: '+380124' });
    expect(errs.phone).toBe('Введіть 9 цифр після +380');
  });

  it('returns the email message for a bad email', () => {
    const errs = validateCheckout({ ...valid, email: 'nope' });
    expect(errs.email).toBe('Невірний e-mail');
  });

  it('returns the name message for a single-word name', () => {
    const errs = validateCheckout({ ...valid, fullName: 'Іван' });
    expect(errs.fullName).toBe("Вкажіть прізвище та ім'я");
  });

  it('returns the warehouse message when missing in warehouse mode', () => {
    const errs = validateCheckout({ ...valid, warehouse: '' });
    expect(errs.warehouse).toBe('Оберіть відділення або поштомат');
  });

  it('returns the city message when missing', () => {
    const errs = validateCheckout({ ...valid, city: '' });
    expect(errs.city).toBe('Оберіть місто');
  });

  it('returns the items message when items array is empty', () => {
    const errs = validateCheckout({ ...valid, items: [] });
    expect(errs.items).toBe('Кошик порожній');
  });

  it('returns multiple errors at once', () => {
    const errs = validateCheckout({
      ...valid,
      fullName: '',
      email: 'nope',
      phone: '',
    });
    expect(errs.fullName).toBeDefined();
    expect(errs.email).toBeDefined();
    expect(errs.phone).toBeDefined();
  });
});
