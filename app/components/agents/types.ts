// components/agents/types.ts — وكلاء الذكاء الاصطناعي (عدة وكلاء، أحدهم افتراضي يخدم صفحة العملاء)
export type AgentTone = 'ودود' | 'رسمي' | 'مختصر';

// مهارات الوكيل الإجرائية: ماذا يستطيع أن ينفّذ فعلاً أثناء المحادثة
export interface AgentSkills {
  orders: boolean; // استقبال الطلبات: جمع البنود وتسجيل العميل وإنشاء فاتورة مقبوضات
}

export interface AgentConfig {
  id: string;
  name: string; // اسم الوكيل — يوقّع به في المحادثات
  role: string; // صفته أمام العميل
  instructions: string; // توجيهات المالك: ماذا يقول الوكيل وكيف
  openingMessage: string; // رسالة الترحيب عند فتح محادثة جديدة
  tone: AgentTone; // نبرة الحديث
  autoReply: boolean; // الرد التلقائي على رسائل العملاء
  isDefault: boolean; // الوكيل الافتراضي الذي يخدم صفحة العملاء العامة
  skills: AgentSkills;
}

export const AGENT_TONES: AgentTone[] = ['ودود', 'رسمي', 'مختصر'];

export const DEFAULT_AGENT: Omit<AgentConfig, 'id'> = {
  name: 'مساعد سلطان',
  role: 'مندوب خدمة العملاء',
  instructions: [
    'رحّب بالعميل باسمه وأخبره أنك من متجر قطن سلطان للأقمشة.',
    'أجب عن أسعار المنتجات وتوفرها من قائمة المنتجات فقط، واقترح بدائل قريبة عند نفاد صنف.',
    'إذا سأل عن رصيده أو ذمته فاذكر الرقم المسجل لديك فقط دون إضافة أو وعد بمهل.',
    'لا تعد بخصومات، ولا تحجز بضاعة، والتزم بالأسعار المعروضة.',
  ].join('\n'),
  openingMessage: 'أهلاً بك في متجر قطن سلطان 🌟 أنا مساعدك الذكي — اسألني عن الأقمشة المتوفرة والأسعار.',
  tone: 'ودود',
  autoReply: true,
  isDefault: true,
  skills: { orders: true },
};

export function createAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return { ...DEFAULT_AGENT, id: crypto.randomUUID(), isDefault: false, ...overrides };
}

export const AGENTS_STORAGE_KEY = 'sultan_agents';
