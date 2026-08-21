import Link from "next/link";
import { logout } from "@/app/actions";
import { NotificationBadge } from "@/components/notification-badge";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { EmailInboxBadge } from "@/components/email-inbox-badge";
import { MobileNavigation } from "@/components/mobile-navigation";

type WorkspaceOption = { id: string; name: string; slug: string };

export function AppShell({ children, active, userName, workspaces, workspaceSlug = "taskflow-demo" }: { children: React.ReactNode; active: "board" | "emails" | "team" | "reports" | "notifications"; userName?: string | null; workspaces: WorkspaceOption[]; workspaceSlug?: string }) {
  const currentSlug = workspaces.some((workspace) => workspace.slug === workspaceSlug) ? workspaceSlug : workspaces[0]?.slug || workspaceSlug;
  const links = [["board", `/board?workspace=${currentSlug}`, "Tasks", "▤"], ["emails", `/emails?workspace=${currentSlug}`, "Email Inbox", "▱"], ["team", `/team?workspace=${currentSlug}`, "Team", "♧"], ["reports", `/reports?workspace=${currentSlug}`, "Reports", "▥"], ["notifications", "/notifications", "Notifications", "♧"]] as const;
  const mobileLinks = links.map(([key, href, label, shortLabel]) => ({ key, href, label, shortLabel }));
  return <div className="app-shell"><aside className="sidebar"><Link href={`/board?workspace=${currentSlug}`} className="brand"><span>✓</span><strong>TaskFlow</strong></Link>{workspaces.length > 0 && <WorkspaceSwitcher workspaces={workspaces} currentSlug={currentSlug} />}<nav aria-label="Primary navigation">{links.map(([key, href, label, icon]) => <Link className={active === key ? "active" : ""} aria-current={active === key ? "page" : undefined} href={href} key={key}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>{key === "emails" && <EmailInboxBadge workspaceSlug={currentSlug} />}{key === "notifications" && <NotificationBadge />}</Link>)}</nav><div className="profile"><span className="avatar">{userName?.[0] || "U"}</span><div><strong>{userName || "TaskFlow user"}</strong><small>{workspaces.find((workspace) => workspace.slug === currentSlug)?.name || "Space"}</small></div><form action={logout}><button title="Sign out">Sign out</button></form></div></aside><main className="main-content">{children}</main><MobileNavigation links={mobileLinks} active={active} workspaceSlug={currentSlug} /></div>;
}
