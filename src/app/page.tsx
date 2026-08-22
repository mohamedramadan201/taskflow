import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUserWorkspaces } from "@/lib/server/authorization";
export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaces = await listUserWorkspaces(session.user.id);
  if (!workspaces[0]) redirect("/login?error=no-workspace");
  redirect(`/board?workspace=${encodeURIComponent(workspaces[0].slug)}`);
}
