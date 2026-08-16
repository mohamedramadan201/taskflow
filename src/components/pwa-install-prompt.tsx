"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("taskflow-pwa-install-dismissed") === "1");
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)) return;
    if (window.localStorage.getItem("taskflow-pwa-install-dismissed") === "1") return;
    const handleBeforeInstall = (nextEvent: Event) => { nextEvent.preventDefault(); setEvent(nextEvent as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);
  if (!event || dismissed) return null;
  async function install() { await event?.prompt(); const choice = await event?.userChoice; if (choice?.outcome === "accepted") setEvent(null); }
  function dismiss() { window.localStorage.setItem("taskflow-pwa-install-dismissed", "1"); setDismissed(true); }
  return <aside className="pwa-install-prompt" role="status"><div><strong>Install TaskFlow</strong><span>Open your workspace faster from your home screen.</span></div><button className="primary-button small" onClick={() => void install}>Install</button><button className="pwa-install-dismiss" onClick={dismiss} aria-label="Dismiss install prompt">×</button></aside>;
}
