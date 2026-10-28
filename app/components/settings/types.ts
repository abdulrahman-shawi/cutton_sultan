// components/settings/types.ts
export interface StoreSettings {
  storeName: string;
  currency: string;
  dollarRate: string;
  openingBalanceSyp: string;
  openingBalanceUsd: string;
  contactEmail: string;
  socialLink: string;
  lowStockThreshold: string;
}

export const defaultSettings: StoreSettings = {
  storeName: 'قطنيات وبشاكير سلطان',
  currency: 'SYP',
  dollarRate: '',
  openingBalanceSyp: '',
  openingBalanceUsd: '',
  contactEmail: '',
  socialLink: '',
  lowStockThreshold: '5',
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

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

// حد تنبيه نقص المخزون: الحد المحفوظ في الإعدادات أو الافتراضي عند غيابه
export function loadLowStockThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_LOW_STOCK_THRESHOLD;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_LOW_STOCK_THRESHOLD;
    const value = Number((JSON.parse(raw) as StoreSettings).lowStockThreshold);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_LOW_STOCK_THRESHOLD;
  } catch {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
}
