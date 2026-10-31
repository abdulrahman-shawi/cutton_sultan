// lib/data.ts — طبقة البيانات المشتركة: تخزين محلي أولاً (يعمل دون اتصال) مع مزامنة تلقائية إلى الخادم عند توفره
export const DATA_KEYS = [
  'sultan_categories',
  'sultan_subcategories',
  'sultan_products',
  'sultan_customers',
  'sultan_suppliers',
  'sultan_invoices',
  'sultan_requests',
  'sultan_returns',
  'sultan_store_settings',
  'sultan_users',
  'sultan_roles',
] as const;

export type DataKey = (typeof DATA_KEYS)[number];

export function isDataKey(key: string): key is DataKey {
  return (DATA_KEYS as readonly string[]).includes(key);
}

// قراءة محلية متزامنة — كل الواجهات تقرأ من التخزين المحلي، وتُملأ قيمه من الخادم عند الدخول
export function loadData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// حفظ محلي فوري + محاولة مزامنة صامتة مع الخادم (تُتجاهل عند غياب الاتصال)
export function saveData(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // التخزين غير متاح في هذا المتصفح
  }
  mirrorToServer(key, value);
}

function mirrorToServer(key: string, value: unknown): void {
  if (!isDataKey(key) || typeof window === 'undefined') return;
  void fetch('/api/store', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  }).catch(() => {
    // الخادم غير متاح — تبقى البيانات محلية وتُرفع عند عودة الاتصال عبر syncFromServer
  });
}

// مرآة شفافة: اعتراض كل كتابة على localStorage (من أي مدير أو مكوّن) ورفعها للخادم.
// تُثبَّت مرة واحدة عند دخول المنطقة الإدارية — بيانات الجلسة خارج قائمة المفاتيح فلا تُرفع.
let mirrorInstalled = false;
export function installStorageMirror(): void {
  if (typeof window === 'undefined' || mirrorInstalled) return;
  mirrorInstalled = true;
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = (key: string, value: string) => {
    originalSetItem(key, value);
    if (!isDataKey(key)) return;
    try {
      mirrorToServer(key, JSON.parse(value));
    } catch {
      // قيمة غير صالحة — لا نرفعها
    }
  };
}

export interface StoreSnapshot {
  [key: string]: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// كل العناصر سجلات تحمل رقم تعريف نصي — شرط قابلية الدمج دون تكرار
function hasIds(items: unknown[]): items is Record<string, unknown>[] {
  return items.every((item) => isPlainObject(item) && typeof item.id === 'string' && item.id.length > 0);
}

// دمج ما ورد من الخادم مع المخزن محلياً دون حذف أي سجل: السجلات المحلية تبقى بمكانها وترتيبها
// ويُحدَّث محتواها من نظيرها على الخادم إن وُجد، ويُضاف فقط ما ليس له نظير محلي برقم التعريف.
// القيم المفردة (الإعدادات) يغلب فيها الخادم عند الاختلاف.
function mergeWithLocal(localRaw: string | null, incoming: unknown): { value: unknown; changed: boolean } {
  if (localRaw === null) return { value: incoming, changed: true };
  let local: unknown;
  try {
    local = JSON.parse(localRaw);
  } catch {
    // مفتاح محلي تالف — تُعوَّض قيمته من الخادم
    return { value: incoming, changed: true };
  }
  if (Array.isArray(local) && Array.isArray(incoming)) {
    if (!hasIds(local) || !hasIds(incoming)) {
      const localIsEmpty = local.length === 0;
      return localIsEmpty ? { value: incoming, changed: true } : { value: local, changed: false };
    }
    const incomingById = new Map(incoming.map((item) => [item.id, item]));
    const localIds = new Set(local.map((item) => item.id));
    const merged = [
      ...local.map((item) => incomingById.get(item.id) ?? item),
      ...incoming.filter((item) => !localIds.has(item.id)),
    ];
    const serialized = JSON.stringify(merged);
    return serialized === localRaw ? { value: local, changed: false } : { value: merged, changed: true };
  }
  if (isPlainObject(local) && isPlainObject(incoming)) {
    const serialized = JSON.stringify(incoming);
    return serialized === localRaw ? { value: local, changed: false } : { value: incoming, changed: true };
  }
  const localIsEmpty =
    (Array.isArray(local) && local.length === 0) ||
    (isPlainObject(local) && Object.keys(local).length === 0);
  if (localIsEmpty) return { value: incoming, changed: true };
  return { value: local, changed: false };
}

// سحب مفاتيح الخادم إلى التخزين المحلي — يُستدعى بعد تسجيل الدخول قبل عرض الصفحات.
// الدمج تجميعي: تُضاف السجلات غير الموجودة محلياً فقط ولا يُحذف أو يُستبدل أي سجل محلي.
// إن كان الخادم جديداً فارغاً تُرفع إليه البيانات المحلية بدلاً من ذلك (بذر أول جهاز).
export async function syncFromServer(): Promise<boolean> {
  try {
    const response = await fetch('/api/store', { cache: 'no-store' });
    if (!response.ok) return false;
    const snapshot = (await response.json()) as StoreSnapshot;
    if (typeof window === 'undefined') return true;
    let anyKey = false;
    for (const key of DATA_KEYS) {
      if (!(key in snapshot)) continue;
      const incoming = snapshot[key];
      if (incoming === null || incoming === undefined) continue; // لا شيء يُضاف من هذا المفتاح
      anyKey = true;
      const { value, changed } = mergeWithLocal(window.localStorage.getItem(key), incoming);
      if (changed) window.localStorage.setItem(key, JSON.stringify(value));
    }
    if (!anyKey) await pushAllToServer();
    return true;
  } catch {
    return false;
  }
}

// رفع كل المفاتيح المحلية إلى الخادم باستبدال كامل — يُستدعى بعد استيراد نسخة احتياطية
// (استعادة محتوى ملف النسخة حرفياً بما فيه الحذف) وبعد أول دخول لبذر قاعدة بيانات فارغة.
// مزامنة فتح المتصفح العادية تمر عبر uploadOfflineBuffer ولا تستخدم هذا الوضع.
export async function pushAllToServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  const snapshot: Record<string, unknown> = { mode: 'replace' };
  for (const key of DATA_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      snapshot[key] = JSON.parse(raw);
    } catch {
      // مفتاح تالف — نتجاوزه
    }
  }
  if (Object.keys(snapshot).length === 1) return;
  try {
    await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch {
    // الخادم غير متاح — تبقى البيانات محلية
  }
}

// حذف مفاتيح من التخزين المحلي (بعد رفعها بنجاح إلى الخادم)
export function clearLocalKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  for (const key of keys) window.localStorage.removeItem(key);
}

// دورة العودة بعد انقطاع: ارفع البيانات المحلية إلى الخادم ليُضاف ما ينقصه فقط.
// تبقى المفاتيح المحلية كما هي — التخزين المحلي هو نسخة العمل الدائمة، فحذفها بعد الرفع
// قد يُفقد كل شيء إن فشل السحب الذي يليه. تعمل لأي مستخدم بغض النظر عن دوره
// (المفاتيح الحساسة يقبلها الخادم من المدير فقط ويعيد الباقي مقبولاً).
// عند غياب الاتصال تفشل بصمت ويبقى كل شيء محلياً — العمل دون اتصال غير متأثر.
export async function uploadOfflineBuffer(): Promise<string[]> {
  if (typeof window === 'undefined') return [];
  const snapshot: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      snapshot[key] = JSON.parse(raw);
    } catch {
      // مفتاح تالف — نتجاوزه
    }
  }
  if (Object.keys(snapshot).length === 0) return [];
  try {
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) return [];
    const result = (await response.json()) as { accepted?: string[] };
    const accepted = Array.isArray(result.accepted) ? result.accepted : [];
    return accepted;
  } catch {
    return [];
  }
}
