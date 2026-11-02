// lib/aiClient.ts — نداء خادم الذكاء الاصطناعي من صفحات الواجهة (المساعد/المحادثات/الوكيل)
// مفتاح KIMI_API_KEY يبقى على الخادم ولا يصل إلى المتصفح أبداً
import type { ChatMessage } from './ai';

interface CallAiOptions {
  system?: string; // موجه نظام مخصص — عند غيابه يستخدم الخادم موجه المساعد القياسي مع الملخّص
  digest?: string; // ملخّص بيانات يُرفق بالموجه الافتراضي
  tools?: boolean; // تمرير مخططات الأدوات للنموذج — افتراضياً مفعّلة، ومحادثات العملاء تعطّلها
}

// يرد نص المساعد النهائي، ويرمي خطأً برسالة عربية واضحة عند أي فشل
export async function callAiChat(messages: ChatMessage[], options: CallAiOptions = {}): Promise<string> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, digest: options.digest ?? '', system: options.system ?? '', tools: options.tools !== false }),
  });
  const data = (await response.json().catch(() => null)) as {
    message?: { content?: string };
    error?: string;
    detail?: string;
  } | null;
  if (!response.ok || !data?.message) {
    const serverError = data?.error ?? 'تعذر الوصول إلى الذكاء الاصطناعي — حاول مجدداً';
    throw new Error(data?.detail ? `${serverError} — ${data.detail}` : serverError);
  }
  return data.message.content ?? '';
}
