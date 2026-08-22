import Link from "next/link";
import { logout } from "@/app/actions";
import { NotificationBadge } from "@/components/notification-badge";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { EmailInboxBadge } from "@/components/email-inbox-badge";
import { MobileNavigation } from "@/components/mobile-navigation";
import { NavigationIcon, type NavigationIconName } from "@/components/navigation-icon";
import type { Role } from "@/lib/permissions";

type WorkspaceOption = { id: string; name: string; slug: string; role?: Role; sidebarOrder?: number };

export function AppShell({ children, active, userName, workspaces, workspaceSlug }: { children: React.ReactNode; active: "board" | "emails" | "team" | "reports" | "notifications"; userName?: string | null; workspaces: WorkspaceOption[]; workspaceSlug?: string }) {
  const currentSlug = (workspaces.some((workspace) => workspace.slug === workspaceSlug) ? workspaceSlug : workspaces[0]?.slug) || "";
  const isOwner = workspaces.find((workspace) => workspace.slug === currentSlug)?.role === "OWNER";
  const links: [string, string, string, NavigationIconName][] = [["board", `/board?workspace=${currentSlug}`, "Tasks", "tasks"], ["emails", `/emails?workspace=${currentSlug}`, "Email Inbox", "email"], ["notifications", "/notifications", "Notifications", "notifications"]];
  if (isOwner) links.splice(2, 0, ["team", `/team?workspace=${currentSlug}`, "Team", "team"], ["reports", `/reports?workspace=${currentSlug}`, "Reports", "reports"]);
  const mobileLinks = links.map(([key, href, label, icon]) => ({ key, href, label, icon }));
  return <div className="app-shell"><aside className="sidebar"><Link href={`/board?workspace=${currentSlug}`} className="brand"><span>✓</span><strong>TaskFlow</strong></Link>{workspaces.length > 0 && <WorkspaceSwitcher workspaces={workspaces} currentSlug={currentSlug} />}<nav aria-label="Primary navigation">{links.map(([key, href, label, icon]) => <Link className={active === key ? "active" : ""} aria-current={active === key ? "page" : undefined} href={href} key={key}><span className="nav-icon"><NavigationIcon name={icon} /></span><span>{label}</span>{key === "emails" && <EmailInboxBadge workspaceSlug={currentSlug} />}{key === "notifications" && <NotificationBadge />}</Link>)}</nav><div className="profile"><span className="avatar">{userName?.[0] || "U"}</span><div><strong>{userName || "TaskFlow user"}</strong><small>{workspaces.find((workspace) => workspace.slug === currentSlug)?.name || "Space"}</small></div><form action={logout}><button title="Sign out">Sign out</button></form></div></aside><MobileNavigation links={mobileLinks} active={active} workspaceSlug={currentSlug} workspaces={workspaces} /><main className="main-content">{children}</main></div>;
}
