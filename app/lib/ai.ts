// lib/ai.ts — عقد المساعد الذكي المشترك بين العميل والخادم: أنواع الرسائل، مخططات الأدوات، وموجّه النظام
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: AiToolCall[];
}

export interface AiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

// الأدوات التي ينفذها العميل محلياً عبر طبقة البيانات (فتح localStorage والمزامنة تلقائياً للخادم).
// الخادم يمرر المخططات فقط إلى النموذج، والتنفيذ الفعلي يبقى في الواجهة بصلاحيات المستخدم نفسها.
export const AI_TOOLS: object[] = [
  {
    type: 'function',
    function: {
      name: 'create_invoice',
      description:
        'إنشاء فاتورة جديدة في النظام: مقبوضات (بيع لعميل)، مدفوعات (شراء من مورد)، أو مصاريف يومية. تُحسب الإجماليات تلقائياً من البنود.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['مقبوضات', 'مدفوعات', 'مصاريف يومية'] },
          partyName: { type: 'string', description: 'اسم العميل (للمقبوضات) أو المورد (للمدفوعات) — اختياري' },
          paid: { type: 'boolean', description: 'هل تُعتبر الفاتورة مدفوعة بالكامل؟ الافتراضي true' },
          notes: { type: 'string', description: 'ملاحظات — اختياري' },
          items: {
            type: 'array',
            description: 'بنود الفاتورة',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'اسم الصنف' },
                quantity: { type: 'number' },
                price: { type: 'number', description: 'سعر الوحدة' },
                currency: { type: 'string', enum: ['SYP', 'USD'] },
              },
              required: ['name', 'quantity', 'price', 'currency'],
            },
          },
        },
        required: ['type', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_journal_entries',
      description:
        'تسجيل قيد أو أكثر في دفتر اليومية: مقبوضات أو مدفوعات مع المبلغ والعملة والعدد والكمية والتاريخ.',
      parameters: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'تاريخ القيد بصيغة YYYY-MM-DD — الافتراضي اليوم' },
                description: { type: 'string', description: 'البيان' },
                type: { type: 'string', enum: ['مقبوضات', 'مدفوعات'] },
                amount: { type: 'number' },
                currency: { type: 'string', enum: ['SYP', 'USD'] },
                count: { type: 'integer', description: 'العدد — الافتراضي 0' },
                quantity: { type: 'integer', description: 'الكمية — الافتراضي 0' },
                notes: { type: 'string' },
              },
              required: ['description', 'type', 'amount', 'currency'],
            },
          },
        },
        required: ['entries'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_products',
      description:
        'إضافة منتج أو أكثر إلى المخزون، لكل منتج تفصيلة واحدة (لون/مقاس/كمية/سعر). يُطابق القسم والقسم الفرعي بالاسم.',
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                modelNumber: { type: 'string', description: 'رقم الموديل — اختياري' },
                categoryName: { type: 'string', description: 'اسم القسم — اختياري' },
                subcategoryName: { type: 'string', description: 'اسم القسم الفرعي — اختياري' },
                color: { type: 'string' },
                size: { type: 'string' },
                quantity: { type: 'number' },
                wholesalePrice: { type: 'number', description: 'سعر الجملة — الافتراضي سعر المبيعة' },
                salePrice: { type: 'number' },
                currency: { type: 'string', enum: ['SYP', 'USD'] },
              },
              required: ['name', 'quantity', 'salePrice', 'currency'],
            },
          },
        },
        required: ['products'],
      },
    },
  },
];

// موجّه النظام بالعربية: يشرح للنموذج شخصيته وبيانات المتجر المتاحة وقواعد استخدام الأدوات بدقة
export function buildSystemPrompt(digest: string): string {
  return [
    'أنت «مساعد سلطان» الذكي — مساعد مدمج في نظام إدارة متجر «قطن سلطان» للأقمشة والمنتجات القطنية.',
    '',
    '## بيانات المتجر المتاحة لك (ملخّص محدّث لحظة المحادثة):',
    digest || '(لا توجد بيانات بعد في النظام)',
    '',
    '## قواعدك الصارمة:',
    '1. أجب دائماً باللغة العربية وبأسلوب موجز وودود، واستخدم الأرقام العربية المشرقية (123) وليس المشرقية الحرفية.',
    '2. للإجابة عن الأسئلة (المبيعات، المخزون، العملاء...) استخدم فقط الأرقام الواردة في ملخّص البيانات أعلاه. ممنوع اختراع أرقام. إذا لم تكن المعلومة في الملخّص فقل بوضوح أنها غير متوفرة.',
    '3. عندما يطلب المستخدم إجراءً (إنشاء فاتورة، تسجيل مصاريف، إضافة منتجات...) استخدم الأداة المناسبة فوراً بمعطيات صحيحة مستخرجة من كلامه.',
    '4. قبل استدعاء الأداة تأكد أن المعطيات الجوهرية موجودة (نوع الفاتورة، البنود والأسعار، المبلغ...). إذا نقص معطى جوهري فاسأل سؤالاً قصيراً واحداً للتوضيح بدل التخمين.',
    '5. بعد نجاح الأداة أكّد للمستخدم بجملة قصيرة ما تم تنفيذه بالتحديد (رقم الفاتورة، المبلغ، عدد القيود/المنتجات). إذا فشل التنفيذ أوضح السبب بلطف.',
    '6. لا تحوّل بين العملتين إطلاقاً ما لم يعطك المستخدم سعر صرف صراحةً.',
    '7. التواريخ بصيغة YYYY-MM-DD. إذا لم يذكر المستخدم تاريخاً فهو اليوم.',
    '8. للمصاريف اليومية استخدم أداة create_invoice بنوع «مصاريف يومية»، وللمقبوضات والمدفوعات العادية استخدم create_journal_entries.',
  ].join('\n');
}
