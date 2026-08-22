import { execFileSync } from "node:child_process";

const isProductionDeployment = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
const explicitlyEnabled = process.env.RUN_DB_MIGRATIONS === "true";

if (!isProductionDeployment && !explicitlyEnabled) {
  console.log("Skipping production database migrations outside a production deployment.");
  process.exit(0);
}

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  throw new Error("Production database migrations require DATABASE_URL or DIRECT_URL.");
}

console.log("Applying pending Prisma migrations...");
execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
