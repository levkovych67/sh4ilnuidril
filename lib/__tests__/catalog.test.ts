import { describe, it, expect } from 'vitest';
import { PRODUCTS, findProduct } from '../catalog';

describe('PRODUCTS', () => {
  it('has at least two entries', () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(2);
  });

  it('every product has non-empty sku, name, videoSrc, imageSrc', () => {
    for (const p of PRODUCTS) {
      expect(typeof p.sku).toBe('string');
      expect(p.sku.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.videoSrc).toBe('string');
      expect(p.videoSrc.startsWith('/')).toBe(true);
      expect(typeof p.imageSrc).toBe('string');
      expect(p.imageSrc.startsWith('/')).toBe(true);
    }
  });

  it('every product has a positive numeric price', () => {
    for (const p of PRODUCTS) {
      expect(typeof p.price).toBe('number');
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it('every product uses currency UAH', () => {
    for (const p of PRODUCTS) {
      expect(p.currency).toBe('UAH');
    }
  });

  it('every SKU is unique', () => {
    const skus = PRODUCTS.map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });
});

describe('findProduct', () => {
  it('returns the product for a known SKU', () => {
    const p = findProduct('DROP01-OVERSIZE');
    expect(p).toBeDefined();
    expect(p?.sku).toBe('DROP01-OVERSIZE');
  });

  it('returns undefined for an unknown SKU', () => {
    expect(findProduct('UNKNOWN-SKU')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(findProduct('')).toBeUndefined();
  });
});
