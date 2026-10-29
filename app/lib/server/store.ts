// lib/server/store.ts — عميل Prisma الموحّد + سجل التدقيق (المخزن نفسه في entities.ts)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function logAudit(userId: string | null, action: string, detail = ''): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { userId, action, detail: detail.slice(0, 500) } });
  } catch {
    // السجل اختياري — لا نعطل العمليات بسببه
  }
}
