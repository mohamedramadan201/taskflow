import type { Metadata } from "next";
import "./globals.css";
import "./readability.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "TaskFlow — Clear work, faster teams",
  description: "Manage tasks and workspaces with clear permissions and reliable reminders.",
  openGraph: { title: "TaskFlow — Clear work, faster teams", description: "Manage tasks and workspaces with clear permissions and reliable reminders.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "TaskFlow — Clear work, faster teams", description: "Manage tasks and workspaces with clear permissions and reliable reminders.", images: ["/og.png"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en" dir="ltr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
