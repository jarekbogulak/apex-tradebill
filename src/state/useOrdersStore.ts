import { create } from 'zustand';

export type PlacedOrder = {
  id?: string;
  clientOrderId?: string;
  symbolDash: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  size: string;
  price: string;
  timeInForce?: 'GOOD_TIL_CANCEL' | 'FILL_OR_KILL' | 'IMMEDIATE_OR_CANCEL';
  createdAt: number; // client timestamp when added
  raw?: any; // raw server response (optional)
};

type OrdersState = {
  orders: PlacedOrder[];
  add: (o: PlacedOrder) => void;
  clear: () => void;
};

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  add: (o) => set((s) => ({ orders: [o, ...s.orders].slice(0, 50) })),
  clear: () => set({ orders: [] }),
}));

