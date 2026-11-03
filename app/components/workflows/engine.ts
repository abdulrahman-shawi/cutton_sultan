// components/workflows/engine.ts — منفّذ مخطط العقد: يمشي من عقدة البداية عبر الروابط
// (التالي / فروع الشرط / الانتقال) ونفّذ كل عقدة على المحادثة، ويتوقف عند «انتظار» معلّماً الاستئناف.
// يعمل على الخادم (/api/chat و cron) وفي الواجهة (التشغيل اليدوي) عبر معالجات مُحقونة.
import { renderTemplate, type Workflow, type WorkflowNode } from './types';
import type { Conversation, ConversationMessage } from '../inbox/types';

export interface EngineHandlers {
  // إنشاء طلب/فاتورة — تنفيذ حقيقي على الخادم، وملاحظة توضيحية في الواجهة
  createOrder?: (node: WorkflowNode, customerName: string) => Promise<string>;
}

export interface EngineResult {
  status: 'completed' | 'waiting';
  steps: number;
  replies: number; // رسائل وصلت للعميل — تُستخدم لكبح رد الوكيل العام بعدها
}

const MAX_STEPS = 50; // حماية من الحلقات اللانهائية في الانتقالات

function push(
  conversation: Conversation,
  content: string,
  sender: ConversationMessage['sender'],
  attachment?: ConversationMessage['attachment']
): void {
  conversation.messages.push({
    id: crypto.randomUUID(),
    sender,
    via: 'workflow',
    content,
    at: Date.now(),
    ...(attachment ? { attachment } : {}),
  });
}

export async function runWorkflowGraph(
  workflow: Workflow,
  conversation: Conversation,
  startNodeId: string | null,
  handlers: EngineHandlers = {}
): Promise<EngineResult> {
  let currentId = startNodeId;
  let steps = 0;
  let replies = 0;
  const now = Date.now();

  while (currentId && steps < MAX_STEPS) {
    steps++;
    const node = workflow.nodes.find((item) => item.id === currentId);
    if (!node) break;
    const customerName = conversation.customerName;

    switch (node.kind) {
      case 'reply': {
        const text = renderTemplate(node.text ?? '', customerName).trim();
        if (text) {
          push(conversation, text, 'shop');
          replies++;
        }
        currentId = node.nextId;
        break;
      }
      case 'image': {
        const url = (node.url ?? '').trim();
        if (url) {
          push(conversation, renderTemplate(node.label ?? '📷 صورة', customerName), 'shop', { kind: 'image', url });
          replies++;
        }
        currentId = node.nextId;
        break;
      }
      case 'location': {
        if (Number.isFinite(node.lat) && Number.isFinite(node.lng)) {
          push(conversation, node.label?.trim() || '📍 موقع المتجر', 'shop', {
            kind: 'location',
            lat: node.lat as number,
            lng: node.lng as number,
            label: node.label?.trim() || 'الموقع',
          });
          replies++;
        }
        currentId = node.nextId;
        break;
      }
      case 'set_agent': {
        conversation.agentId = node.agentId ?? null;
        push(conversation, `🤖 عُيّن وكيل «${node.agentName ?? '—'}» لهذه المحادثة`, 'system');
        currentId = node.nextId;
        break;
      }
      case 'assign': {
        conversation.assigneeId = node.userId ?? null;
        conversation.assigneeName = node.userName ?? '';
        push(conversation, `👤 أُسندت المحادثة إلى «${node.userName ?? '—'}»`, 'system');
        currentId = node.nextId;
        break;
      }
      case 'order': {
        const note = handlers.createOrder
          ? await handlers.createOrder(node, customerName)
          : `🧾 طلب للعميل «${customerName}» — يُنشأ على خادم المتجر فقط`;
        if (note) push(conversation, note, 'system');
        currentId = node.nextId;
        break;
      }
      case 'wait': {
        const minutes = Math.max(1, Math.floor(Number(node.minutes) || 1));
        conversation.pendingExecutions = [
          ...(conversation.pendingExecutions ?? []),
          { workflowId: workflow.id, nodeId: node.id, resumeAt: now + minutes * 60_000 },
        ];
        return { status: 'waiting', steps, replies };
      }
      case 'if': {
        const keyword = (node.conditionKeyword ?? '').trim().toLowerCase();
        const lastCustomer = [...conversation.messages].reverse().find((item) => item.sender === 'customer');
        const hit = keyword ? (lastCustomer?.content.toLowerCase().includes(keyword) ?? false) : false;
        const result = node.conditionNegate ? !hit : hit;
        currentId = result ? node.ifTrueId ?? null : node.ifFalseId ?? null;
        break;
      }
      case 'goto': {
        currentId = node.targetId ?? null;
        break;
      }
      default:
        currentId = null;
    }
  }

  return { status: 'completed', steps, replies };
}
