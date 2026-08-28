import { useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Locked } from "./pages/Locked";
import { Overview } from "./pages/Overview";

export default function App() {
  const { session, admin, loading } = useAuth();

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
    <AppShell>
      <Overview />
    </AppShell>
  );
}
