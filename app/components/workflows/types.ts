// components/workflows/types.ts — أتمتة سير العمل: محفّزات (كلمة مفتاحية/عميل جديد/عدم رد/خمول/يدوي) + إجراءات
export type WorkflowTrigger =
  | { kind: 'message'; keyword: string } // رسالة واردة تتضمن كلمة مفتاحية
  | { kind: 'new_customer' } // أول رسالة من عميل في محادثة جديدة
  | { kind: 'no_reply'; minutes: number } // مرّت X دقيقة ولم يردّ المحل على آخر رسالة للعميل
  | { kind: 'inactive'; hours: number } // لم يتحدث العميل منذ X ساعة (انتهاء/برود المحادثة)
  | { kind: 'manual' }; // تشغيل يدوي فقط

export type WorkflowAction = { kind: 'reply'; text: string } | { kind: 'notify'; text: string };

export interface WorkflowRun {
  at: number;
  detail: string;
}

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  runs: WorkflowRun[];
  createdAt: number;
}

export const WORKFLOWS_STORAGE_KEY = 'sultan_workflows';

// سياق المطابقة: نص الرسالة وهل المحادثة جديدة (أول رسالة من العميل)
export interface TriggerContext {
  text: string;
  isNewConversation: boolean;
}

// هل يُطلق سير العمل لحظة وصول رسالة؟ (كلمة مفتاحية أو عميل جديد) — الزمنية تُفحص من مجدول cron
export function workflowMatchesMessage(workflow: Workflow, context: TriggerContext): boolean {
  if (!workflow.enabled) return false;
  if (workflow.trigger.kind === 'new_customer') return context.isNewConversation;
  if (workflow.trigger.kind === 'message') {
    const keyword = workflow.trigger.keyword.trim().toLowerCase();
    if (!keyword) return false;
    return context.text.toLowerCase().includes(keyword);
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
    return trigger.keyword.trim()
      ? `رسالة تتضمن «${trigger.keyword.trim()}»`
      : 'رسالة واردة (بدون كلمة محددة)';
  }
  if (trigger.kind === 'new_customer') return 'عميل جديد (أول رسالة)';
  if (trigger.kind === 'no_reply') return `عدم ردّ المحل خلال ${trigger.minutes} دقيقة`;
  if (trigger.kind === 'inactive') return `لم يتحدث العميل منذ ${trigger.hours} ساعة`;
  return 'تشغيل يدوي فقط';
}

export function actionLabel(action: WorkflowAction): string {
  return action.kind === 'reply' ? `رد الوكيل: ${action.text}` : `إشعار: ${action.text}`;
}

// النصوص تدعم متغيرات: {اسم_العميل} يُستبدل باسم العميل الحقيقي عند التنفيذ
export function renderTemplate(text: string, customerName: string): string {
  return text.replaceAll('{اسم_العميل}', customerName).replaceAll('{العميل}', customerName);
}

// تنفيذ إجراءات سير العمل عبر خطافات يوفّرها المنفّذ (الوارد أو التشغيل اليدوي أو مجدول cron).
// الردود تُرسل باسم المحل، والإشعارات رسائل نظام داخلية تظهر في الوارد دون انكشافها للعميل كرد محل.
export function executeWorkflowActions(
  workflow: Workflow,
  customerName: string,
  hooks: { reply: (text: string) => void; notify: (text: string) => void }
): { ran: boolean; detail: string } {
  let replies = 0;
  let notices = 0;
  for (const action of workflow.actions) {
    if (action.kind === 'reply') {
      hooks.reply(renderTemplate(action.text, customerName));
      replies++;
    } else {
      hooks.notify(renderTemplate(action.text, customerName));
      notices++;
    }
  }
  const detail =
    workflow.actions.length === 0
      ? 'لا إجراءات — أضف إجراءً للسير'
      : replies > 0 && notices > 0
        ? `ردّ (${replies}) وأشعار (${notices}) لـ «${customerName}»`
        : replies > 0
          ? `ردّ برسالة (${replies}) لـ «${customerName}»`
          : `إشعار (${notices})`;
  return { ran: workflow.actions.length > 0, detail };
}
