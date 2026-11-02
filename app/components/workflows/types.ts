// components/workflows/types.ts — أتمتة سير العمل: محفّز (رسالة واردة بكلمة مفتاحية أو يدوي) + إجراءات (رد/إشعار)
export type WorkflowTrigger = { kind: 'message'; keyword: string } | { kind: 'manual' };

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

// النصوص تدعم متغيرات: {اسم_العميل} يُستبدل باسم العميل الحقيقي عند التنفيذ
export function renderTemplate(text: string, customerName: string): string {
  return text.replaceAll('{اسم_العميل}', customerName).replaceAll('{العميل}', customerName);
}

// هل يطابق سير العمل رسالة واردة؟ المطابقة باحتواء الكلمة المفتاحية دون حساسية لحالة الأحرف
export function workflowMatchesMessage(workflow: Workflow, messageText: string): boolean {
  if (!workflow.enabled || workflow.trigger.kind !== 'message') return false;
  const keyword = workflow.trigger.keyword.trim().toLowerCase();
  if (!keyword) return false;
  return messageText.toLowerCase().includes(keyword);
}

export function triggerLabel(workflow: Workflow): string {
  if (workflow.trigger.kind === 'message') {
    return workflow.trigger.keyword.trim()
      ? `رسالة تتضمن «${workflow.trigger.keyword.trim()}»`
      : 'رسالة واردة (بدون كلمة محددة)';
  }
  return 'تشغيل يدوي فقط';
}

export function actionLabel(action: WorkflowAction): string {
  return action.kind === 'reply' ? `رد الوكيل: ${action.text}` : `إشعار: ${action.text}`;
}

// تنفيذ إجراءات سير العمل عبر خطافات يوفّرها المنفّذ (الوارد أو التشغيل اليدوي)
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
