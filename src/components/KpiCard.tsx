type Kind = "number" | "hours" | "bytes";

type Props = {
  label: string;
  value: number | null;
  loading?: boolean;
  sublabel?: string;
  accent?: "copper" | "lime";
  kind?: Kind;
};

function formatBytes(b: number): string {
  if (!b || b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const val = b / Math.pow(1024, i);
  return `${val.toLocaleString("en-ZA", { maximumFractionDigits: i >= 3 ? 2 : 0 })} ${units[i]}`;
}

function formatValue(value: number, kind: Kind): string {
  const v = Number(value);
  if (kind === "hours") {
    const hours = v / 3600;
    return `${hours.toLocaleString("en-ZA", { maximumFractionDigits: 1 })} h`;
  }
  if (kind === "bytes") return formatBytes(v);
  return v.toLocaleString("en-ZA");
}

export function KpiCard({
  label,
  value,
  loading,
  sublabel,
  accent = "copper",
  kind = "number",
}: Props) {
  const stripe = accent === "lime" ? "bg-lime" : "bg-copper";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink/12 bg-surface p-4 pb-5">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${stripe}`} aria-hidden />
      <div className="text-xs font-medium text-ink/55">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums text-ink">
        {loading ? (
          <span className="inline-block h-8 w-20 animate-pulse rounded-md bg-surface-2" />
        ) : value === null ? (
          <span className="text-ink/30">—</span>
        ) : (
          formatValue(value, kind)
        )}
      </div>
      {sublabel && !loading && value !== null && (
        <div className="mt-1.5 text-xs font-semibold text-olive">{sublabel}</div>
      )}
    </div>
  );
}
