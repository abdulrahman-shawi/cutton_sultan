// components/offers/types.ts — عروضات المتجر: ربطة منتجات (اسم + موديل + كمية وسعر) مع خصم على بنودها،
// تُضاف بنود العرض تلقائياً إلى الفاتورة عند بيعه
export type OfferDiscountType = 'percent' | 'fixed';

// صنف داخل العرض: تفصيلة مختارة من المخزون (منتج × قسم فرعي × لون/مقاس) مع رقم الموديل والسعر ضمن الربطة
export interface OfferItem {
  productId: string;
  productName: string;
  modelNumber: string;
  subcategoryName?: string;
  variant?: string; // اللون / المقاس
  quantity: number;
  price: number;
  currency: 'SYP' | 'USD';
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  items: OfferItem[];
  discountType: OfferDiscountType;
  discountValue: number; // نسبة (0-100) على بنود العرض أو مبلغ ثابت بالليرة
  active: boolean;
  createdAt: number;
}

export const OFFERS_STORAGE_KEY = 'sultan_offers';

export function formatOfferValue(offer: Offer): string {
  return offer.discountType === 'percent' ? `خصم ${offer.discountValue}٪` : `خصم ${offer.discountValue} ل.س`;
}

// إجمالي بنود العرض (أساس احتساب الخصم)
export function offerItemsTotals(offer: Offer | null | undefined): { syp: number; usd: number } {
  const items = offer?.items ?? [];
  let syp = 0;
  let usd = 0;
  for (const item of items) {
    if (item.currency === 'USD') usd += item.quantity * item.price;
    else syp += item.quantity * item.price;
  }
  return { syp, usd };
}

// حساب قيمة خصم العرض على أساس معطى: النسبة تُطبق على كل عملة، والمبلغ الثابت على الليرة.
// العروض القديمة بلا بنود تُحسب على أساس كامل الفاتورة (سلوك سابق).
export function computeOfferDiscount(
  offer: Offer | null | undefined,
  baseSyp: number,
  baseUsd: number
): { syp: number; usd: number } {
  if (!offer || !offer.active) return { syp: 0, usd: 0 };
  if (offer.discountType === 'percent') {
    const percent = Math.min(Math.max(offer.discountValue, 0), 100);
    return {
      syp: Math.round((baseSyp * percent) / 100),
      usd: Math.round(baseUsd * percent) / 100,
    };
  }
  return { syp: Math.min(Math.max(offer.discountValue, 0), baseSyp), usd: 0 };
}
