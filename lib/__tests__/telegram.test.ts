import { describe, it, expect } from 'vitest';
import { formatOrderMessage } from '../telegram';

describe('formatOrderMessage', () => {
  it('renders each ordered line with its size-bearing name and quantity', () => {
    const text = formatOrderMessage({
      orderReference: 'DROP01-1',
      lines: [
        { name: 'Футболка - Tee (Розмір: M)', quantity: 2 },
        { name: 'Футболка - Hat', quantity: 1 },
      ],
      fullName: 'Іван Іванов',
      phone: '+380671234567',
      email: 'a@b.com',
      city: 'Львів',
      warehouse: 'Відділення №1',
      amount: 5200,
    });
    expect(text).toContain('• Футболка - Tee (Розмір: M) ×2');
    expect(text).toContain('• Футболка - Hat ×1');
  });

  it('shows a dash when no lines were provided', () => {
    const text = formatOrderMessage({
      orderReference: 'DROP01-2',
      lines: [],
      fullName: '—',
      phone: '—',
      email: '—',
      city: '—',
      warehouse: '—',
      amount: 0,
    });
    expect(text).toContain('<b>Товар:</b>\n—');
  });
});
