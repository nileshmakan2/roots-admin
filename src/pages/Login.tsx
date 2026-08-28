import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Wordmark } from "../components/ui";
import { BRAND } from "../config";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) {
      setError("That email and password didn't match. Try again.");
      setBusy(false);
    }
    // On success, AuthProvider updates the session and the app renders the console.
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4">
      {/* Signature: a faint oversized copper pin glow, echoing the logo mark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(180,108,72,0.20), rgba(180,108,72,0) 70%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Wordmark className="h-12 w-auto" />
          <p className="mt-3 text-sm text-ink/55">{BRAND.console}</p>
        </div>

        <div className="rounded-2xl border border-ink/12 bg-surface p-6 shadow-sm">
          <h1 className="font-display text-xl font-bold text-espresso">Sign in</h1>
          <p className="mt-1 text-sm text-ink/55">
            Restricted to authorised Roots admins.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink/70">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                placeholder="you@padawanconsulting.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink/70">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink/40">
          {BRAND.name} · {BRAND.tagline}
        </p>
      </div>
    </div>
  );
}
