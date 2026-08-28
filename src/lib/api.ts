import { supabase } from "./supabase";
import type { Overview, SeriesPoint, RateFlag } from "./types";

export type Result<T> = { data: T | null; error: string | null };

export type RangeKey = "7d" | "30d" | "90d" | "year" | "lastYear" | "all";

// Friendly labels for the range toggle.
export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "year", label: "This year" },
  { key: "lastYear", label: "Last year" },
  { key: "all", label: "All time" },
];

function toMessage(err: { message?: string } | null): string | null {
  if (!err) return null;
  const m = err.message ?? "Something went wrong.";
  if (/does not exist|not find|schema cache/i.test(m)) {
    return "This data isn't available yet. The backend functions may not be set up.";
  }
  return m;
}

// Turns a range choice into the bucket + bounds the series functions expect.
// `from_ts` null means all-time (the function starts at the earliest record).
export function rangeToParams(range: RangeKey): {
  bucket: "day" | "month";
  from_ts: string | null;
  to_ts: string;
} {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  switch (range) {
    case "7d":
    case "30d":
    case "90d": {
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const from = startOfDay(now);
      from.setDate(from.getDate() - (days - 1));
      return { bucket: "day", from_ts: iso(from), to_ts: iso(now) };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { bucket: "month", from_ts: iso(from), to_ts: iso(now) };
    }
    case "lastYear": {
      const from = new Date(now.getFullYear() - 1, 0, 1);
      const to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      return { bucket: "month", from_ts: iso(from), to_ts: iso(to) };
    }
    case "all":
    default:
      return { bucket: "month", from_ts: null, to_ts: iso(now) };
  }
}

export async function fetchOverview(): Promise<Result<Overview>> {
  const { data, error } = await supabase.rpc("admin_overview").single();
  return { data: (data as Overview) ?? null, error: toMessage(error) };
}

async function fetchSeries(fn: string, range: RangeKey): Promise<Result<SeriesPoint[]>> {
  const { bucket, from_ts, to_ts } = rangeToParams(range);
  const { data, error } = await supabase.rpc(fn, { bucket, from_ts, to_ts });
  return { data: (data as SeriesPoint[]) ?? null, error: toMessage(error) };
}

export function fetchSignupsSeries(range: RangeKey) {
  return fetchSeries("admin_signups_series", range);
}

export function fetchListensSeries(range: RangeKey) {
  return fetchSeries("admin_listens_series", range);
}

// Current-window flag: users who created more than 20 roots in the last hour.
// Empty array means nobody is breaching right now.
export async function fetchRateFlags(): Promise<Result<RateFlag[]>> {
  const { data, error } = await supabase.rpc("admin_rate_flags");
  return { data: (data as RateFlag[]) ?? null, error: toMessage(error) };
}
