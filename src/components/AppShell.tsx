import { useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "./ui";

// Current + parked screens. Only "Overview" is live; the rest are shown as
// "soon" so the roadmap is visible without being built.
const NAV = [
  { label: "Overview", live: true },
  { label: "Moderation", live: false },
  { label: "Campaigns", live: false },
  { label: "Payouts", live: false },
];

function BrandMark() {
  // Official Roots wordmark (transparent PNG in /public).
  return <img src="/roots_wordmark.png" alt="Roots" className="h-8 w-auto" />;
}

function NavList() {
  return (
    <nav className="mt-6">
      <div className="mb-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/45">
        Console
      </div>
      <ul className="space-y-1">
        {NAV.map((item) => (
          <li key={item.label}>
            <span
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${
                item.live ? "bg-copper text-[#FBFAF5]" : "text-ink/45"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
                  aria-hidden
                />
                {item.label}
              </span>
              {!item.live && (
                <span className="rounded-full border border-ink/12 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/40">
                  Soon
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const identity = admin?.email ?? "Admin";
  const role = admin?.role ?? "admin";

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 flex-none flex-col border-r border-ink/12 bg-surface p-5 md:flex">
        <BrandMark />
        <NavList />
        <div className="mt-auto border-t border-ink/12 pt-4">
          <div className="truncate text-sm font-semibold text-ink" title={identity}>
            {identity}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink/45">{role}</div>
          <Button variant="ghost" onClick={signOut} className="mt-3 w-full">
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-ink/12 bg-surface px-4 py-3 md:hidden">
          <BrandMark />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg border border-ink/12 px-3 py-1.5 text-sm text-ink/70"
          >
            Menu
          </button>
        </header>

        {menuOpen && (
          <div className="border-b border-ink/12 bg-surface px-4 pb-4 md:hidden">
            <NavList />
            <div className="mt-4 border-t border-ink/12 pt-3">
              <div className="truncate text-sm font-semibold text-ink">{identity}</div>
              <div className="text-[11px] uppercase tracking-wide text-ink/45">{role}</div>
              <Button variant="ghost" onClick={signOut} className="mt-3 w-full">
                Sign out
              </Button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-10 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
