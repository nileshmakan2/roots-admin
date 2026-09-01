import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { RootLine, Button, Spinner } from "../components/ui";
import {
  fetchUsers,
  fetchUsersCount,
  inviteUser,
  sendPasswordReset,
  setUserStatus,
} from "../lib/api";
import type { UserRow } from "../lib/types";

const PAGE_SIZE = 50;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AddUserModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const r = await inviteUser(email);
    if (r.error) {
      setError(r.error);
      setBusy(false);
      return;
    }
    onInvited(`Invite sent to ${email.trim()}.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink/12 bg-surface p-6">
        <h2 className="font-display text-lg font-bold text-espresso">Add a user</h2>
        <p className="mt-1 text-sm text-ink/55">
          They'll get an email invite to set their own password.
        </p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-medium text-ink/70">Email</span>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
            placeholder="person@example.com"
          />
        </label>
        {error && (
          <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "admin" | "suspended" }) {
  const cls =
    tone === "admin"
      ? "bg-copper/15 text-copper-deep"
      : "bg-danger/10 text-danger";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export function Users() {
  const { admin } = useAuth();
  const callerId = admin?.user_id ?? null;
  const callerIsOwner = (admin?.role ?? "") === "owner";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    const [u, c] = await Promise.all([
      fetchUsers(debounced || null, PAGE_SIZE, offset),
      fetchUsersCount(debounced || null),
    ]);
    setRows(u.data);
    setError(u.error);
    if (c.data !== null) setTotal(c.data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchUsers(debounced || null, PAGE_SIZE, offset),
      fetchUsersCount(debounced || null),
    ]).then(([u, c]) => {
      if (!active) return;
      setRows(u.data);
      setError(u.error);
      if (c.data !== null) setTotal(c.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [debounced, offset]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  }

  async function onReset(u: UserRow) {
    setBusyId(u.user_id);
    setRowError(null);
    const r = await sendPasswordReset(u.user_id);
    setBusyId(null);
    if (r.error) return setRowError({ id: u.user_id, msg: r.error });
    flash(`Password reset email sent to ${u.email ?? "user"}.`);
  }

  async function onToggleStatus(u: UserRow) {
    const action = u.is_suspended ? "reactivate" : "suspend";
    setBusyId(u.user_id);
    setRowError(null);
    const r = await setUserStatus(u.user_id, action);
    setBusyId(null);
    if (r.error) return setRowError({ id: u.user_id, msg: r.error });
    flash(action === "suspend" ? "User suspended." : "User reactivated.");
    await load(true);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;

  const canToggle = (u: UserRow) =>
    u.user_id !== callerId && (callerIsOwner || !u.is_admin);

  const headerCount = useMemo(
    () => (total !== null ? `${total.toLocaleString("en-ZA")} total` : ""),
    [total]
  );

  return (
    <div>
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-copper-deep">
          People
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-espresso">
            Users
          </h1>
          <Button onClick={() => setShowAdd(true)}>Add user</Button>
        </div>
        <RootLine className="mt-4" />
      </header>

      {notice && (
        <div className="mb-4 rounded-xl border border-olive/40 bg-olive/10 px-4 py-2.5 text-sm text-[#4c5330]">
          {notice}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, handle or email"
          className="w-full max-w-xs rounded-xl border border-ink/12 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
        />
        <span className="text-xs text-ink/45">{headerCount}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-7 w-7" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-ink/12 bg-surface px-6 py-16 text-center text-sm text-ink/55">
          {error}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-2xl border border-ink/12 bg-surface px-6 py-16 text-center text-sm text-ink/55">
          No users match that search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink/12 bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink/12 text-left text-xs uppercase tracking-wide text-ink/45">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Last seen</th>
                <th className="px-4 py-3 text-right font-semibold">Roots</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const name = u.display_name?.trim() || "—";
                const busy = busyId === u.user_id;
                return (
                  <tr key={u.user_id} className="border-b border-ink/8 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{name}</span>
                        {u.is_admin && <Chip label="Admin" tone="admin" />}
                        {u.is_suspended && <Chip label="Suspended" tone="suspended" />}
                      </div>
                      {u.handle && <div className="text-xs text-ink/45">@{u.handle}</div>}
                      {rowError?.id === u.user_id && (
                        <div className="mt-1 text-xs text-danger">{rowError.msg}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-ink/60">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-ink/60">{fmtDate(u.last_sign_in_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink/70">
                      {u.roots_count.toLocaleString("en-ZA")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onReset(u)}
                          disabled={busy}
                          className="rounded-lg border border-ink/12 px-2.5 py-1.5 text-xs font-medium text-ink/70 hover:bg-surface-2 disabled:opacity-50"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => onToggleStatus(u)}
                          disabled={busy || !canToggle(u)}
                          title={
                            !canToggle(u)
                              ? u.user_id === callerId
                                ? "You can't change your own account"
                                : "Only the owner can change an admin account"
                              : undefined
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${
                            u.is_suspended
                              ? "border border-ink/12 text-ink/70 hover:bg-surface-2"
                              : "bg-danger/10 text-danger hover:bg-danger/15"
                          }`}
                        >
                          {u.is_suspended ? "Reactivate" : "Suspend"}
                        </button>
                        {busy && <Spinner className="h-4 w-4" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && rows && rows.length > 0 && pageCount && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink/55">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={total !== null && offset + PAGE_SIZE >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onInvited={(msg) => {
            setShowAdd(false);
            flash(msg);
            load(true);
          }}
        />
      )}
    </div>
  );
}
