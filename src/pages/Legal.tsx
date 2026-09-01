import { useEffect, useState } from "react";
import { RootLine, Button, Spinner } from "../components/ui";
import {
  fetchCurrentDoc,
  fetchDocHistory,
  publishNewVersion,
  correctInPlace,
  type DocType,
  type LegalDoc,
} from "../lib/legal";

const TABS: { key: DocType; label: string }[] = [
  { key: "terms", label: "Terms of Service" },
  { key: "privacy", label: "Privacy Policy" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function Legal() {
  const [docType, setDocType] = useState<DocType>("terms");

  const [current, setCurrent] = useState<LegalDoc | null>(null);
  const [history, setHistory] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor fields.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [effectiveAt, setEffectiveAt] = useState(toDateInput(null));
  const [editingId, setEditingId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function loadInto(doc: LegalDoc | null) {
    setTitle(doc?.title ?? "");
    setBody(doc?.body ?? "");
    setEffectiveAt(toDateInput(doc?.effective_at ?? null));
    setEditingId(doc?.id ?? null);
  }

  async function loadAll(type: DocType, keepEditor = false) {
    setLoading(true);
    setError(null);
    const [cur, hist] = await Promise.all([fetchCurrentDoc(type), fetchDocHistory(type)]);
    setCurrent(cur.data);
    setHistory(hist.data ?? []);
    setError(cur.error ?? hist.error);
    if (!keepEditor) loadInto(cur.data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchCurrentDoc(docType), fetchDocHistory(docType)]).then(([cur, hist]) => {
      if (!active) return;
      setCurrent(cur.data);
      setHistory(hist.data ?? []);
      setError(cur.error ?? hist.error);
      loadInto(cur.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  }

  const editingCurrent = !!current && editingId === current.id;
  const nextVersion = (history[0]?.version ?? 0) + 1;

  async function doPublish() {
    setBusy(true);
    setConfirming(false);
    const r = await publishNewVersion({ docType, title, body, effectiveAt });
    setBusy(false);
    if (r.error) return setError(r.error);
    flash(`Published ${docType === "terms" ? "Terms" : "Privacy Policy"} v${r.data?.version}.`);
    await loadAll(docType);
  }

  async function doCorrect() {
    if (!current) return;
    setBusy(true);
    const r = await correctInPlace({ id: current.id, title, body });
    setBusy(false);
    if (r.error) return setError(r.error);
    flash(`Saved a correction to v${current.version} (no version bump).`);
    await loadAll(docType);
  }

  return (
    <div>
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-copper-deep">
          Legal
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-espresso">
          Terms &amp; Privacy
        </h1>
        <RootLine className="mt-4" />
      </header>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setDocType(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              docType === t.key ? "bg-paper text-ink" : "text-ink/55 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-olive/40 bg-olive/10 px-4 py-2.5 text-sm text-[#4c5330]">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* Editor */}
          <div className="rounded-2xl border border-ink/12 bg-surface p-5">
            <div className="mb-4 text-sm text-ink/55">
              {current ? (
                <>
                  Current live version:{" "}
                  <span className="font-semibold text-ink">v{current.version}</span>, effective{" "}
                  {fmtDate(current.effective_at)}.
                </>
              ) : (
                "No published version yet. Publishing will create v1."
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink/70">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                placeholder={docType === "terms" ? "Terms of Service" : "Privacy Policy"}
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-ink/70">
                Effective date (for the next published version)
              </span>
              <input
                type="date"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
                className="rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-ink/70">Body (Markdown)</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={20}
                className="w-full rounded-xl border border-ink/12 bg-paper px-3.5 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                placeholder="Write the document in Markdown…"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/12 pt-4">
              {confirming ? (
                <>
                  <span className="text-sm text-ink/70">
                    Publish v{nextVersion}? It goes live on the app and website.
                  </span>
                  <Button onClick={doPublish} disabled={busy}>
                    {busy ? "Publishing…" : "Confirm publish"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setConfirming(true)}
                    disabled={busy || !body.trim()}
                  >
                    Publish new version
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={doCorrect}
                    disabled={busy || !editingCurrent || !body.trim()}
                    title={
                      editingCurrent
                        ? "Overwrite the current version in place, no version bump (for typo fixes)"
                        : "Load the current live version to make an in-place correction"
                    }
                  >
                    Save correction to current
                  </Button>
                  {busy && <Spinner className="h-4 w-4" />}
                </>
              )}
            </div>
          </div>

          {/* History */}
          <div className="rounded-2xl border border-ink/12 bg-surface p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">
              Version history
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-ink/45">No versions yet.</div>
            ) : (
              <ul className="space-y-1.5">
                {history.map((h) => {
                  const isLive = current?.id === h.id;
                  const isEditing = editingId === h.id;
                  return (
                    <li key={h.id}>
                      <button
                        onClick={() => loadInto(h)}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                          isEditing
                            ? "border-copper bg-copper/5"
                            : "border-ink/12 hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink">v{h.version}</span>
                          <span className="flex gap-1">
                            {isLive && (
                              <span className="rounded-full bg-olive/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4c5330]">
                                Live
                              </span>
                            )}
                            {!h.published && (
                              <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/50">
                                Draft
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-ink/50">
                          effective {fmtDate(h.effective_at)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink/40">
              Loading a past version fills the editor. Publish it to make it the new live
              version (history is preserved).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
