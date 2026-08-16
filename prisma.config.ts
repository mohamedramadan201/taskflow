import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL || env("DATABASE_URL") },
});
