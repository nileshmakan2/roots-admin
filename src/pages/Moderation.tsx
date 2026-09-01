import { useEffect, useState } from "react";
import { RootLine, Button, Spinner } from "../components/ui";
import {
  fetchReports,
  fetchRootAudioUrl,
  moderateRoot,
  type ModerationAction,
} from "../lib/api";
import type { ReportGroup } from "../lib/types";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string | null }) {
  const hidden = status === "hidden";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        hidden ? "bg-ink/10 text-ink/60" : "bg-olive/20 text-[#4c5330]"
      }`}
    >
      {hidden ? "Hidden" : status ?? "active"}
    </span>
  );
}

function QueueRow({
  row,
  selected,
  onSelect,
}: {
  row: ReportGroup;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-copper bg-copper/5"
          : "border-ink/12 bg-surface hover:bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-ink">
          {row.root_title?.trim() || "Untitled root"}
        </span>
        <StatusBadge status={row.root_status} />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-ink/55">
        <span>
          <span className="font-semibold text-copper-deep">{row.open_count}</span> open
          <span className="text-ink/35"> / {row.report_count}</span>
        </span>
        <span>{shortDate(row.last_reported_at)}</span>
      </div>
    </button>
  );
}

function AudioPlayer({ rootId }: { rootId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the selected root changes.
  useEffect(() => {
    setUrl(null);
    setError(null);
    setLoading(false);
  }, [rootId]);

  async function load() {
    setLoading(true);
    setError(null);
    const r = await fetchRootAudioUrl(rootId);
    if (r.error) setError(r.error);
    else setUrl(r.data);
    setLoading(false);
  }

  return (
    <div>
      {url ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls autoPlay src={url} className="w-full" />
          <button
            onClick={load}
            className="text-xs text-ink/50 underline underline-offset-2 hover:text-ink/70"
          >
            Refresh link
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Play audio"}
          </Button>
          {loading && <Spinner className="h-4 w-4" />}
        </div>
      )}
      {error && <div className="mt-2 text-sm text-danger">{error}</div>}
    </div>
  );
}

function DetailPanel({
  row,
  busy,
  errorMsg,
  onAct,
}: {
  row: ReportGroup;
  busy: boolean;
  errorMsg: string | null;
  onAct: (action: ModerationAction) => void;
}) {
  const hidden = row.root_status === "hidden";
  const owner =
    row.owner_display_name?.trim() ||
    (row.owner_handle ? `@${row.owner_handle}` : "Unknown owner");
  const reasons = (row.reasons ?? []).filter((r) => r && r.trim().length > 0);

  return (
    <div className="rounded-2xl border border-ink/12 bg-surface p-5">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 truncate font-display text-lg font-semibold text-espresso">
          {row.root_title?.trim() || "Untitled root"}
        </h2>
        <StatusBadge status={row.root_status} />
      </div>
      <div className="mt-0.5 text-sm text-ink/55">
        {owner}
        {row.owner_handle && row.owner_display_name && (
          <span className="text-ink/40"> · @{row.owner_handle}</span>
        )}
      </div>

      {/* Player */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
          Listen
        </div>
        <AudioPlayer rootId={row.root_id} />
      </div>

      {/* Reports summary (individual reporters drop in here once available) */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink/45">
            Reports
          </div>
          <div className="text-xs text-ink/55">
            <span className="font-semibold text-copper-deep">{row.open_count}</span> open
            <span className="text-ink/35"> / {row.report_count} total</span>
            <span className="ml-2 text-ink/40">
              first {shortDate(row.first_reported_at)}
            </span>
          </div>
        </div>
        {reasons.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r, i) => (
              <span key={i} className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink/70">
                {r}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs italic text-ink/40">No reason given.</div>
        )}
        <div className="mt-2 text-xs text-ink/40">
          Individual reporters will appear here soon.
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2 border-t border-ink/12 pt-4">
        {hidden ? (
          <Button onClick={() => onAct("unhide")} disabled={busy}>
            {busy ? "Working…" : "Unhide"}
          </Button>
        ) : (
          <Button onClick={() => onAct("hide")} disabled={busy}>
            {busy ? "Working…" : "Hide root"}
          </Button>
        )}
        <Button variant="ghost" onClick={() => onAct("dismiss")} disabled={busy}>
          Dismiss
        </Button>
        {busy && <Spinner className="ml-1 h-4 w-4" />}
      </div>
    </div>
  );
}

export function Moderation() {
  const [rows, setRows] = useState<ReportGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    const r = await fetchReports(includeResolved);
    setRows(r.data);
    setError(r.error);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchReports(includeResolved).then((r) => {
      if (!active) return;
      setRows(r.data);
      setError(r.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [includeResolved]);

  // Keep a valid selection: default to the first row, and reselect if the
  // current one dropped off (e.g. after hiding/dismissing).
  useEffect(() => {
    if (!rows || rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.root_id === selectedId)) {
      setSelectedId(rows[0].root_id);
    }
  }, [rows, selectedId]);

  async function onAct(action: ModerationAction) {
    if (!selectedId) return;
    const id = selectedId;
    setBusyId(id);
    setRowError(null);
    const r = await moderateRoot(action, id);
    if (r.error) {
      setRowError({ id, msg: r.error });
      setBusyId(null);
      return;
    }
    await load(true);
    setBusyId(null);
  }

  const selected = rows?.find((r) => r.root_id === selectedId) ?? null;
  const isEmpty = !loading && !error && (!rows || rows.length === 0);

  return (
    <div>
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-copper-deep">
          Trust &amp; safety
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-espresso">
            Moderation
          </h1>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--color-copper)]"
            />
            Show resolved
          </label>
        </div>
        <RootLine className="mt-4" />
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-7 w-7" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-ink/12 bg-surface px-6 py-16 text-center text-sm text-ink/55">
          {error}
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-ink/12 bg-surface px-6 py-16 text-center">
          <div className="font-display text-lg font-semibold text-espresso">
            Nothing to review
          </div>
          <p className="mt-1 text-sm text-ink/55">
            {includeResolved
              ? "No reports on record."
              : "The queue is clear. Reported roots will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* Queue */}
          <div className="space-y-2">
            {rows!.map((row) => (
              <QueueRow
                key={row.root_id}
                row={row}
                selected={row.root_id === selectedId}
                onSelect={() => setSelectedId(row.root_id)}
              />
            ))}
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <DetailPanel
                row={selected}
                busy={busyId === selected.root_id}
                errorMsg={rowError?.id === selected.root_id ? rowError.msg : null}
                onAct={onAct}
              />
            ) : (
              <div className="rounded-2xl border border-ink/12 bg-surface px-6 py-16 text-center text-sm text-ink/55">
                Select a reported root to review.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
