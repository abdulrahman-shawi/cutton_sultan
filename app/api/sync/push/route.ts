// app/api/sync/push/route.ts — رفع ذاكرة الانتظار المحلية (offline buffer) عند عودة الاتصال
// أي مستخدم مسجّل — أيًّا كان دوره — يرفع تغييرات عمله على البيانات التشغيلية؛
// المفاتيح الحساسة (الإعدادات/المستخدمون/الأدوار) تقبل من المدير فقط حتى لا تُمسح صلاحيات بجلسة قديمة.
// الدمج تجميعي افتراضياً: يُضاف ما ليس موجوداً على الخادم ولا يُحذف أي سجل — فتح المتصفح لا يمسح بيانات أحد.
// باستثناء mode = 'replace' (استيراد نسخة احتياطية فقط) حيث تُستبدل المجموعات محتوىً وحذفاً كما في الملف.
import { NextResponse } from 'next/server';
import { isAllowedKey, mergeAny, writeAny } from '../../../lib/server/entities';
import { logAudit } from '../../../lib/server/store';
import { getSessionUser } from '../../../lib/server/auth';
import { ADMIN_ROLE_ID } from '../../../lib/server/seed';

export const dynamic = 'force-dynamic';

const SENSITIVE_KEYS = ['sultan_store_settings', 'sultan_users', 'sultan_roles'];

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }

  const accepted: string[] = [];
  const skipped: string[] = [];
  const replace = body?.mode === 'replace';
  for (const [key, value] of Object.entries(body)) {
    if (key === 'mode' || !isAllowedKey(key)) {
      skipped.push(key);
      continue;
    }
    if (SENSITIVE_KEYS.includes(key) && user.roleId !== ADMIN_ROLE_ID) {
      skipped.push(key);
      continue;
    }
    if (replace) await writeAny(key, value);
    else await mergeAny(key, value);
    accepted.push(key);
  }

  await logAudit(user.id, 'sync.push', `accepted=${accepted.join(',') || 'none'}`);
  return NextResponse.json({ ok: true, accepted, skipped });
}
