// components/requests/types.ts — توصيات العملاء: منتجات طلبها العميل ولم تكن متوفرة
export type RequestStatus = 'قيد الانتظار' | 'تم التوفر';

export const REQUEST_STATUSES: RequestStatus[] = ['قيد الانتظار', 'تم التوفر'];

export interface CustomerRequest {
  id: string;
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  notes: string;
  status: RequestStatus;
  createdAt: number;
}

export const REQUESTS_STORAGE_KEY = 'sultan_requests';
