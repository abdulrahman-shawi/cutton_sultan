// components/categories/types.ts
export type CategoryStatus = 'نشط' | 'متوقف';

export interface Category {
  id: string;
  name: string;
  description: string;
  status: CategoryStatus;
}

export const seedCategories: Category[] = [
  { id: 'seed-shawls', name: 'بشاكير', description: 'بشاكير وشالات نسائية فاخرة', status: 'نشط' },
  { id: 'seed-cotton', name: 'قطنيات', description: 'أقمشة ومنتجات قطنية', status: 'نشط' },
  { id: 'seed-sheets', name: 'مفارش', description: 'مفارش سرائر وطاولات', status: 'نشط' },
];

export const CATEGORIES_STORAGE_KEY = 'sultan_categories';
