// components/customers/types.ts
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  openingBalanceSyp: number;
  openingBalanceUsd: number;
  notes: string;
  createdAt: number;
}

export const CUSTOMERS_STORAGE_KEY = 'sultan_customers';

export function loadOpeningDefaults(): { syp: string; usd: string } {
  if (typeof window === 'undefined') return { syp: '', usd: '' };
  try {
    const raw = window.localStorage.getItem('sultan_store_settings');
    if (!raw) return { syp: '', usd: '' };
    const settings = JSON.parse(raw) as { openingBalanceSyp?: string; openingBalanceUsd?: string };
    return { syp: settings.openingBalanceSyp ?? '', usd: settings.openingBalanceUsd ?? '' };
  } catch {
    return { syp: '', usd: '' };
  }
}
