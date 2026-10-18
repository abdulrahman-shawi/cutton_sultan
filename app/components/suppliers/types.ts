// components/suppliers/types.ts
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  goods: string;
  openingBalanceSyp: number;
  openingBalanceUsd: number;
  notes: string;
  createdAt: number;
}

export const SUPPLIERS_STORAGE_KEY = 'sultan_suppliers';
