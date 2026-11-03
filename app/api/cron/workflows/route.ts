// app/api/cron/workflows/route.ts — مجدول سيرات العمل: يفحص كل المحادثات كل ساعة (Vercel Cron)
// ويطلق محفزات «عدم الرد» و«انتهاء المحادثة»، ويستأنف التنفيذات المعلقة عند عقد «الانتظار».
// محمي بسر CRON_SECRET عند ضبطه (يرسله Vercel تلقائياً في ترويسة Authorization).
import { NextResponse } from 'next/server';
import { readCollection, upsertRecord } from '../../../lib/server/entities';
import { runWorkflowGraph } from '../../../components/workflows/engine';
import {
  conversationMatchesTimeTrigger,
  isTimeBasedTrigger,
  migrateWorkflow,
  type Workflow,
} from '../../../components/workflows/types';
import type { Conversation } from '../../../components/inbox/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true; // بيئة تطوير محلية بلا سر
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const now = Date.now();
  const allWorkflows = (((await readCollection('sultan_workflows')) ?? []) as Workflow[]).map((workflow) =>
    migrateWorkflow(workflow)
  );
  const conversations = ((await readCollection('sultan_conversations')) ?? []) as Conversation[];

  let fired = 0;
  let resumed = 0;

  const logRun = async (workflow: Workflow, detail: string) => {
    const runs = [{ at: now, detail }, ...workflow.runs].slice(0, 20);
    await upsertRecord('sultan_workflows', { ...workflow, runs } as unknown as Record<string, unknown>);
  };

  // 1) محفزات زمنية على المحادثات
  const timeWorkflows = allWorkflows.filter((workflow) => workflow.enabled && isTimeBasedTrigger(workflow.trigger));
  for (const workflow of timeWorkflows) {
    for (const conversation of conversations) {
      if (!conversationMatchesTimeTrigger(workflow, conversation, now)) continue;
      const result = await runWorkflowGraph(workflow, conversation, workflow.triggerNextId, {
        createOrder: async () => 'تُنشأ الطلبات على خادم المحادثات فقط',
      });
      conversation.lastAutoFollowUpAt = now;
      conversation.updatedAt = now;
      await upsertRecord('sultan_conversations', conversation as unknown as Record<string, unknown>);
      await logRun(workflow, `محادثة ${conversation.customerName} — ${result.steps} عقدة`);
      fired++;
    }
  }

  // 2) استئناف التنفيذات المعلقة عند عقد «الانتظار»
  for (const conversation of conversations) {
    const pending = conversation.pendingExecutions ?? [];
    if (pending.length === 0) continue;
    const due = pending.filter((execution) => execution.resumeAt <= now);
    if (due.length === 0) continue;
    conversation.pendingExecutions = pending.filter((execution) => execution.resumeAt > now);
    for (const execution of due) {
      const workflow = allWorkflows.find((item) => item.id === execution.workflowId);
      const waitNode = workflow?.nodes.find((node) => node.id === execution.nodeId);
      if (!workflow || !waitNode) continue;
      const result = await runWorkflowGraph(workflow, conversation, waitNode.nextId ?? null, {
        createOrder: async () => 'تُنشأ الطلبات على خادم المحادثات فقط',
      });
      await logRun(workflow, `استئناف بعد انتظار — محادثة ${conversation.customerName} — ${result.steps} عقدة`);
      resumed++;
    }
    conversation.updatedAt = now;
    await upsertRecord('sultan_conversations', conversation as unknown as Record<string, unknown>);
  }

  return NextResponse.json({ ok: true, timeWorkflows: timeWorkflows.length, fired, resumed });
}
