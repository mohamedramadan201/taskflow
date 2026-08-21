"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).then(() => {
        if (!("caches" in window)) return;
        return window.caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("taskflow-shell-")).map((key) => window.caches.delete(key))));
      });
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => registration.update());
  }, []);
  return null;
}
