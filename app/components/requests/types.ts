// components/requests/types.ts — توصيات العملاء: منتجات طلبها العميل ولم تكن متوفرة
export type RequestStatus = 'قيد الانتظار' | 'تم التوفر';

export const REQUEST_STATUSES: RequestStatus[] = ['قيد الانتظار', 'تم التوفر'];

// صنف واحد ضمن طلب العميل: يُربط بتفصيلة (لون/مقاس) عند اختياره من الكتالوج
export interface RequestItem {
  key: string;
  productId: string | null;
  entryBarcode: string | null;
  name: string;
  quantity: number;
}

export interface RequestItemDraft {
  key: string;
  productId: string | null;
  entryBarcode: string | null;
  name: string;
  query: string;
  quantity: string;
}

export function createRequestItemDraft(): RequestItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: null,
    entryBarcode: null,
    name: '',
    query: '',
    quantity: '1',
  };
}

export interface CustomerRequest {
  id: string;
  customerName: string;
  phone: string;
  items: RequestItem[];
  notes: string;
  status: RequestStatus;
  createdAt: number;
}

export const REQUESTS_STORAGE_KEY = 'sultan_requests';

// اسم مختصر للعرض في القوائم والتنبيهات: أول صنف مع عدد الأصناف المتبقية
export function requestItemsLabel(items: RequestItem[]): string {
  if (items.length === 0) return '—';
  return items.length > 1 ? `${items[0].name} +${items.length - 1}` : items[0].name;
}

// إجمالي الكميات المطلوبة لعرضه في الجدول
export function requestTotalQuantity(items: RequestItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
