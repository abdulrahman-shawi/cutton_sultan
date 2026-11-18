// app/api/audio/delete/route.ts — حذف مقطع صوتي من Vercel Blob
import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/auth';

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });

  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  if (typeof url !== 'string' || !url.includes('/quran-audio/')) {
    return NextResponse.json({ error: 'رابط المقطع غير صالح' }, { status: 400 });
  }

  try {
    await del(url);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'تعذر حذف المقطع' }, { status: 500 });
  }
}
