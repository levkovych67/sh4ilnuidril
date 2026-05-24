'use client';

import {
  createContext,
  useCallback,
  useContext,
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
