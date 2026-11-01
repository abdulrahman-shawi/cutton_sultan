// components/assistant/AssistantManager.tsx — واجهة المحادثة مع المساعد الذكي (Kimi):
// يرسل الرسائل مع ملخّص بيانات المتجر إلى /api/ai/chat، وينفّذ أدوات النموذج (فواتير/قيود/منتجات)
// محلياً عبر طبقة البيانات نفسها فتتزامن مع الخادم تلقائياً، ثم يعيد نتيجة التنفيذ للنموذج للتأكيد
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Bot, Send, Sparkles, User, Wrench } from 'lucide-react';
import type { ChatMessage } from '../../lib/ai';
import { usePermissions } from '../auth/usePermissions';
import { executeTool } from './executors';
import { buildStoreDigest } from './digest';

const SUGGESTIONS = [
  'ملخص مبيعات اليوم',
  'ما أكثر المنتجات مبيعاً؟',
  'ما نواقص المخزون؟',
  'أدخل مصاريف يومية: إيجار المحل 200000 ل.س',
  'أنشئ فاتورة مقبوضات للعميل أحمد: 5 قطع قماش بـ 30000 ل.س للقطعة',
];

interface PendingTool {
  id: string;
  label: string;
  result?: string;
}

function toolLabel(call: { function: { name: string; arguments: string } }): string {
  try {
    const args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
    if (call.function.name === 'create_invoice') {
      const type = typeof args.type === 'string' ? args.type : 'فاتورة';
      const items = Array.isArray(args.items) ? args.items.length : 0;
      return `إنشاء ${type} (${items} ${items === 1 ? 'بند' : 'بنود'})`;
    }
    if (call.function.name === 'create_journal_entries') {
      const count = Array.isArray(args.entries) ? args.entries.length : 0;
      return `تسجيل ${count === 1 ? 'قيد يومية' : count + ' قيود في دفتر اليومية'}`;
    }
    if (call.function.name === 'create_products') {
      const count = Array.isArray(args.products) ? args.products.length : 0;
      return `إضافة ${count === 1 ? 'منتج للمخزون' : count + ' منتجات للمخزون'}`;
    }
  } catch {
    // نكتفي بالاسم عند تعذر قراءة المعطيات
  }
  return call.function.name;
}

export default function AssistantManager() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTools, setPendingTools] = useState<PendingTool[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const invoicesPerms = usePermissions('invoices');
  const journalPerms = usePermissions('daily_journal');
  const productsPerms = usePermissions('products');

  const allowed = (page: 'invoices' | 'daily_journal' | 'products') =>
    page === 'invoices' ? invoicesPerms.add : page === 'daily_journal' ? journalPerms.add : productsPerms.add;

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, pendingTools, busy]);

  const callApi = async (history: ChatMessage[]): Promise<ChatMessage | null> => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, digest: buildStoreDigest() }),
    });
    const data = (await response.json().catch(() => null)) as { message?: ChatMessage; error?: string; detail?: string } | null;
    if (!response.ok || !data?.message) {
      setError(data?.error ?? 'تعذر الوصول إلى المساعد الذكي — حاول مجدداً');
      return null;
    }
    return data.message;
  };

  const send = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    setError(null);
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      // حتى 4 جولات: النموذج قد يطلب تنفيذ أدوات ثم يؤكد بناءً على النتائج
      for (let round = 0; round < 4; round++) {
        const reply = await callApi(history);
        if (!reply) return;
        if (reply.tool_calls && reply.tool_calls.length > 0) {
          history.push({ role: 'assistant', content: reply.content ?? '', tool_calls: reply.tool_calls });
          for (const call of reply.tool_calls) {
            const label = toolLabel(call);
            setPendingTools((prev) => [...prev, { id: call.id, label }]);
            const result = await executeTool(call.function.name, call.function.arguments, allowed);
            setPendingTools((prev) => prev.map((tool) => (tool.id === call.id ? { ...tool, result: result.message } : tool)));
            history.push({ role: 'tool', content: result.message, tool_call_id: call.id, name: call.function.name });
          }
          setPendingTools([]);
          continue;
        }
        history.push({ role: 'assistant', content: reply.content ?? '' });
        return;
      }
      history.push({ role: 'assistant', content: 'توقفت عن المحاولة بعد عدة جولات — أعد صياغة طلبك من فضلك.' });
    } finally {
      setMessages([...history]);
      setBusy(false);
      setPendingTools([]);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <p className="text-xs font-semibold text-blue-600 mb-1.5">مدعوم بنموذج Kimi</p>
        <h1 className="text-2xl font-bold text-slate-900">المساعد الذكي</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          اسأل عن مبيعاتك ومخزونك وعملائك، أو اطلب تنفيذاً مباشراً: «أدخل مصاريف يومية بكذا»، «أنشئ فاتورة مقبوضات...»، «أضف منتجاً...».
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <span className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mb-4">
              <Sparkles className="w-7 h-7" aria-hidden="true" />
            </span>
            <p className="font-bold text-slate-800 mb-1.5">كيف أساعدك اليوم؟</p>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              أرى بيانات متجرك الحية (المنتجات والفواتير ودفتر اليومية) وأنفّذ أوامرك مباشرة:
              إنشاء الفواتير وتسجيل المصاريف اليومية وإضافة المنتجات والإجابة عن أسئلتك المالية.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          if (message.role === 'tool') return null; // نتائج الأدوات تظهر ضمن بطاقات التنفيذ أسفلها
          const isUser = message.role === 'user';
          const tools = message.tool_calls ?? [];
          return (
            <div key={index} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <span className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${isUser ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white'}`}>
                {isUser ? <User className="w-4 h-4" aria-hidden="true" /> : <Bot className="w-4 h-4" aria-hidden="true" />}
              </span>
              <div className={`max-w-[80%] space-y-2 ${isUser ? 'text-left' : ''}`}>
                {message.content && (
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser ? 'bg-blue-600 text-white rounded-tl-md' : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tr-md'
                  }`}>
                    {message.content}
                  </div>
                )}
                {tools.map((call) => {
                  const pending = pendingTools.find((tool) => tool.id === call.id);
                  return (
                    <div key={call.id} className="rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-xs text-slate-600 space-y-1">
                      <p className="flex items-center gap-1.5 font-semibold text-blue-700">
                        <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                        تنفيذ: {toolLabel(call)}
                      </p>
                      {pending?.result && <p className={pending.result.startsWith('لا تملك') || pending.result.startsWith('تعذر') ? 'text-rose-600' : 'text-emerald-700'}>{pending.result}</p>}
                      {!pending?.result && busy && <p className="text-slate-400">جارٍ التنفيذ...</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {busy && pendingTools.length === 0 && (
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0 bg-blue-600 text-white">
              <Bot className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="rounded-2xl rounded-tr-md bg-slate-50 border border-slate-100 px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{error}</p>
            {error.includes('KIMI_API_KEY') && (
              <p className="text-xs mt-1 text-rose-500">أضف المفتاح في ملف ‎.env بجانب DATABASE_URL على الخادم ثم أعد تشغيل التطبيق.</p>
            )}
          </div>
        </div>
      )}

      {messages.length <= 2 && !busy && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className="text-xs bg-white border border-slate-200 text-slate-600 rounded-full px-3.5 py-2 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="اكتب سؤالاً أو أمراً... مثال: أدخل مصاريف يومية: كهرباء 150 ألف ل.س"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="إرسال"
          className="w-11 h-11 rounded-xl grid place-items-center bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 -scale-x-100" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
