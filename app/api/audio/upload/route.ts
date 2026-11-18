// app/api/audio/upload/route.ts — إذن رفع مباشر من المتصفح إلى Vercel Blob (يتجاوز حد 4.5MB لطلبات الخادم)
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/auth';

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getSessionUser();
        if (!user) throw new Error('غير مسجل الدخول');
        return {
          allowedContentTypes: [
            'audio/mpeg',
            'audio/mp4',
            'audio/x-m4a',
            'audio/wav',
            'audio/x-wav',
            'audio/ogg',
            'audio/webm',
            'audio/aac',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // القائمة تُقرأ مباشرة من المخزن — لا حاجة لتحديث إضافي هنا
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'فشل الرفع';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
