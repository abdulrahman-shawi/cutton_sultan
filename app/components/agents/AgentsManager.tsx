// components/agents/AgentsManager.tsx — استوديو الوكيل: وجّهه ماذا يقول، ثم اختبره مباشرة قبل نشره
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Bot, Check, RotateCcw, Send, User } from 'lucide-react';
import { AGENT_TONES, DEFAULT_AGENT, type AgentConfig } from './types';
import { callAiChat } from '../../lib/aiClient';
import { buildAgentSystemPromptLocal, loadAgentConfig, saveAgentConfig } from '../../lib/agentClient';
import type { ChatMessage } from '../../lib/ai';

interface TestMessage {
  id: string;
  role: 'customer' | 'agent';
  content: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

const TEST_CUSTOMER = 'عميل تجريبي';

export default function AgentsManager() {
  const [form, setForm] = useState<AgentConfig>(loadAgentConfig);
  const [saved, setSaved] = useState<AgentConfig>(form);
  const [toast, setToast] = useState<string | null>(null);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [testMessages, testBusy]);

  const update = (field: keyof AgentConfig, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const cleaned: AgentConfig = {
      ...form,
      name: form.name.trim() || DEFAULT_AGENT.name,
      role: form.role.trim(),
      instructions: form.instructions.trim(),
      openingMessage: form.openingMessage.trim(),
    };
    setForm(cleaned);
    setSaved(cleaned);
    saveAgentConfig(cleaned);
    setToast('تم حفظ إعدادات الوكيل — ستُستخدم في محادثات العملاء فوراً');
  };

  const handleReset = () => {
    setForm(DEFAULT_AGENT);
    setToast('أُعيدت القيم الافتراضية — اضغط حفظ لتثبيتها');
  };

  const handleTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = testInput.trim();
    if (!text || testBusy) return;
    setError(null);
    const history: ChatMessage[] = [
      ...testMessages.slice(-20).map((message) => ({
        role: message.role === 'customer' ? ('user' as const) : ('assistant' as const),
        content: message.content,
      })),
      { role: 'user' as const, content: text },
    ];
    setTestMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'customer', content: text }]);
    setTestInput('');
    setTestBusy(true);
    try {
      // الاختبار يجري بالإعدادات الحالية في النموذج حتى قبل الحفظ
      const reply = await callAiChat(history, { system: buildAgentSystemPromptLocal(form, TEST_CUSTOMER), tools: false });
      setTestMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'agent', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الرد — حاول مجدداً');
    } finally {
      setTestBusy(false);
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-600 mb-1.5">الذكاء الاصطناعي</p>
        <h1 className="text-2xl font-bold text-slate-900">وكيل العملاء</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          وجّه الوكيل بما يقوله وكيف يتحدث مع العملاء — تعليماتك تُبنى في موجه النظام ويستخدمها في
          محادثات الوارد، وجرّبه هنا قبل نشره.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{error}</p>
            {error.includes('KIMI_API_KEY') && (
              <p className="text-xs mt-1 text-rose-500">أضف المفتاح في ملف ‎.env على الخادم ثم أعد تشغيل التطبيق.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agent-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم الوكيل <span className="text-red-500">*</span>
              </label>
              <input
                id="agent-name"
                type="text"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="agent-role" className="block text-sm font-medium text-slate-700 mb-1.5">الدور / الصفة</label>
              <input
                id="agent-role"
                type="text"
                value={form.role}
                onChange={(event) => update('role', event.target.value)}
                placeholder="مندوب خدمة العملاء"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="agent-instructions" className="block text-sm font-medium text-slate-700 mb-1.5">
              توجيهاتك للوكيل — ماذا يقول وكيف؟ <span className="text-red-500">*</span>
            </label>
            <textarea
              id="agent-instructions"
              rows={7}
              value={form.instructions}
              onChange={(event) => update('instructions', event.target.value)}
              placeholder={'مثال:\n- رحّب بالعميل باسمه\n- لا تعد بخصومات\n- اقترح بدائل عند نفاد الصنف'}
              className={`${inputClass} resize-y leading-relaxed`}
            />
            <p className="text-xs text-slate-400 mt-1.5">
              تُحقن هذه التعليمات في موجه النظام كما كتبتها — كلما كانت أدق كان رد الوكيل أوفق لما تريد.
            </p>
          </div>

          <div>
            <label htmlFor="agent-opening" className="block text-sm font-medium text-slate-700 mb-1.5">رسالة الترحيب</label>
            <textarea
              id="agent-opening"
              rows={2}
              value={form.openingMessage}
              onChange={(event) => update('openingMessage', event.target.value)}
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-slate-400 mt-1.5">تُرسل تلقائياً عند فتح محادثة جديدة والرد التلقائي مفعّل.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <div>
              <label htmlFor="agent-tone" className="block text-sm font-medium text-slate-700 mb-1.5">نبرة الحديث</label>
              <select
                id="agent-tone"
                value={form.tone}
                onChange={(event) => update('tone', event.target.value)}
                className={`${inputClass} bg-white cursor-pointer`}
              >
                {AGENT_TONES.map((tone) => (
                  <option key={tone} value={tone}>{tone}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">الرد التلقائي على العملاء</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.autoReply}
                aria-label="الرد التلقائي"
                onClick={() => update('autoReply', !form.autoReply)}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.autoReply ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.autoReply ? 'right-0.5' : 'right-[22px]'}`}
                />
              </button>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {dirty ? 'حفظ التوجيهات' : 'محفوظ'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 py-2.5 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              الافتراضي
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-blue-600 text-white grid place-items-center">
                <Bot className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800">اختبار مباشر — «{form.name || DEFAULT_AGENT.name}»</p>
                <p className="text-[11px] text-slate-400">يتحدث مع عميل تجريبي حسب الإعدادات الحالية حتى قبل الحفظ</p>
              </div>
            </div>
            {testMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setTestMessages([])}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                مسح المحادثة
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50 min-h-[360px] max-h-[440px]">
            {testMessages.length === 0 && (
              <div className="h-full grid place-items-center text-center py-8">
                <div>
                  <Bot className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-600 mb-1">جرّب الوكيل</p>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    اكتب رسالة كأنك عميل يسأل عن منتج أو سعر — سيرد الوكيل وفق التوجيهات الحالية في النموذج.
                  </p>
                </div>
              </div>
            )}
            {testMessages.map((message) => {
              const isCustomer = message.role === 'customer';
              return (
                <div key={message.id} className={`flex gap-2 ${isCustomer ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 mt-1 ${
                      isCustomer ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {isCustomer ? <User className="w-3.5 h-3.5" aria-hidden="true" /> : <Bot className="w-3.5 h-3.5" aria-hidden="true" />}
                  </span>
                  <div className={`max-w-[75%] ${isCustomer ? 'text-left' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        isCustomer
                          ? 'bg-emerald-500 text-white rounded-tl-md'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tr-md'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {testBusy && (
              <div className="flex gap-2">
                <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0 bg-blue-600 text-white">
                  <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <div className="rounded-2xl rounded-tr-md bg-white border border-slate-200 px-4 py-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleTest} className="border-t border-slate-100 px-4 py-3 flex items-center gap-2">
            <input
              type="text"
              value={testInput}
              onChange={(event) => setTestInput(event.target.value)}
              placeholder="اكتب رسالة كعميل تجريبي... مثال: عندكم قماش قطني أحمر؟"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button
              type="submit"
              disabled={testBusy || !testInput.trim()}
              aria-label="إرسال"
              className="w-11 h-11 rounded-xl grid place-items-center bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 -scale-x-100" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
