// components/returns/types.ts — نموذج عمليات التبديل والمرتجع
import type { ProductCurrency } from '../products/types';

export type ReturnType = 'مرتجع' | 'تبديل';

export const RETURN_TYPES: ReturnType[] = ['مرتجع', 'تبديل'];

// صنف واحد ضمن عملية: إما وارد (مرتجع من الزبون) أو صادر (بديل مسلَّم للزبون)
export interface ReturnItem {
  key: string;
  productId: string | null;
  entryBarcode: string | null;
  name: string;
  currency: ProductCurrency;
  quantity: number;
  price: number;
  notes: string;
}

export interface ReturnItemDraft {
  key: string;
  productId: string | null;
  entryBarcode: string | null;
  name: string;
  query: string;
  currency: ProductCurrency;
  quantity: string;
  price: string;
  notes: string;
}

export function createReturnItemDraft(): ReturnItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: null,
    entryBarcode: null,
    name: '',
    query: '',
    currency: 'SYP',
    quantity: '1',
    price: '',
    notes: '',
  };
}

export interface ReturnRecord {
  id: string;
  number: number;
  type: ReturnType;
  customerId: string | null;
  customerName: string;
  returnedItems: ReturnItem[];
  replacementItems: ReturnItem[];
  returnedSyp: number;
  returnedUsd: number;
  replacementSyp: number;
  replacementUsd: number;
  paidSyp: number;
  paidUsd: number;
  refundedSyp: number;
  refundedUsd: number;
  notes: string;
  createdAt: number;
}

export const RETURNS_STORAGE_KEY = 'sultan_returns';

export function returnTotals(items: ReturnItem[]): { syp: number; usd: number } {
  const totals = { syp: 0, usd: 0 };
  for (const item of items) {
    totals[item.currency === 'USD' ? 'usd' : 'syp'] += Math.max(item.quantity * item.price, 0);
  }
  return totals;
}
