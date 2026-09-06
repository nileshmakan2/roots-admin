import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Locked } from "./pages/Locked";
import { Overview } from "./pages/Overview";
import { Moderation } from "./pages/Moderation";
import { Users } from "./pages/Users";
import { Legal } from "./pages/Legal";
import { MapView } from "./pages/MapView";
import type { Page } from "./nav";

export default function App() {
  const { session, admin, loading } = useAuth();
  const [page, setPage] = useState<Page>("overview");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!session) return <Login />;
  if (!admin) return <Locked />;

  return (
    <AppShell current={page} onNavigate={setPage}>
      {page === "overview" && <Overview />}
      {page === "map" && <MapView />}
      {page === "moderation" && <Moderation />}
      {page === "users" && <Users />}
      {page === "legal" && <Legal />}
    </AppShell>
  );
}
