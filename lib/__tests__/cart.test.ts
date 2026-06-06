import { describe, it, expect } from 'vitest';
import {
  addItem,
  setQuantity,
  removeItem,
  totalQuantity,
  totalAmount,
  lineKey,
  MAX_QUANTITY,
  type CartItem,
} from '../cart';

const TEE = { sku: 'DROP01-OVERSIZE', name: 'Tee', price: 2600, size: 'M' };
const TEE_L = { ...TEE, size: 'L' };
const HAT = { sku: 'HAT-01', name: 'Hat', price: 800, size: '' };

function line(p: Omit<CartItem, 'quantity'>, quantity: number): CartItem {
  return { ...p, quantity };
}

describe('addItem', () => {
  it('appends a new line if (sku,size) is not in the cart', () => {
    expect(addItem([], TEE, 1)).toEqual([line(TEE, 1)]);
  });

  it('appends with default qty 1 when qty omitted', () => {
    expect(addItem([], TEE)).toEqual([line(TEE, 1)]);
  });

  it('merges quantity for an existing (sku,size)', () => {
    expect(addItem([line(TEE, 2)], TEE, 3)).toEqual([line(TEE, 5)]);
  });

  it('keeps the same SKU in two sizes as TWO distinct lines', () => {
    const start = addItem([], TEE, 1);
    const both = addItem(start, TEE_L, 1);
    expect(both).toEqual([line(TEE, 1), line(TEE_L, 1)]);
  });

  it('merges only the matching size, leaving the other size untouched', () => {
    const start = [line(TEE, 1), line(TEE_L, 1)];
    expect(addItem(start, TEE_L, 2)).toEqual([line(TEE, 1), line(TEE_L, 3)]);
  });

  it('clamps the merged quantity to MAX_QUANTITY', () => {
    expect(addItem([line(TEE, 8)], TEE, 5)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('clamps an initial add that would exceed MAX_QUANTITY', () => {
    expect(addItem([], TEE, 99)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('does not mutate the input array', () => {
    const start = [line(TEE, 1)];
    addItem(start, TEE, 1);
    expect(start).toEqual([line(TEE, 1)]);
  });

  it('is a no-op when qty is 0 or negative', () => {
    expect(addItem([], TEE, 0)).toEqual([]);
    expect(addItem([line(TEE, 2)], TEE, -5)).toEqual([line(TEE, 2)]);
  });
});

describe('lineKey', () => {
  it('combines sku and size', () => {
    expect(lineKey(TEE)).toBe('DROP01-OVERSIZE__M');
    expect(lineKey(HAT)).toBe('HAT-01__');
  });
});

describe('setQuantity', () => {
  it('updates the targeted (sku,size) line', () => {
    expect(setQuantity([line(TEE, 1)], lineKey(TEE), 4)).toEqual([line(TEE, 4)]);
  });

  it('updates only the matching size line', () => {
    const start = [line(TEE, 1), line(TEE_L, 1)];
    expect(setQuantity(start, lineKey(TEE_L), 4)).toEqual([line(TEE, 1), line(TEE_L, 4)]);
  });

  it('clamps a value above MAX_QUANTITY', () => {
    expect(setQuantity([line(TEE, 1)], lineKey(TEE), 99)).toEqual([line(TEE, MAX_QUANTITY)]);
  });

  it('removes the line when qty <= 0', () => {
    expect(setQuantity([line(TEE, 1)], lineKey(TEE), 0)).toEqual([]);
  });

  it('is a no-op for an unknown line key', () => {
    expect(setQuantity([line(TEE, 1)], 'UNKNOWN__M', 3)).toEqual([line(TEE, 1)]);
  });

  it('does not mutate the input array', () => {
    const start = [line(TEE, 1)];
    setQuantity(start, lineKey(TEE), 4);
    expect(start).toEqual([line(TEE, 1)]);
  });
});

describe('removeItem', () => {
  it('drops only the matching (sku,size) line', () => {
    expect(removeItem([line(TEE, 2), line(TEE_L, 1)], lineKey(TEE))).toEqual([line(TEE_L, 1)]);
  });

  it('is a no-op for an unknown line key', () => {
    expect(removeItem([line(TEE, 1)], 'UNKNOWN__M')).toEqual([line(TEE, 1)]);
  });
});

describe('totals', () => {
  it('totalQuantity sums quantities across lines', () => {
    expect(totalQuantity([line(TEE, 2), line(HAT, 3)])).toBe(5);
  });
  it('totalAmount sums price × quantity across lines', () => {
    expect(totalAmount([line(TEE, 2), line(HAT, 3)])).toBe(2 * 2600 + 3 * 800);
  });
});
