// lib/agentPrompt.ts — بناء موجه نظام «وكيل العملاء» وملخّص الكتالوج (دوال نقية بلا وصول للتخزين
// تُستخدم على العميل من agentClient وعلى الخادم من مسار /api/chat مع بيانات مقروءة من قاعدة البيانات)
import type { AgentConfig } from '../components/agents/types';
import type { Product } from '../components/products/types';
import type { Customer } from '../components/customers/types';
import type { Invoice } from '../components/invoices/types';

// كتالوج مضغوط يُعرض على الوكيل فيردّ على استفسارات العملاء عن المنتجات والأسعار والتوفر
export function buildCatalogDigestFromProducts(products: Product[], limit = 60): string {
  const lines: string[] = [];
  let used = 0;
  for (const product of products) {
    if (used >= limit) break;
    for (const entry of product.entries) {
      if (used >= limit) break;
      const variant = [entry.color, entry.size].filter(Boolean).join(' / ');
      lines.push(
        `- ${product.name}${variant ? ` (${variant})` : ''} — موديل ${product.modelNumber || '—'} — ` +
          `${entry.salePrice} ${entry.currency === 'USD' ? '$' : 'ل.س'} — المتوفر: ${entry.quantity} قطعة`
      );
      used++;
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(لا توجد منتجات مسجلة بعد)';
}

// سياق العميل: إجمالي مشترياته ومتبقي ذمته من فواتير المقبوضات — ليذكّر الوكيل الرصيد عند الحاجة
export function buildCustomerContextFromData(customerName: string, customers: Customer[], invoices: Invoice[]): string {
  if (!customerName.trim()) return '';
  const customer = customers.find((item) => item.name.trim() === customerName.trim());
  const rows = invoices.filter(
    (invoice) => invoice.type === 'مقبوضات' && invoice.partyName.trim() === customerName.trim()
  );
  if (rows.length === 0) return '';
  let totalSyp = 0;
  let totalUsd = 0;
  let remainingSyp = 0;
  let remainingUsd = 0;
  for (const invoice of rows) {
    totalSyp += invoice.totalSyp;
    totalUsd += invoice.totalUsd;
    remainingSyp += invoice.remainingSyp;
    remainingUsd += invoice.remainingUsd;
  }
  const parts = [`إجمالي مشترياته من المحل: ${Math.round(totalSyp)} ل.س و ${Math.round(totalUsd * 100) / 100} $`];
  if (remainingSyp > 0 || remainingUsd > 0) {
    parts.push(`متبقٍ عليه (ذمة غير مسددة): ${Math.round(remainingSyp)} ل.س و ${Math.round(remainingUsd * 100) / 100} $`);
  }
  if (customer?.phone) parts.push(`هاتفه: ${customer.phone}`);
  return parts.join(' — ');
}

// موجه الوكيل الكامل: هويته + توجيهات المالك + كتالوج المتجر + سياق العميل الحالي
export function buildAgentSystemPrompt(
  config: AgentConfig,
  customerName: string,
  catalog: string,
  customerContext: string
): string {
  return [
    `أنت «${config.name}» — ${config.role} في متجر «قطن سلطان» للأقمشة والمنتجات القطنية.`,
    'تمثّل المحل في محادثة مع عميل عبر الرسائل. مهمتك الرد على استفساراته ومساعدته في اختيار المنتجات.',
    '',
    '## توجيهات المالك لك (التزم بها حرفياً):',
    config.instructions.trim() || '(لا توجد توجيهات خاصة — تصرّف بما يليق بخدمة العملاء)',
    '',
    `## نبرة الحديث المطلوبة: ${config.tone}`,
    '',
    '## منتجات المتجر المتوفرة (الاسم — الموديل — السعر — المتوفر):',
    catalog,
    '',
    customerContext
      ? `## بيانات العميل الذي تتحدث معه الآن: ${customerName} — ${customerContext}`
      : `## العميل الذي تتحدث معه الآن: ${customerName}`,
    '',
    '## قواعد صارمة:',
    '1. أجب باللغة العربية فقط، بأسلوب موجز وودود يناسب الرسائل النصية القصيرة (فقرة أو فقرتان كحد أقصى).',
    '2. استخدم فقط الأسماء والأسعار والكميات الواردة في قائمة المنتجات أعلاه — ممنوع اختراع منتجات أو أسعار. إذا لم يتوفر المنتج فقل ذلك بوضوح واقترح أقرب بديل من القائمة.',
    '3. لا تذكر أرقام حسابات أو مصاريف المحل، ولا تعد بخصومات أو أسعار غير موجودة في القائمة.',
    '4. إذا سأل العميل عن رصيده أو ذمته فأجبه بالأرقام الواردة في بياناته أعلاه فقط.',
    '5. عند انتهاء الحاجة، أغلق الحوار بجملة مهذبة قصيرة.',
  ].join('\n');
}
