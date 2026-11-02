// lib/agentClient.ts — نسخ الوكيل المرتبطة بالتخزين المحلي: قراءة إعداداته من إعدادات المتجر
// (تتزامن تلقائياً مع الخادم ليستخدمها مسار /api/chat مع العملاء الحقيقيين) وبناء موجهه من بيانات الجهاز
import { loadData, saveData } from './data';
import {
  buildAgentSystemPrompt,
  buildCatalogDigestFromProducts,
  buildCustomerContextFromData,
} from './agentPrompt';
import { DEFAULT_AGENT, type AgentConfig } from '../components/agents/types';
import type { Product } from '../components/products/types';
import type { Customer } from '../components/customers/types';
import type { Invoice } from '../components/invoices/types';

const SETTINGS_KEY = 'sultan_store_settings';

interface SettingsWithAgent {
  agentConfig?: Partial<AgentConfig>;
}

export function loadAgentConfig(): AgentConfig {
  const settings = loadData<SettingsWithAgent>(SETTINGS_KEY);
  return { ...DEFAULT_AGENT, ...(settings?.agentConfig ?? {}) };
}

// الحفظ دمجي: بقية مفاتيح إعدادات المتجر (الاسم/سعر الصرف...) لا تُمس
export function saveAgentConfig(config: AgentConfig): void {
  const settings = loadData<Record<string, unknown>>(SETTINGS_KEY) ?? {};
  saveData(SETTINGS_KEY, { ...settings, agentConfig: config });
}

export function buildAgentSystemPromptLocal(config: AgentConfig, customerName: string): string {
  const products = loadData<Product[]>('sultan_products') ?? [];
  const customers = loadData<Customer[]>('sultan_customers') ?? [];
  const invoices = loadData<Invoice[]>('sultan_invoices') ?? [];
  return buildAgentSystemPrompt(
    config,
    customerName,
    buildCatalogDigestFromProducts(products),
    buildCustomerContextFromData(customerName, customers, invoices)
  );
}
