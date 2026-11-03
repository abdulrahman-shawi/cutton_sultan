// components/chat/CustomerChat.tsx — الصفحة العامة التي يتحدث منها العميل مع وكيل المتجر (بلا تسجيل دخول)
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Bot, MapPin, Send, Store, User } from 'lucide-react';
import type { ConversationMessage } from '../inbox/types';
import { formatChatTime } from '../inbox/types';

const GUEST_KEY = 'sultan_chat_guest';

interface GuestSession {
  name: string;
  conversationId: string | null;
}

function loadGuest(): GuestSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestSession;
    return typeof parsed.name === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function saveGuest(session: GuestSession) {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(session));
  } catch {
    // التخزين غير متاح
  }
}

async function fetchConversation(id: string): Promise<ConversationMessage[] | null> {
  try {
    const response = await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as { conversation?: { messages?: ConversationMessage[] } };
    return data.conversation?.messages ?? null;
  } catch {
    return null;
  }
}

export default function CustomerChat() {
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('مساعد المتجر');
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // جلسة العميل المحفوظة على جهازه: اسمه ومعرّف محادثته
  useEffect(() => {
    const session = loadGuest();
    setGuest(session);
    setNameInput(session?.name ?? '');
    if (!session?.conversationId) setLoading(false);
  }, []);

  // تحميل محادثة سابقة إن وُجدت
  useEffect(() => {
    if (!guest?.conversationId || startedRef.current) return;
    startedRef.current = true;
    void fetchConversation(guest.conversationId).then((loaded) => {
      if (loaded) setMessages(loaded);
      setLoading(false);
    });
  }, [guest]);

  // استطلاع خفيف لالتقاط ردود المالك اليدوية من صفحة الوارد
  useEffect(() => {
    if (!guest?.conversationId) return;
    const timer = setInterval(() => {
      void fetchConversation(guest.conversationId as string).then((loaded) => {
        if (loaded) setMessages((prev) => (JSON.stringify(prev) !== JSON.stringify(loaded) ? loaded : prev));
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [guest]);

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, busy, loading]);

  const startChat = () => {
    const name = nameInput.trim();
    if (!name) return;
    const session: GuestSession = { name, conversationId: guest?.conversationId ?? null };
    setGuest(session);
    saveGuest(session);
  };

  const send = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || !guest || busy) return;
    setError(null);
    setBusy(true);
    // عرض فوري لرسالة العميل قبل وصول الرد
    const optimistic: ConversationMessage = { id: `local-${Date.now()}`, sender: 'customer', via: 'manual', content: text, at: Date.now() };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: guest.name, message: text, conversationId: guest.conversationId }),
      });
      const data = (await response.json().catch(() => null)) as {
        messages?: ConversationMessage[];
        conversationId?: string;
        agentName?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.messages) {
        setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
        setInput(text);
        setError(data?.error ?? 'تعذر إرسال الرسالة — تحقق من الاتصال ثم أعد المحاولة');
        return;
      }
      setMessages(data.messages);
      if (data.conversationId && data.conversationId !== guest.conversationId) {
        const session = { ...guest, conversationId: data.conversationId };
        setGuest(session);
        saveGuest(session);
      }
      if (data.agentName) setAgentName(data.agentName);
    } catch {
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
      setInput(text);
      setError('تعذر إرسال الرسالة — تحقق من الاتصال ثم أعد المحاولة');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  if (!guest) {
    return (
      <div className="min-h-screen bg-slate-100 grid place-items-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <span className="w-16 h-16 rounded-2xl bg-blue-600 text-white grid place-items-center mx-auto mb-4">
            <Store className="w-8 h-8" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">متجر قطن سلطان</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            مرحباً بك في محادثة المتجر الذكية — اسأل عن الأقمشة والأسعار والتوفر،
            وسيرد عليك المساعد فوراً.
          </p>
          <label htmlFor="guest-name" className="block text-right text-sm font-medium text-slate-700 mb-1.5">اسمك الكريم</label>
          <input
            id="guest-name"
            type="text"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') startChat();
            }}
            placeholder="مثال: أبو أحمد"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-center mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={startChat}
            disabled={!nameInput.trim()}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ابدأ المحادثة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-stretch" dir="rtl">
      <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto bg-white shadow-xl overflow-hidden min-h-screen">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-white">
          <span className="w-11 h-11 rounded-2xl bg-blue-600 text-white grid place-items-center shrink-0">
            <Store className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">متجر قطن سلطان</h1>
            <p className="text-xs text-slate-400">{agentName} — يرد فوراً</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            متصل
          </span>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60 min-h-[50vh]">
          {loading ? (
            <div className="h-full grid place-items-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-label="جارٍ التحميل" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <Bot className="w-10 h-10 text-slate-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600 mb-1">أهلاً {guest.name} 👋</p>
              <p className="text-xs text-slate-400">اسألنا عن أي منتج — الأسعار والتوفر لحظة بلحظة.</p>
            </div>
          ) : (
            messages.map((message) => {
              if (message.sender === 'system') {
                return (
                  <p key={message.id} className="text-center text-[11px] text-slate-400 bg-slate-200/70 rounded-full w-fit mx-auto px-3 py-1">
                    {message.content}
                  </p>
                );
              }
              const mine = message.sender === 'customer';
              return (
                <div key={message.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 mt-1 ${
                      mine ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {mine ? <User className="w-3.5 h-3.5" aria-hidden="true" /> : <Bot className="w-3.5 h-3.5" aria-hidden="true" />}
                  </span>
                  <div className={`max-w-[78%] ${mine ? 'text-left' : ''}`}>
                    {message.attachment?.kind === 'image' && (
                      <img
                        src={message.attachment.url}
                        alt={message.attachment.url}
                        className="mb-1 rounded-xl max-h-56 w-full object-cover border border-slate-200 bg-slate-50"
                        loading="lazy"
                      />
                    )}
                    {message.attachment?.kind === 'location' && (
                      <a
                        href={`https://maps.google.com/?q=${message.attachment.lat},${message.attachment.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-medium text-blue-600 underline bg-white border border-slate-200 rounded-tr-md"
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        {message.attachment.label} — افتح في الخرائط
                      </a>
                    )}
                    {message.content && (
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          mine
                            ? 'bg-emerald-500 text-white rounded-tl-md'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tr-md'
                        }`}
                      >
                        {message.content}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">{formatChatTime(message.at)}</p>
                  </div>
                </div>
              );
            })
          )}
          {busy && (
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

        {error && (
          <div className="px-4 pb-2">
            <p className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-slate-100 px-4 py-3 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="اكتب رسالتك..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
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
    </div>
  );
}
