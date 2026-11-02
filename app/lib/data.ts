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
  'sultan_daily_journal',
  'sultan_conversations',
  'sultan_workflows',
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

// حفظ محلي فوري — المرآة المثبتة في installStorageMirror ترفع القيمة إلى الخادم فوراً
// عند توفر الاتصال، وعند غيابه تُسجَّل الفروقات في قائمة الانتظار لترفع عند عودة الاتصال
export function saveData(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // التخزين غير متاح في هذا المتصفح
  }
}

// قائمة انتظار عمليات أُجريت دون اتصال: إضافة (put) أو تعديل أو حذف (delete) سجلاً سجلاً
export interface SyncOp {
  key: DataKey;
  op: 'put' | 'delete' | 'putSingleton';
  id?: string;
  record?: Record<string, unknown>;
  at: number;
}

const SYNC_QUEUE_KEY = 'sultan_sync_queue';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

type IdentifiedRecord = Record<string, unknown> & { id: string };

// كل العناصر سجلات تحمل رقم تعريف نصي — شرط حساب الفروق دون تكرار
function hasIds(items: unknown[]): items is IdentifiedRecord[] {
  return items.every((item) => isPlainObject(item) && typeof item.id === 'string' && item.id.length > 0);
}

function isIdentified(item: unknown): item is IdentifiedRecord {
  return isPlainObject(item) && typeof item.id === 'string' && item.id.length > 0;
}

// حساب الفرق بين القيمة القديمة والجديدة لمفتاح: السجلات المضافة/المعدلة عمليات put،
// والسجلات المغايرة عمليات delete — فينطبق الإضافة والتعديل والحذف كلها على الخادم لاحقاً
function computeDelta(key: DataKey, previous: unknown, next: unknown): SyncOp[] {
  if (Array.isArray(next)) {
    if (!hasIds(next)) return [];
    const previousRecords = Array.isArray(previous) ? previous.filter(isIdentified) : [];
    const previousById = new Map(previousRecords.map((record) => [record.id, record] as const));
    const nextIds = new Set(next.map((record) => record.id));
    const ops: SyncOp[] = [];
    for (const record of next) {
      const old = previousById.get(record.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(record)) {
        ops.push({ key, op: 'put', id: record.id, record, at: Date.now() });
      }
    }
    for (const record of previousRecords) {
      if (!nextIds.has(record.id)) ops.push({ key, op: 'delete', id: record.id, at: Date.now() });
    }
    return ops;
  }
  if (isPlainObject(next)) return [{ key, op: 'putSingleton', record: next, at: Date.now() }];
  return [];
}

function queueKeyOf(op: SyncOp): string {
  return op.op === 'putSingleton' ? op.key : `${op.key}:${op.id ?? ''}`;
}

function readQueue(): SyncOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (op): op is SyncOp =>
        isPlainObject(op) && isDataKey(String(op.key)) && (op.op === 'put' || op.op === 'delete' || op.op === 'putSingleton'),
    );
  } catch {
    return [];
  }
}

function writeQueue(ops: SyncOp[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(ops));
  } catch {
    // التخزين غير متاح
  }
}

// إلحاق الفروق بالقائمة مع استبدال آخر عملية لنفس السجل — الحالة النهائية هي الأحدث دائماً
function appendToQueue(ops: SyncOp[]): void {
  if (ops.length === 0) return;
  const merged = new Map(readQueue().map((op) => [queueKeyOf(op), op]));
  for (const op of ops) merged.set(queueKeyOf(op), op);
  writeQueue(Array.from(merged.values()));
}

function clearQueue(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SYNC_QUEUE_KEY);
}

function queueDelta(key: string, previous: unknown, next: unknown): void {
  if (!isDataKey(key)) return;
  appendToQueue(computeDelta(key, previous, next));
}

function mirrorToServer(key: string, value: unknown, previous: unknown = null): void {
  if (!isDataKey(key) || typeof window === 'undefined') return;
  void fetch('/api/store', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
    .then((response) => {
      // الخادم متصل لكنه رفض الحفظ (انتهاء جلسة/عطل مؤقت) — نحتفظ بالفرق ليُرفع بعد إعادة الدخول
      if (!response.ok && response.status !== 403) queueDelta(key, previous, value);
    })
    .catch(() => {
      // لا اتصال — الفرق بين القديم والجديد يُسجَّل في قائمة الانتظار ويُرفع عند عودة الاتصال
      queueDelta(key, previous, value);
    });
}

// مرآة شفافة: اعتراض كل كتابة على localStorage (من أي مدير أو مكوّن) ورفعها للخادم.
// عند توفر الاتصال تصل القيمة لقاعدة البيانات فوراً (الإضافة والتعديل والحذف معاً)،
// وعند غيابه تُحفظ محلياً وتُسجَّل فروقاتها في قائمة الانتظار. تُثبَّت مرة واحدة عند دخول المنطقة الإدارية.
let mirrorInstalled = false;
export function installStorageMirror(): void {
  if (typeof window === 'undefined' || mirrorInstalled) return;
  mirrorInstalled = true;
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
  const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
  window.localStorage.setItem = (key: string, value: string) => {
    let previous: unknown = null;
    let hasPrevious = false;
    if (isDataKey(key)) {
      const oldRaw = originalGetItem(key);
      if (oldRaw !== null) {
        try {
          previous = JSON.parse(oldRaw);
          hasPrevious = true;
        } catch {
          hasPrevious = false;
        }
      }
    }
    originalSetItem(key, value);
    if (!isDataKey(key)) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      // قيمة غير صالحة — لا نرفعها
      return;
    }
    mirrorToServer(key, parsed, hasPrevious ? previous : null);
  };
}

export interface StoreSnapshot {
  [key: string]: unknown;
}

// هل فقد الخادم بيانات هذه المجموعة؟ مجموعة (أو إعدادات) فارغة على الخادم مع وجود بيانات محلية
// تعني أن قاعدة البيانات أُعيدت/فقدت — عندها تُرفع المحلية إليه بدل مسحها من الجهاز
function serverCollectionLost(localRaw: string | null, incoming: unknown): boolean {
  if (localRaw === null) return false;
  let local: unknown;
  try {
    local = JSON.parse(localRaw);
  } catch {
    return false;
  }
  if (Array.isArray(incoming) && incoming.length === 0) {
    return Array.isArray(local) && local.length > 0;
  }
  if (isPlainObject(incoming) && Object.keys(incoming).length === 0) {
    return isPlainObject(local) && Object.keys(local).length > 0;
  }
  return false;
}

// سحب مفاتيح الخادم إلى التخزين المحلي — يُستدعى بعد رفع قائمة الانتظار وقبل عرض الصفحات.
// الخادم هو قاعدة البيانات المرجعية: تُستبدل المجموعات المحلية بنظيراتها عليه حرفياً فينتقل
// حذف وتعديل بقية الأجهزة إلى هذا الجهاز. لا يُفقد شيء: كل تغيير محلي غير مرفوع كان محفوظاً
// في قائمة الانتظار وطُبِّق على الخادم للتو قبل هذا السحب (صمام الخادم الفارغ أعلاه يحمي من المسح عند فقد قاعدة البيانات).
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
      if (incoming === null || incoming === undefined) continue; // لم تُضبط هذه القيمة على الخادم بعد
      anyKey = true;
      const localRaw = window.localStorage.getItem(key);
      if (serverCollectionLost(localRaw, incoming)) {
        // خادم فقد هذه المجموعة: المحلي هو النسخة الوحيدة — ارفعه إليه بدل مسحه
        try {
          const localValue: unknown = localRaw ? JSON.parse(localRaw) : null;
          if (localValue !== null) {
            void fetch('/api/store', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key, value: localValue }),
            }).catch(() => {});
          }
        } catch {
          // محلي تالف — نكتفي بعدم المسح
        }
        continue;
      }
      const serialized = JSON.stringify(incoming);
      if (localRaw !== serialized) window.localStorage.setItem(key, serialized);
    }
    if (!anyKey) await pushAllToServer();
    return true;
  } catch {
    return false;
  }
}

// رفع كل المفاتيح المحلية إلى الخادم باستبدال كامل — يُستدعى بعد استيراد نسخة احتياطية
// (استعادة محتوى ملف النسخة حرفياً بما فيه الحذف) وبعد أول دخول لبذر قاعدة بيانات فارغة.
// مزامنة فتح المتصفح العادية تمر عبر uploadOfflineBuffer (قائمة الانتظار) ولا تستخدم هذا الوضع.
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
// دورة العودة بعد انقطاع: ارفع قائمة الانتظار (العمليات المسجلة أثناء غياب الاتصال) إلى
// الخادم ليُطبَّق كل إضافة/تعديل/حذف سجلاً سجلاً، ثم امسح القائمة من localStorage.
// لا تمس هذه العمليات بيانات بقية الأجهزة، وتكرار الرفع آمِن لأن كل عملية idempotent.
// عند فشل الرفع (لا اتصال/رفض) تبقى القائمة كما هي للمحاولة التالية — لا يضيع شيء.
export async function uploadOfflineBuffer(): Promise<string[]> {
  if (typeof window === 'undefined') return [];
  const ops = readQueue();
  if (ops.length === 0) return [];
  try {
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    });
    if (!response.ok) return [];
    clearQueue(); // نجح الرفع — تُحذف العمليات المرفوعة من قائمة الانتظار المحلية
    return ['sync-queue'];
  } catch {
    return [];
  }
}
