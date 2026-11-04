// app/api/shop/route.ts — بوابة الكتالوج العامة: بيانات المتجر للعملاء بلا تسجيل دخول.
// تُرسل الأقسام النشطة والمنتجات مع أسعار المفرق والتوفر فقط — أسعار الجملة والباركود لا تغادر النظام الإداري.
import { NextResponse } from 'next/server';
import { readCollection, readSingleton } from '../../lib/server/entities';
import type { Product } from '../../components/products/types';
import type { Category } from '../../components/categories/types';
import type { Subcategory } from '../../components/subcategories/types';

export const dynamic = 'force-dynamic';

interface ShopSettings {
  storeName?: string;
  contactEmail?: string;
  socialLink?: string;
  dollarRate?: string;
  currency?: string;
}

// GET /api/shop — لقطة الكتالوج الكاملة للواجهة العامة
export async function GET() {
  const [settings, categories, subcategories, products] = await Promise.all([
    readSingleton('sultan_store_settings') as Promise<ShopSettings | null>,
    readCollection('sultan_categories') as Promise<Category[] | null>,
    readCollection('sultan_subcategories') as Promise<Subcategory[] | null>,
    readCollection('sultan_products') as Promise<Product[] | null>,
  ]);

  const activeCategories = (categories ?? []).filter((category) => category.status === 'نشط');
  const activeSubcategories = (subcategories ?? []).filter((subcategory) => subcategory.status === 'نشط');

  // تنظيف المنتجات لوجهة العميل: إسقاط الجملة والباركود والحقول الداخلية
  const catalogProducts = (products ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    modelNumber: product.modelNumber,
    categoryId: product.categoryId,
    status: product.status,
    imageUrl: product.imageUrl ?? '',
    entries: (product.entries ?? []).map((entry) => ({
      color: entry.color,
      size: entry.size,
      subcategoryId: entry.subcategoryId,
      currency: entry.currency,
      quantity: entry.quantity,
      salePrice: entry.salePrice,
    })),
  }));

  return NextResponse.json({
    storeName: settings?.storeName?.trim() || 'قطنيات وبشاكير سلطان',
    contactEmail: settings?.contactEmail?.trim() ?? '',
    socialLink: settings?.socialLink?.trim() ?? '',
    dollarRate: settings?.dollarRate?.trim() ?? '',
    currency: settings?.currency?.trim() || 'SYP',
    categories: activeCategories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? '',
    })),
    subcategories: activeSubcategories.map((subcategory) => ({
      id: subcategory.id,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
    })),
    products: catalogProducts,
  });
}
