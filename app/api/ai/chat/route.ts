// app/api/ai/chat/route.ts — وسيط المساعد الذكي: يتحقق من الجلسة ويمرّر المحادثة إلى نموذج Kimi على الخادم
// مفتاح KIMI_API_KEY يبقى هنا ولا يصل للمتصفح أبداً
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/auth';
import { AI_TOOLS, buildSystemPrompt, type ChatMessage } from '../../../lib/ai';

export const dynamic = 'force-dynamic';

const DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1';
const DEFAULT_MODEL = 'kimi-k2.6';

function isValidMessage(message: unknown): message is ChatMessage {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Record<string, unknown>;
  const role = candidate.role;
  const content = candidate.content;
  if (role !== 'user' && role !== 'assistant' && role !== 'tool') return false;
  if (typeof content !== 'string') return false;
  if (role === 'tool') return typeof candidate.tool_call_id === 'string';
  return true;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });

  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'المساعد الذكي غير مفعّل بعد: أضف KIMI_API_KEY إلى ملف ‎.env على الخادم ثم أعد تشغيله' },
      { status: 500 }
    );
  }

  let body: { messages?: unknown; digest?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(isValidMessage).slice(-30)
    : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: 'لا توجد رسائل صالحة في الطلب' }, { status: 400 });
  }
  const digest = typeof body.digest === 'string' ? body.digest.slice(0, 20000) : '';

  const baseUrl = (process.env.KIMI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = process.env.KIMI_MODEL || DEFAULT_MODEL;

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        // بلا temperature: نماذج K3 تقبل فقط القيمة الافتراضية (1) وترفض أي قيمة مخصصة برمز 400
        messages: [{ role: 'system', content: buildSystemPrompt(digest) }, ...messages],
        tools: AI_TOOLS,
      }),
    });
  } catch {
    return NextResponse.json({ error: 'تعذر الاتصال بخادم Kimi — تحقق من الاتصال بالإنترنت' }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: `رفض خادم Kimi الطلب (رمز ${upstream.status})`, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  let payload: { choices?: { message?: unknown }[] };
  try {
    payload = await upstream.json();
  } catch {
    return NextResponse.json({ error: 'رد غير مفهوم من خادم Kimi' }, { status: 502 });
  }
  const message = payload?.choices?.[0]?.message;
  if (!message) {
    return NextResponse.json({ error: 'رد غير مفهوم من خادم Kimi' }, { status: 502 });
  }
  return NextResponse.json({ message, model });
}
