"use client";
import { useEffect, useState } from "react";
export function EmailInboxBadge({ workspaceSlug }: { workspaceSlug: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => { let active = true; const load = () => fetch(`/api/emails/count?workspace=${encodeURIComponent(workspaceSlug)}`).then((response) => response.ok ? response.json() : null).then((value) => { if (active && value) setCount(value.count); }).catch(() => {}); const refresh = () => { void load(); }; void load(); const timer = setInterval(load, 15_000); window.addEventListener("taskflow:email-count-changed", refresh); return () => { active = false; clearInterval(timer); window.removeEventListener("taskflow:email-count-changed", refresh); }; }, [workspaceSlug]);
  return count ? <strong className="nav-count" aria-label={`${count} untriaged emails`}>{count > 99 ? "99+" : count}</strong> : null;
}
