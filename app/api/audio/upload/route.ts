// app/api/audio/upload/route.ts — إذن رفع مباشر من المتصفح إلى Vercel Blob (يتجاوز حد 4.5MB لطلبات الخادم)
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/auth';

// امتدادات الملفات الصوتية المقبولة — نتحقق من الامتداد بدلاً من قائمة MIME الصارمة،
// لأن متصفحات الجوال كثيراً ما ترسل نوع MIME فارغاً أو غير دقيق فيُرفض ملف صوتي سليم
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.oga', '.opus', '.aac', '.webm', '.amr', '.flac', '.3gp', '.mp4'];

// 500 م.ب — تكفي للمقاطع الطويلة (سورة البقرة كاملة ~140 م.ب). الرفع مباشر من المتصفح إلى المخزن
// ومجزّأ (multipart) للملفات الكبيرة، فلا يمر عبر حدود حجم طلبات الخادم
const MAX_SIZE_BYTES = 500 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getSessionUser();
        if (!user) throw new Error('غير مسجل الدخول — أعد تسجيل الدخول ثم حاول مجدداً');
        const dotIndex = pathname.lastIndexOf('.');
        const ext = dotIndex === -1 ? '' : pathname.slice(dotIndex).toLowerCase();
        if (!AUDIO_EXTENSIONS.includes(ext)) {
          throw new Error(`صيغة الملف «${ext || 'غير معروفة'}» غير مدعومة — ارفع ملفاً صوتياً (MP3 / M4A / WAV / OGG)`);
        }
        return {
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // القائمة تُقرأ مباشرة من المخزن — لا حاجة لتحديث إضافي هنا
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('audio upload error:', error);
    const message = error instanceof Error ? error.message : 'فشل الرفع';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
