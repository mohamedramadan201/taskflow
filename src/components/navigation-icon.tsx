export type NavigationIconName = "tasks" | "email" | "team" | "reports" | "notifications" | "menu" | "close";

const paths: Record<NavigationIconName, React.ReactNode> = {
  tasks: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></>,
  email: <><path d="M4 6.5h16v11H4z" /><path d="m4.5 7 7.5 6 7.5-6" /></>,
  team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.5-3 2.4-4.5 5.5-4.5s5 1.5 5.5 4.5M14 14.8c2.8-.6 5.3.7 6 3.2" /></>,
  reports: <><path d="M5 20V11M12 20V5M19 20v-8" /><path d="M3 20.5h18" /></>,
  notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
};

export function NavigationIcon({ name, size = 20 }: { name: NavigationIconName; size?: number }) {
  return <svg className="navigation-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
