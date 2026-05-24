export interface CartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export const MAX_QUANTITY = 10;

function clampQty(n: number): number {
  if (n > MAX_QUANTITY) return MAX_QUANTITY;
  if (n < 0) return 0;
  return n;
}

export function addItem(
  items: CartItem[],
  item: Omit<CartItem, 'quantity'>,
  qty: number = 1,
): CartItem[] {
  if (qty <= 0) return items;
  const existing = items.find((i) => i.sku === item.sku);
  if (existing) {
    const merged = clampQty(existing.quantity + qty);
    if (merged <= 0) return items;
    return items.map((i) => (i.sku === item.sku ? { ...i, quantity: merged } : i));
  }
  const clamped = clampQty(qty);
  if (clamped <= 0) return items;
  return [...items, { ...item, quantity: clamped }];
}

export function setQuantity(items: CartItem[], sku: string, qty: number): CartItem[] {
  const clamped = clampQty(qty);
  if (clamped <= 0) return removeItem(items, sku);
  return items.map((i) => (i.sku === sku ? { ...i, quantity: clamped } : i));
}

export function removeItem(items: CartItem[], sku: string): CartItem[] {
  return items.filter((i) => i.sku !== sku);
}

export function totalQuantity(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function totalAmount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.price, 0);
}
