export interface CartItem {
  sku: string;
  name: string;
  price: number;
  size: string;
  quantity: number;
}

export const MAX_QUANTITY = 10;

/** Cart line identity: a product in two sizes is two lines. */
export function lineKey(item: { sku: string; size: string }): string {
  return `${item.sku}__${item.size}`;
}

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
  const key = lineKey(item);
  const existing = items.find((i) => lineKey(i) === key);
  if (existing) {
    const merged = clampQty(existing.quantity + qty);
    if (merged <= 0) return items;
    return items.map((i) => (lineKey(i) === key ? { ...i, quantity: merged } : i));
  }
  const clamped = clampQty(qty);
  if (clamped <= 0) return items;
  return [...items, { ...item, quantity: clamped }];
}

export function setQuantity(items: CartItem[], key: string, qty: number): CartItem[] {
  const clamped = clampQty(qty);
  if (clamped <= 0) return removeItem(items, key);
  return items.map((i) => (lineKey(i) === key ? { ...i, quantity: clamped } : i));
}

export function removeItem(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => lineKey(i) !== key);
}

export function totalQuantity(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function totalAmount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.price, 0);
}
