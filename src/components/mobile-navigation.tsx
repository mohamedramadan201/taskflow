"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmailInboxBadge } from "@/components/email-inbox-badge";
import { NavigationIcon, type NavigationIconName } from "@/components/navigation-icon";
import { NotificationBadge } from "@/components/notification-badge";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

type MobileLink = { key: string; href: string; label: string; icon: NavigationIconName };
type WorkspaceOption = { id: string; name: string; slug: string };

export function MobileNavigation({ links, active, workspaceSlug, workspaces }: { links: readonly MobileLink[]; active: string; workspaceSlug: string; workspaces: WorkspaceOption[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !menuRef.current) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>("a, button, input, select")).filter((item) => !item.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("keydown", trapFocus);
    menuRef.current?.querySelector<HTMLElement>("button, a, input, select")?.focus();
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("keydown", trapFocus); document.body.style.overflow = previousOverflow; trigger?.focus(); };
  }, [open]);

  return <>
    <header className="mobile-app-header">
      <button ref={triggerRef} type="button" className="mobile-menu-trigger" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation-drawer" onClick={() => setOpen((value) => !value)}><NavigationIcon name={open ? "close" : "menu"} size={26} /></button>
      <Link href={"/board?workspace=" + workspaceSlug} className="mobile-brand"><span>✓</span><strong>TaskFlow</strong></Link>
      <Link href="/notifications" className="mobile-header-notifications" aria-label="Open notifications"><NavigationIcon name="notifications" size={25} /><NotificationBadge /></Link>
    </header>
    {open && <div className="mobile-navigation-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <aside ref={menuRef} id="mobile-navigation-drawer" className="mobile-navigation-drawer" role="dialog" aria-modal="true" aria-label="TaskFlow navigation" onClick={(event) => event.stopPropagation()}>
        <div className="mobile-drawer-brand"><span>✓</span><strong>TaskFlow</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><NavigationIcon name="close" size={22} /></button></div>
        {workspaces.length > 0 && <WorkspaceSwitcher workspaces={workspaces} currentSlug={workspaceSlug} />}
        <nav aria-label="Mobile navigation">{links.map((link) => <Link key={link.key} className={active === link.key ? "active" : ""} aria-current={active === link.key ? "page" : undefined} href={link.href} onClick={() => setOpen(false)}><NavigationIcon name={link.icon} /><span>{link.label}</span>{link.key === "emails" && <EmailInboxBadge workspaceSlug={workspaceSlug} />}{link.key === "notifications" && <NotificationBadge />}</Link>)}</nav>
      </aside>
    </div>}
  </>;
}
