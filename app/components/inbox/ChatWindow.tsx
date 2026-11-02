// components/inbox/ChatWindow.tsx — نافذة الدردشة مع العميل: فقاعات الرسائل ومربع الإرسال بثلاثة أوضاع
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, MessagesSquare, Send, Sparkles, User } from 'lucide-react';
import type { Conversation, ConversationMessage } from './types';
import { formatChatTime } from './types';

export type ComposerMode = 'customer' | 'shop' | 'agent';

interface ChatWindowProps {
  conversation: Conversation | null;
  agentName: string;
  autoReply: boolean;
  busy: boolean;
  onSend: (mode: ComposerMode, text: string) => void;
  onSuggest: () => Promise<string | null>;
}

const MODES: { value: ComposerMode; label: string; hint: string }[] = [
  { value: 'customer', label: 'العميل', hint: 'إرسال كرسالة واردة من العميل — يستجيب الوكيل تلقائياً' },
  { value: 'shop', label: 'المحل', hint: 'رد يدوي من المحل بصياغتك' },
  { value: 'agent', label: 'الوكيل', hint: 'وجّه الوكيل بجملة وسيصوغ هو الرسالة النهائية ويرسلها' },
];

function viaLabel(message: ConversationMessage, agentName: string): string | null {
  if (message.sender === 'customer') return null;
  if (message.via === 'workflow') return 'سير عمل';
  if (message.via === 'agent') return agentName;
  return null;
}

export default function ChatWindow({ conversation, agentName, autoReply, busy, onSend, onSuggest }: ChatWindowProps) {
  const [mode, setMode] = useState<ComposerMode>('customer');
  const [input, setInput] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [conversation?.messages.length, busy, suggesting]);

  if (!conversation) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm grid place-items-center h-full min-h-[420px]">
        <div className="text-center px-6">
          <MessagesSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">اختر محادثة من القائمة</p>
          <p className="text-sm text-slate-400">أو ابدأ محادثة جديدة مع أحد العملاء ليجرب الوكيل الرد عليه.</p>
        </div>
      </div>
    );
  }

  const lastCustomerMessage = [...conversation.messages].reverse().find((message) => message.sender === 'customer');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    onSend(mode, text);
    setInput('');
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const draft = await onSuggest();
      if (draft) {
        setMode('shop');
        setInput(draft);
      }
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-sm font-bold shrink-0">
            {conversation.customerName.trim().charAt(0) || '؟'}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{conversation.customerName}</p>
            <p className="text-[11px] text-slate-400">
              {autoReply ? `الرد التلقائي من «${agentName}» مفعّل` : 'الرد التلقائي متوقف — الرد اليدوي فقط'}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${autoReply ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          {autoReply ? 'وكيل نشط' : 'وكيل متوقف'}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50 min-h-[320px]">
        {conversation.messages.length === 0 && (
          <div className="h-full grid place-items-center text-center py-8">
            <div>
              <Bot className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600 mb-1">بداية المحادثة</p>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                اكتب رسالة بصفتك العميل (وضع «العميل») ليرد الوكيل تلقائياً، أو استخدم وضع «الوكيل» لتوجيهه بما يقوله.
              </p>
            </div>
          </div>
        )}
        {conversation.messages.map((message) => {
          if (message.sender === 'system') {
            return (
              <p key={message.id} className="text-center text-[11px] text-slate-400 bg-slate-100/80 rounded-full w-fit mx-auto px-3 py-1">
                {message.content}
              </p>
            );
          }
          const isCustomer = message.sender === 'customer';
          const label = viaLabel(message, agentName);
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
                <p className={`text-[10px] text-slate-400 mt-1 ${isCustomer ? 'text-left' : ''}`}>
                  {formatChatTime(message.at)}
                  {label ? ` · ${label}` : ''}
                </p>
              </div>
            </div>
          );
        })}
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

      <form onSubmit={handleSubmit} className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.hint}
                onClick={() => setMode(option.value)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === option.value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 flex-1 min-w-[140px]">{MODES.find((option) => option.value === mode)?.hint}</p>
          {mode === 'shop' && lastCustomerMessage && (
            <button
              type="button"
              onClick={() => void handleSuggest()}
              disabled={suggesting || busy}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              {suggesting ? 'يصيغ الرد...' : 'اقترح رداً بالذكاء الاصطناعي'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              mode === 'customer'
                ? `اكتب رسالة يقولها ${conversation.customerName}...`
                : mode === 'shop'
                  ? 'اكتب ردك بصفتك المحل...'
                  : 'وجّه الوكيل: مثال «اعتذر عن نفاد القماش الأحمر واقترح بديلاً»'
            }
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
        </div>
      </form>
    </div>
  );
}
