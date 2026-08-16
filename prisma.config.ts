import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Local Prisma commands use .env, while Vercel injects environment variables
// directly and does not provide a filesystem .env file during builds.
if (existsSync(".env")) loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL || env("DATABASE_URL") },
});
