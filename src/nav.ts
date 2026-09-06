// Shared navigation definition, imported by App (routing) and AppShell (sidebar).

export type Page = "overview" | "moderation" | "users" | "legal" | "map";

export type NavItem = { key: string; label: string; live: boolean };

export const NAV: NavItem[] = [
  { key: "overview", label: "Overview", live: true },
  { key: "map", label: "Map", live: true },
  { key: "moderation", label: "Moderation", live: true },
  { key: "users", label: "Users", live: true },
  { key: "legal", label: "Legal", live: true },
  { key: "campaigns", label: "Campaigns", live: false },
  { key: "payouts", label: "Payouts", live: false },
];
