"use client";

import Link from "next/link";
import { useState } from "react";
import { EmailInboxBadge } from "@/components/email-inbox-badge";
import { NotificationBadge } from "@/components/notification-badge";

type MobileLink = { key: string; href: string; label: string; shortLabel: string };

export function MobileNavigation({ links, active, workspaceSlug }: { links: readonly MobileLink[]; active: string; workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const primary = links.filter((link) => ["board", "emails", "reports", "notifications"].includes(link.key));
  const more = links.filter((link) => !primary.some((item) => item.key === link.key));

  return <>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {primary.map((link) => <Link key={link.key} className={active === link.key ? "active" : ""} aria-current={active === link.key ? "page" : undefined} href={link.href}><span className="mobile-nav-icon" aria-hidden="true">{link.shortLabel}{link.key === "emails" && <EmailInboxBadge workspaceSlug={workspaceSlug} />}{link.key === "notifications" && <NotificationBadge />}</span><small>{link.label === "Email Inbox" ? "Email" : link.label}</small></Link>)}
      <button type="button" className={open ? "active" : ""} aria-expanded={open} aria-controls="mobile-more-menu" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">•••</span><small>More</small></button>
    </nav>
    {open && <div className="mobile-more-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section id="mobile-more-menu" className="mobile-more-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" onClick={(event) => event.stopPropagation()}>
        <div className="mobile-more-handle" aria-hidden="true" />
        <div className="mobile-more-header"><div><span className="eyebrow">TASKFLOW</span><h2 id="mobile-more-title">More</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close menu">×</button></div>
        <nav aria-label="More navigation">{more.map((link) => <Link key={link.key} className={active === link.key ? "active" : ""} href={link.href} onClick={() => setOpen(false)}>{link.label}<span aria-hidden="true">›</span></Link>)}</nav>
      </section>
    </div>}
  </>;
}
