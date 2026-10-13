import { supabase } from "./supabase";
import type {
  Overview,
  SeriesPoint,
  RateFlag,
  ReportGroup,
  UserRow,
  UserDetail,
  UserRootRow,
  UserRouteRow,
  MapRoot,
  MapRoute,
  PinMoveResult,
} from "./types";

export type Result<T> = { data: T | null; error: string | null };

export type RangeKey = "7d" | "30d" | "90d" | "year" | "lastYear" | "all";

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

function invokeStatus(err: unknown): number | undefined {
  return (err as { context?: { status?: number } })?.context?.status;
}

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

export function fetchRootsSeries(range: RangeKey) {
  return fetchSeries("admin_roots_series", range);
}

export async function fetchRateFlags(): Promise<Result<RateFlag[]>> {
  const { data, error } = await supabase.rpc("admin_rate_flags");
  return { data: (data as RateFlag[]) ?? null, error: toMessage(error) };
}

// ---- Moderation ----------------------------------------------------------

export async function fetchReports(includeResolved = false): Promise<Result<ReportGroup[]>> {
  const { data, error } = await supabase.rpc("admin_reports", {
    include_resolved: includeResolved,
  });
  return { data: (data as ReportGroup[]) ?? null, error: toMessage(error) };
}

export type ModerationAction = "hide" | "unhide" | "dismiss";

const ACTION_FN: Record<ModerationAction, string> = {
  hide: "moderate_hide_root",
  unhide: "moderate_unhide_root",
  dismiss: "moderate_dismiss_reports",
};

export async function moderateRoot(action: ModerationAction, rootId: string): Promise<Result<true>> {
  const { error } = await supabase.functions.invoke(ACTION_FN[action], {
    body: { root_id: rootId },
  });
  if (error) {
    const status = invokeStatus(error);
    if (status === 401 || status === 403) {
      return { data: null, error: "You're not signed in as an admin, or your session expired." };
    }
    return { data: null, error: error.message ?? "The action failed. Try again." };
  }
  return { data: true, error: null };
}

export async function fetchRootAudioUrl(rootId: string): Promise<Result<string>> {
  const { data, error } = await supabase.functions.invoke("admin_root_audio_url", {
    body: { root_id: rootId },
  });
  if (error) {
    const status = invokeStatus(error);
    if (status === 401 || status === 403) {
      return { data: null, error: "You're not signed in as an admin, or your session expired." };
    }
    return { data: null, error: error.message ?? "Couldn't load the audio. Try again." };
  }
  const url = (data as { signed_url?: string } | null)?.signed_url ?? null;
  if (!url) return { data: null, error: "No audio URL was returned for this root." };
  return { data: url, error: null };
}

// ---- User management ------------------------------------------------------

export async function fetchUsers(search: string | null, limit = 50, offset = 0): Promise<Result<UserRow[]>> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    search: search && search.trim() ? search.trim() : null,
    limit_n: limit,
    offset_n: offset,
  });
  return { data: (data as UserRow[]) ?? null, error: toMessage(error) };
}

export async function fetchUsersCount(search: string | null): Promise<Result<number>> {
  const { data, error } = await supabase.rpc("admin_users_count", {
    search: search && search.trim() ? search.trim() : null,
  });
  const n = typeof data === "number" ? data : Number(data ?? 0);
  return { data: error ? null : n, error: toMessage(error) };
}

// Per-user detail for the Users drawer. All three degrade to a friendly
// "not available yet" until the backend functions exist.
export async function fetchUserDetail(userId: string): Promise<Result<UserDetail>> {
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: userId }).maybeSingle();
  return { data: (data as UserDetail) ?? null, error: toMessage(error) };
}

export async function fetchUserRoots(userId: string): Promise<Result<UserRootRow[]>> {
  const { data, error } = await supabase.rpc("admin_user_roots", { p_user_id: userId });
  return { data: (data as UserRootRow[]) ?? null, error: toMessage(error) };
}

export async function fetchUserRoutes(userId: string): Promise<Result<UserRouteRow[]>> {
  const { data, error } = await supabase.rpc("admin_user_routes", { p_user_id: userId });
  return { data: (data as UserRouteRow[]) ?? null, error: toMessage(error) };
}

export async function inviteUser(email: string): Promise<Result<{ user_id: string }>> {
  const { data, error } = await supabase.functions.invoke("admin_invite_user", { body: { email: email.trim() } });
  if (error) {
    const status = invokeStatus(error);
    if (status === 401 || status === 403) {
      return { data: null, error: "You're not signed in as an admin, or your session expired." };
    }
    if (status === 409) return { data: null, error: "An account with that email already exists." };
    return { data: null, error: error.message ?? "Couldn't send the invite. Try again." };
  }
  return { data: (data as { user_id: string }) ?? null, error: null };
}

export async function sendPasswordReset(userId: string): Promise<Result<true>> {
  const { error } = await supabase.functions.invoke("admin_send_password_reset", { body: { user_id: userId } });
  if (error) {
    const status = invokeStatus(error);
    if (status === 401 || status === 403) {
      return { data: null, error: "You're not signed in as an admin, or your session expired." };
    }
    return { data: null, error: error.message ?? "Couldn't send the reset email. Try again." };
  }
  return { data: true, error: null };
}

export async function setUserStatus(userId: string, action: "suspend" | "reactivate"): Promise<Result<true>> {
  const { error } = await supabase.functions.invoke("admin_set_user_status", { body: { user_id: userId, action } });
  if (error) {
    const status = invokeStatus(error);
    if (status === 401 || status === 403) {
      return { data: null, error: "You're not signed in as an admin, or you can't act on this account." };
    }
    return { data: null, error: error.message ?? "The action failed. Try again." };
  }
  return { data: true, error: null };
}

// ---- Map ------------------------------------------------------------------

export async function fetchMapRoots(search: string | null = null): Promise<Result<MapRoot[]>> {
  const { data, error } = await supabase.rpc("admin_map_roots", {
    search: search && search.trim() ? search.trim() : null,
  });
  return { data: (data as MapRoot[]) ?? null, error: toMessage(error) };
}

export async function fetchMapRoutes(): Promise<Result<MapRoute[]>> {
  const { data, error } = await supabase.rpc("admin_map_routes");
  return { data: (data as MapRoute[]) ?? null, error: toMessage(error) };
}

export async function movePin(
  rootId: string,
  lat: number,
  lng: number,
  location?: string
): Promise<Result<PinMoveResult>> {
  const body: Record<string, unknown> = { root_id: rootId, lat, lng };
  if (location !== undefined) body.location = location;
  const { data, error } = await supabase.functions.invoke("admin_move_root_pin", { body });
  if (error) {
    const status = invokeStatus(error);
    if (status === 403) return { data: null, error: "Pin editing is limited to owned (Heritage) accounts." };
    if (status === 401) return { data: null, error: "You're not signed in as an admin, or your session expired." };
    return { data: null, error: error.message ?? "Couldn't move the pin. Try again." };
  }
  return { data: (data as PinMoveResult) ?? null, error: null };
}

export async function updateRootTitle(rootId: string, title: string): Promise<Result<{ title: string }>> {
  const { data, error } = await supabase.functions.invoke("admin_update_root", {
    body: { root_id: rootId, title },
  });
  if (error) {
    const status = invokeStatus(error);
    if (status === 401) return { data: null, error: "You're not signed in as an admin, or your session expired." };
    if (status === 403) return { data: null, error: "Editing is limited to Heritage-owned roots." };
    if (status === 404) return { data: null, error: "That root no longer exists." };
    if (status === 400) return { data: null, error: "Title must be between 1 and 200 characters." };
    return { data: null, error: error.message ?? "Couldn't save the name. Try again." };
  }
  return { data: (data as { title: string }) ?? null, error: null };
}
