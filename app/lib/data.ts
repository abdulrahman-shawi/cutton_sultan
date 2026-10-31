// lib/data.ts — طبقة البيانات المشتركة: تخزين محلي أولاً (يعمل دون اتصال) مع مزامنة تلقائية إلى الخادم عند توفره
// كل دفعة تحمل «طابعاً مرجعياً» = آخر وقت تعديل سحبه العميل من الخادم، والخادم لا يمسح ما هو أحدث منه
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

// بادئة مفاتيح الطوابع المرجعية في التخزين المحلي — ليست مفاتيح بيانات فلا تُرفع بالمرآة
const SYNC_TS_PREFIX = 'sultan_synced_at::';

function readSyncTs(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SYNC_TS_PREFIX + key);
  } catch {
    return null;
  }
}

function writeSyncTs(key: string, ts: string | null | undefined): void {
  if (!ts || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYNC_TS_PREFIX + key, ts);
  } catch {
    // التخزين غير متاح — الدفعة التالية ستعمل بوضع الإضافة فقط (آمن)
  }
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

// تعليق مؤقت للمرآة أثناء تعبئة التخزين المحلي من لقطة الخادم — لا معنى لإعادة رفع ما سُحب للتو
let mirrorSuspended = false;

function mirrorToServer(key: string, value: unknown): void {
  if (!isDataKey(key) || typeof window === 'undefined' || mirrorSuspended) return;
  void fetch('/api/store', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, base: readSyncTs(key) }),
  })
    .then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as { serverTime?: string };
      if (result?.serverTime) writeSyncTs(key, result.serverTime);
    })
    .catch(() => {
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

// سحب كل مفاتيح الخادم إلى التخزين المحلي — يُستدعى بعد تسجيل الدخول قبل عرض الصفحات.
// إن كان الخادم جديداً فارغاً تُرفع إليه البيانات المحلية بدلاً من ذلك (بذر أول جهاز).
// تُسجَّل مع كل مفتاح طابعه المرجعي (آخر وقت تعديل على الخادم) لتحمي الدفعات اللاحقة الأحدثَ من المسح.
export async function syncFromServer(): Promise<boolean> {
  try {
    const response = await fetch('/api/store', { cache: 'no-store' });
    if (!response.ok) return false;
    const snapshot = (await response.json()) as StoreSnapshot;
    if (typeof window === 'undefined') return true;
    const meta = (snapshot.__meta ?? {}) as Record<string, string | null>;
    let anyKey = false;
    mirrorSuspended = true;
    try {
      for (const key of DATA_KEYS) {
        if (key in snapshot) {
          anyKey = true;
          window.localStorage.setItem(key, JSON.stringify(snapshot[key]));
        }
      }
    } finally {
      mirrorSuspended = false;
    }
    for (const key of DATA_KEYS) {
      if (key in meta) writeSyncTs(key, meta[key]);
    }
    if (!anyKey) await pushAllToServer();
    return true;
  } catch {
    return false;
  }
}

// رفع كل المفاتيح المحلية إلى الخادم — يُستدعى بعد أول دخول ناجح لبذر قاعدة البيانات وبعد استيراد نسخة احتياطية.
// إجراء صريح من المستخدم لذلك يُرسل طابع «الآن»: استبدال كامل مقصود (النسخة المحلية هي الحقيقة).
export async function pushAllToServer(): Promise<void> {
  if (typeof window === 'undefined') return;
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
  if (Object.keys(snapshot).length === 0) return;
  const now = new Date().toISOString();
  const base: Record<string, string> = {};
  for (const key of Object.keys(snapshot)) base[key] = now;
  try {
    await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...snapshot, __base: base }),
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

// دورة العودة بعد انقطاع: ارفع ذاكرة الانتظار المحلية إلى الخادم، واحذف المرفوع من localStorage.
// تعمل لأي مستخدم بغض النظر عن دوره (المفاتيح الحساسة يقبلها الخادم من المدير فقط ويعيد الباقي مقبولاً).
// كل مفتاح يُرفع بطابعه المرجعي فلا يمسح على الخادم سجلات أحدث مما سحب هذا الجهاز.
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
  const base: Record<string, string> = {};
  for (const key of Object.keys(snapshot)) {
    const ts = readSyncTs(key);
    if (ts) base[key] = ts;
  }
  try {
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...snapshot, __base: base }),
    });
    if (!response.ok) return [];
    const result = (await response.json()) as { accepted?: string[]; serverTime?: Record<string, string> };
    const accepted = Array.isArray(result.accepted) ? result.accepted : [];
    for (const key of accepted) writeSyncTs(key, result.serverTime?.[key]);
    clearLocalKeys(accepted);
    return accepted;
  } catch {
    return [];
  }
}
