import { useEffect, useState, type ReactNode } from "react";
import { Button, Spinner } from "./ui";
import { avatarUrl, initialsOf } from "../lib/avatar";
import { fetchRootAudioUrl, fetchUserDetail, fetchUserRoots, fetchUserRoutes } from "../lib/api";
import type { UserDetail, UserRootRow, UserRouteRow, UserRow } from "../lib/types";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDuration(totalSeconds: number | null | undefined): string {
  const s = Number(totalSeconds ?? 0);
  if (!s) return "0 min";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toLocaleString("en-ZA", { maximumFractionDigits: 1 })} h`;
}

function fmtClip(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function n(v: number | null | undefined): string {
  return Number(v ?? 0).toLocaleString("en-ZA");
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3">
      <div className="text-[11px] font-medium text-ink/55">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold tabular-nums ${tone === "danger" ? "text-danger" : "text-ink"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-ink/45">{sub}</div>}
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "good" | "warn" | "danger" | "copper" }) {
  const cls = {
    neutral: "bg-ink/8 text-ink/60",
    good: "bg-olive/20 text-[#4c5330]",
    warn: "bg-[#FBEEDD] text-[#9A6A1E]",
    danger: "bg-danger/10 text-danger",
    copper: "bg-copper/15 text-copper-deep",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/45">{children}</div>
      {right}
    </div>
  );
}

function RootPlayer({ rootId }: { rootId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchRootAudioUrl(rootId).then((r) => {
      if (!active) return;
      if (r.error) setError(r.error);
      else setUrl(r.data);
    });
    return () => {
      active = false;
    };
  }, [rootId]);
  if (error) return <div className="text-xs text-danger">{error}</div>;
  if (!url) return <Spinner className="h-4 w-4" />;
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio controls autoPlay src={url} className="h-8 w-full" />;
}

export function UserDrawer({
  user,
  onClose,
  onReset,
  onToggleStatus,
  canToggle,
  toggleTitle,
  busy,
  onPreviewAvatar,
}: {
  user: UserRow;
  onClose: () => void;
  onReset: () => void;
  onToggleStatus: () => void;
  canToggle: boolean;
  toggleTitle?: string;
  busy: boolean;
  onPreviewAvatar: (url: string, name: string) => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [roots, setRoots] = useState<UserRootRow[] | null>(null);
  const [rootsErr, setRootsErr] = useState<string | null>(null);
  const [routes, setRoutes] = useState<UserRouteRow[] | null>(null);
  const [routesErr, setRoutesErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPlayingId(null);
    setImgFailed(false);
    Promise.all([fetchUserDetail(user.user_id), fetchUserRoots(user.user_id), fetchUserRoutes(user.user_id)]).then(
      ([d, r, rt]) => {
        if (!active) return;
        setDetail(d.data);
        setDetailErr(d.error);
        setRoots(r.data);
        setRootsErr(r.error);
        setRoutes(rt.data);
        setRoutesErr(rt.error);
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [user.user_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = user.display_name?.trim() || (user.handle ? `@${user.handle}` : "User");
  const avatarKey = detail?.avatar_url ?? user.avatar_url ?? null;
  const imgUrl = avatarUrl(avatarKey);

  const sortedRoots = (roots ?? []).slice().sort((a, b) => {
    if ((b.open_reports ?? 0) !== (a.open_reports ?? 0)) return (b.open_reports ?? 0) - (a.open_reports ?? 0);
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  const rateFlagged = (detail?.roots_last_hour ?? 0) > 20;
  const hasOpenReports = (detail?.reports_against_open ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col bg-paper shadow-2xl">
        {/* Header */}
        <div className="border-b border-ink/10 bg-white px-6 pb-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              {imgUrl && !imgFailed ? (
                <button
                  onClick={() => onPreviewAvatar(imgUrl, name)}
                  title="View full image"
                  className="h-16 w-16 flex-none overflow-hidden rounded-full border border-ink/12 hover:ring-2 hover:ring-copper/40"
                >
                  <img src={imgUrl} alt="" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
                </button>
              ) : (
                <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-copper/15 font-display text-lg font-bold text-copper-deep">
                  {initialsOf(user.display_name, user.handle)}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl font-bold text-espresso">{name}</h2>
                {user.handle && <div className="text-sm text-ink/50">@{user.handle}</div>}
                <div className="truncate text-sm text-ink/60">{user.email ?? "—"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.is_suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="good">Active</Badge>}
                  {user.is_admin && <Badge tone="copper">{detail?.admin_role ? `Admin · ${detail.admin_role}` : "Admin"}</Badge>}
                  {detail?.is_private != null && (
                    <Badge tone="neutral">{detail.is_private ? "Private profile" : "Public profile"}</Badge>
                  )}
                  {hasOpenReports && <Badge tone="danger">{n(detail?.reports_against_open)} open reports</Badge>}
                  {rateFlagged && <Badge tone="warn">Rate flag</Badge>}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-0.5 text-2xl leading-none text-ink/40 hover:bg-surface-2 hover:text-ink/70"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {avatarKey && imgFailed && (
            <div className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[11px] text-danger">
              Profile image failed to load. Stored key: <span className="font-mono">{avatarKey}</span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={onReset} disabled={busy}>
              Send password reset
            </Button>
            <button
              onClick={onToggleStatus}
              disabled={busy || !canToggle}
              title={toggleTitle}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                user.is_suspended
                  ? "border border-ink/12 text-ink hover:bg-surface-2"
                  : "bg-danger/10 text-danger hover:bg-danger/15"
              }`}
            >
              {user.is_suspended ? "Reactivate account" : "Suspend account"}
            </button>
            {busy && <Spinner className="ml-1 mt-2.5 h-4 w-4" />}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-7 w-7" />
            </div>
          ) : (
            <>
              {detailErr && !detail ? (
                <div className="mt-5 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/55">
                  Detailed stats aren't available yet (needs <span className="font-mono">admin_user_detail</span>). Roots owned:{" "}
                  <b className="text-ink">{n(user.roots_count)}</b>.
                </div>
              ) : (
                <>
                  <SectionTitle>Content</SectionTitle>
                  <div className="grid grid-cols-3 gap-2.5">
                    <Stat
                      label="Roots"
                      value={n(detail?.roots_total ?? user.roots_count)}
                      sub={`${n(detail?.roots_active)} active · ${n(detail?.roots_hidden)} hidden`}
                    />
                    <Stat label="Routes" value={n(detail?.routes_total)} />
                    <Stat label="Hours of roots" value={fmtDuration(detail?.total_seconds)} />
                    <Stat label="Plays received" value={n(detail?.plays_received)} />
                    <Stat label="Followers" value={n(detail?.followers_count)} />
                    <Stat label="Following" value={n(detail?.following_count)} />
                  </div>

                  <SectionTitle>Trust &amp; safety</SectionTitle>
                  <div className="grid grid-cols-3 gap-2.5">
                    <Stat
                      label="Flagged roots"
                      value={n(detail?.roots_flagged)}
                      tone={(detail?.roots_flagged ?? 0) > 0 ? "danger" : undefined}
                    />
                    <Stat
                      label="Open reports"
                      value={n(detail?.reports_against_open)}
                      sub={`${n(detail?.reports_against_total)} all time`}
                      tone={hasOpenReports ? "danger" : undefined}
                    />
                    <Stat label="Reports they filed" value={n(detail?.reports_filed)} />
                  </div>
                  {rateFlagged && (
                    <div className="mt-2.5 rounded-xl border border-[#EFD9B8] bg-[#FBEEDD] px-3 py-2 text-xs text-[#7a5418]">
                      Created {n(detail?.roots_last_hour)} roots in the last hour (threshold 20).
                    </div>
                  )}

                  <SectionTitle>Profile</SectionTitle>
                  <div className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
                    <div className="grid grid-cols-2 gap-y-2">
                      <span className="text-ink/50">Joined</span>
                      <span className="text-right text-ink">{fmtDate(detail?.created_at ?? user.created_at)}</span>
                      <span className="text-ink/50">Last seen</span>
                      <span className="text-right text-ink">{fmtDate(detail?.last_sign_in_at ?? user.last_sign_in_at)}</span>
                    </div>
                    <div className="mt-3 border-t border-ink/8 pt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink/45">About</div>
                      <p className="whitespace-pre-wrap text-ink/75">{detail?.about?.trim() || <span className="italic text-ink/40">No bio.</span>}</p>
                    </div>
                  </div>
                </>
              )}

              <SectionTitle right={roots ? <span className="text-xs text-ink/40">{n(roots.length)}</span> : null}>
                Roots
              </SectionTitle>
              {rootsErr && !roots ? (
                <div className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/55">
                  Root list isn't available yet (needs <span className="font-mono">admin_user_roots</span>).
                </div>
              ) : sortedRoots.length === 0 ? (
                <div className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/45">No roots.</div>
              ) : (
                <ul className="overflow-hidden rounded-xl border border-ink/10 bg-white">
                  {sortedRoots.map((r) => (
                    <li key={r.root_id} className="border-b border-ink/8 px-4 py-3 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{r.title?.trim() || "Untitled root"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink/50">
                            <Badge tone={r.status === "hidden" ? "neutral" : "good"}>{r.status ?? "active"}</Badge>
                            {r.visibility && <Badge tone="neutral">{r.visibility}</Badge>}
                            {(r.open_reports ?? 0) > 0 && <Badge tone="danger">{n(r.open_reports)} open</Badge>}
                            <span>{fmtClip(r.seconds)}</span>
                            <span>·</span>
                            <span>{n(r.plays)} plays</span>
                            <span>·</span>
                            <span>{fmtDate(r.created_at)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setPlayingId(playingId === r.root_id ? null : r.root_id)}
                          className="flex-none rounded-lg border border-ink/12 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-surface-2"
                        >
                          {playingId === r.root_id ? "Close" : "Play"}
                        </button>
                      </div>
                      {playingId === r.root_id && (
                        <div className="mt-2">
                          <RootPlayer rootId={r.root_id} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <SectionTitle right={routes ? <span className="text-xs text-ink/40">{n(routes.length)}</span> : null}>
                Routes
              </SectionTitle>
              {routesErr && !routes ? (
                <div className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/55">
                  Route list isn't available yet (needs <span className="font-mono">admin_user_routes</span>).
                </div>
              ) : !routes || routes.length === 0 ? (
                <div className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/45">No routes.</div>
              ) : (
                <ul className="overflow-hidden rounded-xl border border-ink/10 bg-white">
                  {routes.map((rt) => (
                    <li key={rt.route_id} className="flex items-center justify-between gap-3 border-b border-ink/8 px-4 py-3 last:border-0">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{rt.name?.trim() || "Untitled route"}</div>
                        <div className="mt-0.5 text-[11px] text-ink/50">
                          {n(rt.stops_count)} stops · {fmtDate(rt.created_at)}
                        </div>
                      </div>
                      {rt.visibility && <Badge tone="neutral">{rt.visibility}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
