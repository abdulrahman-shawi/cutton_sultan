// components/offers/OffersManager.tsx — إدارة عروضات المتجر: قائمة، تفعيل، وربطها بالفواتير ووكيل العملاء
'use client';

import { useEffect, useState } from 'react';
import { BadgePercent, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import OfferModal from './OfferModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { OFFERS_STORAGE_KEY, formatOfferValue, type Offer } from './types';

function loadOffers(): Offer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Offer[]) : [];
  } catch {
    return [];
  }
}

export default function OffersManager() {
  const [offers, setOffers] = useState<Offer[]>(loadOffers);
  const [modal, setModal] = useState<{ open: boolean; offer: Offer | null }>({ open: false, offer: null });
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(offers));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [offers]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = (offer: Offer) => {
    const exists = offers.some((item) => item.id === offer.id);
    setOffers((prev) => (exists ? prev.map((item) => (item.id === offer.id ? offer : item)) : [offer, ...prev]));
    setModal({ open: false, offer: null });
    setToast(exists ? 'تم تحديث العرض' : 'تم إنشاء العرض — أصبح متاحاً في الفواتير');
  };

  const toggleActive = (offer: Offer) => {
    setOffers((prev) => prev.map((item) => (item.id === offer.id ? { ...item, active: !item.active } : item)));
  };

  const handleDelete = () => {
    if (!deleting) return;
    setOffers((prev) => prev.filter((offer) => offer.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف العرض');
  };

  const activeCount = offers.filter((offer) => offer.active).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">التسويق</p>
          <h1 className="text-2xl font-bold text-slate-900">العروضات</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            أنشئ عروضاً بنسبة أو بمبلغ ثابت — تُختار عند إصدار الفاتورة فيخصم تلقائياً من الإجمالي،
            ويعرضها وكيل العملاء للعملاء عند السؤال عن العروض.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, offer: null })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          عرض جديد
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1.5">عدد العروضات</p>
          <p className="text-lg font-bold text-slate-800">{offers.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1.5">عروض مفعّلة</p>
          <p className="text-lg font-bold text-emerald-600">{activeCount}</p>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
          <BadgePercent className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">لا عروضات بعد</p>
          <p className="text-sm text-slate-400 mb-5">أنشئ أول عرض ليظهر في الفواتير ومحادثات العملاء.</p>
          <button
            type="button"
            onClick={() => setModal({ open: true, offer: null })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            عرض جديد
          </button>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <li key={offer.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${offer.active ? 'border-emerald-200' : 'border-slate-200 opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${offer.discountType === 'percent' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                  <BadgePercent className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
                  {formatOfferValue(offer)}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={offer.active}
                  aria-label={`تفعيل ${offer.title}`}
                  onClick={() => toggleActive(offer)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${offer.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${offer.active ? 'right-0.5' : 'right-[22px]'}`} />
                </button>
              </div>
              <p className="font-bold text-slate-800 mt-3">{offer.title}</p>
              {offer.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{offer.description}</p>}
              {offer.items && offer.items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {offer.items.slice(0, 4).map((item, index) => (
                    <li key={index} className="text-[11px] text-slate-500">
                      <span className="font-medium text-slate-600">{item.productName}</span>
                      {item.modelNumber ? <span className="text-slate-400"> — موديل {item.modelNumber}</span> : ''}
                      <span className="text-slate-400"> × {item.quantity}</span>
                    </li>
                  ))}
                  {offer.items.length > 4 && (
                    <li className="text-[11px] text-slate-400">+{offer.items.length - 4} منتجات أخرى</li>
                  )}
                </ul>
              )}
              <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModal({ open: true, offer })}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(offer)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal.open && (
        <OfferModal
          initial={modal.offer}
          onClose={() => setModal({ open: false, offer: null })}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.title}
          itemLabel="العرض"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toast && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
