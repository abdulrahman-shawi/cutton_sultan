// components/invoices/types.ts
import { formatPrice, type Product, type ProductCurrency } from '../products/types';
import type { Subcategory } from '../subcategories/types';

export type InvoiceType = 'مقبوضات' | 'مدفوعات' | 'مصاريف يومية';
export type PaymentStatus = 'مدفوعة' | 'مدفوعة جزئياً' | 'غير مدفوعة';

export const INVOICE_TYPES: InvoiceType[] = ['مقبوضات', 'مدفوعات', 'مصاريف يومية'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['مدفوعة', 'مدفوعة جزئياً', 'غير مدفوعة'];

export interface InvoiceItem {
  key: string;
  productId: string | null;
  entryBarcode: string | null;
  name: string;
  currency: ProductCurrency;
  quantity: number;
  price: number;
  discount: number;
  notes: string;
}

export interface ItemDraft {
  key: string;
  productId: string | null;
  entryBarcode: string | null;
  name: string;
  query: string;
  currency: ProductCurrency;
  quantity: string;
  price: string;
  discount: string;
  notes: string;
}

export function createItemDraft(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: null,
    entryBarcode: null,
    name: '',
    query: '',
    currency: 'SYP',
    quantity: '1',
    price: '',
    discount: '',
    notes: '',
  };
}

export interface Invoice {
  id: string;
  number: number;
  type: InvoiceType;
  partyId: string | null;
  partyName: string;
  status: PaymentStatus;
  items: InvoiceItem[];
  totalSyp: number;
  totalUsd: number;
  paidSyp: number;
  paidUsd: number;
  remainingSyp: number;
  remainingUsd: number;
  notes: string;
  createdAt: number;
}

export const INVOICES_STORAGE_KEY = 'sultan_invoices';

// كل تفصيلة (لون/مقاس) كخيار قابل للبحث والاختيار في الفاتورة
export interface EntryOption {
  barcode: string;
  productId: string;
  productName: string;
  modelNumber: string;
  subcategoryName: string;
  color: string;
  size: string;
  currency: ProductCurrency;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
}

export function buildEntryOptions(products: Product[], subcategories: Subcategory[]): EntryOption[] {
  const options: EntryOption[] = [];
  for (const product of products) {
    for (const entry of product.entries) {
      options.push({
        barcode: entry.barcode,
        productId: product.id,
        productName: product.name,
        modelNumber: product.modelNumber,
        subcategoryName: subcategories.find((subcategory) => subcategory.id === entry.subcategoryId)?.name ?? '',
        color: entry.color,
        size: entry.size,
        currency: entry.currency,
        retailPrice: entry.salePrice,
        wholesalePrice: entry.wholesalePrice,
        stock: entry.quantity,
      });
    }
  }
  return options;
}

export function optionLabel(option: EntryOption): string {
  const variant = [option.color, option.size].filter(Boolean).join(' / ');
  return variant ? `${option.productName} — ${variant}` : option.productName;
}

export function optionSearchText(option: EntryOption): string {
  return `${option.productName} ${option.modelNumber} ${option.barcode}`.toLowerCase();
}

export function currencySymbol(currency: ProductCurrency): string {
  return currency === 'USD' ? '$' : 'ل.س';
}

export function formatMoney(value: number, currency: ProductCurrency): string {
  return `${formatPrice(value)} ${currencySymbol(currency)}`;
}
