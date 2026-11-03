// app/api/chat/route.ts — بوابة العملاء العامة: استقبال رسائل العميل، توليد رد الوكيل الافتراضي عبر Kimi،
// تنفيذ مهارة الطلبات (تسجيل العميل + إنشاء فاتورة مقبوضات مع تحديث المخزون) عند تفعيلها على الوكيل،
// تخزين المحادثة على الخادم لتظهر في «محادثات العملاء»، وتطبيق سير العمل المفعّلة.
// بلا جلسة دخول — محمية بمحدد معدل بسيط، والأدوات تنفيذية محدودة بالمهارات المفعّلة.
import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '../../lib/server/store';
import { readCollection, readSingleton, upsertRecord } from '../../lib/server/entities';
import { buildAgentSystemPrompt, buildCatalogDigestFromProducts, buildCustomerContextFromData } from '../../lib/agentPrompt';
import { migrateWorkflow, workflowMatchesMessage, type Workflow } from '../../components/workflows/types';
import { runWorkflowGraph } from '../../components/workflows/engine';
import { createAgent, type AgentConfig } from '../../components/agents/types';
import type { Product } from '../../components/products/types';
import type { Customer } from '../../components/customers/types';
import type { Invoice, InvoiceItem } from '../../components/invoices/types';
import type { ChatMessage } from '../../lib/ai';
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

// قائمة الوكلاء من الخادم مع ترحيل الإعداد القديم — والوكيل الافتراضي (أو المخصص للمحادثة)
async function loadAgentsServer(): Promise<AgentConfig[]> {
  const agents = ((await readCollection('sultan_agents')) ?? []) as AgentConfig[];
  const withSkills = agents.map((agent) => ({
    ...createAgent(),
    ...agent,
    skills: agent.skills && typeof agent.skills.orders === 'boolean' ? agent.skills : { orders: true },
  }));
  if (withSkills.length > 0) return withSkills;
  const legacy = (await readSingleton('sultan_store_settings')) as { agentConfig?: Partial<AgentConfig> } | null;
  return [createAgent({ ...(legacy?.agentConfig ?? {}), isDefault: true })];
}

async function pickAgent(conversation: Conversation): Promise<AgentConfig> {
  const agents = await loadAgentsServer();
  if (conversation.agentId) {
    const assigned = agents.find((agent) => agent.id === conversation.agentId && agent.autoReply);
    if (assigned) return assigned;
  }
  return agents.find((agent) => agent.isDefault && agent.autoReply) ?? agents.find((agent) => agent.autoReply) ?? agents[0];
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

// أدوات مهارة الطلبات — يمرّر مخططها للنموذج وتنفيذها هنا على الخادم عندما يستدعيها الوكيل
const ORDER_TOOLS: object[] = [
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'تسجيل عميل جديد في النظام باسمه (وهاتفه إن ذكره). إذا كان العميل موجوداً مسبقاً تُبلغ بذلك دون تكرار.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم العميل كما ذكره' },
          phone: { type: 'string', description: 'رقم الهاتف إن ذكره — اختياري' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_invoice',
      description:
        'إنشاء فاتورة مقبوضات (بيع للعميل) من بنود طلبه بعد تأكيدها معه. مرّر paid=true للدفع كاش الآن، وpaid=false للذمة (الآجل). استخدم أسماء المنتجات كما في قائمة الكتالوج حرفياً.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'اسم العميل المشترك' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productName: { type: 'string', description: 'اسم المنتج كما ورد في الكتالوج' },
                variant: { type: 'string', description: 'التفصيلة (لون/مقاس) إن حددها العميل' },
                quantity: { type: 'number' },
                price: { type: 'number', description: 'سعر الوحدة من الكتالوج' },
                currency: { type: 'string', enum: ['SYP', 'USD'] },
              },
              required: ['productName', 'quantity', 'price', 'currency'],
            },
          },
          paid: { type: 'boolean', description: 'هل الدفع كاش الآن؟ الافتراضي false (ذمة)' },
          notes: { type: 'string' },
        },
        required: ['customerName', 'items'],
      },
    },
  },
];

interface ToolResult {
  message: string;
  notes: string[]; // ملاحظات تُدرج كرسائل نظام في المحادثة ليطلع عليها المالك
}

async function executeCreateCustomer(rawName: unknown, rawPhone: unknown): Promise<ToolResult> {
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, 80) : '';
  if (!name) return { message: 'تعذر التسجيل: الاسم فارغ.', notes: [] };
  const customers = ((await readCollection('sultan_customers')) ?? []) as Customer[];
  if (customers.some((customer) => customer.name.trim() === name)) {
    return { message: `العميل «${name}» موجود مسبقاً في النظام.`, notes: [] };
  }
  const customer: Customer = {
    id: crypto.randomUUID(),
    name,
    phone: typeof rawPhone === 'string' ? rawPhone.trim().slice(0, 30) : '',
    address: '',
    openingBalanceSyp: 0,
    openingBalanceUsd: 0,
    notes: 'سجّله وكيل المحادثة',
    createdAt: Date.now(),
  };
  await upsertRecord('sultan_customers', customer as unknown as Record<string, unknown>);
  return { message: `تم تسجيل العميل الجديد «${name}».`, notes: [`👤 تسجيل عميل جديد عبر الوكيل: ${name}`] };
}

async function executeCreateInvoice(args: Record<string, unknown>): Promise<ToolResult> {
  const customerName = typeof args.customerName === 'string' ? args.customerName.trim().slice(0, 80) : '';
  const rawItems = Array.isArray(args.items) ? args.items : [];
  const paid = args.paid === true;
  if (!customerName || rawItems.length === 0) {
    return { message: 'تعذر إنشاء الفاتورة: اسم العميل أو البنود ناقصة.', notes: [] };
  }

  const products = ((await readCollection('sultan_products')) ?? []) as Product[];
  const invoices = ((await readCollection('sultan_invoices')) ?? []) as Invoice[];
  const number = invoices.reduce((max, invoice) => Math.max(max, invoice.number || 0), 0) + 1;

  const cleanItems: InvoiceItem[] = [];
  let totalSyp = 0;
  let totalUsd = 0;
  for (const raw of rawItems as Record<string, unknown>[]) {
    const quantity = Math.floor(Number(raw.quantity));
    const price = Number(raw.price);
    const currency = raw.currency === 'USD' ? 'USD' : 'SYP';
    const itemName = String(raw.productName ?? '').trim().slice(0, 120);
    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0 || !itemName) {
      return { message: 'تعذر إنشاء الفاتورة: أحد البنود فيه كمية أو سعراً غير صالح.', notes: [] };
    }
    if (currency === 'USD') totalUsd += quantity * price;
    else totalSyp += quantity * price;

    // مطابقة المنتج بالاسم لتحديث المخزون وربط البند
    let productId: string | null = null;
    let entryBarcode: string | null = null;
    let displayName = itemName;
    const product = products.find((item) => item.name.trim().toLowerCase() === itemName.toLowerCase());
    if (product) {
      productId = product.id;
      displayName = product.name;
      let remaining = quantity;
      for (const entry of product.entries) {
        if (remaining <= 0) break;
        const take = Math.min(entry.quantity, remaining);
        if (take > 0) {
          entry.quantity -= take;
          remaining -= take;
          entryBarcode = entryBarcode ?? entry.barcode;
        }
      }
      await upsertRecord('sultan_products', product as unknown as Record<string, unknown>);
    }
    cleanItems.push({
      key: crypto.randomUUID(),
      productId,
      entryBarcode,
      name: displayName,
      currency,
      quantity,
      price,
      discount: 0,
      notes: typeof raw.variant === 'string' ? raw.variant.trim().slice(0, 60) : '',
    });
  }

  const customer = ((await readCollection('sultan_customers')) ?? []).find(
    (item) => (item as Customer).name.trim() === customerName
  ) as Customer | undefined;

  const invoice: Invoice = {
    id: crypto.randomUUID(),
    number,
    type: 'مقبوضات',
    partyId: customer?.id ?? null,
    partyName: customerName,
    status: paid ? 'مدفوعة' : 'غير مدفوعة',
    items: cleanItems,
    totalSyp,
    totalUsd,
    paidSyp: paid ? totalSyp : 0,
    paidUsd: paid ? totalUsd : 0,
    remainingSyp: paid ? 0 : totalSyp,
    remainingUsd: paid ? 0 : totalUsd,
    notes: typeof args.notes === 'string' && args.notes.trim() ? args.notes.trim() : 'أُنشئت عبر وكيل المحادثة',
    createdAt: Date.now(),
  };
  await upsertRecord('sultan_invoices', invoice as unknown as Record<string, unknown>);

  const totalText = [
    totalSyp > 0 ? `${Math.round(totalSyp)} ل.س` : '',
    totalUsd > 0 ? `${Math.round(totalUsd * 100) / 100} $` : '',
  ].filter(Boolean).join(' و ');
  return {
    message: `تم إنشاء فاتورة مقبوضات رقم ${number} للعميل «${customerName}» بقيمة ${totalText} — الحالة: ${paid ? 'مدفوعة كاش' : 'ذمة غير مدفوعة'}.`,
    notes: [`🧾 فاتورة مقبوضات رقم ${number} — ${customerName} — ${totalText} (${paid ? 'مدفوعة' : 'ذمة'})`],
  };
}

async function executeTool(name: string, argumentsJson: string): Promise<ToolResult> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argumentsJson || '{}') as Record<string, unknown>;
  } catch {
    return { message: 'تعذر قراءة معطيات الأداة.', notes: [] };
  }
  try {
    if (name === 'create_customer') return await executeCreateCustomer(args.name, args.phone);
    if (name === 'create_invoice') return await executeCreateInvoice(args);
    return { message: `أداة غير معروفة: ${name}`, notes: [] };
  } catch {
    return { message: 'تعذر تنفيذ العملية مؤقتاً — أعد المحاولة.', notes: [] };
  }
}

// محادثة مع الوكيل عبر Kimi — مع حلقة أدوات حتى 4 جولات عند تفعيل مهارة الطلبات
async function runAgent(
  config: AgentConfig,
  customerName: string,
  history: ChatMessage[],
  withOrders: boolean
): Promise<{ text: string | null; notes: string[] }> {
  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) return { text: null, notes: [] };

  const products = ((await readCollection('sultan_products')) ?? []) as Product[];
  const customers = ((await readCollection('sultan_customers')) ?? []) as Customer[];
  const invoices = ((await readCollection('sultan_invoices')) ?? []) as Invoice[];
  const system = buildAgentSystemPrompt(
    config,
    customerName,
    buildCatalogDigestFromProducts(products),
    buildCustomerContextFromData(customerName, customers, invoices)
  );
  const tools = withOrders ? ORDER_TOOLS : undefined;

  const notes: string[] = [];
  for (let round = 0; round < 4; round++) {
    const upstream = await fetch(`${(process.env.KIMI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.KIMI_MODEL || DEFAULT_MODEL,
        messages: [{ role: 'system', content: system }, ...history],
        ...(tools ? { tools } : {}),
      }),
    });
    if (!upstream.ok) return { text: null, notes };
    const payload = (await upstream.json().catch(() => null)) as {
      choices?: { message?: ChatMessage }[];
    } | null;
    const reply = payload?.choices?.[0]?.message;
    if (!reply) return { text: null, notes };

    if (reply.tool_calls && reply.tool_calls.length > 0) {
      history.push({ role: 'assistant', content: reply.content ?? '', tool_calls: reply.tool_calls });
      for (const call of reply.tool_calls) {
        const result = await executeTool(call.function.name, call.function.arguments);
        notes.push(...result.notes);
        history.push({ role: 'tool', content: result.message, tool_call_id: call.id, name: call.function.name });
      }
      continue;
    }
    return { text: reply.content ?? null, notes };
  }
  return { text: 'تعذر إكمال الطلب الآن — اطلب من العميل إعادة صياغة طلبه من فضلك.', notes };
}

// تطبيق سيرات العمل المفعّلة المطابقة لرسالة العميل لحظة وصولها عبر محرك العقد نفسه
async function applyWorkflows(conversation: Conversation, text: string, isNewConversation: boolean): Promise<number> {
  const workflows = (((await readCollection('sultan_workflows')) ?? []) as Workflow[])
    .map((workflow) => migrateWorkflow(workflow))
    .filter((workflow) => workflowMatchesMessage(workflow, { text, isNewConversation }));
  let replies = 0;
  for (const workflow of workflows) {
    const result = await runWorkflowGraph(workflow, conversation, workflow.triggerNextId, {
      createOrder: async (node, customer) =>
        (
          await executeCreateInvoice({
            customerName: customer,
            items: node.items ?? [],
            paid: node.paid === true,
            notes: `سير عمل «${workflow.name}»`,
          })
        ).message,
    });
    replies += result.replies;
    const runs = [
      { at: Date.now(), detail: `محادثة ${conversation.customerName} — ${result.steps} عقدة` },
      ...workflow.runs,
    ].slice(0, 20);
    await upsertRecord('sultan_workflows', { ...workflow, runs } as unknown as Record<string, unknown>);
  }
  return replies;
}

// اسم المتجر من الإعدادات المزامنة — يظهر في ترويسة صفحة العميل الثابتة
async function loadStoreName(): Promise<string> {
  const settings = (await readSingleton('sultan_store_settings')) as { storeName?: string } | null;
  return settings?.storeName?.trim() || 'متجر قطن سلطان';
}

// GET /api/chat?id=... — استرجاع محادثة العميل لمتابعتها من جهازه (معرّف غير قابل للتخمين)
// GET /api/chat (بدون id) — إعدادات الواجهة العامة: اسم المتجر واسم الوكيل الافتراضي
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  const storeName = await loadStoreName();
  if (!id) {
    const agents = await loadAgentsServer();
    const defaultAgent =
      agents.find((agent) => agent.isDefault && agent.autoReply) ?? agents.find((agent) => agent.autoReply) ?? agents[0];
    return NextResponse.json({ storeName, agentName: defaultAgent?.name ?? 'مساعد المتجر' });
  }
  const conversation = await readConversation(id);
  if (!conversation) return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  const agent = await pickAgent(conversation);
  return NextResponse.json({ conversation, agentName: agent.name, storeName });
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

  // الوكيل: المخصص للمحادثة (عقدة تعيين وكيل) أو الافتراضي
  const agent = await pickAgent(conversation);

  // رسالة ترحيب عند أول رسالة من العميل في محادثة جديدة
  if (isNew && agent.autoReply && agent.openingMessage.trim()) {
    conversation.messages.push(message(agent.openingMessage.trim(), 'shop', 'agent'));
  }

  let reply: string | null = null;
  if (agent.autoReply) {
    // سير العمل المطابقة أولاً، وإلا رد الوكيل (مع أدوات مهارة الطلبات عند تفعيلها)
    const workflowReplies = await applyWorkflows(conversation, text, isNew);
    if (workflowReplies === 0) {
      const history: ChatMessage[] = conversation.messages
        .slice(-MAX_HISTORY)
        .filter((item) => item.sender !== 'system') // رسائل النظام الداخلية لا تُمرَّر للنموذج
        .map((item) => ({
          role: item.sender === 'customer' ? ('user' as const) : ('assistant' as const),
          content: item.content,
        }));
      const result = await runAgent(agent, customerName, history, agent.skills.orders === true);
      reply = result.text;
      for (const note of result.notes) {
        conversation.messages.push(message(note, 'system', 'workflow'));
      }
      if (reply) conversation.messages.push(message(reply, 'shop', 'agent'));
    }
  }
  if (!reply && !agent.autoReply) {
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
    storeName: await loadStoreName(),
    messages: conversation.messages.slice(-50),
  });
}
