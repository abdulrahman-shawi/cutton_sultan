// app/api/audio/route.ts — قائمة مقاطع الصوت المخزنة على Vercel Blob وآخر مقطع أُضيف
import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AUDIO_PREFIX = 'quran-audio/';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: AUDIO_PREFIX, limit: 100 });
    const clips = blobs
      .map((blob) => ({
        url: blob.url,
        pathname: blob.pathname,
        name: blob.pathname.slice(AUDIO_PREFIX.length),
        size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(),
      }))
      .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
    return NextResponse.json({ clips, latest: clips[0]?.url ?? null });
  } catch {
    return NextResponse.json(
      { clips: [], latest: null, error: 'تعذر الاتصال بمخزن الملفات — تحقق من إعداد Vercel Blob' },
      { status: 500 }
    );
  }
}
