// components/workflows/types.ts — أتمتة سير العمل بنموذج عقد مرسوم (مثل n8n):
// محفّز (خمسة أنواع) + عقد مرسومة بمواقع قابلة للسحب تتصل ببعضها عبر «التالي» وفروع «إذا»
export type WorkflowTrigger =
  | { kind: 'message'; keywords: string[]; matchStart: boolean } // رسالة تتضمن أي كلمة من القائمة — في أي موضع أو في أول الكلام
  | { kind: 'new_customer' } // أول رسالة من عميل في محادثة جديدة
  | { kind: 'no_reply'; minutes: number } // مرّت X دقيقة ولم يردّ المحل على آخر رسالة للعميل
  | { kind: 'inactive'; hours: number } // لم يتحدث العميل منذ X ساعة (انتهاء/برود المحادثة)
  | { kind: 'manual' }; // تشغيل يدوي فقط

export type WorkflowNodeKind =
  | 'reply' // إرسال رسالة نصية
  | 'image' // إرسال صورة
  | 'location' // إرسال موقع جغرافي
  | 'set_agent' // تعيين وكيل معين للمحادثة
  | 'assign' // إسناد المحادثة إلى موظف
  | 'order' // إنشاء طلب/فاتورة مقبوضات
  | 'wait' // الانتظار مدة معينة ثم الاستئناف
  | 'if' // عقدة شرطية على آخر رسالة للعميل
  | 'goto'; // الانتقال إلى عقدة محددة

export interface OrderNodeItem {
  name: string;
  quantity: number;
  price: number;
  currency: 'SYP' | 'USD';
}

// عقدة واحدة في المخطط: نوعها وموقعها على اللوحة وحقولها حسب النوع وروابطها
export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  position: { x: number; y: number };
  nextId: string | null; // الخطوة التالية (كل الأنواع ما عدا if/goto)
  // رسالة/إشعار
  text?: string;
  // صورة
  url?: string;
  // موقع
  lat?: number;
  lng?: number;
  label?: string;
  // تعيين وكيل / إسناد موظف
  agentId?: string;
  agentName?: string;
  userId?: string;
  userName?: string;
  // طلب/فاتورة
  items?: OrderNodeItem[];
  paid?: boolean;
  // انتظار
  minutes?: number;
  // شرطية
  conditionKeyword?: string;
  conditionNegate?: boolean;
  ifTrueId?: string | null;
  ifFalseId?: string | null;
  // انتقال
  targetId?: string | null;
}

export interface WorkflowRun {
  at: number;
  detail: string;
}

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  triggerNextId: string | null; // أول عقدة بعد المحفّز
  nodes: WorkflowNode[];
  runs: WorkflowRun[];
  createdAt: number;
  /** @deprecated الحقل القديم actions يُرحَّل إلى nodes عند القراءة */
  actions?: { kind: 'reply' | 'notify'; text: string }[];
}

export const WORKFLOWS_STORAGE_KEY = 'sultan_workflows';

export const NODE_KINDS: { value: WorkflowNodeKind; label: string; color: string }[] = [
  { value: 'reply', label: 'رسالة نصية', color: 'bg-blue-600' },
  { value: 'image', label: 'إرسال صورة', color: 'bg-violet-500' },
  { value: 'location', label: 'إرسال موقع', color: 'bg-teal-500' },
  { value: 'set_agent', label: 'تعيين وكيل', color: 'bg-indigo-500' },
  { value: 'assign', label: 'إسناد لموظف', color: 'bg-cyan-600' },
  { value: 'order', label: 'طلب/فاتورة', color: 'bg-emerald-600' },
  { value: 'wait', label: 'انتظار', color: 'bg-slate-500' },
  { value: 'if', label: 'شرط (إذا)', color: 'bg-amber-500' },
  { value: 'goto', label: 'انتقال لعقدة', color: 'bg-rose-500' },
];

export function nodeKindLabel(kind: WorkflowNodeKind): string {
  return NODE_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

export function nodeKindColor(kind: WorkflowNodeKind): string {
  return NODE_KINDS.find((entry) => entry.value === kind)?.color ?? 'bg-slate-500';
}

// تطبيع المحفّز: النسخة القديمة بكلمة واحدة (keyword نصية) تُحوَّل إلى قائمة كلمات
export function normalizeTrigger(trigger: WorkflowTrigger | undefined): WorkflowTrigger {
  if (!trigger) return { kind: 'manual' };
  if (trigger.kind === 'message') {
    const legacy = trigger as unknown as { keyword?: string };
    const keywords = Array.isArray(trigger.keywords)
      ? trigger.keywords
      : typeof legacy.keyword === 'string' && legacy.keyword.trim()
        ? [legacy.keyword.trim()]
        : [];
    return { kind: 'message', keywords, matchStart: trigger.matchStart === true };
  }
  return trigger;
}

// ترحيل أي سير قديم (trigger + actions خطية) إلى نموذج العقد المرصوفة عمودياً
export function migrateWorkflow(raw: Partial<Workflow> & { actions?: { kind: 'reply' | 'notify'; text: string }[] }): Workflow {
  if (Array.isArray(raw.nodes)) {
    return {
      id: raw.id ?? crypto.randomUUID(),
      name: raw.name ?? '',
      enabled: raw.enabled ?? true,
      trigger: normalizeTrigger(raw.trigger),
      triggerNextId: raw.triggerNextId ?? null,
      nodes: raw.nodes,
      runs: Array.isArray(raw.runs) ? raw.runs : [],
      createdAt: raw.createdAt ?? Date.now(),
    };
  }
  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  const nodes: WorkflowNode[] = actions.map((action, index) => ({
    id: crypto.randomUUID(),
    kind: 'reply',
    position: { x: 120, y: 150 + index * 130 },
    nextId: null,
    text: action.kind === 'notify' ? `🔔 ${action.text}` : action.text,
  }));
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].nextId = nodes[i + 1].id;
  return {
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name ?? '',
    enabled: raw.enabled ?? true,
    trigger: normalizeTrigger(raw.trigger),
    triggerNextId: nodes[0]?.id ?? null,
    nodes,
    runs: Array.isArray(raw.runs) ? raw.runs : [],
    createdAt: raw.createdAt ?? Date.now(),
  };
}

// سياق المطابقة: نص الرسالة وهل المحادثة جديدة (أول رسالة من العميل)
export interface TriggerContext {
  text: string;
  isNewConversation: boolean;
}

// هل يُطلق سير العمل لحظة وصول رسالة؟ (كلمات مفتاحية أو عميل جديد) — الزمنية تُفحص من مجدول cron
export function workflowMatchesMessage(workflow: Workflow, context: TriggerContext): boolean {
  if (!workflow.enabled) return false;
  if (workflow.trigger.kind === 'new_customer') return context.isNewConversation;
  if (workflow.trigger.kind === 'message') {
    const keywords = workflow.trigger.keywords.map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (keywords.length === 0) return false;
    const text = context.text.toLowerCase().trim();
    const fromStart = workflow.trigger.matchStart;
    return keywords.some((item) => (fromStart ? text.startsWith(item) : text.includes(item)));
  }
  return false;
}

// سيرات العمل الزمنية التي يفحصها مجدول cron دورياً على المحادثات المخزنة
export function isTimeBasedTrigger(trigger: WorkflowTrigger): trigger is Extract<WorkflowTrigger, { kind: 'no_reply' | 'inactive' }> {
  return trigger.kind === 'no_reply' || trigger.kind === 'inactive';
}

// هل تنطبق محفزات «عدم الرد» أو «الخمول» على هذه المحادثة الآن؟
// الشرط المشترك: آخر رسالة من العميل تجاوزت عتبة الزمن، ولم تُطلَق متابعة تلقائية بعد هذه الرسالة —
// فلا يتكرر الإطلاق قبل وصول رسالة جديدة من العميل.
export function conversationMatchesTimeTrigger(
  workflow: Workflow,
  conversation: { messages: { sender: string; at: number }[]; lastAutoFollowUpAt?: number },
  now: number
): boolean {
  if (!workflow.enabled || !isTimeBasedTrigger(workflow.trigger)) return false;
  const customerMessages = conversation.messages.filter((message) => message.sender === 'customer');
  if (customerMessages.length === 0) return false;
  const lastCustomerAt = Math.max(...customerMessages.map((message) => message.at));
  if ((conversation.lastAutoFollowUpAt ?? 0) >= lastCustomerAt) return false;
  if (workflow.trigger.kind === 'no_reply') {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage || lastMessage.sender !== 'customer') return false; // ردّ المحل — لا يوجد عدم رد
    return now - lastMessage.at >= workflow.trigger.minutes * 60_000;
  }
  // inactive: لم يتحدث العميل منذ X ساعة مهما كان آخر طرف ردّ
  return now - lastCustomerAt >= workflow.trigger.hours * 3_600_000;
}

export function triggerLabel(workflow: Workflow): string {
  const trigger = workflow.trigger;
  if (trigger.kind === 'message') {
    const words = trigger.keywords.map((item) => item.trim()).filter(Boolean);
    if (words.length === 0) return 'رسالة واردة (بدون كلمات محددة)';
    const where = trigger.matchStart ? 'يبدأ بـ' : 'تتضمن';
    return `رسالة ${where} ${words.slice(0, 3).map((word) => `«${word}»`).join(' أو ')}${words.length > 3 ? ` (+${words.length - 3})` : ''}`;
  }
  if (trigger.kind === 'new_customer') return 'عميل جديد (أول رسالة)';
  if (trigger.kind === 'no_reply') return `عدم ردّ المحل خلال ${trigger.minutes} دقيقة`;
  if (trigger.kind === 'inactive') return `لم يتحدث العميل منذ ${trigger.hours} ساعة`;
  return 'تشغيل يدوي فقط';
}

// النصوص تدعم متغيرات: {اسم_العميل} يُستبدل باسم العميل الحقيقي عند التنفيذ
export function renderTemplate(text: string, customerName: string): string {
  return text.replaceAll('{اسم_العميل}', customerName).replaceAll('{العميل}', customerName);
}
