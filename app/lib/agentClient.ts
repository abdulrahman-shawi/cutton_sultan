// lib/agentClient.ts — نسخ الوكيل المرتبطة بالتخزين المحلي: قائمة الوكلاء تتزامن تلقائياً مع الخادم
// (ليستخدمها مسار /api/chat مع العملاء الحقيقيين) مع ترحيل إعدادات الوكيل القديمة المفردة إن وُجدت
import { loadData, saveData } from './data';
import {
  buildAgentSystemPrompt,
  buildCatalogDigestFromProducts,
  buildCustomerContextFromData,
} from './agentPrompt';
import { AGENTS_STORAGE_KEY, createAgent, type AgentConfig } from '../components/agents/types';
import type { Product } from '../components/products/types';
import type { Customer } from '../components/customers/types';
import type { Invoice } from '../components/invoices/types';

const LEGACY_SETTINGS_KEY = 'sultan_store_settings';

interface LegacySettings {
  agentConfig?: Partial<AgentConfig>;
}

// قراءة قائمة الوكلاء — مع ترحيل نسخة الوكيل الواحد القديمة (داخل إعدادات المتجر) إلى وكيل افتراضي
export function loadAgents(): AgentConfig[] {
  const agents = loadData<AgentConfig[]>(AGENTS_STORAGE_KEY);
  if (Array.isArray(agents) && agents.length > 0) {
    return agents.map((agent) => ({
      ...createAgent(),
      ...agent,
      skills: agent.skills && typeof agent.skills.orders === 'boolean' ? agent.skills : { orders: true },
    }));
  }
  const legacy = loadData<LegacySettings>(LEGACY_SETTINGS_KEY)?.agentConfig;
  const migrated = [createAgent({ ...legacy, isDefault: true })];
  saveAgents(migrated);
  return migrated;
}

export function saveAgents(agents: AgentConfig[]): void {
  saveData(AGENTS_STORAGE_KEY, agents);
}

// الوكيل الذي يخدم صفحة العملاء العامة: المحدد افتراضياً، أو أول وكيل مفعّل للرد التلقائي
export function loadDefaultAgent(agents: AgentConfig[]): AgentConfig {
  return (
    agents.find((agent) => agent.isDefault && agent.autoReply) ??
    agents.find((agent) => agent.autoReply) ??
    agents[0]
  );
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
