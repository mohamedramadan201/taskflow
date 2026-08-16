"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NotificationActions({ unread }: { unread: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  if (!unread) return null;

  async function markAllRead() {
    setSaving(true);
    const response = await fetch("/api/notifications/read-all", { method: "POST" });
    setSaving(false);
    if (response.ok) router.refresh();
  }

  return <button type="button" className="ghost-button notification-read-button" disabled={saving} onClick={markAllRead}>{saving ? "Marking..." : `Mark all read (${unread})`}</button>;
}
