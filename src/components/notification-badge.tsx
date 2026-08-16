"use client";

import { useEffect, useState } from "react";

export function NotificationBadge() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notifications?limit=100", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((items: Array<{ readAt: string | null }>) => setUnread(items.filter((item) => !item.readAt).length))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!unread) return null;
  return <span className="notification-badge" aria-label={`${unread} unread notifications`}>{unread > 99 ? "99+" : unread}</span>;
}
