import { loadEnvFile } from "node:process";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const users = [
  ["owner@taskflow.local", "Omar Owner", "OWNER"],
  ["admin@taskflow.local", "Amira Admin", "ADMIN"],
  ["member@taskflow.local", "Mina Member", "MEMBER"],
  ["viewer@taskflow.local", "Vera Viewer", "VIEWER"],
] as const;

async function main() {
  const passwordHash = await hash("Taskflow123!", 12);
  const workspace = await prisma.workspace.upsert({ where: { slug: "taskflow-demo" }, update: {}, create: { name: "Product Launch", slug: "taskflow-demo" } });
  const seeded = [];
  for (const [email, name, role] of users) {
    const user = await prisma.user.upsert({ where: { email }, update: { name, passwordHash }, create: { email, name, passwordHash } });
    await prisma.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } }, update: { role }, create: { workspaceId: workspace.id, userId: user.id, role } });
    seeded.push(user);
  }
  if ((await prisma.task.count({ where: { workspaceId: workspace.id } })) === 0) {
    await prisma.task.createMany({ data: [
      { workspaceId: workspace.id, title: "Finalize launch brief", description: "Align scope, owners and success metrics.", status: "IN_PROGRESS", priority: "HIGH", createdByUserId: seeded[0].id, assigneeUserId: seeded[2].id },
      { workspaceId: workspace.id, title: "QA onboarding journey", description: "Test the new account checklist end to end.", status: "TODO", priority: "URGENT", createdByUserId: seeded[1].id, assigneeUserId: seeded[1].id },
      { workspaceId: workspace.id, title: "Publish release notes", status: "DONE", priority: "MEDIUM", createdByUserId: seeded[0].id, assigneeUserId: seeded[2].id },
    ] });
  }
  console.log(`Seeded ${workspace.slug}; demo password: Taskflow123!`);
}
main().finally(() => prisma.$disconnect());
