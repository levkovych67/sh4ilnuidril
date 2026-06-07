'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { CheckoutModal } from './CheckoutModal';

interface CheckoutContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used within CheckoutProvider');
  return ctx;
}

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <CheckoutContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
      <CheckoutModal />
    </CheckoutContext.Provider>
  );
}
