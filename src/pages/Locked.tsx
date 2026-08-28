import { useAuth } from "../auth/AuthProvider";
import { Button, Wordmark } from "../components/ui";

export function Locked() {
  const { signOut, session } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="mx-auto h-11 w-auto" />
        <div className="mt-8 rounded-2xl border border-ink/12 bg-surface p-6">
          <h1 className="font-display text-xl font-bold text-espresso">
            No admin access
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            You're signed in as{" "}
            <span className="font-medium text-ink">{session?.user.email}</span>, but
            this account isn't on the Roots admin list. Ask the owner to add you.
          </p>
          <Button variant="ghost" onClick={signOut} className="mt-6 w-full">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
