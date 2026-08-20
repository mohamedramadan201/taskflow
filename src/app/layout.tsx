import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";
import "./readability.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "TaskFlow — Clear work, faster teams",
  description: "Manage tasks and workspaces with clear permissions and reliable reminders.",
  openGraph: { title: "TaskFlow — Clear work, faster teams", description: "Manage tasks and workspaces with clear permissions and reliable reminders.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "TaskFlow — Clear work, faster teams", description: "Manage tasks and workspaces with clear permissions and reliable reminders.", images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#163f35",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const developmentServiceWorkerCleanup = process.env.NODE_ENV !== "production" ? "if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function (registrations) { registrations.forEach(function (registration) { registration.unregister(); }); }); if ('caches' in window) { caches.keys().then(function (keys) { keys.filter(function (key) { return key.indexOf('taskflow-shell-') === 0; }).forEach(function (key) { caches.delete(key); }); }); } }" : "";
  return (
    <html
      lang="en" dir="ltr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{developmentServiceWorkerCleanup && <script dangerouslySetInnerHTML={{ __html: developmentServiceWorkerCleanup }} />}<PwaRegister /><PwaInstallPrompt />{children}</body>
    </html>
  );
}
