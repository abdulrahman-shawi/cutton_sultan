// components/inbox/types.ts — محادثات العملاء مع الوكيل/المحل (تخزين محلي)
export type MessageSender = 'customer' | 'shop' | 'system'; // من أرسل؟ العميل، المحل، أو إشعار نظام داخلي
export type MessageVia = 'manual' | 'agent' | 'workflow'; // يدوي، توليد الوكيل، أو سير عمل

// مرفقات الرسائل: صورة أو موقع جغرافي (تضافه عقد سير العمل)
export type MessageAttachment =
  | { kind: 'image'; url: string }
  | { kind: 'location'; lat: number; lng: number; label: string };

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  via: MessageVia;
  content: string;
  at: number;
  attachment?: MessageAttachment;
}

// تنفيذ معلّق على عقدة «انتظار» — يستأنفه مجدول cron عند حلول موعده
export interface PendingExecution {
  workflowId: string;
  nodeId: string;
  resumeAt: number;
}

export interface Conversation {
  id: string;
  customerId: string | null;
  customerName: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
  // وكيل مخصص للمحادثة (عقدة تعيين وكيل) — يتجاوز الوكيل الافتراضي
  agentId?: string | null;
  // موظف مُسند إليه العمل (عقدة إسناد)
  assigneeId?: string | null;
  assigneeName?: string;
  // وقت آخر متابعة تلقائية (سير عمل زمني) — يمنع تكرار الإطلاق قبل رسالة عميل جديدة
  lastAutoFollowUpAt?: number;
  pendingExecutions?: PendingExecution[];
}

export const CONVERSATIONS_STORAGE_KEY = 'sultan_conversations';

export function createConversation(customerId: string | null, customerName: string): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    customerId,
    customerName,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function lastMessagePreview(conversation: Conversation): string {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return 'محادثة جديدة';
  return last.content;
}
