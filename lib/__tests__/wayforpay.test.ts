import { describe, it, expect } from 'vitest';
import { hmacMd5, purchaseSignature, callbackSignature, responseSignature } from '../wayforpay';

const SECRET = 'flk3409refn54t54t*FNJRET';

describe('hmacMd5', () => {
  it('produces a 32-char hex digest', () => {
    expect(hmacMd5(SECRET, 'a;b;c')).toMatch(/^[a-f0-9]{32}$/);
  });
  it('is deterministic', () => {
    expect(hmacMd5(SECRET, 'x')).toBe(hmacMd5(SECRET, 'x'));
  });
});

describe('purchaseSignature', () => {
  it('joins fields with semicolons and expands product arrays', () => {
    const sig = purchaseSignature(SECRET, {
      merchantAccount: 'test_merch',
      merchantDomainName: 'isusneisus.com',
      orderReference: 'DROP01-1',
      orderDate: 1000,
      amount: 2200,
      currency: 'UAH',
      productName: ['Tee'],
      productCount: [1],
      productPrice: [2200],
    });
    expect(sig).toMatch(/^[a-f0-9]{32}$/);
    const expected = hmacMd5(SECRET,
      'test_merch;isusneisus.com;DROP01-1;1000;2200;UAH;Tee;1;2200');
    expect(sig).toBe(expected);
  });
});

describe('callbackSignature', () => {
  it('builds signature from callback fields', () => {
    const sig = callbackSignature(SECRET, {
      merchantAccount: 'test_merch', orderReference: 'DROP01-1', amount: 2200,
      currency: 'UAH', authCode: '123', cardPan: '44**11',
      transactionStatus: 'Approved', reasonCode: 1100,
    });
    expect(sig).toBe(hmacMd5(SECRET,
      'test_merch;DROP01-1;2200;UAH;123;44**11;Approved;1100'));
  });
});

describe('responseSignature', () => {
  it('signs orderReference;status;time', () => {
    expect(responseSignature(SECRET, 'DROP01-1', 'accept', 1700))
      .toBe(hmacMd5(SECRET, 'DROP01-1;accept;1700'));
  });
});
