// app/api/chat/route.ts — بوابة العملاء العامة: استقبال رسائل العميل، توليد رد الوكيل عبر Kimi،
// تخزين المحادثة على الخادم لتظهر في «محادثات العملاء» لدى المالك، وتطبيق سير العمل المفعّلة.
// بلا جلسة دخول — محمية بمحدد معدل بسيط وبدون أدوات تنفيذية.
import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '../../lib/server/store';
import { readCollection, readSingleton, upsertRecord } from '../../lib/server/entities';
import { buildAgentSystemPrompt, buildCatalogDigestFromProducts, buildCustomerContextFromData } from '../../lib/agentPrompt';
import { executeWorkflowActions, workflowMatchesMessage, type Workflow } from '../../components/workflows/types';
import { DEFAULT_AGENT, type AgentConfig } from '../../components/agents/types';
import type { Product } from '../../components/products/types';
import type { Customer } from '../../components/customers/types';
import type { Invoice } from '../../components/invoices/types';
import type { Conversation, ConversationMessage } from '../../components/inbox/types';

export const dynamic = 'force-dynamic';

const DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1';
const DEFAULT_MODEL = 'kimi-k2.6';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 30;

// محدد معدل بسيط في الذاكرة: 12 رسالة في الدقيقة لكل عنوان IP
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT;
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

interface AgentSettings {
  agentConfig?: Partial<AgentConfig>;
}

async function loadAgentConfig(): Promise<AgentConfig> {
  const settings = (await readSingleton('sultan_store_settings')) as AgentSettings | null;
  return { ...DEFAULT_AGENT, ...(settings?.agentConfig ?? {}) };
}

// قراءة محادثة مخزنة على الخادم — سجل واحد لكل محادثة في جدول Conversation بعمود JSONB
async function readConversation(id: string): Promise<Conversation | null> {
  const row = await withDbRetry(() => prisma.conversation.findUnique({ where: { id } }));
  return row ? (row.data as unknown as Conversation) : null;
}

async function saveConversation(conversation: Conversation): Promise<void> {
  await upsertRecord('sultan_conversations', { ...conversation, updatedAt: Date.now() } as unknown as Record<string, unknown>);
}

function message(content: string, sender: ConversationMessage['sender'], via: ConversationMessage['via']): ConversationMessage {
  return { id: crypto.randomUUID(), sender, via, content, at: Date.now() };
}

// توليد رد الوكيل عبر Kimi بموجه النظام المبني من إعدادات المتجر وبياناته — بلا أدوات
async function askAgent(
  config: AgentConfig,
  customerName: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string | null> {
  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) return null;
  const products = ((await readCollection('sultan_products')) ?? []) as Product[];
  const customers = ((await readCollection('sultan_customers')) ?? []) as Customer[];
  const invoices = ((await readCollection('sultan_invoices')) ?? []) as Invoice[];
  const system = buildAgentSystemPrompt(
    config,
    customerName,
    buildCatalogDigestFromProducts(products),
    buildCustomerContextFromData(customerName, customers, invoices)
  );
  const upstream = await fetch(`${(process.env.KIMI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.KIMI_MODEL || DEFAULT_MODEL,
      messages: [{ role: 'system', content: system }, ...history],
    }),
  });
  if (!upstream.ok) return null;
  const payload = (await upstream.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  return payload?.choices?.[0]?.message?.content ?? null;
}

// تطبيق سيرات العمل المفعّلة المطابقة لرسالة العميل لحظة وصولها (كلمة مفتاحية أو عميل جديد)
async function applyWorkflows(conversation: Conversation, text: string, isNewConversation: boolean): Promise<number> {
  const workflows = (((await readCollection('sultan_workflows')) ?? []) as Workflow[]).filter((workflow) =>
    workflowMatchesMessage(workflow, { text, isNewConversation })
  );
  let replies = 0;
  for (const workflow of workflows) {
    let replyCount = 0;
    executeWorkflowActions(workflow, conversation.customerName, {
      reply: (replyText) => {
        conversation.messages.push(message(`📌 ${replyText}`, 'shop', 'workflow'));
        replyCount++;
      },
      notify: (note) => conversation.messages.push(message(`🔔 ${note}`, 'system', 'workflow')),
    });
    replies += replyCount;
    const runs = [{ at: Date.now(), detail: `محادثة ${conversation.customerName}` }, ...workflow.runs].slice(0, 20);
    await upsertRecord('sultan_workflows', { ...workflow, runs } as unknown as Record<string, unknown>);
  }
  return replies;
}

// GET /api/chat?id=... — استرجاع محادثة العميل لمتابعتها من جهازه (معرّف غير قابل للتخمين)
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'معرّف المحادثة مطلوب' }, { status: 400 });
  const conversation = await readConversation(id);
  if (!conversation) return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  return NextResponse.json({ conversation });
}

// POST /api/chat — { customerName, message, conversationId? } ← { reply, conversationId, agentName, messages }
export async function POST(request: Request) {
  if (!rateLimitOk(clientIp(request))) {
    return NextResponse.json({ error: 'كثرة الطلبات — انتظر لحظة ثم أعد المحاولة' }, { status: 429 });
  }

  let body: { customerName?: unknown; message?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 80) : '';
  const text = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  if (!customerName) return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });

  const agent = await loadAgentConfig();

  // محادثة قائمة أو جديدة
  let conversation = conversationId ? await readConversation(conversationId) : null;
  const isNew = !conversation;
  if (!conversation) {
    conversation = {
      id: crypto.randomUUID(),
      customerId: null,
      customerName,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  conversation.messages.push(message(text, 'customer', 'manual'));

  // رسالة ترحيب عند أول رسالة من العميل في محادثة جديدة
  if (isNew && agent.autoReply && agent.openingMessage.trim()) {
    conversation.messages.push(message(agent.openingMessage.trim(), 'shop', 'agent'));
  }

  let reply: string | null = null;
  if (agent.autoReply) {
    // سير العمل المطابقة أولاً، وإلا رد الوكيل العام
    const workflowReplies = await applyWorkflows(conversation, text, isNew);
    if (workflowReplies === 0) {
      const history = conversation.messages.slice(-MAX_HISTORY)
        .filter((item) => item.sender !== 'system') // رسائل النظام الداخلية لا تُمرَّر للنموذج
        .map((item) => ({
          role: item.sender === 'customer' ? ('user' as const) : ('assistant' as const),
          content: item.content,
        }));
      reply = await askAgent(agent, customerName, history);
      if (reply) conversation.messages.push(message(reply, 'shop', 'agent'));
    }
  }
  if (!reply && conversation.messages.length <= 2 && !agent.autoReply) {
    // الوكيل متوقف: رسالة ودية تمهّد لتدخل المالك
    reply = 'شكراً لتواصلك مع متجر قطن سلطان. سجّلنا رسالتك وسيرد عليك صاحب المحل في أقرب وقت.';
    conversation.messages.push(message(reply, 'shop', 'workflow'));
  }

  conversation.updatedAt = Date.now();
  await saveConversation(conversation);

  return NextResponse.json({
    reply,
    conversationId: conversation.id,
    agentName: agent.name,
    messages: conversation.messages.slice(-50),
  });
}
