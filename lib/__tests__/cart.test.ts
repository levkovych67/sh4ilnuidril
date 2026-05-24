import { describe, it, expect } from 'vitest';
import {
  addItem,
  setQuantity,
  removeItem,
  totalQuantity,
  totalAmount,
  MAX_QUANTITY,
  type CartItem,
} from '../cart';

const TEE = { sku: 'DROP01-OVERSIZE', name: 'Tee', price: 2600 };
const HAT = { sku: 'HAT-01', name: 'Hat', price: 800 };

function line(p: { sku: string; name: string; price: number }, quantity: number): CartItem {
  return { ...p, quantity };
}

describe('addItem', () => {
  it('appends a new line if the SKU is not in the cart', () => {
    expect(addItem([], TEE, 1)).toEqual([line(TEE, 1)]);
  });

  it('appends with default qty 1 when qty omitted', () => {
    expect(addItem([], TEE)).toEqual([line(TEE, 1)]);
  });

  it('merges quantity for an existing SKU', () => {
    const start = [line(TEE, 2)];
    expect(addItem(start, TEE, 3)).toEqual([line(TEE, 5)]);
  });

  it('clamps the merged quantity to MAX_QUANTITY', () => {
    const start = [line(TEE, 8)];
    expect(addItem(start, TEE, 5)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('clamps an initial add that would exceed MAX_QUANTITY', () => {
    expect(addItem([], TEE, 99)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('keeps unrelated lines untouched when merging', () => {
    const start = [line(HAT, 1), line(TEE, 2)];
    expect(addItem(start, TEE, 1)).toEqual([line(HAT, 1), line(TEE, 3)]);
  });

  it('does not mutate the input array', () => {
    const start = [line(TEE, 1)];
    addItem(start, TEE, 1);
    expect(start).toEqual([line(TEE, 1)]);
  });
});

describe('setQuantity', () => {
  it('updates an existing line', () => {
    expect(setQuantity([line(TEE, 1)], TEE.sku, 4)).toEqual([line(TEE, 4)]);
  });

  it('clamps a value above MAX_QUANTITY', () => {
    expect(setQuantity([line(TEE, 1)], TEE.sku, 99)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('removes the line when qty is 0', () => {
    expect(setQuantity([line(TEE, 1)], TEE.sku, 0)).toEqual([]);
  });

  it('removes the line when qty is negative', () => {
    expect(setQuantity([line(TEE, 1)], TEE.sku, -5)).toEqual([]);
  });

  it('is a no-op for an unknown SKU', () => {
    const start = [line(TEE, 1)];
    expect(setQuantity(start, 'UNKNOWN', 3)).toEqual([line(TEE, 1)]);
  });

  it('does not mutate the input array', () => {
    const start = [line(TEE, 1)];
    setQuantity(start, TEE.sku, 4);
    expect(start).toEqual([line(TEE, 1)]);
  });
});

describe('removeItem', () => {
  it('drops the matching line', () => {
    expect(removeItem([line(TEE, 2), line(HAT, 1)], TEE.sku)).toEqual([line(HAT, 1)]);
  });

  it('is a no-op for an unknown SKU', () => {
    expect(removeItem([line(TEE, 1)], 'UNKNOWN')).toEqual([line(TEE, 1)]);
  });
});

describe('totalQuantity', () => {
  it('returns 0 for an empty cart', () => {
    expect(totalQuantity([])).toBe(0);
  });

  it('sums quantities across lines', () => {
    expect(totalQuantity([line(TEE, 2), line(HAT, 3)])).toBe(5);
  });
});

describe('totalAmount', () => {
  it('returns 0 for an empty cart', () => {
    expect(totalAmount([])).toBe(0);
  });

  it('sums price × quantity across lines', () => {
    expect(totalAmount([line(TEE, 2), line(HAT, 3)])).toBe(2 * 2600 + 3 * 800);
  });
});
