// app/api/cron/workflows/route.ts — مجدول سيرات العمل الزمنية: يفحص كل المحادثات كل 15 دقيقة
// (عبر Vercel Cron في vercel.json) ويطلق سيرات «عدم الرد» و«انتهاء المحادثة» المطابقة.
// محمي بسر CRON_SECRET عند ضبطه (يرسله Vercel تلقائياً في ترويسة Authorization).
import { NextResponse } from 'next/server';
import { readCollection, upsertRecord } from '../../../lib/server/entities';
import {
  conversationMatchesTimeTrigger,
  executeWorkflowActions,
  isTimeBasedTrigger,
  type Workflow,
} from '../../../components/workflows/types';
import type { Conversation, ConversationMessage } from '../../../components/inbox/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // ثانية — مهمة الفحص خفيفة لكنها قد تلمس مئات المحادثات

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true; // بيئة تطوير محلية بلا سر
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

function message(content: string, sender: ConversationMessage['sender'], via: ConversationMessage['via']): ConversationMessage {
  return { id: crypto.randomUUID(), sender, via, content, at: Date.now() };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const now = Date.now();
  const workflows = (((await readCollection('sultan_workflows')) ?? []) as Workflow[]).filter(
    (workflow) => workflow.enabled && isTimeBasedTrigger(workflow.trigger)
  );
  const conversations = ((await readCollection('sultan_conversations')) ?? []) as Conversation[];

  let scanned = 0;
  let fired = 0;

  for (const workflow of workflows) {
    const runDetail = `${new Date(now).toISOString()} — تلقائي`;
    for (const conversation of conversations) {
      if (!conversationMatchesTimeTrigger(workflow, conversation, now)) continue;
      scanned++;
      executeWorkflowActions(workflow, conversation.customerName, {
        reply: (text) => conversation.messages.push(message(text, 'shop', 'workflow')),
        notify: (text) => conversation.messages.push(message(`🔔 ${text}`, 'system', 'workflow')),
      });
      conversation.lastAutoFollowUpAt = now;
      conversation.updatedAt = now;
      await upsertRecord('sultan_conversations', conversation as unknown as Record<string, unknown>);
      fired++;
    }
    const runs = [{ at: now, detail: runDetail }, ...workflow.runs].slice(0, 20);
    await upsertRecord('sultan_workflows', { ...workflow, runs } as unknown as Record<string, unknown>);
  }

  return NextResponse.json({ ok: true, workflows: workflows.length, scanned, fired });
}
