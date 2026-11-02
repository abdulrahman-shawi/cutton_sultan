// components/agents/types.ts — إعدادات وكيل الذكاء الاصطناعي الذي يحادب العملاء (تخزين محلي)
export type AgentTone = 'ودود' | 'رسمي' | 'مختصر';

export interface AgentConfig {
  name: string; // اسم الوكيل — يوقّع به في المحادثات
  role: string; // صفته أمام العميل
  instructions: string; // توجيهات المالك: ماذا يقول الوكيل وكيف
  openingMessage: string; // رسالة الترحيب عند فتح محادثة جديدة
  tone: AgentTone; // نبرة الحديث
  autoReply: boolean; // الرد التلقائي على رسائل العملاء
}

export const AGENT_STORAGE_KEY = 'sultan_agent_config';

export const AGENT_TONES: AgentTone[] = ['ودود', 'رسمي', 'مختصر'];

export const DEFAULT_AGENT: AgentConfig = {
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
};
