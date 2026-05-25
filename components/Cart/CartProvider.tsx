'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addItem,
  removeItem,
  setQuantity,
  totalAmount as sumAmount,
  totalQuantity as sumQty,
  type CartItem,
} from '@/lib/cart';
import { findProduct } from '@/lib/catalog';

const STORAGE_KEY = 'sasha-cart-v1';

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sku === 'string' &&
    typeof v.name === 'string' &&
    typeof v.price === 'number' &&
    typeof v.quantity === 'number'
  );
}

interface CartContextValue {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  totalQuantity: number;
  totalAmount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load on mount. Initial state is [] (matches SSR) — we hydrate after mount
  // to avoid React hydration mismatch warnings. Silent on any failure
  // (private mode, quota, corrupt JSON) — in-memory cart still works.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isCartItem)) {
        // Drop items whose SKU is no longer in the catalog (deleted product,
        // moved asset path, etc.). Prevents phantom lines in the drawer.
        const valid = parsed.filter((item) => findProduct(item.sku));
        setItems(valid);
      }
    } catch {
      /* keep empty cart */
    }
  }, []);

  // Save on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* in-memory only */
    }
  }, [items]);

  const add = useCallback(
    (item: Omit<CartItem, 'quantity'>, qty: number = 1) =>
      setItems((prev) => addItem(prev, item, qty)),
    [],
  );
  const setQty = useCallback(
    (sku: string, qty: number) => setItems((prev) => setQuantity(prev, sku, qty)),
    [],
  );
  const remove = useCallback((sku: string) => setItems((prev) => removeItem(prev, sku)), []);
  const clear = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const value: CartContextValue = useMemo(
    () => ({
      items,
      add,
      setQty,
      remove,
      clear,
      totalQuantity: sumQty(items),
      totalAmount: sumAmount(items),
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [items, isDrawerOpen, add, setQty, remove, clear, openDrawer, closeDrawer],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
