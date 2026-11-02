// components/inbox/InboxManager.tsx — صفحة الوارد: محادثات العملاء مع الوكيل الذكي
// ثلاثة أوضاع للإرسال: رسالة من العميل (يستجيب الوكيل/سير العمل)، رد يدوي من المحل، أو توجيه الوكيل بما يقول
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import ConversationList from './ConversationList';
import ChatWindow, { type ComposerMode } from './ChatWindow';
import ConfirmDialog from '../categories/ConfirmDialog';
import type { Customer } from '../customers/types';
import { CUSTOMERS_STORAGE_KEY } from '../customers/types';
import { DEFAULT_AGENT, AGENT_STORAGE_KEY, type AgentConfig } from '../agents/types';
import {
  WORKFLOWS_STORAGE_KEY,
  executeWorkflowActions,
  workflowMatchesMessage,
  type Workflow,
} from '../workflows/types';
import { callAiChat } from '../../lib/aiClient';
import { buildAgentSystemPrompt } from '../../lib/agentPrompt';
import type { ChatMessage } from '../../lib/ai';
import { createConversation, CONVERSATIONS_STORAGE_KEY, type Conversation, type ConversationMessage } from './types';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
}

function loadCustomers(): Customer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Customer[]) : [];
  } catch {
    return [];
  }
}

function loadAgent(): AgentConfig {
  if (typeof window === 'undefined') return DEFAULT_AGENT;
  try {
    const raw = window.localStorage.getItem(AGENT_STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT;
    return { ...DEFAULT_AGENT, ...(JSON.parse(raw) as Partial<AgentConfig>) };
  } catch {
    return DEFAULT_AGENT;
  }
}

function loadWorkflows(): Workflow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Workflow[]) : [];
  } catch {
    return [];
  }
}

// تحويل رسائل المحادثة إلى صيغة النموذج: العميل = user، المحل/الوكيل = assistant
function toChatMessages(conversation: Conversation): ChatMessage[] {
  return conversation.messages.slice(-30).map((message) => ({
    role: message.sender === 'customer' ? 'user' : 'assistant',
    content: message.content,
  }));
}

export default function InboxManager() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [customers] = useState<Customer[]>(loadCustomers);
  const [agent] = useState<AgentConfig>(loadAgent);
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [starting, setStarting] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [conversations]);

  // سجل تشغيل سير العمل يُحدَّث من هنا فيُحفظ مع بقية السيرات
  useEffect(() => {
    try {
      window.localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(workflows));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [workflows]);

  useEffect(() => {
    if (!toast && !notice) return;
    const timer = setTimeout(() => {
      setToast(null);
      setNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, notice]);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  const patchConversation = (id: string, patch: (conversation: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((conversation) => (conversation.id === id ? patch(conversation) : conversation)));
  };

  const pushMessage = (conversationId: string, message: Omit<ConversationMessage, 'id' | 'at'>) => {
    patchConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: [...conversation.messages, { ...message, id: crypto.randomUUID(), at: Date.now() }],
    }));
  };

  const generateAgentReply = async (conversation: Conversation, extraUserMessage?: string): Promise<string> => {
    const system = buildAgentSystemPrompt(agent, conversation.customerName);
    const history = toChatMessages(conversation);
    if (extraUserMessage) history.push({ role: 'user', content: extraUserMessage });
    return callAiChat(history, { system, tools: false });
  };

  // تسجيل تشغيل سير العمل مع الحفاظ على أحدث 20 تشغيلاً لكل سير
  const logWorkflowRun = (workflowId: string, detail: string) => {
    setWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.id === workflowId
          ? { ...workflow, runs: [{ at: Date.now(), detail }, ...workflow.runs].slice(0, 20) }
          : workflow
      )
    );
  };

  const handleCustomerMessage = async (conversation: Conversation, text: string) => {
    // 1) سير العمل المطابقة لها أولوية الرد المحدد
    const matched = workflows.find((workflow) => workflowMatchesMessage(workflow, text));
    if (matched) {
      let replyCount = 0;
      const outcome = executeWorkflowActions(matched, conversation.customerName, {
        reply: (replyText) => {
          pushMessage(conversation.id, { sender: 'shop', via: 'workflow', content: replyText });
          replyCount++;
        },
        notify: (note) => setNotice(`سير العمل «${matched.name}»: ${note}`),
      });
      logWorkflowRun(matched.id, outcome.detail);
      if (replyCount > 0) return;
    }
    // 2) وإلا يولّد الوكيل رداً عاماً إن كان مفعّلاً
    if (!agent.autoReply) return;
    setBusy(true);
    try {
      const reply = await generateAgentReply(conversation);
      pushMessage(conversation.id, { sender: 'shop', via: 'agent', content: reply });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر توليد رد الوكيل');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (mode: ComposerMode, text: string) => {
    if (!active) return;
    setError(null);
    const conversation = active;
    if (mode === 'customer') {
      pushMessage(conversation.id, { sender: 'customer', via: 'manual', content: text });
      const pendingMessage: ConversationMessage = { sender: 'customer', via: 'manual', content: text, id: 'pending', at: Date.now() };
      await handleCustomerMessage({ ...conversation, messages: [...conversation.messages, pendingMessage] }, text);
      return;
    }
    if (mode === 'shop') {
      pushMessage(conversation.id, { sender: 'shop', via: 'manual', content: text });
      return;
    }
    // وضع الوكيل: توجيه المالك يُحوَّل إلى رسالة مصوغة يرسلها الوكيل
    setBusy(true);
    try {
      const draft = await generateAgentReply(conversation, `توجيه من المالك: ${text} — صُغ الرسالة النهائية للعميل بناءً عليه مباشرة دون شرح.`);
      pushMessage(conversation.id, { sender: 'shop', via: 'agent', content: draft });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر توليد رد الوكيل');
    } finally {
      setBusy(false);
    }
  };

  const handleSuggest = async (): Promise<string | null> => {
    if (!active) return null;
    setError(null);
    try {
      const system = buildAgentSystemPrompt(agent, active.customerName);
      const history = toChatMessages(active);
      history.push({
        role: 'user',
        content: 'صُغ رداً مناسباً من المحل على رسالة العميل الأخيرة. أعد صياغة الرد فقط دون أي مقدمات.',
      });
      return await callAiChat(history, { system, tools: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر اقتراح الرد');
      return null;
    }
  };

  const openConversation = (conversation: Conversation) => setActiveId(conversation.id);

  const handleStartConversation = () => {
    const customer = customers.find((item) => item.id === newCustomerId);
    const name = (customer?.name ?? newCustomerName).trim();
    if (!name) return;
    const existing = conversations.find(
      (conversation) => conversation.customerId === customer?.id || (!customer && conversation.customerName.trim() === name)
    );
    let conversation = existing ?? null;
    if (!conversation) {
      conversation = createConversation(customer?.id ?? null, customer?.name ?? name);
      setConversations((prev) => [conversation as Conversation, ...prev]);
      // رسالة ترحيب من الوكيل عند افتتاح المحادثة إن كان مفعّلاً
      if (agent.autoReply && agent.openingMessage.trim()) {
        const opened = conversation as Conversation;
        pushMessage(opened.id, { sender: 'shop', via: 'agent', content: agent.openingMessage.trim() });
      }
    }
    setActiveId(conversation.id);
    setStarting(false);
    setNewCustomerId('');
    setNewCustomerName('');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setConversations((prev) => prev.filter((conversation) => conversation.id !== deleting.id));
    if (activeId === deleting.id) setActiveId(null);
    setDeleting(null);
    setToast('تم حذف المحادثة');
  };

  const availableCustomers = customers.filter(
    (customer) => !conversations.some((conversation) => conversation.customerId === customer.id)
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <p className="text-xs font-semibold text-blue-600 mb-1.5">تواصل العملاء</p>
        <h1 className="text-2xl font-bold text-slate-900">محادثات العملاء</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          محادثات الذكاء الاصطناعي مع العملاء — محاكاة رسائل العملاء ورد الوكيل الفوري من بيانات المتجر،
          أو توجيه الوكيل بما يقوله، وإدارة الردود من صفحة الوكيل وسير العمل.
        </p>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{error}</p>
            {error.includes('KIMI_API_KEY') && (
              <p className="text-xs mt-1 text-rose-500">أضف المفتاح في ملف ‎.env على الخادم ثم أعد تشغيل التطبيق.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 min-h-0">
        <ConversationList
          conversations={sorted}
          activeId={activeId}
          onSelect={openConversation}
          onNew={() => setStarting(true)}
          onDelete={setDeleting}
        />
        <ChatWindow
          conversation={active}
          agentName={agent.name}
          autoReply={agent.autoReply}
          busy={busy}
          onSend={(mode, text) => void handleSend(mode, text)}
          onSuggest={handleSuggest}
        />
      </div>

      {starting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setStarting(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">محادثة جديدة</h2>
              <button
                type="button"
                onClick={() => setStarting(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="inbox-customer" className="block text-sm font-medium text-slate-700 mb-1.5">عميل مسجل</label>
                <select
                  id="inbox-customer"
                  value={newCustomerId}
                  onChange={(event) => {
                    setNewCustomerId(event.target.value);
                    if (event.target.value) setNewCustomerName('');
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">اختر من العملاء...</option>
                  {(availableCustomers.length > 0 ? availableCustomers : customers).map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>
              {!newCustomerId && (
                <div>
                  <label htmlFor="inbox-customer-name" className="block text-sm font-medium text-slate-700 mb-1.5">أو اسم عميل جديد</label>
                  <input
                    id="inbox-customer-name"
                    type="text"
                    value={newCustomerName}
                    onChange={(event) => setNewCustomerName(event.target.value)}
                    placeholder="مثال: أبو محمد"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleStartConversation}
                  disabled={!newCustomerId && !newCustomerName.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  فتح المحادثة
                </button>
                <button
                  type="button"
                  onClick={() => setStarting(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.customerName}
          itemLabel="المحادثة"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {(toast || notice) && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {toast ?? notice}
          </div>
        </div>
      )}
    </div>
  );
}
