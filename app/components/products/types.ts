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
}

export interface EntryDraft {
  color: string;
  size: string;
  subcategoryId: string;
  currency: ProductCurrency;
  quantity: string;
  wholesalePrice: string;
  salePrice: string;
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
