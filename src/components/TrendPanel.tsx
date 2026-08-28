import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "../lib/types";
import { RANGE_OPTIONS, type RangeKey } from "../lib/api";
import { Spinner } from "./ui";

type Props = {
  title: string;
  color: string; // hex line/area colour
  data: SeriesPoint[] | null;
  loading: boolean;
  error: string | null;
  range: RangeKey;
  bucket: "day" | "month";
  onRangeChange: (r: RangeKey) => void;
};

function label(iso: string, bucket: "day" | "month"): string {
  const d = new Date(iso);
  return bucket === "month"
    ? d.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" })
    : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function TrendPanel({
  title,
  color,
  data,
  loading,
  error,
  range,
  bucket,
  onRangeChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-ink/12 bg-surface p-5 pb-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-espresso">{title}</h2>
        <div className="flex flex-wrap gap-0.5 rounded-lg bg-surface-2 p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onRangeChange(opt.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                opt.key === range ? "bg-paper text-ink" : "text-ink/55 hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-52">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink/55">
            {error}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink/45">
            No data for this period yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${slug(title)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(28,23,20,0.08)" vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={(v) => label(String(v), bucket)}
                tick={{ fill: "rgba(28,23,20,0.5)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                width={40}
                tick={{ fill: "rgba(28,23,20,0.5)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(v) => label(String(v), bucket)}
                formatter={(value) => [Number(value).toLocaleString("en-ZA"), title]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(28,23,20,0.12)",
                  background: "#F6F7F1",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#fill-${slug(title)})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
