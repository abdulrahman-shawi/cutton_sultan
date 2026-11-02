// components/agents/AgentsManager.tsx — إدارة الوكلاء: قائمة الوكلاء، تعيين الافتراضي، وتجربة أي وكيل مباشرة
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Bot, Check, MessageSquare, Pencil, Plus, Send, ShoppingCart, Star, Trash2, User } from 'lucide-react';
import AgentModal from './AgentModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { createAgent, type AgentConfig } from './types';
import { callAiChat } from '../../lib/aiClient';
import { buildAgentSystemPromptLocal, loadAgents, saveAgents } from '../../lib/agentClient';
import type { ChatMessage } from '../../lib/ai';

interface TestMessage {
  id: string;
  role: 'customer' | 'agent';
  content: string;
}

const TEST_CUSTOMER = 'عميل تجريبي';

export default function AgentsManager() {
  const [agents, setAgents] = useState<AgentConfig[]>(loadAgents);
  const [modal, setModal] = useState<{ open: boolean; agent: AgentConfig | null }>({ open: false, agent: null });
  const [deleting, setDeleting] = useState<AgentConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveAgents(agents);
  }, [agents]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [testMessages, testBusy]);

  const defaultAgent = agents.find((agent) => agent.isDefault) ?? agents[0] ?? null;
  const testing = agents.find((agent) => agent.id === testingId) ?? null;

  const handleSave = (agent: AgentConfig) => {
    const exists = agents.some((item) => item.id === agent.id);
    setAgents((prev) => {
      let next = exists ? prev.map((item) => (item.id === agent.id ? agent : item)) : [...prev, agent];
      // الوكيل الافتراضي واحد فقط: أول وكيل أو المحدد افتراضياً
      if (next.length === 1) next = [{ ...next[0], isDefault: true }];
      else if (agent.isDefault) next = next.map((item) => ({ ...item, isDefault: item.id === agent.id }));
      return next;
    });
    setModal({ open: false, agent: null });
    setToast(exists ? 'تم تحديث الوكيل' : 'تم إنشاء الوكيل');
  };

  const handleSetDefault = (agent: AgentConfig) => {
    setAgents((prev) => prev.map((item) => ({ ...item, isDefault: item.id === agent.id })));
    setToast(`«${agent.name}» هو الوكيل الافتراضي لصفحة العملاء الآن`);
  };

  const handleDelete = () => {
    if (!deleting) return;
    setAgents((prev) => {
      const next = prev.filter((item) => item.id !== deleting.id);
      if (deleting.isDefault && next.length > 0) next[0] = { ...next[0], isDefault: true };
      return next;
    });
    if (testingId === deleting.id) {
      setTestingId(null);
      setTestMessages([]);
    }
    setDeleting(null);
    setToast('تم حذف الوكيل');
  };

  const startTest = (agent: AgentConfig) => {
    setTestingId(agent.id);
    setTestMessages([]);
    setError(null);
  };

  const handleTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!testing) return;
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
      const reply = await callAiChat(history, { system: buildAgentSystemPromptLocal(testing, TEST_CUSTOMER), tools: false });
      setTestMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'agent', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الرد — حاول مجدداً');
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">الذكاء الاصطناعي</p>
          <h1 className="text-2xl font-bold text-slate-900">الوكلاء</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            عدة وكلاء — كل واحد بتوجيهاته ومهاراته. الوكيل الافتراضي يخدم صفحة العملاء العامة،
            ويمكن تجربة أي وكيل هنا قبل نشره. مهارة «الطلبات» تتيح للوكيل تسجيل العملاء وإنشاء فواتير المقبوضات من المحادثة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, agent: null })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          وكيل جديد
        </button>
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
        <div className="space-y-4">
          {agents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-14 px-6 text-center">
              <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              <p className="font-semibold text-slate-700 mb-1">لا وكلاء بعد</p>
              <p className="text-sm text-slate-400 mb-5">أنشئ أول وكيل ووجّهه بما يقوله للعملاء.</p>
              <button
                type="button"
                onClick={() => setModal({ open: true, agent: null })}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                وكيل جديد
              </button>
            </div>
          ) : (
            agents.map((agent) => (
              <div key={agent.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${agent.isDefault ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-11 h-11 rounded-2xl grid place-items-center text-white font-bold shrink-0 ${agent.isDefault ? 'bg-blue-600' : 'bg-slate-400'}`}>
                      {agent.name.trim().charAt(0) || '؟'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800">{agent.name}</p>
                        {agent.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 px-2.5 py-0.5 text-[11px] font-medium">
                            <Star className="w-3 h-3 fill-current" aria-hidden="true" />
                            افتراضي
                          </span>
                        )}
                        {!agent.autoReply && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-400 px-2.5 py-0.5 text-[11px] font-medium">الرد متوقف</span>
                        )}
                        {agent.skills.orders && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 px-2.5 py-0.5 text-[11px] font-medium">
                            <ShoppingCart className="w-3 h-3" aria-hidden="true" />
                            يستقبل الطلبات
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {agent.role || 'بدون دور'} · نبرة {agent.tone}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-3 line-clamp-3 whitespace-pre-wrap">{agent.instructions}</p>
                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => startTest(agent)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${testingId === agent.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    تجربة
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, agent })}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    تعديل
                  </button>
                  {!agent.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(agent)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-600 hover:bg-amber-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" aria-hidden="true" />
                      تعيين افتراضي
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleting(agent)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-blue-600 text-white grid place-items-center">
                <Bot className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {testing ? `تجربة — «${testing.name}»` : 'تجربة الوكيل'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {testing ? 'يتحدث مع عميل تجريبي حسب إعداداته المحفوظة' : 'اختر «تجربة» من أي وكيل في القائمة'}
                </p>
              </div>
            </div>
            {testMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setTestMessages([])}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                مسح
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50 min-h-[360px] max-h-[440px]">
            {!testing ? (
              <div className="h-full grid place-items-center text-center py-8">
                <div>
                  <Bot className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-600 mb-1">اختر وكيلاً للتجربة</p>
                  <p className="text-xs text-slate-400">التجربة تستخدم إعدادات الوكيل المحفوظة كما يراها العملاء فعلياً.</p>
                </div>
              </div>
            ) : testMessages.length === 0 ? (
              <div className="h-full grid place-items-center text-center py-8">
                <div>
                  <Bot className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-600 mb-1">اكتب رسالة كعميل</p>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    {testing.skills.orders
                      ? 'جرّب: «بدي أطلب طلبية» — سيسأل عن البنود وطريقة الدفع ثم يُنشئ فاتورة.'
                      : 'اسأل عن منتج أو سعر — سيرد الوكيل وفق توجيهاته.'}
                  </p>
                </div>
              </div>
            ) : (
              testMessages.map((message) => {
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
              })
            )}
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
              placeholder={testing ? `اكتب رسالة كعميل تجريبي...` : 'اختر وكيلاً أولاً من القائمة'}
              disabled={!testing}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!testing || testBusy || !testInput.trim()}
              aria-label="إرسال"
              className="w-11 h-11 rounded-xl grid place-items-center bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 -scale-x-100" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      {modal.open && (
        <AgentModal
          initial={modal.agent}
          onClose={() => setModal({ open: false, agent: null })}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="الوكيل"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

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
