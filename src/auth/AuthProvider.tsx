import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config";
import type { AdminRow } from "../lib/types";

type AuthState = {
  session: Session | null;
  admin: AdminRow | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(p))));
  } catch {
    return null;
  }
}

// TEMPORARY DIAGNOSTIC VERSION 2.
// Compares the normal client read against a read that explicitly forces the
// user's token, to tell a client token-attach problem apart from an RLS/policy
// problem. Read the browser console (F12).
async function loadAdmin(userId: string): Promise<AdminRow | null> {
  console.log("%c[auth] ---- admin gate check v2 ----", "color:#B46C48;font-weight:bold");

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? "";
  const claims = decodeJwt(token);
  console.log("[auth] token claims -> sub:", claims?.sub, "| role:", claims?.role);

  // A) Normal client read (what the app uses today).
  const normal = await supabase.from("admins").select("*");
  console.log("[auth] A) normal client read -> rows:", normal.data,
    "| error:", normal.error?.message ?? null);

  // B) Forced read: hit the REST API directly with the user token as Bearer.
  let forcedRows: AdminRow[] = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    forcedRows = await res.json();
    console.log("[auth] B) forced-token read -> status:", res.status, "| rows:", forcedRows);
  } catch (e) {
    console.warn("[auth] B) forced-token read failed:", e);
  }

  const normalRows = (normal.data as AdminRow[] | null) ?? [];

  if (normalRows.length > 0) {
    console.log("%c[auth] RESULT: normal read worked. Gate OK.", "color:#9FA573;font-weight:bold");
    return normalRows.find((r) => r.user_id === userId) ?? normalRows[0];
  }

  if (Array.isArray(forcedRows) && forcedRows.length > 0) {
    console.warn(
      "%c[auth] RESULT: normal read was EMPTY but forced-token read WORKED. " +
        "The client isn't attaching your user token to data requests. " +
        "Signing you in via the forced read for now.",
      "color:#B46C48;font-weight:bold"
    );
    return forcedRows.find((r) => r.user_id === userId) ?? forcedRows[0];
  }

  console.warn(
    "%c[auth] RESULT: BOTH reads empty. Your token is valid but the row is " +
      "hidden by RLS. This is a database policy issue, not the client.",
    "color:#F31C1F;font-weight:bold"
  );
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminRow | null>(null);
  const [ready, setReady] = useState(false);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    let active = true;
    if (!userId) {
      setAdmin(null);
      setCheckedFor(null);
      return;
    }
    loadAdmin(userId).then((row) => {
      if (!active) return;
      setAdmin(row);
      setCheckedFor(userId);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  const loading = !ready || (!!userId && checkedFor !== userId);

  return (
    <AuthContext.Provider value={{ session, admin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within an AuthProvider");
  return value;
}
