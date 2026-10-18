// components/products/types.ts
export type ProductStatus = 'متوفر' | 'غير متوفر';
export type ProductCurrency = 'SYP' | 'USD';

export interface ProductEntry {
  color: string;
  size: string;
  subcategoryId: string;
  currency: ProductCurrency;
  quantity: number;
  wholesalePrice: number;
  salePrice: number;
  barcode: string;
}

export interface EntryDraft {
  color: string;
  size: string;
  subcategoryId: string;
  currency: ProductCurrency;
  quantity: string;
  wholesalePrice: string;
  salePrice: string;
  barcode: string;
}

export interface Product {
  id: string;
  name: string;
  modelNumber: string;
  categoryId: string;
  status: ProductStatus;
  entries: ProductEntry[];
}

export const PRODUCT_STATUSES: ProductStatus[] = ['متوفر', 'غير متوفر'];

export const PRODUCT_CURRENCIES: { value: ProductCurrency; label: string; symbol: string }[] = [
  { value: 'SYP', label: 'سوري', symbol: 'ل.س' },
  { value: 'USD', label: 'دولار', symbol: '$' },
];

export const COLOR_SUGGESTIONS = [
  'أبيض', 'أسود', 'أحمر', 'أزرق', 'أخضر', 'أصفر', 'وردي', 'بنفسجي',
  'برتقالي', 'بني', 'رمادي', 'بيج', 'كحلي', 'تركوازي', 'ذهبي', 'فضي',
];

export const SIZE_SUGGESTIONS = [
  'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'فري سايز',
  'مقاس 1', 'مقاس 2', 'مقاس 3', 'مقاس 4', 'مقاس 5',
];

export const PRODUCTS_STORAGE_KEY = 'sultan_products';

// توليد باركود EAN-13 بصيغة سليمة تشمل رقم التحقق
export function generateBarcode(): string {
  let random = String(Math.floor(Math.random() * 10000000000));
  while (random.length < 10) random = '0' + random;
  const body = '20' + random;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(body.charAt(i));
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return body + String(checkDigit);
}

export function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
