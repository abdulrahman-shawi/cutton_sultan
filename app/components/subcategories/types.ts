// components/subcategories/types.ts
import type { CategoryStatus } from '../categories/types';

export type { CategoryStatus };

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  status: CategoryStatus;
}

export const SUBCATEGORIES_STORAGE_KEY = 'sultan_subcategories';
