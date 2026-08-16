import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPool?: Pool };
function createClient() {
  // Local development is a persistent Node process, so Supabase's session-mode
  // pooler is the appropriate IPv4 endpoint. Deployed/serverless runtimes keep
  // using the transaction-mode DATABASE_URL.
  const connectionString = process.env.NODE_ENV === "development"
    ? process.env.DIRECT_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const defaultPoolSize = process.env.NODE_ENV === "development" ? 2 : 5;
  const configuredPoolSize = Number(process.env.DATABASE_POOL_SIZE ?? defaultPoolSize);
  const max = Number.isInteger(configuredPoolSize) && configuredPoolSize > 0 ? configuredPoolSize : defaultPoolSize;
  const pool = globalForPrisma.prismaPool ?? new Pool({
    connectionString,
    max,
    min: 0,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 300,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    application_name: "taskflow",
  });
  pool.on("error", (error) => console.warn("Database pool discarded an idle connection:", error.message));
  if (process.env.NODE_ENV !== "production") globalForPrisma.prismaPool = pool;
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /connection terminated|connection timeout|econnreset|econnrefused|57p01|0800[036]/i.test(message);
}

export async function withDatabaseRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return operation();
  }
}
