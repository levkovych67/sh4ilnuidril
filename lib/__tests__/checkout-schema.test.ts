import { describe, it, expect } from 'vitest';
import { checkoutSchema } from '../checkoutSchema';

const base = {
  fullName: 'Чемеров Олександр',
  phone: '+380671234567',
  email: 'a@b.com',
  items: [{ sku: 'DROP01-OVERSIZE', quantity: 1 }],
  city: 'Львів',
  cityRef: 'ref-1',
  deliveryType: 'warehouse' as const,
  warehouse: 'Відділення №1',
  street: '',
  building: '',
  flat: '',
};

const courier = {
  ...base,
  deliveryType: 'courier' as const,
  warehouse: '',
  street: 'вул. Шевченка',
  building: '12',
};

describe('checkoutSchema', () => {
  it('accepts a valid single-line warehouse order', () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a valid courier order', () => {
    expect(checkoutSchema.safeParse(courier).success).toBe(true);
  });

  it('accepts a valid multi-line order', () => {
    const multi = {
      ...base,
      items: [
        { sku: 'DROP01-OVERSIZE', quantity: 1 },
        { sku: 'DROP01-PRODUCT2', quantity: 2 },
      ],
    };
    expect(checkoutSchema.safeParse(multi).success).toBe(true);
  });

  it('rejects an empty items array with the Ukrainian message', () => {
    const res = checkoutSchema.safeParse({ ...base, items: [] });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'items');
      expect(issue?.message).toBe('Кошик порожній');
    }
  });

  it('rejects a line with quantity < 1', () => {
    expect(
      checkoutSchema.safeParse({
        ...base,
        items: [{ sku: 'DROP01-OVERSIZE', quantity: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a line with non-integer quantity', () => {
    expect(
      checkoutSchema.safeParse({
        ...base,
        items: [{ sku: 'DROP01-OVERSIZE', quantity: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a line with empty sku', () => {
    expect(
      checkoutSchema.safeParse({
        ...base,
        items: [{ sku: '', quantity: 1 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a single-word name', () => {
    expect(checkoutSchema.safeParse({ ...base, fullName: 'Іван' }).success).toBe(false);
  });

  it('rejects a bad email', () => {
    expect(checkoutSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('rejects a bad phone', () => {
    expect(checkoutSchema.safeParse({ ...base, phone: '123' }).success).toBe(false);
  });

  it('rejects a warehouse order with no warehouse', () => {
    expect(checkoutSchema.safeParse({ ...base, warehouse: '' }).success).toBe(false);
  });

  it('rejects a courier order with no street', () => {
    expect(checkoutSchema.safeParse({ ...courier, street: '' }).success).toBe(false);
  });

  it('rejects a courier order with no building', () => {
    expect(checkoutSchema.safeParse({ ...courier, building: '' }).success).toBe(false);
  });

  it('reports the Ukrainian message for a missing warehouse', () => {
    const res = checkoutSchema.safeParse({ ...base, warehouse: '' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'warehouse');
      expect(issue?.message).toBe('Оберіть відділення або поштомат');
    }
  });

  it('reports the prefix message when phone does not start with +380', () => {
    const res = checkoutSchema.safeParse({ ...base, phone: '+1234567890' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const phoneIssue = res.error.issues.find((i) => i.path[0] === 'phone');
      expect(phoneIssue?.message).toBe('Введіть номер у форматі +380…');
    }
  });

  it('reports the length message when phone is +380 but too short', () => {
    const res = checkoutSchema.safeParse({ ...base, phone: '+380124' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const phoneIssue = res.error.issues.find((i) => i.path[0] === 'phone');
      expect(phoneIssue?.message).toBe('Введіть 9 цифр після +380');
    }
  });
});
