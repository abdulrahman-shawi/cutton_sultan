// components/settings/types.ts
export interface StoreSettings {
  storeName: string;
  currency: string;
  dollarRate: string;
  openingBalanceSyp: string;
  openingBalanceUsd: string;
  contactEmail: string;
  socialLink: string;
}

export const defaultSettings: StoreSettings = {
  storeName: 'قطنيات وبشاكير سلطان',
  currency: 'SYP',
  dollarRate: '',
  openingBalanceSyp: '',
  openingBalanceUsd: '',
  contactEmail: '',
  socialLink: '',
};

export const currencyOptions = [
  { value: 'SYP', label: 'ليرة سورية (SYP)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
  { value: 'EUR', label: 'يورو (EUR)' },
  { value: 'TRY', label: 'ليرة تركية (TRY)' },
];

export const SETTINGS_STORAGE_KEY = 'sultan_store_settings';

export interface SettingsSectionProps {
  settings: StoreSettings;
  onChange: (field: keyof StoreSettings, value: string) => void;
}

export function loadDollarRate(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return 0;
    const rate = Number((JSON.parse(raw) as StoreSettings).dollarRate);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  } catch {
    return 0;
  }
}
