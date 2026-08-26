// ============================================================
// App Store — Simple state management for the print flow
// ============================================================

'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface PrintState {
  sessionId: string | null;
  kioskId: string | null;
  kioskDisplayId: string | null;
  kioskName: string | null;
  kioskLocation: string | null;
  printMethod: 'QR' | 'CODE' | null;
  fileId: string | null;
  fileName: string | null;
  filePages: number;
  fileSize: number;
  colorMode: 'BW' | 'COLOR';
  paperSize: 'A4';
  sides: 'SINGLE' | 'DOUBLE';
  copies: number;
  pageRange: string | null;
  totalPrice: number;
  totalPages: number;
  pricePerPage: number;
  jobId: string | null;
  jobDisplayId: string | null;
  paymentId: string | null;
  orderId: string | null;
  printCode: string | null;
  codeExpiresAt: string | null;
  allowedKioskId: string | null;
}

interface StoreContextType {
  state: PrintState;
  update: (patch: Partial<PrintState>) => void;
  reset: () => void;
}

const defaultState: PrintState = {
  sessionId: null,
  kioskId: null,
  kioskDisplayId: null,
  kioskName: null,
  kioskLocation: null,
  printMethod: null,
  fileId: null,
  fileName: null,
  filePages: 0,
  fileSize: 0,
  colorMode: 'BW',
  paperSize: 'A4',
  sides: 'SINGLE',
  copies: 1,
  pageRange: null,
  totalPrice: 0,
  totalPages: 0,
  pricePerPage: 0,
  jobId: null,
  jobDisplayId: null,
  paymentId: null,
  orderId: null,
  printCode: null,
  codeExpiresAt: null,
  allowedKioskId: null,
};

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrintState>(defaultState);

  const update = (patch: Partial<PrintState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const reset = () => setState(defaultState);

  return (
    <StoreContext.Provider value={{ state, update, reset }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
}
