// lib/server/store.ts — عميل Prisma الموحّد + سجل التدقيق + إعادة محاولة امتصاص استيقاظ قواعدة الخادم (Neon)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Can't reach database server") ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNRESET') ||
    message.includes('ECONNREFUSED') ||
    message.includes('P1001')
  );
}

// إعادة المحاولة عند استيقاظ قاعدة البيانات من السكون — 4 محاولات بفاصل تصاعدي قصير
export async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function logAudit(userId: string | null, action: string, detail = ''): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { userId, action, detail: detail.slice(0, 500) } });
  } catch {
    // السجل اختياري — لا نعطل العمليات بسببه
  }
}
