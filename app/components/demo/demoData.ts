// components/demo/demoData.ts — بيانات تجريبية كاملة للتجربة (لا تلمس الفواتير ولا الإعدادات)
import { CATEGORIES_STORAGE_KEY, type Category } from '../categories/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import {
  PRODUCTS_STORAGE_KEY,
  generateBarcode,
  type Product,
  type ProductEntry,
} from '../products/types';
import { CUSTOMERS_STORAGE_KEY, type Customer } from '../customers/types';
import { SUPPLIERS_STORAGE_KEY, type Supplier } from '../suppliers/types';

export function buildDemoData(): void {
  if (typeof window === 'undefined') return;
  try {
    const categories: Category[] = [
      { id: 'demo-cat-1', name: 'بشاكير', description: 'بشاكير وشالات نسائية فاخرة', status: 'نشط' },
      { id: 'demo-cat-2', name: 'قطنيات', description: 'أقمشة وملابس قطنية', status: 'نشط' },
      { id: 'demo-cat-3', name: 'أطفال', description: 'ملابس وأقمشة أطفال', status: 'نشط' },
    ];

    const subNames: { categoryId: string; names: string[] }[] = [
      { categoryId: 'demo-cat-1', names: ['فوريو', 'بازكة', 'روز'] },
      { categoryId: 'demo-cat-2', names: ['فوريو', 'بازكة', 'نسيم'] },
      { categoryId: 'demo-cat-3', names: ['فوريو', 'بازكة', 'ميلو'] },
    ];
    const subcategories: Subcategory[] = [];
    subNames.forEach((group, g) => {
      group.names.forEach((name, n) => {
        subcategories.push({
          id: `demo-sub-${g + 1}-${n + 1}`,
          categoryId: group.categoryId,
          name,
          status: 'نشط',
        });
      });
    });

    const productNames = [
      ['بشكير صوف مشجر', 'بشكير حرير سادة', 'شال مطرز يدوي'],
      ['ثوب قطن مصري', 'قماش قطن مخطط', 'بيجاما قطن ناعمة'],
      ['بيجاما أطفال ولادي', 'فستان بناتي صيفي', 'طقم أطفال قطني'],
    ];
    const colorPairs = [
      [['أحمر', 'أسود'], ['كحلي', 'بيج'], ['وردي', 'أبيض']],
      [['أبيض', 'أزرق'], ['أخضر', 'رمادي'], ['بني', 'أصفر']],
      [['أزرق', 'أحمر'], ['أخضر', 'أصفر'], ['وردي', 'بنفسجي']],
    ];
    const sizePairs = [
      [['فري سايز', 'فري سايز'], ['فري سايز', 'فري سايز'], ['فري سايز', 'فري سايز']],
      [['M', 'L'], ['S', 'XL'], ['L', 'XXL']],
      [['مقاس 2', 'مقاس 3'], ['مقاس 1', 'مقاس 2'], ['مقاس 3', 'مقاس 4']],
    ];

    const products: Product[] = [];
    let counter = 101;
    for (let g = 0; g < 3; g++) {
      const categoryId = `demo-cat-${g + 1}`;
      for (let n = 0; n < 3; n++) {
        const subcategoryId = `demo-sub-${g + 1}-${n + 1}`;
        for (let p = 0; p < 3; p++) {
          const saleSyp = 40000 + ((counter + p) % 7) * 15000;
          const saleUsd = 8 + ((counter + g) % 5) * 3;
          const entries: ProductEntry[] = [
            {
              color: colorPairs[g][n][0],
              size: sizePairs[g][n][0],
              subcategoryId,
              currency: 'SYP',
              quantity: 10 + p * 5 + n,
              wholesalePrice: Math.round(saleSyp * 0.75),
              salePrice: saleSyp,
              barcode: generateBarcode(),
            },
            {
              color: colorPairs[g][n][1],
              size: sizePairs[g][n][1],
              subcategoryId,
              currency: 'USD',
              quantity: 5 + p * 3,
              wholesalePrice: Math.round(saleUsd * 0.7),
              salePrice: saleUsd,
              barcode: generateBarcode(),
            },
          ];
          products.push({
            id: `demo-prod-${g + 1}-${n + 1}-${p + 1}`,
            name: productNames[g][p],
            modelNumber: `MDL-${counter}`,
            categoryId,
            status: p === 2 ? 'غير متوفر' : 'متوفر',
            entries,
          });
          counter++;
        }
      }
    }

    const now = Date.now();
    const customers: Customer[] = [
      {
        id: 'demo-cust-1',
        name: 'أحمد العلي',
        phone: '0955123456',
        address: 'دمشق — الميدان',
        openingBalanceSyp: 50000,
        openingBalanceUsd: 0,
        notes: '',
        createdAt: now,
      },
      {
        id: 'demo-cust-2',
        name: 'محمد حسن',
        phone: '0988776655',
        address: 'حلب — الجميلية',
        openingBalanceSyp: 0,
        openingBalanceUsd: 25,
        notes: '',
        createdAt: now,
      },
    ];

    const suppliers: Supplier[] = [
      {
        id: 'demo-sup-1',
        name: 'شركة فوريو',
        phone: '0112233445',
        subcategoryIds: ['demo-sub-1-1', 'demo-sub-2-1', 'demo-sub-3-1'],
        productIds: [
          'demo-prod-1-1-1', 'demo-prod-1-1-2',
          'demo-prod-2-1-1', 'demo-prod-2-1-2',
          'demo-prod-3-1-1', 'demo-prod-3-1-2',
        ],
        openingBalanceSyp: -100000,
        openingBalanceUsd: 0,
        notes: '',
        createdAt: now,
      },
      {
        id: 'demo-sup-2',
        name: 'شركة بازكة',
        phone: '0988112233',
        subcategoryIds: ['demo-sub-1-2', 'demo-sub-2-2', 'demo-sub-3-2'],
        productIds: [
          'demo-prod-1-2-1', 'demo-prod-1-2-2',
          'demo-prod-2-2-1', 'demo-prod-2-2-2',
          'demo-prod-3-2-1', 'demo-prod-3-2-2',
        ],
        openingBalanceSyp: 0,
        openingBalanceUsd: -50,
        notes: '',
        createdAt: now,
      },
    ];

    window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    window.localStorage.setItem(SUBCATEGORIES_STORAGE_KEY, JSON.stringify(subcategories));
    window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    window.localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
    window.localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
  } catch {
    // تعذر الكتابة في التخزين
  }
}
