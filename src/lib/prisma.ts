import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Diagnostic utility to test PostgreSQL connectivity
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  databaseUrl?: string;
}> {
  try {
    // Quick query to verify database response
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (err: any) {
    const rawUrl = process.env.DATABASE_URL || "";
    // Mask password in database URL for safe display
    const maskedUrl = rawUrl.replace(/:([^:@]+)@/, ":*****@");
    
    return {
      connected: false,
      error: err?.message || "Could not connect to PostgreSQL database.",
      databaseUrl: maskedUrl,
    };
  }
}

