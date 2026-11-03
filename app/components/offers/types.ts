// components/offers/types.ts — عروضات المتجر: نسبة مئوية أو مبلغ ثابت بالليرة، تُطبق على الفواتير
export type OfferDiscountType = 'percent' | 'fixed';

export interface Offer {
  id: string;
  title: string;
  description: string;
  discountType: OfferDiscountType;
  discountValue: number; // نسبة (0-100) أو مبلغ ل.س
  active: boolean;
  createdAt: number;
}

export const OFFERS_STORAGE_KEY = 'sultan_offers';

export function formatOfferValue(offer: Offer): string {
  return offer.discountType === 'percent' ? `خصم ${offer.discountValue}٪` : `خصم ${offer.discountValue} ل.س`;
}

// حساب قيمة خصم العرض لإجمالي فاتورة: النسبة تُطبق على كل عملة، والمبلغ الثابت على الليرة
export function computeOfferDiscount(
  offer: Offer | null | undefined,
  totalSyp: number,
  totalUsd: number
): { syp: number; usd: number } {
  if (!offer || !offer.active) return { syp: 0, usd: 0 };
  if (offer.discountType === 'percent') {
    const percent = Math.min(Math.max(offer.discountValue, 0), 100);
    return {
      syp: Math.round((totalSyp * percent) / 100),
      usd: Math.round(totalUsd * percent) / 100,
    };
  }
  return { syp: Math.min(Math.max(offer.discountValue, 0), totalSyp), usd: 0 };
}
