// lib/agentPrompt.ts — بناء موجه نظام «وكيل العملاء» وملخّص الكتالوج (دوال نقية بلا وصول للتخزين
// تُستخدم على العميل من agentClient وعلى الخادم من مسار /api/chat مع بيانات مقروءة من قاعدة البيانات)
import type { AgentConfig } from '../components/agents/types';
import type { Product } from '../components/products/types';
import type { Customer } from '../components/customers/types';
import type { Invoice } from '../components/invoices/types';
import type { Offer } from '../components/offers/types';

// عروض المتجر المفعّلة سطراً واحداً لكل عرض — يذكرها الوكيل للعميل عند السؤال عن العروض
export function buildOffersDigest(offers: Offer[]): string {
  const active = offers.filter((offer) => offer.active);
  if (active.length === 0) return '';
  return active
    .map((offer) => {
      const value = offer.discountType === 'percent' ? `خصم ${offer.discountValue}٪` : `خصم ${offer.discountValue} ل.س`;
      return `- ${offer.title}: ${value}${offer.description ? ` — ${offer.description}` : ''}`;
    })
    .join('\n');
}

// كتالوج مضغوط يُعرض على الوكيل فيردّ على استفسارات العملاء عن المنتجات والأسعار والتوفر.
// ترتيب ذكي: المنتجات المتوفرة أولاً (حسب مجموع مخزونها) فلا يختفي صنف كامل بسبب قصّ القائمة،
// وكل تفصيلة متوفرة تُدرج كاملة — القصّ القديم بحدّ 60 تفصيلة كان يخفي بقية المنتجات عن الوكيل.
export function buildCatalogDigestFromProducts(products: Product[], maxProducts = 200): string {
  if (products.length === 0) return '(لا توجد منتجات مسجلة بعد)';

  const ranked = products
    .map((product) => ({
      product,
      inStock: product.entries.filter((entry) => entry.quantity > 0),
      outStock: product.entries.filter((entry) => entry.quantity <= 0),
    }))
    .sort((a, b) => {
      const aTotal = a.inStock.reduce((sum, entry) => sum + entry.quantity, 0);
      const bTotal = b.inStock.reduce((sum, entry) => sum + entry.quantity, 0);
      if (aTotal > 0 && bTotal === 0) return -1;
      if (aTotal === 0 && bTotal > 0) return 1;
      return bTotal - aTotal;
    });

  const lines: string[] = [];
  const GLOBAL_LINE_CAP = 1500; // سقف أمان إجمالي — نادراً ما يُبلَّغ في المتاجر العادية
  let usedProducts = 0;

  for (const { product, inStock, outStock } of ranked) {
    if (usedProducts >= maxProducts || lines.length >= GLOBAL_LINE_CAP) break;
    const total = inStock.reduce((sum, entry) => sum + entry.quantity, 0);
    const priceSet = new Map<string, boolean>();
    for (const entry of product.entries) {
      priceSet.set(`${entry.salePrice} ${entry.currency === 'USD' ? '$' : 'ل.س'}`, true);
    }
    const prices = Array.from(priceSet.keys()).slice(0, 4).join(' / ');
    lines.push(
      `▪ ${product.name} — موديل ${product.modelNumber || '—'} — السعر: ${prices}${priceSet.size > 4 ? ' ...' : ''} — المتوفر: ${total} قطعة`
    );
    usedProducts++;

    if (inStock.length === 0) {
      lines.push(`   (نفد حالياً — ${outStock.length} تفصيلة بكمية صفر)`);
      continue;
    }
    for (const entry of inStock) {
      if (lines.length >= GLOBAL_LINE_CAP) break;
      const variant = [entry.color, entry.size].filter(Boolean).join(' / ');
      lines.push(
        `   · ${variant || 'بدون تفصيلة'} — ${entry.salePrice} ${entry.currency === 'USD' ? '$' : 'ل.س'} — ${entry.quantity} قطعة`
      );
    }
    if (outStock.length > 0) {
      lines.push(`   · (نفد من هذا المنتج أيضاً: ${outStock.length} تفصيلة)`);
    }
  }
  return lines.join('\n');
}

// سياق العميل: إجمالي مشترياته ومتبقي ذمته من فواتير المقبوضات — ليذكّر الوكيل الرصيد عند الحاجة
export function buildCustomerContextFromData(customerName: string, customers: Customer[], invoices: Invoice[]): string {  if (!customerName.trim()) return '';
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
  customerContext: string,
  offersDigest = ''
): string {
  return [
    `أنت «${config.name}» — ${config.role} في متجر «قطن سلطان» للأقمشة والمنتجات القطنية.`,
    'تمثّل المحل في محادثة مع عميل عبر الرسائل. مهمتك الرد على استفساراته ومساعدته في اختيار المنتجات.',
    '',
    '## توجيهات المالك لك (التزم بها حرفياً):',
    config.instructions.trim() || '(لا توجد توجيهات خاصة — تصرّف بما يليق بخدمة العملاء)',
    '',
    `## نبرة الحديث المطلوبة: ${config.tone}`,
    ...(config.skills?.orders
      ? [
          '',
          '## مهارة استقبال الطلبات مفعّلة — عند رغبة العميل بالشراء:',
          '- إذا عبّر العميل عن رغبة بالشراء («أريد طلبية»، «بدي أشتري»، «اطلب»...) فأنت تستطيع تنفيذ الطلب فوراً بأداتيك: أنشئ العميل إن كان جديداً، ثم أنشئ فاتورة المقبوضات.',
          '- اجمع البنود أولاً: اسم المنتج كما ورد في القائمة أعلاه حرفياً، والتفصيلة (لون/مقاس) إن اختارها، والكمية — والسعر من القائمة لا من عندك.',
          '- اسأل سؤالاً واحداً عن طريقة الدفع: كاش الآن أم ذمة (آجل)؟ ثم مرّر paid=true للكاش وpaid=false للذمة.',
          '- قبل التنفيذ لخّص للعميل البنود والإجمالي بجملة واحدة. بعد التنفيذ أكّد: رقم الفاتورة، الإجمالي، وحالة الدفع.',
        ]
      : []),
    ...(offersDigest
      ? [
          '',
          '## عروض المتجر الحالية (اذكرها للعميل عند سؤاله عن العروض أو قبل إتمام طلبه):',
          offersDigest,
        ]
      : []),
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
    '2. قائمة المنتجات أعلاه هي مصدر الحقيقة الوحيد — ابحث فيها كاملة قبل أي حكم. ممنوع اختراع منتجات أو أسعار.',
    '3. إذا طلب العميل صنفاً ولم تجده بالاسم نفسه، فابحث عن أقرب معنى (مثال: «سليب» قد يكون مسجلاً «شرعي» أو «فانيلا» أو «بنطال» — والعكس). لا تقل «لا يوجد» أبداً قبل أن تعرض ما لديك من أصناف مشابهة متوفرة، وإن لم يوجد شيء قريب اعرض أشهر المنتجات المتوفرة بديلاً.',
    '4. علامة «(نفد حالياً)» تعني أن المنتج مسجل لكن كميته صفر — إذا سأل عنه فأخبره أنه نفد مؤخراً واقترح بديلاً متوفراً، لا أنه غير موجود أصلاً.',
    '5. لا تذكر أرقام حسابات أو مصاريف المحل، ولا تعد بخصومات أو أسعار غير موجودة في القائمة.',
    '6. إذا سأل العميل عن رصيده أو ذمته فأجبه بالأرقام الواردة في بياناته أعلاه فقط.',
    '7. عند انتهاء الحاجة، أغلق الحوار بجملة مهذبة قصيرة.',
  ].join('\n');
}
